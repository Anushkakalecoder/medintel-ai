import os
import pickle
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

VECTOR_STORE_DIR = os.environ.get("VECTOR_STORE_DIR", "/tmp/medintel_vectors")
Path(VECTOR_STORE_DIR).mkdir(parents=True, exist_ok=True)


def build_bm25_index(doc_id: str, chunks: list[str]):
    from rank_bm25 import BM25Okapi
    tokenized = [chunk.lower().split() for chunk in chunks]
    bm25 = BM25Okapi(tokenized)
    path = os.path.join(VECTOR_STORE_DIR, f"{doc_id}_bm25.pkl")
    with open(path, "wb") as f:
        pickle.dump({"bm25": bm25, "chunks": chunks}, f)
    logger.info(f"BM25 index saved for doc {doc_id}")
    return bm25, chunks


def build_tfidf_index(doc_id: str, chunks: list[str]):
    from sklearn.feature_extraction.text import TfidfVectorizer
    vectorizer = TfidfVectorizer(
        max_features=10000,
        stop_words="english",
        ngram_range=(1, 2),
    )
    matrix = vectorizer.fit_transform(chunks)
    path = os.path.join(VECTOR_STORE_DIR, f"{doc_id}_tfidf.pkl")
    with open(path, "wb") as f:
        pickle.dump({"vectorizer": vectorizer, "matrix": matrix, "chunks": chunks}, f)
    logger.info(f"TF-IDF index saved for doc {doc_id}")
    return vectorizer, matrix, chunks


def load_bm25_index(doc_id: str) -> tuple:
    path = os.path.join(VECTOR_STORE_DIR, f"{doc_id}_bm25.pkl")
    if not Path(path).exists():
        return None, None
    with open(path, "rb") as f:
        data = pickle.load(f)
    return data["bm25"], data["chunks"]


def load_tfidf_index(doc_id: str) -> tuple:
    path = os.path.join(VECTOR_STORE_DIR, f"{doc_id}_tfidf.pkl")
    if not Path(path).exists():
        return None, None, None
    with open(path, "rb") as f:
        data = pickle.load(f)
    return data["vectorizer"], data["matrix"], data["chunks"]


def build_index(doc_id: str, chunks: list[str]):
    """Build both BM25 and TF-IDF indexes for a document."""
    build_bm25_index(doc_id, chunks)
    build_tfidf_index(doc_id, chunks)
    logger.info(f"All indexes built for doc {doc_id}")


def delete_index(doc_id: str):
    import shutil
    for suffix in ["_bm25.pkl", "_tfidf.pkl"]:
        path = os.path.join(VECTOR_STORE_DIR, f"{doc_id}{suffix}")
        if Path(path).exists():
            os.remove(path)
    logger.info(f"Indexes deleted for doc {doc_id}")
