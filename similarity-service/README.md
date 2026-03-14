# Journal Entry Similarity Service

A stateless microservice for retrieving semantically similar journal entries using deep learning embeddings (Sentence Transformers).

## Overview

This service provides **semantic similarity** retrieval for a journaling chatbot. Unlike keyword matching, it understands the **meaning** of text:

- "feeling joyful" matches "I was so happy today" (synonyms)
- "my dog passed away" matches "I lost my beloved pet" (related concepts)
- "got promoted" matches "career advancement" (semantic relationship)

## Features

- **Semantic Embeddings**: Uses Sentence Transformers (all-MiniLM-L6-v2) for meaning-based similarity
- **Deep Understanding**: Captures synonyms, related concepts, and contextual meaning
- **Fast & Efficient**: Pre-normalized embeddings with batch processing support
- **Stateless**: No database required; all data passed in requests
- **Docker Ready**: Includes Dockerfile for containerized deployment

## Tech Stack

- **Python 3.11+**
- **FastAPI** - Web framework
- **Sentence Transformers** - Semantic embeddings
- **PyTorch** - Deep learning backend
- **Pydantic** - Request/response validation

## Installation

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Docker

```bash
# Build the image
docker build -t similarity-service .

# Run the container
docker run -d -p 8001:8001 --name similarity-service similarity-service
```

## API Endpoints

### POST /similarity

Find the most similar journal entries to a query.

**Request:**
```json
{
  "user_id": "user_123",
  "query": "feeling happy about my promotion",
  "top_k": 5,
  "threshold": 0.3,
  "entries": [
    "Today I got promoted at work! So excited!",
    "Had a terrible day, everything went wrong.",
    "Celebrated my career milestone with family.",
    "Went grocery shopping.",
    "Work has been challenging but rewarding lately."
  ]
}
```

Notes:

- `top_k` and `threshold` are optional. If omitted, the service uses its server defaults.
- Default threshold is `0.3` for semantic similarity (higher than TF-IDF since embeddings are more accurate).
- The query can be natural language - the model understands meaning, not just keywords.

**Response:**
```json
{
  "relevant_entries": [
    "Today I got promoted at work! So excited!",
    "Celebrated my career milestone with family.",
    "Work has been challenging but rewarding lately."
  ]
}
```

### POST /similarity/debug

Debug endpoint that returns similarity scores for all entries.

**Response:**
```json
{
  "query": "feeling happy about my promotion",
  "scores": [
    {"entry": "Today I got promoted at work! So excited!", "score": 0.4523},
    {"entry": "Celebrated my career milestone with family.", "score": 0.2134},
    {"entry": "Work has been challenging but rewarding...", "score": 0.1567},
    {"entry": "Had a terrible day, everything went wrong.", "score": 0.0234},
    {"entry": "Went grocery shopping.", "score": 0.0}
  ]
}
```

### GET /health

Health check endpoint for container orchestration.

### GET /docs

Interactive API documentation (Swagger UI).

## Configuration

The service uses the following configurable parameters (in `similarity_service.py`):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SIMILARITY_THRESHOLD` | 0.3 | Minimum similarity score to consider an entry relevant |
| `TOP_K` | 5 | Maximum number of entries to return |
| `MODEL_NAME` | all-MiniLM-L6-v2 | Sentence Transformer model (384 dimensions, fast) |

### Alternative Models

You can use different models by passing `model_name` to the constructor:

- `all-MiniLM-L6-v2` - Fast, good quality (default)
- `all-mpnet-base-v2` - Higher quality, slower
- `paraphrase-multilingual-MiniLM-L12-v2` - Multilingual support

## Algorithm

1. **Text Cleaning**
   - Remove excessive whitespace
   - Clean formatting artifacts

2. **Semantic Embedding**
   - Encode text using Sentence Transformer model
   - Generate 384-dimensional dense vectors
   - Vectors capture semantic meaning, not just keywords

3. **Cosine Similarity**
   - Compute similarity between query embedding and each entry embedding
   - Semantically similar texts have high scores even without word overlap
   - Filter by threshold and return top K

## Integration

This service is designed to be called by a chatbot service:

```python
import httpx

async def get_relevant_entries(user_id: str, query: str, entries: list[str]) -> list[str]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://similarity-service:8001/similarity",
            json={
                "user_id": user_id,
                "query": query,
                "entries": entries
            }
        )
        response.raise_for_status()
        return response.json()["relevant_entries"]
```

## License

MIT
