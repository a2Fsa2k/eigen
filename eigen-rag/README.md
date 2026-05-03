# eigen-rag

A fully independent RAG (Retrieval-Augmented Generation) pipeline.
Built and tested standalone — integration with eigen PDF viewer comes later.

---

## Stack

| Layer | Tech |
|---|---|
| API | FastAPI |
| PDF parsing | PyMuPDF (`fitz`) |
| Chunking | custom sliding-window (500 chars, 100 overlap) |
| Embeddings | `sentence-transformers` — `all-MiniLM-L6-v2` |
| Vector search | `hnswlib` (in-memory, cosine similarity) |
| LLM | OpenAI-compatible — defaults to **local ollama** |

---

## Project structure

```
eigen-rag/
├── server/
│   ├── main.py                  ← FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example             ← copy to .env and configure
│   ├── api/
│   │   ├── routes/
│   │   │   ├── pdf.py           ← POST /ingest
│   │   │   └── chat.py          ← POST /query
│   │   └── middleware/
│   │       └── logging.py
│   ├── models/
│   │   └── schemas.py           ← Pydantic request/response models
│   ├── pdf/
│   │   ├── parser.py            ← PDF → pages (PyMuPDF)
│   │   └── indexer.py           ← pages → overlapping chunks
│   └── rag/
│       ├── embeddings.py        ← text → float32 vectors
│       ├── retriever.py         ← hnswlib vector store
│       └── generator.py        ← LLM answer generation
└── client/
    └── test_client.js           ← standalone Node.js CLI to test the server
```

---

## Quickstart

### 1. Set up the server

```bash
cd server

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set LLM_BASE_URL / LLM_MODEL / OPENAI_API_KEY

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. (Optional) Start ollama locally

```bash
ollama serve
ollama pull llama3.2
```

### 3. Test the pipeline with the CLI client

```bash
# Health check
node --experimental-vm-modules client/test_client.js status

# Ingest a PDF
node client/test_client.js ingest /path/to/your/document.pdf
# → prints doc_id

# Ask a question
node client/test_client.js query <doc_id> "What is this document about?"
```

---

## API contract

```
GET  /status                                       → { ready, version }
POST /ingest   multipart/form-data  file=<PDF>     → { doc_id, chunk_count, message }
POST /query    application/json                    → { answer, sources[] }
               { doc_id, q, k=5 }
```

Response shape for `/query`:
```json
{
  "answer": "The document discusses...",
  "sources": [
    { "id": "uuid", "text": "...", "page": 3, "score": 0.91 }
  ]
}
```

---

## Swapping the LLM

The generator uses any OpenAI-compatible endpoint. To switch:

| Backend | `.env` settings |
|---|---|
| Local ollama | `LLM_BASE_URL=http://localhost:11434/v1` `LLM_MODEL=llama3.2` |
| OpenAI | `LLM_BASE_URL=https://api.openai.com/v1` `LLM_MODEL=gpt-4o` `OPENAI_API_KEY=sk-...` |
| LM Studio | `LLM_BASE_URL=http://localhost:1234/v1` `LLM_MODEL=<model-name>` |
