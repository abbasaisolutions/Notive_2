from pydantic import BaseModel, Field
from typing import List


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
