"""
POST /ingest  — receives PDF, extracts, chunks, embeds, stores index.
"""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import IngestResponse
from pdf.parser import extract_pages
from pdf.indexer import chunk_pages
from rag.embeddings import embed
from rag import retriever

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest(file: UploadFile = File(...)):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    pages = extract_pages(pdf_bytes)
    if not pages:
        raise HTTPException(status_code=422, detail="No extractable text found in PDF")

    ocr_pages = sum(1 for p in pages if p.get("source_type") == "ocr")

    chunks = chunk_pages(pages)
    texts  = [c["text"] for c in chunks]
    embeddings = embed(texts)

    doc_id = str(uuid.uuid4())
    retriever.build_index(doc_id, chunks, embeddings)

    return IngestResponse(
        doc_id=doc_id,
        chunk_count=len(chunks),
        page_count=len(pages),
        ocr_pages=ocr_pages,
        message=f"Ingested {len(pages)} pages ({ocr_pages} via OCR), {len(chunks)} chunks",
    )
