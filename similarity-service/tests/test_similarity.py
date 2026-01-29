import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.similarity_service import SimilarityService
from app.text_processor import TextProcessor


client = TestClient(app)


class TestTextProcessor:
    """Tests for the TextProcessor class."""

    def setup_method(self):
        self.processor = TextProcessor()

    def test_clean_for_embedding_basic(self):
        """Test that text is cleaned for embedding."""
        result = self.processor.clean_for_embedding("Hello   WORLD  ")
        assert result == "Hello WORLD"

    def test_clean_for_embedding_removes_special_chars(self):
        """Test that excessive special characters are removed."""
        result = self.processor.clean_for_embedding("Hello!!! *** world")
        assert "***" not in result
        assert "!!!" not in result

    def test_clean_for_embedding_empty_string(self):
        """Test handling of empty string."""
        result = self.processor.clean_for_embedding("")
        assert result == ""

    def test_clean_for_embedding_batch(self):
        """Test batch cleaning for embedding."""
        texts = ["Hello   World", "Test   String"]
        results = self.processor.clean_for_embedding_batch(texts)
        assert len(results) == 2
        assert results[0] == "Hello World"

    def test_normalize_lowercase(self):
        """Test that text is converted to lowercase (legacy method)."""
        result = self.processor.normalize("Hello WORLD")
        assert result == "hello world"

    def test_normalize_remove_punctuation(self):
        """Test that punctuation is removed (legacy method)."""
        result = self.processor.normalize("Hello, world! How are you?")
        assert "," not in result
        assert "!" not in result
        assert "?" not in result

    def test_normalize_remove_stopwords(self):
        """Test that stopwords are removed (legacy method)."""
        result = self.processor.normalize("I am feeling very happy today")
        assert "i" not in result.split()
        assert "am" not in result.split()
        assert "very" not in result.split()
        assert "happy" in result.split()
        assert "today" in result.split()

    def test_normalize_empty_string(self):
        """Test handling of empty string (legacy method)."""
        result = self.processor.normalize("")
        assert result == ""

    def test_normalize_batch(self):
        """Test batch normalization (legacy method)."""
        texts = ["Hello World", "Test String"]
        results = self.processor.normalize_batch(texts)
        assert len(results) == 2


