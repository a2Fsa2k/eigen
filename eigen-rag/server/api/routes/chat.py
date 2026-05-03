"""
POST /query  — hybrid retrieval (BM25 + vector) → generator → response.
"""
import os
from fastapi import APIRouter, HTTPException
from models.schemas import QueryRequest, QueryResponse
from rag.embeddings import embed
from rag import retriever
from rag.generator import generate_answer, AI_ENABLED

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    try:
        query_vec = embed([req.q])
        chunks = retriever.query_index(
            doc_id=req.doc_id,
            query_vec=query_vec,
            query_text=req.q,       # passed to BM25
            k=req.k,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

    answer = generate_answer(req.q, chunks)
    return QueryResponse(answer=answer, sources=chunks, mock=not AI_ENABLED)
