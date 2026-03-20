# Retrieval Eval Scaffold

This folder gives Notive a lightweight benchmark scaffold for Sprint 1.

## Dataset format

Use a JSON file with:

- `entries`: `{ id, title?, text }[]`
- `queries`: `{ id, text, relevant: string[] }[]`

The included [notive_retrieval.sample.json](./notive_retrieval.sample.json) is only a starter example. Replace it with real journal-style queries as the benchmark grows.

For a local private dataset based on the current app database, run:

```bash
cd backend
npm run retrieval:build-eval
```

That writes an ignored dataset under `similarity-service/eval/private/` so private notes do not get committed.

To benchmark the live backend retrieval pipeline, including chunked dense retrieval and hybrid reranking:

```bash
cd backend
npm run retrieval:evaluate-pipeline
```

## Run the evaluator

```powershell
.\run-retrieval-eval.ps1
```

Optional direct script usage:

```bash
python scripts/evaluate_retrieval.py --dataset eval/notive_retrieval.sample.json --model sentence-transformers/all-MiniLM-L6-v2 --model BAAI/bge-small-en-v1.5
```

To save a report:

```bash
python scripts/evaluate_retrieval.py --output eval/reports/latest.json
```

## Reported metrics

- `recall@10`
- `mrr@10`
- `ndcg@10`
- `elapsed_seconds`

## Goal

Use this to compare dense-only retrieval against dense-plus-rerank before switching models or thresholds in production.
Use the backend pipeline evaluator when you want to measure the exact shipped retrieval stack instead of encoder-only quality.
