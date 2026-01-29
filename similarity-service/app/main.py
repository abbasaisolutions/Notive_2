from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import time

from .models import SimilarityRequest, SimilarityResponse
from .similarity_service import SimilarityService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Journal Entry Similarity Service",
    description="A stateless microservice for retrieving similar journal entries using semantic embeddings (Sentence Transformers). Unlike keyword matching, this service understands the MEANING of text.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize similarity service
similarity_service = SimilarityService()


@app.get("/")
async def root():
    """Root endpoint returning service info."""
    return {
        "service": "Journal Entry Similarity Service",
        "version": "1.0.0",
        "status": "healthy"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration."""
    return {"status": "healthy"}


@app.post("/similarity", response_model=SimilarityResponse)
async def find_similar_entries(request: SimilarityRequest) -> SimilarityResponse:
    """
    Find journal entries most semantically similar to the query.
    
    This endpoint uses deep learning embeddings (Sentence Transformers) to find
    entries that match the MEANING of the query, not just keywords. For example:
    - "feeling happy" will match "I was joyful and excited"
    - "my pet died" will match "lost my beloved dog"
    
    - **user_id**: User identifier (for logging/tracking)
    - **query**: The search query text (natural language)
    - **entries**: List of journal entry texts to search
    
    Returns the top 5 most semantically similar entries with similarity score >= 0.3
    """
    start_time = time.time()
    
    logger.info(f"Received similarity request for user: {request.user_id}")
    logger.info(f"Query: '{request.query[:100]}...' with {len(request.entries)} entries")

    # Validate request
    if not request.query.strip():
        raise HTTPException(
            status_code=400,
            detail="Query cannot be empty"
        )

    if not request.entries:
        return SimilarityResponse(relevant_entries=[])

    # Filter out empty entries
    valid_entries = [e for e in request.entries if e and e.strip()]
    
    if not valid_entries:
        return SimilarityResponse(relevant_entries=[])

    try:
        # Find similar entries
        relevant_entries = similarity_service.find_similar_entries(
            query=request.query,
            entries=valid_entries,
            top_k=request.top_k,
            threshold=request.threshold,
        )
        
        elapsed_time = time.time() - start_time
        logger.info(
            f"Found {len(relevant_entries)} relevant entries "
            f"for user {request.user_id} in {elapsed_time:.3f}s"
        )

        return SimilarityResponse(relevant_entries=relevant_entries)

    except Exception as e:
        logger.error(f"Error processing similarity request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while processing similarity request"
        )


@app.post("/similarity/debug")
async def debug_similarity(request: SimilarityRequest):
    """
    Debug endpoint that returns similarity scores for all entries.
    Useful for testing and tuning the similarity threshold.
    """
    if not request.query.strip() or not request.entries:
        return {"scores": []}

    valid_entries = [e for e in request.entries if e and e.strip()]
    
    scores = similarity_service.get_similarity_scores(
        query=request.query,
        entries=valid_entries
    )
    
    return {
        "query": request.query,
        "top_k": request.top_k,
        "threshold": request.threshold,
        "scores": [
            {"entry": entry[:100] + "..." if len(entry) > 100 else entry, "score": score}
            for entry, score in scores
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
