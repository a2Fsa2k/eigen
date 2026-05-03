"""
Semantic chunker — splits on sentence boundaries, respects heading tags as
natural break points, preserves page + heading + source_type metadata.

Strategy:
  1. Split text into sentences (simple regex — no NLTK dependency)
  2. Accumulate sentences into a chunk until TARGET_TOKENS is reached
  3. When a heading line (H1:/H2:) is encountered, always start a new chunk
  4. Overlap: carry the last OVERLAP_SENTENCES sentences into the next chunk
"""
import re
import uuid
from typing import List, Dict

TARGET_CHARS    = 600   # target chunk size in characters
OVERLAP_SENTS   = 3     # increased overlap to reduce cut-off issues
HEADING_RE      = re.compile(r"^(H1|H2): ", re.MULTILINE)


def clean_text(text: str) -> str:
    """Lightweight OCR noise cleanup and whitespace normalization.
    Keeps most punctuation, normalizes common curly quotes and dashes,
    removes non-ascii control characters and collapses whitespace.
    Additionally applies a few conservative OCR-specific regex fixes
    (digit→letter substitutions inside words, common hyphen/pipe artifacts)
    to reduce noise like `1-krod`, `l'clt`, `a1b` etc.
    """
    if not text:
        return text
    # normalize newlines and common bullets
    t = text.replace('\r', ' ').replace('\n', ' ')
    t = t.replace('•', ' ').replace('•', ' ')
    # normalize quotes and dashes
    t = t.replace('’', "'").replace('‘', "'")
    t = t.replace('“', '"').replace('”', '"')
    t = t.replace('\u2013', '-').replace('\u2014', ' - ')
    # remove non-ascii to avoid weird ligatures/artifacts
    t = re.sub(r'[^\x00-\x7f]', ' ', t)

    # Conservative OCR heuristics: replace digits that are likely
    # misrecognized characters when they occur between letters.
    # e.g. `a1b` -> `alb`, `co0peration` -> `cooperation`
    t = re.sub(r'(?<=[A-Za-z])1(?=[A-Za-z])', 'l', t)
    t = re.sub(r'(?<=[A-Za-z])0(?=[A-Za-z])', 'o', t)
    t = re.sub(r'(?<=[A-Za-z])5(?=[A-Za-z])', 's', t)

    # Fix common patterns like `1-word` where leading `1-` is an OCR of `l-`
    t = re.sub(r'\b1-([A-Za-z])', r'l-\1', t)

    # Replace pipes inside words (OCR often yields `l|ike`)
    t = re.sub(r'(?<=[A-Za-z])\|(?=[A-Za-z])', 'l', t)

    # collapse whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _split_sentences(text: str) -> List[str]:
    """Split on . ! ? followed by whitespace or end-of-string."""
    raw = re.split(r'(?<=[.!?])\s+', text.strip())
    # Also split on newline-separated lines (common in structured PDFs)
    sentences = []
    for part in raw:
        for line in part.splitlines():
            line = line.strip()
            if line:
                sentences.append(line)
    return sentences


def _flush(buf: List[str], page: int, heading: str | None,
           source_type: str, chunks: List[Dict]) -> None:
    text = " ".join(buf).strip()
    if text:
        chunks.append({
            "id":          str(uuid.uuid4()),
            "page":        page,
            "text":        text,
            "heading":     heading,
            "source_type": source_type,
        })


def chunk_pages(pages: List[Dict]) -> List[Dict]:
    """
    Input:  [{ page, text, heading, source_type }, ...]
    Output: [{ id, page, text, heading, source_type }, ...]
    """
    chunks: List[Dict] = []

    for page_data in pages:
        page        = page_data["page"]
        source_type = page_data.get("source_type", "digital")
        heading     = page_data.get("heading")

        # Clean page text from OCR artifacts before splitting
        raw_text = clean_text(page_data["text"])
        sentences   = _split_sentences(raw_text)
        buf: List[str] = []
        current_heading = heading

        for sent in sentences:
            # Heading line — flush current chunk, start fresh
            if HEADING_RE.match(sent):
                if buf:
                    _flush(buf, page, current_heading, source_type, chunks)
                    buf = []
                current_heading = HEADING_RE.sub("", sent).strip()
                buf.append(current_heading)
                continue

            buf.append(sent)

            # Reached target size — flush with overlap carry-over
            if sum(len(s) for s in buf) >= TARGET_CHARS:
                _flush(buf, page, current_heading, source_type, chunks)
                buf = buf[-OVERLAP_SENTS:]   # carry last N sentences

        # Flush remaining
        if buf:
            _flush(buf, page, current_heading, source_type, chunks)

    return chunks
