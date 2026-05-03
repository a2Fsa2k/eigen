"""
Embeddings — wraps sentence-transformers to produce float32 vectors.
"""
from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(texts: List[str]) -> np.ndarray:
    """Returns shape (N, dim) float32 array."""
    model = get_model()
    return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