class TestSimilarityService:
    """Tests for the SimilarityService class with semantic similarity."""

    def setup_method(self):
        self.service = SimilarityService()

    def test_find_similar_entries_basic(self):
        """Test basic similarity search."""
        query = "happy promotion work"
        entries = [
            "I got promoted at work today! So happy!",
            "Had a terrible day at the office.",
            "Career milestone celebration.",
            "Went grocery shopping."
        ]
        
        results = self.service.find_similar_entries(query, entries)
        assert len(results) > 0
        # The entry about promotion should be most relevant
        assert "promoted" in results[0].lower() or "career" in results[0].lower()

    def test_semantic_similarity_synonyms(self):
        """Test that semantic similarity captures synonyms (not just word matching)."""
        query = "feeling joyful and excited"
        entries = [
            "I was so happy today, everything went great!",  # Similar meaning
            "The weather was cloudy and cold.",  # Unrelated
            "Had a wonderful celebration with friends.",  # Similar positive emotion
            "Went to the dentist appointment."  # Unrelated
        ]
        
        results = self.service.find_similar_entries(query, entries, threshold=0.2)
        # Should find entries about happiness/celebration even without exact word match
        assert len(results) > 0
        # The happy entry should rank high even though "joyful" isn't in it
        scores = self.service.get_similarity_scores(query, entries)
        happy_score = next(s for e, s in scores if "happy" in e.lower())
        dentist_score = next(s for e, s in scores if "dentist" in e.lower())
        assert happy_score > dentist_score

    def test_semantic_similarity_related_concepts(self):
        """Test that semantic similarity understands related concepts."""
        query = "my dog passed away"
        entries = [
            "I lost my beloved pet yesterday.",  # Same meaning, different words
            "Went to the dog park today.",  # Has 'dog' but different context
            "Had pizza for dinner.",  # Unrelated
            "Grieving the loss of a family member."  # Related emotion
        ]
        
        scores = self.service.get_similarity_scores(query, entries)
        pet_loss_score = next(s for e, s in scores if "lost my beloved pet" in e.lower())
        dog_park_score = next(s for e, s in scores if "dog park" in e.lower())
        pizza_score = next(s for e, s in scores if "pizza" in e.lower())
        
        # "Lost my pet" should be more similar than "dog park" despite word overlap
        assert pet_loss_score > dog_park_score
        assert pet_loss_score > pizza_score

    def test_find_similar_entries_empty_query(self):
        """Test with empty query."""
        results = self.service.find_similar_entries("", ["entry1", "entry2"])
        assert results == []

    def test_find_similar_entries_empty_entries(self):
        """Test with empty entries list."""
        results = self.service.find_similar_entries("test query", [])
        assert results == []

    def test_find_similar_entries_no_matches(self):
        """Test when no entries are similar."""
        query = "quantum physics theoretical research"
        entries = [
            "Had breakfast this morning.",
            "Went to the gym.",
            "Called mom today."
        ]
        
        results = self.service.find_similar_entries(query, entries, threshold=0.5)
        # Should return empty or low-relevance results with high threshold
        assert isinstance(results, list)

    def test_find_similar_entries_max_results(self):
        """Test that results are limited to top_k."""
        query = "great day"
        entries = [f"Day {i} was great" for i in range(10)]
        
        results = self.service.find_similar_entries(query, entries, top_k=3)
        assert len(results) <= 3

    def test_get_similarity_scores(self):
        """Test getting similarity scores for debugging."""
        query = "happy"
        entries = ["I am happy", "I am sad"]
        
        scores = self.service.get_similarity_scores(query, entries)
        assert len(scores) == 2
        assert all(isinstance(score, float) for _, score in scores)
        # Happy should score higher than sad
        happy_score = next(s for e, s in scores if "happy" in e.lower())
        sad_score = next(s for e, s in scores if "sad" in e.lower())
        assert happy_score > sad_score

    def test_batch_similarity(self):
        """Test batch similarity search."""
        queries = ["happy day", "sad moment"]
        entries = [
            "Today was wonderful and joyful!",
            "Feeling down and depressed.",
            "Went shopping."
        ]
        
        results = self.service.find_similar_entries_batch(queries, entries, threshold=0.2)
        assert len(results) == 2
        assert isinstance(results[0], list)
        assert isinstance(results[1], list)
        assert len(results) <= 3

    def test_get_similarity_scores(self):
        """Test getting similarity scores for debugging."""
        query = "happy"
        entries = ["I am happy", "I am sad"]
        
        scores = self.service.get_similarity_scores(query, entries)
        assert len(scores) == 2
        assert all(isinstance(score, float) for _, score in scores)


class TestAPIEndpoints:
    """Tests for the API endpoints."""

    def test_root_endpoint(self):
        """Test the root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        assert "service" in response.json()

    def test_health_endpoint(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_similarity_endpoint_success(self):
        """Test successful similarity request."""
        request_data = {
            "user_id": "test_user",
            "query": "feeling happy today",
            "entries": [
                "Today was a happy day!",
                "Feeling sad and down.",
                "Great mood this morning."
            ]
        }
        
        response = client.post("/similarity", json=request_data)
        assert response.status_code == 200
        assert "relevant_entries" in response.json()
        assert isinstance(response.json()["relevant_entries"], list)

    def test_similarity_endpoint_empty_query(self):
        """Test similarity endpoint with empty query."""
        request_data = {
            "user_id": "test_user",
            "query": "   ",
            "entries": ["entry1", "entry2"]
        }
        
        response = client.post("/similarity", json=request_data)
        assert response.status_code == 400

    def test_similarity_endpoint_empty_entries(self):
        """Test similarity endpoint with empty entries."""
        request_data = {
            "user_id": "test_user",
            "query": "test query",
            "entries": []
        }
        
        response = client.post("/similarity", json=request_data)
        assert response.status_code == 200
        assert response.json()["relevant_entries"] == []

    def test_debug_endpoint(self):
        """Test the debug endpoint."""
        request_data = {
            "user_id": "test_user",
            "query": "happy day",
            "entries": ["Happy day today!", "Sad day today."]
        }
        
        response = client.post("/similarity/debug", json=request_data)
        assert response.status_code == 200
        assert "scores" in response.json()
        assert "query" in response.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
