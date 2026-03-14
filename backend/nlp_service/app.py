import os
import re
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI
from pydantic import BaseModel
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import yake

SPACY_MODEL_NAME = os.getenv("SPACY_MODEL", "en_core_web_sm")

try:
    import spacy
    _NLP = spacy.load(SPACY_MODEL_NAME)
    _SPACY_MODEL_LOADED = SPACY_MODEL_NAME
except Exception:
    _NLP = None
    _SPACY_MODEL_LOADED = None

try:
    from transformers import pipeline
except Exception:
    pipeline = None

app = FastAPI(title="Notive NLP Service", version="0.2.0")

_analyzer = SentimentIntensityAnalyzer()
_kw_extractor = yake.KeywordExtractor(lan="en", n=2, top=12)

ADVANCED_MODE_ENABLED = os.getenv("NLP_ENABLE_ADVANCED_MODELS", "false").lower() == "true"
ADVANCED_EVIDENCE_MIN_SCORE = float(os.getenv("NLP_EVIDENCE_MIN_SCORE", "0.45"))
ADVANCED_MAX_SENTENCES = max(4, int(os.getenv("NLP_EVIDENCE_MAX_SENTENCES", "12")))
HF_CACHE_DIR = os.getenv("HF_MODEL_CACHE_DIR")
HF_SENTIMENT_MODEL = os.getenv("NLP_SENTIMENT_MODEL", "cardiffnlp/twitter-roberta-base-sentiment-latest")
HF_EMOTION_MODEL = os.getenv("NLP_EMOTION_MODEL", "j-hartmann/emotion-english-distilroberta-base")
HF_ZERO_SHOT_MODEL = os.getenv("NLP_ZERO_SHOT_MODEL", "facebook/bart-large-mnli")

# Canonical mood categories aligned with app-level tags/mood chips.
EMOTION_CATEGORIES = {
    "happy": ["happy", "joy", "joyful", "excited", "thrilled", "delighted", "cheerful", "elated"],
    "sad": ["sad", "unhappy", "depressed", "miserable", "heartbroken", "gloomy", "grief"],
    "anxious": ["anxious", "worried", "nervous", "stressed", "overwhelmed", "panicked", "uneasy", "fearful"],
    "calm": ["calm", "peaceful", "relaxed", "serene", "tranquil", "grounded", "mindful"],
    "frustrated": ["angry", "furious", "irritated", "frustrated", "annoyed", "rage", "resentful"],
    "grateful": ["grateful", "thankful", "blessed", "appreciative", "fortunate"],
    "motivated": ["motivated", "inspired", "driven", "determined", "ambitious", "focused"],
    "tired": ["tired", "exhausted", "drained", "fatigued", "burned", "sleepy"],
    "thoughtful": ["reflective", "thoughtful", "pondering", "considering", "contemplating"],
}

EMOTION_TOKEN_MAP = {
    keyword: emotion
    for emotion, keywords in EMOTION_CATEGORIES.items()
    for keyword in keywords
}

HF_EMOTION_TO_CANONICAL = {
    "joy": "happy",
    "love": "grateful",
    "optimism": "motivated",
    "surprise": "thoughtful",
    "neutral": "calm",
    "sadness": "sad",
    "anger": "frustrated",
    "annoyance": "frustrated",
    "disappointment": "sad",
    "disapproval": "frustrated",
    "fear": "anxious",
    "nervousness": "anxious",
    "grief": "sad",
    "remorse": "thoughtful",
    "embarrassment": "anxious",
    "confusion": "thoughtful",
    "realization": "thoughtful",
    "admiration": "grateful",
    "approval": "grateful",
    "caring": "grateful",
    "desire": "motivated",
    "curiosity": "thoughtful",
    "excitement": "happy",
    "relief": "calm",
}

NEGATIONS = {"not", "never", "no", "none", "hardly", "barely", "without", "dont", "didnt", "cant", "cannot", "wont"}
INTENSIFIERS = {"very", "really", "extremely", "super", "so", "deeply", "highly"}
DOWNTONERS = {"slightly", "somewhat", "kinda", "kindof", "little", "mildly"}

