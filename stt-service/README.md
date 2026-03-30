# Notive STT Service

Self-hosted Faster-Whisper sidecar for Notive voice transcription jobs.

## What it does

- Accepts audio from the backend as base64 JSON
- Runs local multilingual transcription with `faster-whisper`
- Supports candidate language routing for mixed-language sessions
- Uses prompt and hotword biasing for names, places, and user lexicon hints
- Returns low-confidence spans so the frontend can ask for review when needed

## Local run

```bash
cd stt-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Docker

```bash
docker build -t notive-stt-service ./stt-service
docker run -p 8003:8001 notive-stt-service
```

## Backend env

Point the backend at this service with:

```bash
VOICE_BACKEND_PROVIDER=faster_whisper
VOICE_LOCAL_SERVICE_URL=http://localhost:8003
```

If `VOICE_BACKEND_PROVIDER` is unset, the backend will automatically prefer the local provider when `VOICE_LOCAL_SERVICE_URL` is configured.
