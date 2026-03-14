# Notive NLP Service

Hybrid NLP service for sentiment, entities, keywords, mood, and evidence extraction (`situation`, `action`, `lesson`, `outcome`).

## Setup

1. Create a virtual environment and install deps:

```bash
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Download the spaCy model (optional but recommended):

```bash
python -m spacy download en_core_web_sm
# Optional advanced spaCy transformer model:
# python -m spacy download en_core_web_trf
```

3. Run the service:

```bash
uvicorn app:app --host 0.0.0.0 --port 8001
```

## Advanced Models (Optional)

The service supports transformer-based inference for higher quality extraction.

Install advanced dependencies:

```bash
pip install -r requirements-advanced.txt
```

Enable advanced mode:

```bash
export NLP_ENABLE_ADVANCED_MODELS=true
# Windows PowerShell:
# $env:NLP_ENABLE_ADVANCED_MODELS = "true"
```

Optional model overrides:

- `SPACY_MODEL` (default: `en_core_web_sm`, optional: `en_core_web_trf`)
- `NLP_SENTIMENT_MODEL` (default: `cardiffnlp/twitter-roberta-base-sentiment-latest`)
- `NLP_EMOTION_MODEL` (default: `j-hartmann/emotion-english-distilroberta-base`)
- `NLP_ZERO_SHOT_MODEL` (default: `facebook/bart-large-mnli`)
- `NLP_EVIDENCE_MIN_SCORE` (default: `0.45`)
- `NLP_EVIDENCE_MAX_SENTENCES` (default: `12`)
- `HF_MODEL_CACHE_DIR` (optional cache path)

## Environment

- `NLP_SERVICE_URL` in the backend should point to this service, e.g. `http://localhost:8001`.
- `NLP_ENABLE_ADVANCED_MODELS=true` enables transformer pipelines when dependencies are installed.

## Endpoints

- `POST /analyze`

Request body:

```json
{ "content": "...", "title": "..." }
```

Response includes sentiment, entities, topics, keywords, suggested mood, highlights, and extracted evidence (`situation/action/lesson/outcome`).
