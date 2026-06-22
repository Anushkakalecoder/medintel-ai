# medintel-ai
A lanchain project
MedIntel AI — Detailed Project Description & Architecture
What It Is
MedIntel AI is a production-grade Multi-Agent Clinical Intelligence Platform that lets medical, regulatory, and clinical professionals upload documents (FDA guidance, clinical trial protocols, ICF documents, SDTM files) and query them using natural language. The system doesn't just search — it runs every question through a 5-stage AI pipeline that classifies intent, retrieves relevant context, verifies confidence, formats citations, and generates a grounded clinical response.

High-Level Architecture
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                       │
│          React + Vite SPA  (dark navy/cyan theme)       │
│   Dashboard │ Chat │ Documents │ Analytics              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS  /api/*
┌──────────────────────▼──────────────────────────────────┐
│              Replit Reverse Proxy (port 80)             │
│         Routes /api → FastAPI,  / → React               │
└────────────┬────────────────────────┬───────────────────┘
             │                        │
┌────────────▼──────────┐  ┌──────────▼──────────────────┐
│  Python FastAPI        │  │  React + Vite (port 22027)  │
│  (port 8080)           │  │  Static SPA served by Vite  │
│                        │  │  TanStack Query for caching  │
│  LangGraph Pipeline    │  │  Wouter for routing          │
│  PostgreSQL via        │  │  Recharts for analytics      │
│  SQLAlchemy            │  │  Generated API hooks (Orval) │
└────────────────────────┘  └─────────────────────────────┘

Backend — Python FastAPI + LangGraph
Entry Point: main.py
FastAPI application with root_path="/api" so all routes automatically work under the /api proxy prefix. Database is initialized on startup via SQLAlchemy.

The 5-Node LangGraph Multi-Agent Pipeline (agents.py)
Every chat query flows through this directed graph in sequence:

Question
   │
   ▼
┌──────────────────────┐
│  Node 1: CLASSIFY    │  Groq LLM classifies intent into:
│                      │  search / compare / summarize / compliance
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Node 2: RETRIEVE    │  Hybrid BM25 + TF-IDF retrieval
│                      │  with Reciprocal Rank Fusion
│                      │  across all user-uploaded documents
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Node 3: VERIFY      │  Groq LLM scores confidence (0.0–1.0)
│                      │  "Does this context actually answer
│                      │   the question?"
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Node 4: CITE        │  Formats structured citations:
│                      │  document name, page, chunk text,
│                      │  relevance score per source
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Node 5: RESPOND     │  Intent-aware answer generation.
│                      │  Grounded strictly in retrieved context.
│                      │  Never uses outside knowledge.
└──────────────────────┘
           │
           ▼
     Structured JSON response
     (answer, sources[], confidence, intent, latency_ms)

LLM: Groq llama-3.3-70b-versatile — chosen for sub-second inference speed and strong clinical reasoning.

Hybrid Retrieval System (retrieval.py + vector_store.py)
Two complementary indexing strategies are built for every uploaded document:

Method	How It Works	Good At
BM25 (rank-bm25)	Term frequency / inverse document frequency at token level	Exact keyword matches, clinical terms, drug names, regulatory codes
TF-IDF (scikit-learn)	Bigram TF-IDF vectorization + cosine similarity	Semantic phrase matching, paraphrase, related terminology
Results from both are fused using Reciprocal Rank Fusion (RRF) — a rank-based combination that doesn't require normalizing scores across different scales. The final top-K chunks are the most relevant according to both systems combined.

Multi-query expansion: the LLM generates 2 alternative phrasings of the user's question, all three variants are retrieved, and results are merged — improving recall for ambiguously worded queries.

Document Processing (document_processor.py)
PDF → pypdf page-by-page text extraction
DOCX → python-docx paragraph extraction
TXT → UTF-8 decode
All text → chunked via RecursiveCharacterTextSplitter (1000 chars, 200 char overlap) from langchain_text_splitters
Database (database.py, models.py)
PostgreSQL via SQLAlchemy ORM. One table: documents — stores metadata (id, name, file type, size, pages, chunk count, status, upload timestamp). Indexes are stored in /tmp/medintel_vectors/ as pickled BM25 and TF-IDF objects, keyed by document UUID.

API Routes
Method	Path	Description
POST	/api/upload	Multipart file upload → extract → chunk → build indexes → mark ready
GET	/api/documents	List all documents with metadata
GET	/api/documents/{id}	Single document detail
DELETE	/api/documents/{id}	Delete document + vector indexes
POST	/api/chat	Run full 5-node LangGraph pipeline
GET	/api/analytics	Aggregate metrics (queries/day, confidence trend, intent distribution)
GET	/api/queries	Recent query history
GET	/api/healthz	Health check
Frontend — React + Vite
Design System
Dark navy + cyan clinical theme built entirely in Tailwind CSS custom properties:

Background: hsl(220, 40%, 4%) — near-black navy
Primary/Accent: hsl(195, 100%, 45%) — clinical cyan
Cards: hsl(220, 30%, 6%) — slightly lighter navy
All chart colors: cyan spectrum gradients
Pages
Dashboard — Live metrics grid (documents, queries, avg latency, success rate + confidence). Recent query history table with intent badges and confidence indicators.

Chat — Streaming-style chat interface. Each assistant response shows:

The grounded answer
Confidence badge (High/Medium/Low + percentage)
Intent classification label
Pipeline latency in ms
Expandable source cards (document name, page, relevance score, chunk text preview)
Documents — Drag-and-drop upload zone. Supports PDF, DOCX, TXT up to 50 MB. Real-time status tracking (Processing → Ready / Error). Delete with index cleanup.

Analytics — Recharts visualizations: queries-per-day bar chart, confidence trend area chart, response latency area chart, intent distribution donut chart.

API Layer
The OpenAPI spec in lib/api-spec/openapi.yaml is the single source of truth. Orval generates TypeScript React Query hooks from it into lib/api-client-react/. All GET requests use generated hooks with 30s stale time. File upload uses a direct fetch() call (multipart/form-data can't be codegen'd cleanly). Chat uses the generated useChat() mutation.

Tech Stack Summary
Layer	Technology
Frontend framework	React 18 + Vite 7
Routing	Wouter
Server state	TanStack Query v5
Styling	Tailwind CSS v4 + custom CSS variables
Charts	Recharts
API codegen	Orval (OpenAPI → React Query hooks)
Backend framework	FastAPI (Python 3.12)
Agent orchestration	LangGraph
LLM	Groq llama-3.3-70b-versatile
Retrieval	BM25 (rank-bm25) + TF-IDF (scikit-learn)
Score fusion	Reciprocal Rank Fusion
PDF parsing	pypdf
DOCX parsing	python-docx
Text chunking	langchain-text-splitters
Database ORM	SQLAlchemy 2.0
Database	PostgreSQL (Replit managed)
Monorepo	pnpm workspaces
Language	TypeScript 5 (frontend), Python 3.12 (backend)
