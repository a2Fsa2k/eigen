"""
Extracts text from the mock PDF using Tesseract OCR.
Each page is rendered to an image via PyMuPDF, then passed to Tesseract.
Output saved to compare/out_tesseract.txt
"""
import fitz
import pytesseract
from PIL import Image
import io
import json
import os

PDF = os.path.join(os.path.dirname(__file__), "..", "mock_rag_test_document.pdf")
OUT_TXT = os.path.join(os.path.dirname(__file__), "out_tesseract.txt")
OUT_JSON = os.path.join(os.path.dirname(__file__), "out_tesseract.json")

DPI = 200   # higher = better accuracy, slower

doc = fitz.open(PDF)
pages_txt = []
pages_json = []

for i, page in enumerate(doc):
    page_num = i + 1
    print(f"  OCR page {page_num}/{len(doc)}...", end="\r")

    # Render page to image at target DPI
    mat = fitz.Matrix(DPI / 72, DPI / 72)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
    img = Image.open(io.BytesIO(pix.tobytes("png")))

    # Run Tesseract — get plain text
    text = pytesseract.image_to_string(img, lang="eng").strip()

    # Also get structured data (bounding boxes + confidence)
    data = pytesseract.image_to_data(img, lang="eng",
                                     output_type=pytesseract.Output.DICT)
    words = [
        {
            "text": data["text"][j],
            "conf": data["conf"][j],
            "left": data["left"][j],
            "top": data["top"][j],
        }
        for j in range(len(data["text"]))
        if data["text"][j].strip() and int(data["conf"][j]) > 30
    ]

    pages_txt.append(f"=== PAGE {page_num} ===\n{text}\n")
    pages_json.append({"page": page_num, "text": text, "words": words})

doc.close()
print()  # newline after progress

with open(OUT_TXT, "w") as f:
    f.write("\n".join(pages_txt))

with open(OUT_JSON, "w") as f:
    json.dump(pages_json, f, indent=2)

print(f"Done. {len(pages_txt)} pages written to:\n  {OUT_TXT}\n  {OUT_JSON}")
