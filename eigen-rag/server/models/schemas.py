from pydantic import BaseModel
from typing import List, Optional


class IngestRequest(BaseModel):
    filename: str


class Chunk(BaseModel):
    id:          str
    text:        str
    page:        int
    score:       Optional[float] = None
    heading:     Optional[str]   = None
    source_type: Optional[str]   = "digital"   # "digital" | "ocr"


class IngestResponse(BaseModel):
    doc_id:      str
    chunk_count: int
    page_count:  int
    ocr_pages:   int
    message:     str


class QueryRequest(BaseModel):
    doc_id: str
    q:      str
    k:      int = 5


class QueryResponse(BaseModel):
    answer:  str
    sources: List[Chunk]
    mock:    bool = False   # True when AI_ENABLED=false