ACTION_PATTERNS = [
    re.compile(r"\b(i|we)\s+(led|organized|built|created|managed|supported|volunteered|resolved|improved|launched|coordinated|presented|mentored|planned)\b[^.!?]*", re.IGNORECASE),
    re.compile(r"\b(decided to|started|committed to|took initiative to)\b[^.!?]*", re.IGNORECASE),
]
LESSON_PATTERNS = [
    re.compile(r"\b(learned that|realized that|discovered that|lesson learned|takeaway)\b[^.!?]*", re.IGNORECASE),
    re.compile(r"\b(i learned|i realized|i discovered)\b[^.!?]*", re.IGNORECASE),
]
OUTCOME_PATTERNS = [
    re.compile(r"\b(resulted in|led to|which helped|improved|increased|reduced|completed|achieved|received|earned)\b[^.!?]*", re.IGNORECASE),
    re.compile(r"\b(outcome|impact|result)\b[^.!?]*", re.IGNORECASE),
]

EVIDENCE_LABELS = ["situation", "action", "lesson", "outcome"]


class AnalyzeRequest(BaseModel):
    content: str
    title: Optional[str] = None


class Entity(BaseModel):
    text: str
    type: str
    confidence: float = 0.6


class Sentiment(BaseModel):
    score: float
    label: str
    confidence: float
    summary: Optional[str] = None


class EvidencePoint(BaseModel):
    text: str
    confidence: float
    source: str


class Evidence(BaseModel):
    situation: Optional[EvidencePoint] = None
    action: Optional[EvidencePoint] = None
    lesson: Optional[EvidencePoint] = None
    outcome: Optional[EvidencePoint] = None


class AnalyzeResponse(BaseModel):
    sentiment: Sentiment
    entities: List[Entity]
    topics: List[str]
    keywords: List[str]
    suggestedMood: Optional[str]
    wordCount: int
    readingTime: int
    emotions: Optional[Dict[str, float]] = None
    highlights: List[str] = []
    evidence: Optional[Evidence] = None
    modelInfo: Optional[Dict[str, str]] = None


class AdvancedModelSuite:
    def __init__(self) -> None:
        self.sentiment = None
        self.emotion = None
        self.zero_shot = None
        self.model_info: Dict[str, str] = {}

    def enabled(self) -> bool:
        return ADVANCED_MODE_ENABLED and pipeline is not None

    def _pipeline_kwargs(self) -> Dict[str, Any]:
        kwargs: Dict[str, Any] = {}
        if HF_CACHE_DIR:
            kwargs["cache_dir"] = HF_CACHE_DIR
        return kwargs

    def load_sentiment(self):
        if not self.enabled():
            return None
        if self.sentiment is not None:
            return self.sentiment
        try:
            self.sentiment = pipeline("text-classification", model=HF_SENTIMENT_MODEL, **self._pipeline_kwargs())
            self.model_info["sentiment"] = HF_SENTIMENT_MODEL
        except Exception:
            self.sentiment = None
        return self.sentiment

    def load_emotion(self):
        if not self.enabled():
            return None
        if self.emotion is not None:
            return self.emotion
        try:
            self.emotion = pipeline("text-classification", model=HF_EMOTION_MODEL, **self._pipeline_kwargs())
            self.model_info["emotion"] = HF_EMOTION_MODEL
        except Exception:
            self.emotion = None
        return self.emotion

    def load_zero_shot(self):
        if not self.enabled():
            return None
        if self.zero_shot is not None:
            return self.zero_shot
        try:
            self.zero_shot = pipeline("zero-shot-classification", model=HF_ZERO_SHOT_MODEL, **self._pipeline_kwargs())
            self.model_info["zeroShot"] = HF_ZERO_SHOT_MODEL
        except Exception:
            self.zero_shot = None
        return self.zero_shot


_advanced = AdvancedModelSuite()


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def _reading_time(words: int) -> int:
    return max(1, round(words / 200))


def _tokenize(text: str) -> List[str]:
    return re.findall(r"\b[a-z']+\b", text.lower())


