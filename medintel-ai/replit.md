# MedIntel AI

A production-grade Multi-Agent Clinical Intelligence Platform for querying, analyzing, and extracting insights from clinical and regulatory documents.

## Run & Operate

- `artifacts/api-server: API Server` workflow — Python FastAPI backend (port 8080)
- `artifacts/medintel: web` workflow — React/Vite frontend (port 22027)
- API available at `/api`, frontend at `/`

## Stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS (dark navy/cyan theme), TanStack Query, Wouter routing, Recharts
- **Backend**: Python 3.12, FastAPI, LangGraph multi-agent pipeline, Groq LLM (llama-3.3-70b-versatile)
- **Retrieval**: Hybrid BM25 + TF-IDF with Reciprocal Rank Fusion (no GPU needed)
- **DB**: PostgreSQL via SQLAlchemy (Replit Postgres)
- **API Codegen**: Orval from OpenAPI spec in `lib/api-spec/openapi.yaml`

## Where things live

- `artifacts/api-server/python/` — FastAPI backend
  - `main.py` — app entry point
  - `agents.py` — LangGraph pipeline (Classify → Retrieve → Verify → Cite → Respond)
  - `retrieval.py` — hybrid BM25 + TF-IDF retrieval with RRF fusion
  - `vector_store.py` — index building/loading (BM25 + scikit-learn TF-IDF)
  - `document_processor.py` — PDF/DOCX/TXT extraction + chunking
  - `routes/` — upload, chat, documents, analytics endpoints
- `artifacts/medintel/src/` — React frontend
  - `pages/` — Dashboard, Chat, Documents, Analytics, NotFound
  - `components/layout/` — Sidebar, AppLayout
- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/` — generated React Query hooks (run codegen to regenerate)

## Architecture decisions

- **BM25 + TF-IDF instead of FAISS/sentence-transformers** — avoids heavy ML dependencies that conflict with Replit's firewall; Reciprocal Rank Fusion still gives strong hybrid retrieval
- **LangGraph pipeline** — 5-node graph: Query Classification → Retrieval → Verification → Citation → Response; each node is an independent agent
- **FastAPI with `root_path="/api"`** — all routes work under the `/api` proxy prefix automatically
- **Groq LLM (llama-3.3-70b-versatile)** — fast inference, clinical reasoning, sub-second latency
- **Orval codegen** — OpenAPI → TypeScript hooks; never write API calls by hand

## Product

- **Dashboard**: Live metrics (documents, queries, latency, confidence) + recent query history
- **Chat**: Multi-agent RAG chat with source citations, confidence scoring, and intent classification
- **Documents**: Drag-and-drop upload (PDF, DOCX, TXT), status tracking, deletion
- **Analytics**: Charts for query volume, confidence trends, latency, and intent distribution

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `sentence-transformers` and `faiss-cpu` are blocked by Replit's package firewall — use BM25 + scikit-learn TF-IDF instead
- `python-jose` is also blocked by the firewall — removed from requirements
- The api-server workflow does `pip install` on startup — changes to requirements.txt take effect on next workflow restart
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
