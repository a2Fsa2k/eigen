"""
PDF parser — 2-tier extraction strategy:
  Tier 1: PyMuPDF blocks  — layout-aware, heading detection, reading order
  Tier 2: Tesseract OCR   — fallback only when a page has zero text (scanned)

Speed: uses get_text("blocks") — 30x faster than get_text("dict"),
still provides bounding boxes for reading order + heading heuristics.
Two-pass on single doc handle — no re-opening per page.
"""
import fitz
import io
import logging
from typing import List, Dict

log = logging.getLogger("eigen-rag")


# ── Tesseract fallback ────────────────────────────────────────────────────────
def _ocr_page(page: fitz.Page) -> str:
    try:
        import pytesseract
        from PIL import Image
        mat = fitz.Matrix(250 / 72, 250 / 72)
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        return pytesseract.image_to_string(img, lang="eng").strip()
    except ImportError:
        log.warning("pytesseract not installed — scanned page will be skipped")
        return ""


# ── PyMuPDF blocks extraction (fast path) ────────────────────────────────────
def _extract_page_blocks(page: fitz.Page) -> Dict:
    """
    Uses get_text("blocks") — 30x faster than get_text("dict").
    Returns (x0, y0, x1, y1, text, block_no, block_type) tuples.
    block_type: 0 = text, 1 = image

    Heading heuristic (no font size available in blocks mode):
      - Short block (< 80 chars) near the top third of the page → H1
      - Short block in upper half → H2
    """
    page_height = page.rect.height
    blocks      = page.get_text("blocks")   # list of tuples
    heading     = None
    lines_out   = []

    # Sort by vertical then horizontal position
    text_blocks = [b for b in blocks if b[6] == 0 and b[4].strip()]
    text_blocks.sort(key=lambda b: (round(b[1] / 10), b[0]))

    for b in text_blocks:
        x0, y0, x1, y1, text, block_no, block_type = b
        text = text.strip()
        if not text:
            continue

        rel_y    = y0 / page_height          # 0.0 = top, 1.0 = bottom
        is_short = len(text) < 80
        is_single_line = text.count("\n") == 0

        if is_short and is_single_line and rel_y < 0.30:
            prefix = "H1: "
            if heading is None:
                heading = text
        elif is_short and is_single_line and rel_y < 0.55:
            prefix = "H2: "
        else:
            prefix = ""

        # Normalise internal newlines to spaces (blocks join lines)
        clean = text.replace("\n", " ").strip()
        lines_out.append(f"{prefix}{clean}")

    return {
        "text":        "\n".join(lines_out),
        "heading":     heading,
        "source_type": "digital",
    }


# ── Public API ────────────────────────────────────────────────────────────────
def extract_pages(pdf_bytes: bytes) -> List[Dict]:
    """
    Returns list of:
      { page: int, text: str, heading: str|None, source_type: 'digital'|'ocr' }

    Two-pass on single doc handle:
      Pass 1 — cheap get_text("text") to detect empty/scanned pages
      Pass 2 — get_text("blocks") only on pages that have text
    """
    doc       = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_out = []

    for i, page in enumerate(doc):
        page_num = i + 1

        # Pass 1: cheap empty-page detection
        raw = page.get_text("text").strip()

        if raw:
            # Pass 2: fast structured extraction
            result = _extract_page_blocks(page)
        else:
            log.info(f"Page {page_num}: no text layer — falling back to Tesseract OCR")
            ocr_text = _ocr_page(page)
            result = {"text": ocr_text, "heading": None, "source_type": "ocr"}

        if result["text"].strip():
            pages_out.append({"page": page_num, **result})
        else:
            log.warning(f"Page {page_num}: no text extracted (skipped)")

    doc.close()
    return pages_out
