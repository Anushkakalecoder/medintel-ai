import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)


def bm25_retrieve(query: str, doc_id: str, top_k: int = 6) -> list[dict]:
    from vector_store import load_bm25_index
    bm25, chunks = load_bm25_index(doc_id)
    if bm25 is None:
        return []
    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)
    top_indices = np.argsort(scores)[::-1][:top_k]
    results = []
    for idx in top_indices:
        if scores[idx] > 0:
            results.append({
                "doc_id": doc_id,
                "chunk_text": chunks[idx],
                "chunk_idx": int(idx),
                "relevance_score": float(min(scores[idx] / (max(scores) + 1e-8), 1.0)),
            })
    return results


def tfidf_retrieve(query: str, doc_id: str, top_k: int = 6) -> list[dict]:
    from vector_store import load_tfidf_index
    from sklearn.metrics.pairwise import cosine_similarity
    vectorizer, matrix, chunks = load_tfidf_index(doc_id)
    if vectorizer is None:
        return []
    try:
        query_vec = vectorizer.transform([query])
        sims = cosine_similarity(query_vec, matrix)[0]
        top_indices = np.argsort(sims)[::-1][:top_k]
        results = []
        for idx in top_indices:
            if sims[idx] > 0:
                results.append({
                    "doc_id": doc_id,
                    "chunk_text": chunks[idx],
                    "chunk_idx": int(idx),
                    "relevance_score": float(sims[idx]),
                })
        return results
    except Exception as e:
        logger.error(f"TF-IDF retrieval error for doc {doc_id}: {e}")
        return []


def hybrid_retrieve(query: str, doc_ids: list[str], top_k: int = 6) -> list[dict]:
    """Hybrid BM25 + TF-IDF retrieval with score fusion."""
    all_results: dict[str, dict] = {}

    for doc_id in doc_ids:
        bm25_results = bm25_retrieve(query, doc_id, top_k=top_k)
        tfidf_results = tfidf_retrieve(query, doc_id, top_k=top_k)

        # Reciprocal rank fusion
        for rank, r in enumerate(bm25_results):
            key = r["chunk_text"][:100]
            if key not in all_results:
                all_results[key] = {**r, "rrf_score": 0.0}
            all_results[key]["rrf_score"] += 1.0 / (60 + rank + 1)

        for rank, r in enumerate(tfidf_results):
            key = r["chunk_text"][:100]
            if key not in all_results:
                all_results[key] = {**r, "rrf_score": 0.0}
            all_results[key]["rrf_score"] += 1.0 / (60 + rank + 1)

    sorted_results = sorted(all_results.values(), key=lambda x: x["rrf_score"], reverse=True)

    # Normalize relevance scores
    if sorted_results:
        max_score = sorted_results[0]["rrf_score"]
        for r in sorted_results:
            r["relevance_score"] = round(r["rrf_score"] / (max_score + 1e-8), 3)

    return sorted_results[:top_k]


def multi_query_retrieve(query: str, doc_ids: list[str], llm, top_k: int = 6) -> list[dict]:
    """Generate sub-queries via LLM, retrieve for each, then fuse results."""
    sub_queries = generate_sub_queries(query, llm)
    logger.info(f"Generated sub-queries: {sub_queries}")

    all_chunks: dict[str, dict] = {}
    for sub_query in [query] + sub_queries[:2]:
        results = hybrid_retrieve(sub_query, doc_ids, top_k=4)
        for r in results:
            key = r["chunk_text"][:100]
            if key not in all_chunks:
                all_chunks[key] = {**r, "combined_score": 0.0}
            all_chunks[key]["combined_score"] += r["relevance_score"]

    sorted_results = sorted(all_chunks.values(), key=lambda x: x["combined_score"], reverse=True)

    if sorted_results:
        max_score = sorted_results[0]["combined_score"]
        for r in sorted_results:
            r["relevance_score"] = round(r["combined_score"] / (max_score + 1e-8), 3)

    return sorted_results[:top_k]


def generate_sub_queries(query: str, llm) -> list[str]:
    prompt = f"""Generate 2 alternative search queries to find information about:
"{query}"

Return only the queries, one per line, no numbering or bullets."""
    try:
        response = llm.invoke(prompt)
        lines = response.content.strip().split("\n")
        return [l.strip() for l in lines if l.strip()][:2]
    except Exception as e:
        logger.warning(f"Sub-query generation failed: {e}")
        return []
