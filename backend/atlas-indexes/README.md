# Atlas Vector Search Index

Create this index on your Atlas cluster to enable semantic search over uploaded documents.

## Using Atlas CLI

```bash
atlas deployments search indexes create \
  --clusterName Cluster0 \
  --file atlas-indexes/rag_vector_index.json
```

## Using Atlas UI

1. Go to **Atlas → your cluster → Search → Create Search Index**
2. Choose **JSON Editor**
3. Select database `vc-screener`, collection `doc_chunks`
4. Paste the contents of `rag_vector_index.json`
5. Name the index `rag_vector_index`
6. Click **Create**

Index takes ~1 minute to build. Set `MONGO_VECTOR_SEARCH_ENABLED=true` in `.env` after it's active.

## Local dev (no Atlas)

Leave `MONGO_VECTOR_SEARCH_ENABLED` unset or `false`. The system falls back to keyword search over the `chunkText` text index automatically.
