import re
import string
from typing import List

# NLTK stopwords - included inline to avoid download dependency
ENGLISH_STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're",
    "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'yourselves', 'he',
    'him', 'his', 'himself', 'she', "she's", 'her', 'hers', 'herself', 'it', "it's",
    'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do',
    'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because',
    'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against',
    'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will',
    'just', 'don', "don't", 'should', "should've", 'now', 'd', 'll', 'm', 'o', 're',
    've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't", 'didn', "didn't",
    'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't",
    'isn', "isn't", 'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn',
    "needn't", 'shan', "shan't", 'shouldn', "shouldn't", 'wasn', "wasn't", 'weren',
    "weren't", 'won', "won't", 'wouldn', "wouldn't"
}


class TextProcessor:
    """Handles text normalization and preprocessing."""

    def __init__(self, stopwords: set = None):
        """
        Initialize the text processor.
        
        Args:
            stopwords: Set of stopwords to remove. Uses English stopwords by default.
        """
        self.stopwords = stopwords or ENGLISH_STOPWORDS
        # Create translation table for removing punctuation
        self.punct_table = str.maketrans('', '', string.punctuation)

    def clean_for_embedding(self, text: str) -> str:
        """
        Light cleaning for semantic embedding models.
        
        Unlike TF-IDF which needs heavy preprocessing, transformer models like
        Sentence-BERT understand context and should receive more natural text.
        We only do minimal cleaning here.
        
        Args:
            text: The input text to clean.
            
        Returns:
            Lightly cleaned text suitable for embedding.
        """
        if not text:
            return ""
        
        # Remove excessive whitespace and newlines
        text = ' '.join(text.split())
        
        # Remove very long sequences of special characters (likely formatting artifacts)
        text = re.sub(r'[^\w\s]{3,}', ' ', text)
        
        # Collapse multiple spaces
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()

    def clean_for_embedding_batch(self, texts: List[str]) -> List[str]:
        """
        Light cleaning for a batch of texts for embedding.
        
        Args:
            texts: List of texts to clean.
            
        Returns:
            List of cleaned texts.
        """
        return [self.clean_for_embedding(text) for text in texts]

    def normalize(self, text: str) -> str:
        """
        Normalize text by:
        1. Converting to lowercase
        2. Removing punctuation
        3. Removing stopwords
        4. Removing extra whitespace
        
        Note: This is kept for backward compatibility but is NOT used
        for semantic similarity. Use clean_for_embedding() instead.
        
        Args:
            text: The input text to normalize.
            
        Returns:
            Normalized text string.
        """
        if not text:
            return ""

        # Convert to lowercase
        text = text.lower()

        # Remove punctuation
        text = text.translate(self.punct_table)

        # Remove extra whitespace and split into words
        words = text.split()

        # Remove stopwords
        words = [word for word in words if word not in self.stopwords]

        # Join back into string
        return ' '.join(words)

    def normalize_batch(self, texts: List[str]) -> List[str]:
        """
        Normalize a batch of texts.
        
        Note: This is kept for backward compatibility but is NOT used
        for semantic similarity. Use clean_for_embedding_batch() instead.
        
        Args:
            texts: List of texts to normalize.
            
        Returns:
            List of normalized texts.
        """
        return [self.normalize(text) for text in texts]
