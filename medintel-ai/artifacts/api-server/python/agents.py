import logging
import time
from typing import TypedDict, Optional, Annotated
import operator

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    question: str
    intent: str
    documents: list[dict]
    confidence: float
    sources: list[dict]
    answer: str
    document_ids: Optional[list[str]]
    doc_names: dict[str, str]


def get_llm():
    import os
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=os.environ["GROQ_API_KEY"],
        temperature=0.1,
        max_tokens=2048,
    )


def query_classification_agent(state: AgentState) -> AgentState:
    llm = get_llm()
    prompt = f"""Classify the following clinical/regulatory question into one of these intents:
- search: Looking for specific information
- compare: Comparing multiple items, protocols, or guidelines
- summarize: Requesting a summary of a document or topic
- compliance: Asking about regulatory requirements or compliance

Question: "{state['question']}"

Respond with only one word: search, compare, summarize, or compliance."""
    try:
        response = llm.invoke(prompt)
        intent = response.content.strip().lower()
        if intent not in ["search", "compare", "summarize", "compliance"]:
            intent = "search"
    except Exception as e:
        logger.error(f"Classification error: {e}")
        intent = "search"

    logger.info(f"Classified intent: {intent}")
    return {**state, "intent": intent}


def retrieval_agent(state: AgentState) -> AgentState:
    from retrieval import multi_query_retrieve, hybrid_retrieve

    doc_ids = state.get("document_ids") or []
    if not doc_ids:
        return {**state, "documents": []}

    llm = get_llm()
    try:
        results = multi_query_retrieve(state["question"], doc_ids, llm, top_k=8)
    except Exception as e:
        logger.error(f"Multi-query retrieval failed, falling back: {e}")
        results = hybrid_retrieve(state["question"], doc_ids, top_k=6)

    logger.info(f"Retrieved {len(results)} chunks")
    return {**state, "documents": results}


def verification_agent(state: AgentState) -> AgentState:
    docs = state.get("documents", [])
    if not docs:
        return {**state, "confidence": 0.1}

    llm = get_llm()
    context_preview = "\n\n".join([d["chunk_text"][:500] for d in docs[:4]])
    prompt = f"""Evaluate how well the following context can answer the question.

Question: {state['question']}

Context:
{context_preview}

Rate from 0.0 to 1.0 how confident you are that this context contains sufficient information to answer the question accurately. 
Respond with only a decimal number like 0.85"""
    try:
        response = llm.invoke(prompt)
        confidence = float(response.content.strip())
        confidence = max(0.0, min(1.0, confidence))
    except Exception as e:
        logger.warning(f"Verification failed: {e}")
        confidence = 0.5 if docs else 0.1

    logger.info(f"Confidence: {confidence}")
    return {**state, "confidence": confidence}


def citation_agent(state: AgentState) -> AgentState:
    docs = state.get("documents", [])
    doc_names = state.get("doc_names", {})

    sources = []
    for i, doc in enumerate(docs[:6]):
        doc_id = doc.get("doc_id", "unknown")
        sources.append({
            "document_id": doc_id,
            "document_name": doc_names.get(doc_id, f"Document {i+1}"),
            "page": None,
            "chunk_text": doc["chunk_text"][:300],
            "relevance_score": doc.get("relevance_score", 0.8),
        })

    return {**state, "sources": sources}


def response_agent(state: AgentState) -> AgentState:
    docs = state.get("documents", [])
    confidence = state.get("confidence", 0.0)

    if not docs:
        return {
            **state,
            "answer": "I couldn't find relevant information in the uploaded documents to answer your question. Please upload relevant clinical or regulatory documents first.",
        }

    context = "\n\n---\n\n".join([
        f"[Source: {state['doc_names'].get(d.get('doc_id',''), 'Document')}]\n{d['chunk_text']}"
        for d in docs[:6]
    ])

    intent_instructions = {
        "search": "Provide a precise, direct answer based strictly on the provided context.",
        "compare": "Compare the relevant aspects found in the documents, highlighting similarities and differences.",
        "summarize": "Provide a comprehensive summary of the key points found in the documents.",
        "compliance": "Focus on regulatory requirements, compliance criteria, and specific guidance found in the documents.",
    }
    instruction = intent_instructions.get(state.get("intent", "search"), intent_instructions["search"])

    llm = get_llm()
    prompt = f"""You are MedIntel AI, a clinical intelligence assistant. Answer ONLY from the provided context. Do not use outside knowledge.

{instruction}

Question: {state['question']}

Context:
{context}

If the context does not contain enough information, say so explicitly. Always cite specific sections or documents when relevant. Be precise and professional."""

    try:
        response = llm.invoke(prompt)
        answer = response.content.strip()
    except Exception as e:
        logger.error(f"Response generation error: {e}")
        answer = "An error occurred while generating the response. Please try again."

    return {**state, "answer": answer}


def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("classify", query_classification_agent)
    workflow.add_node("retrieve", retrieval_agent)
    workflow.add_node("verify", verification_agent)
    workflow.add_node("cite", citation_agent)
    workflow.add_node("respond", response_agent)

    workflow.set_entry_point("classify")
    workflow.add_edge("classify", "retrieve")
    workflow.add_edge("retrieve", "verify")
    workflow.add_edge("verify", "cite")
    workflow.add_edge("cite", "respond")
    workflow.add_edge("respond", END)

    return workflow.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def run_pipeline(question: str, document_ids: list[str], doc_names: dict[str, str]) -> dict:
    graph = get_graph()
    initial_state: AgentState = {
        "question": question,
        "intent": "",
        "documents": [],
        "confidence": 0.0,
        "sources": [],
        "answer": "",
        "document_ids": document_ids,
        "doc_names": doc_names,
    }
    start = time.time()
    result = graph.invoke(initial_state)
    latency_ms = (time.time() - start) * 1000
    return {**result, "latency_ms": latency_ms}
