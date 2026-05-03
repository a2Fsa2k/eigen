"""
Extracts text from the mock PDF using PyMuPDF (layout-aware blocks mode).
Output saved to compare/out_pymupdf.txt
"""
import fitz
import json
import os

PDF = os.path.join(os.path.dirname(__file__), "..", "mock_rag_test_document.pdf")
OUT_TXT = os.path.join(os.path.dirname(__file__), "out_pymupdf.txt")
OUT_JSON = os.path.join(os.path.dirname(__file__), "out_pymupdf.json")

doc = fitz.open(PDF)
pages_txt = []
pages_json = []

for i, page in enumerate(doc):
    page_num = i + 1

    # ── Tier 1: raw text ────────────────────────────────────────────────────
    raw = page.get_text("text").strip()

    # ── Tier 2: blocks (bounding-box aware, reading order) ──────────────────
    blocks = page.get_text("dict")["blocks"]
    structured_lines = []
    block_data = []

    for b in blocks:
        if b["type"] != 0:          # 0 = text block, 1 = image
            continue
        block_lines = []
        for line in b["lines"]:
            line_text = " ".join(span["text"] for span in line["spans"]).strip()
            if not line_text:
                continue

            # Infer heading by font size
            font_size = line["spans"][0]["size"] if line["spans"] else 0
            flags    = line["spans"][0]["flags"] if line["spans"] else 0
            is_bold  = bool(flags & 2**4)

            prefix = ""
            if font_size >= 16:
                prefix = "# "
            elif font_size >= 13 or is_bold:
                prefix = "## "

            structured_lines.append(f"{prefix}{line_text}")
            block_lines.append({
                "text": line_text,
                "font_size": round(font_size, 1),
                "bold": is_bold,
                "bbox": line["bbox"],
            })
        block_data.append(block_lines)

    page_text = "\n".join(structured_lines)
    pages_txt.append(f"=== PAGE {page_num} ===\n{page_text}\n")
    pages_json.append({"page": page_num, "raw": raw, "blocks": block_data})

doc.close()

with open(OUT_TXT, "w") as f:
    f.write("\n".join(pages_txt))

with open(OUT_JSON, "w") as f:
    json.dump(pages_json, f, indent=2)

print(f"Done. {len(pages_txt)} pages written to:\n  {OUT_TXT}\n  {OUT_JSON}")