def _normalize_classifier_output(result: Any) -> List[Dict[str, Any]]:
    if isinstance(result, list):
        if len(result) == 1 and isinstance(result[0], list):
            return [item for item in result[0] if isinstance(item, dict)]
        return [item for item in result if isinstance(item, dict)]
    if isinstance(result, dict):
        return [result]
    return []


def _map_sentiment_label(raw_label: str) -> str:
    label = raw_label.strip().lower()
    if "neg" in label or label in {"label_0", "0"}:
        return "negative"
    if "neu" in label or label in {"label_1", "1"}:
        return "neutral"
    if "pos" in label or label in {"label_2", "2"}:
        return "positive"
    return "neutral"


def _sentiment_advanced(text: str) -> Optional[Sentiment]:
    model = _advanced.load_sentiment()
    if model is None:
        return None

    try:
        raw = model(text, top_k=None, truncation=True)
        scores = _normalize_classifier_output(raw)
        if not scores:
            return None

        label_scores = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
        for row in scores:
            label = _map_sentiment_label(str(row.get("label", "")))
            score = float(row.get("score", 0.0))
            if score > label_scores[label]:
                label_scores[label] = score

        best_label = max(label_scores, key=label_scores.get)
        confidence = min(1.0, label_scores[best_label])
        signed_score = round(label_scores["positive"] - label_scores["negative"], 3)
        return Sentiment(score=signed_score, label=best_label, confidence=confidence, summary=None)
    except Exception:
        return None


def _sentiment_fallback(text: str) -> Sentiment:
    scores = _analyzer.polarity_scores(text)
    compound = scores.get("compound", 0.0)
    if compound >= 0.2:
        label = "positive"
    elif compound <= -0.2:
        label = "negative"
    else:
        label = "neutral"
    confidence = min(1.0, abs(compound))
    return Sentiment(score=compound, label=label, confidence=confidence, summary=None)


def _extract_keywords(text: str) -> List[str]:
    try:
        kws = _kw_extractor.extract_keywords(text)
    except Exception:
        return []

    cleaned: List[str] = []
    for kw, _score in kws:
        kw_clean = kw.strip().lower()
        if len(kw_clean) < 3:
            continue
        if kw_clean in cleaned:
            continue
        cleaned.append(kw_clean)
    return cleaned


def _extract_entities(text: str) -> List[Entity]:
    entities: List[Entity] = []
    if _NLP is None:
        # Fallback: capitalize sequences
        for match in re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text):
            if match.lower() in [e.text.lower() for e in entities]:
                continue
            entities.append(Entity(text=match, type="thing", confidence=0.4))
        return entities[:8]

    doc = _NLP(text)
    for ent in doc.ents:
        ent_type = "thing"
        if ent.label_ in {"PERSON"}:
            ent_type = "person"
        elif ent.label_ in {"GPE", "LOC", "FAC"}:
            ent_type = "place"
        elif ent.label_ in {"EVENT"}:
            ent_type = "activity"
        elif ent.label_ in {"ORG", "PRODUCT", "WORK_OF_ART"}:
            ent_type = "thing"
        entities.append(Entity(text=ent.text, type=ent_type, confidence=0.7))

    # Deduplicate
    seen = set()
    unique: List[Entity] = []
    for e in entities:
        key = (e.text.lower(), e.type)
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)

    return unique[:8]


def _extract_emotions_fallback(text: str) -> Dict[str, float]:
    tokens = _tokenize(text)
    scores: Dict[str, float] = {}
    for i, token in enumerate(tokens):
        emotion = EMOTION_TOKEN_MAP.get(token)
        if not emotion:
            continue

        prev = tokens[i - 1] if i > 0 else ""
        if prev in NEGATIONS:
            continue

        weight = 1.0
        if prev in INTENSIFIERS:
            weight = 1.4
        elif prev in DOWNTONERS:
            weight = 0.6

        scores[emotion] = scores.get(emotion, 0.0) + weight

    if not scores:
        return {}

    max_score = max(scores.values()) or 1.0
    return {emotion: round(score / max_score, 3) for emotion, score in scores.items()}


