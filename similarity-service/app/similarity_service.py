import os
from typing import List, Tuple, Optional
import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder

from .text_processor import TextProcessor


class SimilarityService:
    """
    Service for computing SEMANTIC similarity between a query and journal entries
    using Sentence Transformers (deep learning embeddings).
    
    Unlike TF-IDF which only matches exact words, this service captures the 
    MEANING of text. For example:
    - "I felt happy today" will match "I was joyful and excited"
    - "My dog passed away" will match "I lost my pet" 
    - "I got promoted at work" will match "Career success and advancement"
    """

    # Minimum similarity threshold to consider an entry relevant
    # Semantic similarity scores tend to be higher, so we use a higher threshold
    SIMILARITY_THRESHOLD = 0.3
    
    # Maximum number of entries to return
    TOP_K = 5
    
    # Model to use for embeddings
    # Defaulting to BGE gives stronger retrieval quality than the MiniLM baseline.
    MODEL_NAME = os.getenv('MODEL_NAME', 'BAAI/bge-small-en-v1.5')
    RERANKER_MODEL_NAME = os.getenv('RERANKER_MODEL_NAME', 'cross-encoder/ms-marco-MiniLM-L6-v2')
    RERANK_TOP_K = int(os.getenv('RERANK_TOP_K', '10'))
    PAD_TO_DIMS = int(os.getenv('PAD_TO_DIMS', '1536'))
    BGE_QUERY_PREFIX = os.getenv(
        'BGE_QUERY_PREFIX',
        'Represent this sentence for searching relevant passages: '
    )

    def __init__(self, model_name: str = None):
        """
        Initialize the similarity service with a sentence transformer model.
        
        Args:
            model_name: Name of the sentence-transformers model to use.
                       Defaults to 'all-MiniLM-L6-v2' for good speed/quality balance.
        """
        self.text_processor = TextProcessor()
        self.model_name = model_name or self.MODEL_NAME
        self._model: Optional[SentenceTransformer] = None
        self._reranker: Optional[CrossEncoder] = None
    
    @property
    def model(self) -> SentenceTransformer:
        """Lazy load the model to avoid slow startup."""
        if self._model is None:
            print(f"Loading sentence transformer model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
            print("Model loaded successfully!")
        return self._model

    @property
    def reranker(self) -> CrossEncoder:
        """Lazy load the reranker so search still starts fast."""
        if self._reranker is None:
            print(f"Loading local reranker model: {self.RERANKER_MODEL_NAME}")
            self._reranker = CrossEncoder(self.RERANKER_MODEL_NAME)
            print("Reranker loaded successfully!")
        return self._reranker

    def native_embedding_dimensions(self) -> int:
        """Return the model's native embedding dimensionality."""
        return int(self.model.get_sentence_embedding_dimension())

    def cached_native_embedding_dimensions(self) -> Optional[int]:
        """Return dimensions only if the encoder is already loaded."""
        if self._model is None:
            return None
        return int(self._model.get_sentence_embedding_dimension())

    def _prepare_texts(self, texts: List[str], mode: str) -> List[str]:
        cleaned_texts = [self.text_processor.clean_for_embedding(text) for text in texts]
        if mode == 'query' and self.model_name.lower().startswith('baai/bge'):
            return [
                f"{self.BGE_QUERY_PREFIX}{text}" if text else text
                for text in cleaned_texts
            ]
        return cleaned_texts

    def _pad_embeddings(self, embeddings: np.ndarray, pad_to_dims: Optional[int]) -> np.ndarray:
        if not pad_to_dims:
            return embeddings

        if embeddings.ndim != 2:
            return embeddings

        current_dims = embeddings.shape[1]
        if current_dims == pad_to_dims:
            return embeddings
        if current_dims > pad_to_dims:
            raise ValueError(
                f"Requested pad_to={pad_to_dims}, but model returned {current_dims} dimensions."
            )

        pad_width = pad_to_dims - current_dims
        return np.pad(embeddings, ((0, 0), (0, pad_width)), mode='constant')

    def compute_cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Compute cosine similarity between two vectors.
        
        Args:
            vec1: First embedding vector.
            vec2: Second embedding vector.
            
        Returns:
            Cosine similarity score between -1 and 1 (typically 0 to 1 for text).
        """
        # Ensure vectors are 1D
        vec1 = np.asarray(vec1).flatten()
        vec2 = np.asarray(vec2).flatten()
        
        # Handle zero vectors
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        # Cosine similarity = dot product / (norm1 * norm2)
        return float(np.dot(vec1, vec2) / (norm1 * norm2))

    def get_embeddings(
        self,
        texts: List[str],
        mode: str = 'document',
        normalize: bool = True,
        pad_to_dims: Optional[int] = None
    ) -> np.ndarray:
        """
        Get semantic embeddings for a list of texts.
        
        Args:
            texts: List of texts to embed.
            
        Returns:
            2D numpy array of shape (len(texts), embedding_dim)
        """
        if not texts:
            return np.array([])

        prepared_texts = self._prepare_texts(texts, mode)

        if mode == 'query' and hasattr(self.model, 'encode_query'):
            embeddings = self.model.encode_query(
                prepared_texts,
                convert_to_numpy=True,
                normalize_embeddings=normalize,
                show_progress_bar=False
            )
        elif mode == 'document' and hasattr(self.model, 'encode_document'):
            embeddings = self.model.encode_document(
                prepared_texts,
                convert_to_numpy=True,
                normalize_embeddings=normalize,
                show_progress_bar=False
            )
        else:
            embeddings = self.model.encode(
                prepared_texts,
                convert_to_numpy=True,
                normalize_embeddings=normalize,
                show_progress_bar=False
            )

        return self._pad_embeddings(embeddings, pad_to_dims)

    def find_similar_entries(
        self,
        query: str,
        entries: List[str],
        top_k: int = None,
        threshold: float = None
    ) -> List[str]:
        """
        Find the most semantically similar entries to the query.
        
        This uses deep learning embeddings to understand MEANING, not just words.
        For example, "feeling down" will match entries about "sadness" or "depression"
        even if those exact words aren't used.
        
        Args:
            query: The search query (can be natural language).
            entries: List of journal entries to search.
            top_k: Maximum number of entries to return. Defaults to TOP_K.
            threshold: Minimum similarity score. Defaults to SIMILARITY_THRESHOLD.
            
        Returns:
            List of relevant entries sorted by semantic similarity (descending).
        """
        if not query or not entries:
            return []

        top_k = top_k or self.TOP_K
        threshold = threshold or self.SIMILARITY_THRESHOLD

        # Filter out empty/whitespace-only entries
        valid_data = [
            (i, entry) for i, entry in enumerate(entries) 
            if entry and entry.strip()
        ]
        
        if not valid_data or not query.strip():
            return []

        valid_entries = [entry for _, entry in valid_data]
        
        # Get embeddings for query and all entries
        # We embed the query separately to keep the code clear
        query_embedding = self.get_embeddings([query], mode='query')[0]
        entry_embeddings = self.get_embeddings(valid_entries, mode='document')

        # Compute similarities using matrix operations (faster than loop)
        # Since embeddings are normalized, cosine similarity = dot product
        similarities = np.dot(entry_embeddings, query_embedding)

        # Create list of (original_index, similarity_score)
        scored_entries: List[Tuple[int, float]] = []
        for i, (orig_idx, _) in enumerate(valid_data):
            sim_score = float(similarities[i])
            if sim_score >= threshold:
                scored_entries.append((orig_idx, sim_score))

        # Sort by similarity descending
        scored_entries.sort(key=lambda x: x[1], reverse=True)

        # Return top_k entries (original text, not cleaned)
        result = [entries[idx] for idx, _ in scored_entries[:top_k]]
        
        return result

    def get_similarity_scores(
        self,
        query: str,
        entries: List[str]
    ) -> List[Tuple[str, float]]:
        """
        Get semantic similarity scores for all entries (useful for debugging).
        
        Args:
            query: The search query.
            entries: List of journal entries to search.
            
        Returns:
            List of tuples (entry, score) sorted by similarity descending.
        """
        if not query or not entries:
            return []

        # Filter out empty entries
        valid_data = [
            (i, entry) for i, entry in enumerate(entries)
            if entry and entry.strip()
        ]
        
        if not valid_data or not query.strip():
            return []

        valid_entries = [entry for _, entry in valid_data]
        
        # Get embeddings
        query_embedding = self.get_embeddings([query], mode='query')[0]
        entry_embeddings = self.get_embeddings(valid_entries, mode='document')

        # Compute all similarities
        similarities = np.dot(entry_embeddings, query_embedding)

        # Create results with original entries
        results: List[Tuple[str, float]] = []
        for i, (_, orig_entry) in enumerate(valid_data):
            sim_score = round(float(similarities[i]), 4)
            results.append((orig_entry, sim_score))

        # Sort by similarity descending
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results

    def find_similar_entries_batch(
        self,
        queries: List[str],
        entries: List[str],
        top_k: int = None,
        threshold: float = None
    ) -> List[List[str]]:
        """
        Find similar entries for multiple queries at once (more efficient).
        
        Args:
            queries: List of search queries.
            entries: List of journal entries to search.
            top_k: Maximum number of entries to return per query.
            threshold: Minimum similarity score.
            
        Returns:
            List of lists, where each inner list contains relevant entries for the 
            corresponding query.
        """
        if not queries or not entries:
            return [[] for _ in queries] if queries else []

        top_k = top_k or self.TOP_K
        threshold = threshold or self.SIMILARITY_THRESHOLD

        # Filter valid entries
        valid_data = [
            (i, entry) for i, entry in enumerate(entries)
            if entry and entry.strip()
        ]
        
        if not valid_data:
            return [[] for _ in queries]

        valid_entries = [entry for _, entry in valid_data]
        
        # Get all embeddings at once
        query_embeddings = self.get_embeddings(queries, mode='query')
        entry_embeddings = self.get_embeddings(valid_entries, mode='document')

        # Compute similarity matrix: (num_queries, num_entries)
        similarity_matrix = np.dot(query_embeddings, entry_embeddings.T)

        results = []
        for q_idx, query in enumerate(queries):
            if not query or not query.strip():
                results.append([])
                continue
                
            similarities = similarity_matrix[q_idx]
            
            # Get entries above threshold
            scored_entries = [
                (valid_data[i][0], float(similarities[i]))
                for i in range(len(valid_data))
                if similarities[i] >= threshold
            ]
            
            # Sort and get top_k
            scored_entries.sort(key=lambda x: x[1], reverse=True)
            query_results = [entries[idx] for idx, _ in scored_entries[:top_k]]
            results.append(query_results)

        return results

    def rerank_candidates(
        self,
        query: str,
        candidates: List[dict],
        top_k: int = None
    ) -> List[Tuple[str, float]]:
        """
        Rerank a small candidate set with a cross-encoder.

        This is slower but higher quality than dense retrieval alone, so it should
        only be used on a short candidate list returned by a first-stage retriever.
        """
        if not query or not query.strip() or not candidates:
            return []

        top_k = top_k or self.RERANK_TOP_K
        prepared: List[Tuple[str, str]] = []
        ids: List[str] = []

        for candidate in candidates:
            candidate_id = str(candidate.get('id') or '').strip()
            if not candidate_id:
                continue

            title = str(candidate.get('title') or '').strip()
            content = str(candidate.get('content') or '').strip()
            if not content:
                continue

            document = f"{title}\n\n{content}" if title else content
            prepared.append((query.strip(), self.text_processor.clean_for_embedding(document[:3200])))
            ids.append(candidate_id)

        if not prepared:
            return []

        scores = self.reranker.predict(prepared)
        ranked = [
            (ids[index], float(scores[index]))
            for index in range(len(ids))
        ]
        ranked.sort(key=lambda item: item[1], reverse=True)

        return ranked[:top_k]
