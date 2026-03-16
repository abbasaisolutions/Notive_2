import argparse
import json
import time
from pathlib import Path
from typing import Dict, List, Sequence

import numpy as np
from sentence_transformers import CrossEncoder, SentenceTransformer


def recall_at_k(ranked_ids: Sequence[str], relevant_ids: Sequence[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    top_ids = set(ranked_ids[:k])
    return 1.0 if any(relevant_id in top_ids for relevant_id in relevant_ids) else 0.0


def mrr_at_k(ranked_ids: Sequence[str], relevant_ids: Sequence[str], k: int) -> float:
    relevant = set(relevant_ids)
    for index, entry_id in enumerate(ranked_ids[:k], start=1):
        if entry_id in relevant:
            return 1.0 / index
    return 0.0


def ndcg_at_k(ranked_ids: Sequence[str], relevant_ids: Sequence[str], k: int) -> float:
    relevant = set(relevant_ids)
    if not relevant:
        return 0.0

    dcg = 0.0
    for index, entry_id in enumerate(ranked_ids[:k], start=1):
        if entry_id in relevant:
            dcg += 1.0 / np.log2(index + 1)

    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / np.log2(index + 1) for index in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0


def build_documents(entries: List[Dict[str, str]]) -> Dict[str, str]:
    return {
        entry["id"]: (
            f"{entry.get('title', '').strip()}\n\n{entry.get('text', '').strip()}".strip()
        )
        for entry in entries
    }


def encode_documents(model: SentenceTransformer, texts: List[str]) -> np.ndarray:
    if hasattr(model, "encode_document"):
        return model.encode_document(texts, convert_to_numpy=True, normalize_embeddings=True)
    return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)


def encode_queries(model: SentenceTransformer, texts: List[str]) -> np.ndarray:
    if hasattr(model, "encode_query"):
        return model.encode_query(texts, convert_to_numpy=True, normalize_embeddings=True)
    return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)


def rank_with_dense(model_name: str, documents: Dict[str, str], queries: List[Dict[str, object]]) -> Dict[str, List[str]]:
    model = SentenceTransformer(model_name)
    entry_ids = list(documents.keys())
    entry_texts = [documents[entry_id] for entry_id in entry_ids]
    entry_embeddings = encode_documents(model, entry_texts)

    ranked: Dict[str, List[str]] = {}
    for query in queries:
        query_id = str(query["id"])
        query_embedding = encode_queries(model, [str(query["text"])])[0]
        scores = np.dot(entry_embeddings, query_embedding)
        ordered_ids = [
            entry_ids[index]
            for index in np.argsort(-scores)
        ]
        ranked[query_id] = ordered_ids

    return ranked


def apply_rerank(
    reranker_name: str,
    documents: Dict[str, str],
    queries: List[Dict[str, object]],
    dense_ranked: Dict[str, List[str]],
    top_k: int,
) -> Dict[str, List[str]]:
    reranker = CrossEncoder(reranker_name)
    reranked: Dict[str, List[str]] = {}

    for query in queries:
        query_id = str(query["id"])
        query_text = str(query["text"])
        candidates = dense_ranked.get(query_id, [])[:top_k]
        pairs = [(query_text, documents[candidate_id]) for candidate_id in candidates]
        if not pairs:
            reranked[query_id] = []
            continue

        scores = reranker.predict(pairs)
        ranked_pairs = sorted(
            zip(candidates, scores),
            key=lambda item: float(item[1]),
            reverse=True,
        )
        reranked[query_id] = [candidate_id for candidate_id, _ in ranked_pairs]

    return reranked


def summarize_metrics(queries: List[Dict[str, object]], ranked: Dict[str, List[str]], label: str) -> Dict[str, float]:
    recalls = []
    mrrs = []
    ndcgs = []

    for query in queries:
        query_id = str(query["id"])
        relevant_ids = [str(entry_id) for entry_id in query.get("relevant", [])]
        ranked_ids = ranked.get(query_id, [])

        recalls.append(recall_at_k(ranked_ids, relevant_ids, 10))
        mrrs.append(mrr_at_k(ranked_ids, relevant_ids, 10))
        ndcgs.append(ndcg_at_k(ranked_ids, relevant_ids, 10))

    return {
        "label": label,
        "recall@10": round(float(np.mean(recalls)) if recalls else 0.0, 4),
        "mrr@10": round(float(np.mean(mrrs)) if mrrs else 0.0, 4),
        "ndcg@10": round(float(np.mean(ndcgs)) if ndcgs else 0.0, 4),
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate local retrieval models against a small labeled dataset.")
    parser.add_argument(
        "--dataset",
        default=str(Path(__file__).resolve().parents[1] / "eval" / "notive_retrieval.sample.json"),
        help="Path to the labeled retrieval dataset JSON file.",
    )
    parser.add_argument(
        "--model",
        action="append",
        dest="models",
        help="SentenceTransformer model to evaluate. Can be passed multiple times.",
    )
    parser.add_argument(
        "--reranker",
        default="cross-encoder/ms-marco-MiniLM-L6-v2",
        help="Optional reranker model to evaluate on the top dense candidates.",
    )
    parser.add_argument(
        "--rerank-top-k",
        type=int,
        default=20,
        help="How many dense candidates to rerank per query.",
    )
    parser.add_argument(
        "--output",
        help="Optional path to write the evaluation summary as JSON.",
    )

    args = parser.parse_args()
    dataset_path = Path(args.dataset).resolve()
    payload = json.loads(dataset_path.read_text(encoding="utf-8"))
    entries = payload.get("entries", [])
    queries = payload.get("queries", [])

    if not entries or not queries:
        raise SystemExit("Dataset must include non-empty 'entries' and 'queries'.")

    documents = build_documents(entries)
    models = args.models or [
        "sentence-transformers/all-MiniLM-L6-v2",
        "BAAI/bge-small-en-v1.5",
    ]

    summaries = []
    for model_name in models:
        dense_start = time.perf_counter()
        dense_ranked = rank_with_dense(model_name, documents, queries)
        dense_elapsed = time.perf_counter() - dense_start
        dense_summary = summarize_metrics(queries, dense_ranked, f"dense::{model_name}")
        dense_summary["elapsed_seconds"] = round(dense_elapsed, 4)
        summaries.append(dense_summary)

        if args.reranker:
            rerank_start = time.perf_counter()
            reranked = apply_rerank(
                reranker_name=args.reranker,
                documents=documents,
                queries=queries,
                dense_ranked=dense_ranked,
                top_k=max(1, args.rerank_top_k),
            )
            rerank_elapsed = time.perf_counter() - rerank_start
            rerank_summary = summarize_metrics(
                queries,
                reranked,
                f"dense+rerank::{model_name}::{args.reranker}",
            )
            rerank_summary["elapsed_seconds"] = round(rerank_elapsed, 4)
            summaries.append(rerank_summary)

    print(f"Dataset: {dataset_path}")
    for summary in summaries:
        print(
            f"{summary['label']}\n"
            f"  recall@10={summary['recall@10']}\n"
            f"  mrr@10={summary['mrr@10']}\n"
            f"  ndcg@10={summary['ndcg@10']}\n"
            f"  elapsed_seconds={summary['elapsed_seconds']}"
        )

    if args.output:
        output_path = Path(args.output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(
                {
                    "dataset": str(dataset_path),
                    "query_count": len(queries),
                    "entry_count": len(entries),
                    "summaries": summaries,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"Saved report: {output_path}")


if __name__ == "__main__":
    main()
