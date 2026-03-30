import base64
import os
import tempfile
from functools import lru_cache
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover
    WhisperModel = None  # type: ignore[assignment]


APP_NAME = "Notive STT Service"
MODEL_SIZE = os.getenv("STT_MODEL_SIZE", "large-v3-turbo")
DEVICE = os.getenv("STT_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("STT_COMPUTE_TYPE", "int8")
BEAM_SIZE = int(os.getenv("STT_BEAM_SIZE", "5"))
BEST_OF = int(os.getenv("STT_BEST_OF", "5"))
VAD_FILTER = os.getenv("STT_VAD_FILTER", "true").lower() != "false"
WORD_TIMESTAMPS = os.getenv("STT_WORD_TIMESTAMPS", "true").lower() != "false"
LOW_CONFIDENCE_WORD_THRESHOLD = float(os.getenv("STT_LOW_CONFIDENCE_WORD_THRESHOLD", "0.45"))
LOW_CONFIDENCE_SEGMENT_THRESHOLD = float(os.getenv("STT_LOW_CONFIDENCE_SEGMENT_THRESHOLD", "-0.8"))


class LexiconHint(BaseModel):
    canonical: str
    aliases: list[str] = Field(default_factory=list)
    locale: Optional[str] = None
    itemType: Optional[str] = None
    boost: float = 0.6


class TranscribeRequest(BaseModel):
    audioBase64: str
    fileName: str = "voice-note.webm"
    mimeType: str = "audio/webm"
    languageMode: str = "auto"
    candidateLanguages: list[str] = Field(default_factory=list)
    hintText: Optional[str] = None
    entryContext: Optional[str] = None
    lexiconHints: list[LexiconHint] = Field(default_factory=list)
    captureMeta: Optional[dict[str, Any]] = None


class TranscribeResponse(BaseModel):
    text: str
    cleanText: str
    detectedLanguage: Optional[str] = None
    model: str
    confidenceOverall: Optional[float] = None
    lowConfidenceSpans: list[dict[str, Any]] = Field(default_factory=list)


app = FastAPI(title=APP_NAME, version="0.1.0")


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    if WhisperModel is None:  # pragma: no cover
        raise RuntimeError("faster-whisper is not installed in this environment.")

    return WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)


def normalize_text(value: Optional[str], max_length: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.split())
    if not normalized:
        return None
    return normalized[:max_length]


def build_hotwords(lexicon_hints: list[LexiconHint]) -> str:
    terms: list[str] = []
    seen: set[str] = set()
    for hint in lexicon_hints:
        for term in [hint.canonical, *hint.aliases]:
            normalized = normalize_text(term, 80)
            if normalized and normalized.lower() not in seen:
                seen.add(normalized.lower())
                terms.append(normalized)
    return ", ".join(terms[:24])


def build_initial_prompt(request: TranscribeRequest) -> Optional[str]:
    parts: list[str] = []
    candidate_languages = [lang for lang in request.candidateLanguages if normalize_text(lang, 12)]
    hotwords = build_hotwords(request.lexiconHints)

    if request.hintText:
        parts.append(normalize_text(request.hintText, 220) or "")
    if request.entryContext:
        parts.append(normalize_text(request.entryContext, 220) or "")
    if candidate_languages:
        parts.append(f"Possible languages: {', '.join(candidate_languages)}.")
    if hotwords:
        parts.append(f"Preserve exact spellings for: {hotwords}.")

    merged = " | ".join(part for part in parts if part)
    return merged or None


def decode_audio_base64(value: str) -> bytes:
    try:
        return base64.b64decode(value)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail=f"Invalid audio payload: {exc}") from exc


def resolve_language_candidates(request: TranscribeRequest) -> list[Optional[str]]:
    explicit = normalize_text(request.languageMode, 20)
    if explicit and explicit not in {"auto", "other"} and "-" not in explicit:
        return [explicit]

    candidates = [
        normalize_text(language, 12)
        for language in request.candidateLanguages
    ]
    normalized = [language for language in candidates if language]

    if not normalized:
        return [None]

    return [None, *normalized[:2]]