def _extract_emotions_advanced(text: str) -> Optional[Dict[str, float]]:
    model = _advanced.load_emotion()
    if model is None:
        return None

    try:
        raw = model(text, top_k=None, truncation=True)
        scores = _normalize_classifier_output(raw)
        if not scores:
            return None

        mapped: Dict[str, float] = {}
        for row in scores:
            label = str(row.get("label", "")).strip().lower()
            canonical = HF_EMOTION_TO_CANONICAL.get(label)
            if not canonical:
                continue
            score = float(row.get("score", 0.0))
            if score > mapped.get(canonical, 0.0):
                mapped[canonical] = score

        if not mapped:
            return None

        max_score = max(mapped.values()) or 1.0
        return {emotion: round(score / max_score, 3) for emotion, score in mapped.items()}
    except Exception:
        return None


def _suggest_mood(sentiment: Sentiment, emotions: Dict[str, float]) -> Optional[str]:
    if emotions:
        sorted_emotions = sorted(emotions.items(), key=lambda x: x[1], reverse=True)
        return sorted_emotions[0][0]
    if sentiment.label == "positive":
        return "happy"
    if sentiment.label == "negative":
        return "sad"
    return "calm"


def _extract_topics(keywords: List[str], entities: List[Entity]) -> List[str]:
    seen = set()
    topics: List[str] = []

    for kw in keywords:
        norm = kw.strip().lower()
        if len(norm) < 3 or norm in seen:
            continue
        seen.add(norm)
        topics.append(norm)

    for ent in entities:
        norm = ent.text.strip().lower()
        if len(norm) < 3 or norm in seen:
            continue
        seen.add(norm)
        topics.append(norm)

    return topics[:5]


def _normalize_sentence(sentence: str) -> str:
    compact = re.sub(r"\s+", " ", sentence or "").strip()
    return compact[:800]


def _split_sentences(text: str) -> List[str]:
    if _NLP is not None:
        try:
            doc = _NLP(text)
            sents = [_normalize_sentence(sent.text) for sent in doc.sents]
            return [s for s in sents if s]
        except Exception:
            pass

    chunks = re.findall(r"[^.!?\n]+[.!?]?", text)
    return [_normalize_sentence(chunk) for chunk in chunks if _normalize_sentence(chunk)]


def _pick_pattern_sentence(sentences: List[str], patterns: List[re.Pattern]) -> Optional[str]:
    for sentence in sentences:
        for pattern in patterns:
            if pattern.search(sentence):
                return sentence
    return None


def _extract_evidence_heuristic(sentences: List[str]) -> Dict[str, EvidencePoint]:
    evidence: Dict[str, EvidencePoint] = {}
    if not sentences:
        return evidence

    evidence["situation"] = EvidencePoint(text=sentences[0], confidence=0.7, source="heuristic")

    action = _pick_pattern_sentence(sentences, ACTION_PATTERNS)
    if action:
        evidence["action"] = EvidencePoint(text=action, confidence=0.68, source="heuristic")

    lesson = _pick_pattern_sentence(sentences, LESSON_PATTERNS)
    if lesson:
        evidence["lesson"] = EvidencePoint(text=lesson, confidence=0.68, source="heuristic")

    outcome = _pick_pattern_sentence(sentences, OUTCOME_PATTERNS)
    if outcome:
        evidence["outcome"] = EvidencePoint(text=outcome, confidence=0.66, source="heuristic")

    return evidence


def _extract_evidence_advanced(sentences: List[str]) -> Dict[str, EvidencePoint]:
    classifier = _advanced.load_zero_shot()
    if classifier is None:
        return {}

    best: Dict[str, Tuple[str, float]] = {}
    for sentence in sentences[:ADVANCED_MAX_SENTENCES]:
        if len(sentence) < 8:
            continue
        try:
            result = classifier(sentence, candidate_labels=EVIDENCE_LABELS, multi_label=True)
        except Exception:
            continue

        labels = result.get("labels") or []
        scores = result.get("scores") or []
        for label, score in zip(labels, scores):
            label_norm = str(label).strip().lower()
            if label_norm not in EVIDENCE_LABELS:
                continue
            score_val = float(score)
            current = best.get(label_norm)
            if current is None or score_val > current[1]:
                best[label_norm] = (sentence, score_val)

    return {
        label: EvidencePoint(text=text, confidence=round(score, 3), source="zero_shot")
        for label, (text, score) in best.items()
        if score >= ADVANCED_EVIDENCE_MIN_SCORE
    }


