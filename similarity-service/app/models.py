from pydantic import BaseModel, Field
from typing import List, Literal


class SimilarityRequest(BaseModel):
    """Request model for similarity search."""
    user_id: str = Field(..., description="The user ID")
    query: str = Field(..., description="The search query")
    entries: List[str] = Field(..., description="List of journal entries to search")
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=50,
        description="Maximum number of entries to return (overrides server default)"
    )
    threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity score to include an entry (overrides server default)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "query": "feeling happy about my promotion",
                "top_k": 5,
                "threshold": 0.1,
                "entries": [
                    "Today I got promoted at work! So excited!",
                    "Had a terrible day, everything went wrong.",
                    "Celebrated my career milestone with family."
                ]
            }
        }


class SimilarityResponse(BaseModel):
    """Response model for similarity search."""
    relevant_entries: List[str] = Field(
        default_factory=list,
        description="List of relevant journal entries sorted by similarity"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "relevant_entries": [
                    "Today I got promoted at work! So excited!",
                    "Celebrated my career milestone with family."
                ]
            }
        }


class RerankCandidate(BaseModel):
    """Candidate document for local reranking."""
    id: str = Field(..., description="Candidate identifier")
    title: str | None = Field(default=None, description="Optional entry title")
    content: str = Field(..., description="Candidate content for reranking")


class RerankRequest(BaseModel):
    """Request model for reranking a small candidate set."""
    query: str = Field(..., description="The query or reference note")
    candidates: List[RerankCandidate] = Field(..., description="Candidates to rerank")
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=50,
        description="Maximum number of ranked results to return"
    )


class RerankResult(BaseModel):
    """A reranked candidate with its relevance score."""
    id: str = Field(..., description="Candidate identifier")
    score: float = Field(..., description="Cross-encoder relevance score")


class RerankResponse(BaseModel):
    """Response model for reranking."""
    results: List[RerankResult] = Field(
        default_factory=list,
        description="Candidates sorted by local rerank score"
    )


class EmbedRequest(BaseModel):
    """Request model for local embedding generation."""
    texts: List[str] = Field(..., description="Texts to embed")
    mode: Literal["query", "document"] = Field(
        default="document",
        description="Whether to encode the texts as search queries or documents"
    )
    normalize: bool = Field(
        default=True,
        description="Whether to L2-normalize the output vectors"
    )
    pad_to: int | None = Field(
        default=None,
        ge=1,
        le=4096,
        description="Optional vector length to pad each embedding to"
    )


class EmbedResponse(BaseModel):
    """Response model for embedding generation."""
    model: str = Field(..., description="Embedding model used")
    mode: Literal["query", "document"] = Field(..., description="Encoding mode used")
    dimensions: int = Field(..., description="Returned vector dimensionality")
    native_dimensions: int = Field(..., description="Native model dimensionality before optional padding")
    embeddings: List[List[float]] = Field(default_factory=list, description="Dense vectors")