def score_segments(segments: list[Any], info: Any) -> float:
    avg_logprobs = [
        float(getattr(segment, "avg_logprob", 0.0))
        for segment in segments
        if getattr(segment, "avg_logprob", None) is not None
    ]

    if avg_logprobs:
        return sum(avg_logprobs) / len(avg_logprobs)

    probability = float(getattr(info, "language_probability", 0.0) or 0.0)
    return probability - 1.0


def build_low_confidence_spans(segments: list[Any]) -> list[dict[str, Any]]:
    spans: list[dict[str, Any]] = []

    for segment in segments:
        words = getattr(segment, "words", None) or []
        if words:
            for word in words:
                probability = float(getattr(word, "probability", 1.0) or 1.0)
                if probability < LOW_CONFIDENCE_WORD_THRESHOLD:
                    spans.append({
                        "start": float(getattr(word, "start", 0.0) or 0.0),
                        "end": float(getattr(word, "end", getattr(word, "start", 0.0)) or 0.0),
                        "text": str(getattr(word, "word", "")).strip(),
                    })
        elif float(getattr(segment, "avg_logprob", 0.0) or 0.0) < LOW_CONFIDENCE_SEGMENT_THRESHOLD:
            spans.append({
                "start": float(getattr(segment, "start", 0.0) or 0.0),
                "end": float(getattr(segment, "end", getattr(segment, "start", 0.0)) or 0.0),
                "text": str(getattr(segment, "text", "")).strip(),
            })

    return [span for span in spans if span["text"]]


def transcribe_with_candidates(temp_path: str, request: TranscribeRequest) -> TranscribeResponse:
    model = get_model()
    language_candidates = resolve_language_candidates(request)
    hotwords = build_hotwords(request.lexiconHints) or None
    initial_prompt = build_initial_prompt(request)

    best_result: Optional[TranscribeResponse] = None
    best_score = float("-inf")

    for language in language_candidates:
        segment_iterator, info = model.transcribe(
            temp_path,
            language=language,
            beam_size=BEAM_SIZE,
            best_of=BEST_OF,
            vad_filter=VAD_FILTER,
            word_timestamps=WORD_TIMESTAMPS,
            condition_on_previous_text=True,
            initial_prompt=initial_prompt,
            hotwords=hotwords,
        )

        segments = list(segment_iterator)
        transcript = " ".join(str(getattr(segment, "text", "")).strip() for segment in segments).strip()
        if not transcript:
            continue

        score = score_segments(segments, info)
        avg_logprobs = [
            float(getattr(segment, "avg_logprob", 0.0))
            for segment in segments
            if getattr(segment, "avg_logprob", None) is not None
        ]
        confidence = None
        if avg_logprobs:
            mean_logprob = sum(avg_logprobs) / len(avg_logprobs)
            confidence = max(0.0, min(1.0, pow(2.718281828, mean_logprob)))

        candidate = TranscribeResponse(
            text=transcript,
            cleanText=transcript,
            detectedLanguage=str(getattr(info, "language", "") or language or ""),
            model=MODEL_SIZE,
            confidenceOverall=confidence,
            lowConfidenceSpans=build_low_confidence_spans(segments),
        )

        if score > best_score:
            best_score = score
            best_result = candidate

    if not best_result:
        raise HTTPException(status_code=422, detail="No transcript returned for this recording.")

    return best_result


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "vad_filter": VAD_FILTER,
    }


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(request: TranscribeRequest) -> TranscribeResponse:
    audio_bytes = decode_audio_base64(request.audioBase64)
    suffix = os.path.splitext(request.fileName)[1] or ".webm"

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
            handle.write(audio_bytes)
            temp_path = handle.name

        return transcribe_with_candidates(temp_path, request)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