def _merge_evidence(heuristic: Dict[str, EvidencePoint], advanced: Dict[str, EvidencePoint]) -> Dict[str, EvidencePoint]:
    merged = dict(heuristic)
    for label, point in advanced.items():
        if label not in merged:
            merged[label] = point
            continue
        if point.confidence > merged[label].confidence:
            merged[label] = point
    return merged


def _build_evidence(text: str) -> Dict[str, EvidencePoint]:
    sentences = _split_sentences(text)
    heuristic = _extract_evidence_heuristic(sentences)

    if not ADVANCED_MODE_ENABLED:
        return heuristic

    advanced = _extract_evidence_advanced(sentences)
    return _merge_evidence(heuristic, advanced)


def _build_highlights(
    sentiment: Sentiment,
    emotions: Dict[str, float],
    topics: List[str],
    entities: List[Entity],
    evidence: Dict[str, EvidencePoint],
) -> List[str]:
    highlights: List[str] = []

    if emotions:
        dominant = sorted(emotions.items(), key=lambda x: x[1], reverse=True)[:2]
        labels = ", ".join([item[0] for item in dominant])
        highlights.append(f"Dominant emotions: {labels}.")

    if topics:
        highlights.append(f"Main themes: {', '.join(topics[:3])}.")

    if entities:
        highlights.append(f"Notable references: {', '.join([e.text for e in entities[:3]])}.")

    if "action" in evidence:
        highlights.append("Detected a concrete action signal.")
    elif sentiment.label == "negative":
        highlights.append("Consider adding one concrete next step for tomorrow.")

    return highlights[:4]


def _build_model_info() -> Optional[Dict[str, str]]:
    info: Dict[str, str] = {}
    if _SPACY_MODEL_LOADED:
        info["spacy"] = _SPACY_MODEL_LOADED
    if _advanced.model_info:
        info.update(_advanced.model_info)
    if not info:
        return None
    return info


@lru_cache(maxsize=1)
def _warm_up_models() -> bool:
    if not ADVANCED_MODE_ENABLED:
        return False
    if pipeline is None:
        return False
    # Lazy loaders keep startup fast; this function intentionally does not force model download.
    return True


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest):
    _warm_up_models()
    content = (payload.content or "").strip()
    if len(content) < 5:
        return AnalyzeResponse(
            sentiment=Sentiment(score=0.0, label="neutral", confidence=0.0, summary=None),
            entities=[],
            topics=[],
            keywords=[],
            suggestedMood=None,
            wordCount=_word_count(content),
            readingTime=_reading_time(_word_count(content)),
            emotions=None,
            evidence=None,
            modelInfo=_build_model_info(),
        )

    full_text = f"{payload.title}. {content}" if payload.title else content
    words = _word_count(full_text)

    sentiment = _sentiment_advanced(full_text) or _sentiment_fallback(full_text)
    emotions = _extract_emotions_advanced(full_text) or _extract_emotions_fallback(full_text)
    keywords = _extract_keywords(full_text)
    entities = _extract_entities(full_text)
    topics = _extract_topics(keywords, entities)
    evidence_map = _build_evidence(full_text)
    suggested = _suggest_mood(sentiment, emotions)
    highlights = _build_highlights(sentiment, emotions, topics, entities, evidence_map)

    if suggested:
        sentiment.summary = f"Tone is {sentiment.label}; strongest emotional signal is {suggested}."

    evidence = Evidence(
        situation=evidence_map.get("situation"),
        action=evidence_map.get("action"),
        lesson=evidence_map.get("lesson"),
        outcome=evidence_map.get("outcome"),
    )
    if not any([evidence.situation, evidence.action, evidence.lesson, evidence.outcome]):
        evidence = None

    return AnalyzeResponse(
        sentiment=sentiment,
        entities=entities,
        topics=topics,
        keywords=keywords,
        suggestedMood=suggested,
        wordCount=words,
        readingTime=_reading_time(words),
        emotions=emotions or None,
        highlights=highlights,
        evidence=evidence,
        modelInfo=_build_model_info(),
    )
