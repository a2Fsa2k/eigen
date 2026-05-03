"""
Generator — builds a structured prompt from retrieved chunks.

MOCK MODE (default, AI_ENABLED=false in .env):
  Returns a structured dry-run response so the full pipeline can be tested
  without an LLM. The prompt that WOULD be sent is included in the response.

LIVE MODE (AI_ENABLED=true):
  Sends the prompt to a configured provider.

Providers:
  - LLM_PROVIDER=openai  → OpenAI-compatible endpoint (ollama, OpenAI, LM Studio)
  - LLM_PROVIDER=gemini  → native Gemini via google-genai
"""
import os
import logging
from typing import List, Dict

log = logging.getLogger("eigen-rag")

AI_ENABLED = os.getenv("AI_ENABLED", "false").lower() == "true"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower().strip()


def _build_prompt(question: str, chunks: List[Dict]) -> str:
    """
    Structured RAG prompt:
      - System role
      - Numbered source blocks with page + heading context
      - Clear instruction to cite sources

    HYBRID MODE POLICY:
      - Prefer answering from sources with citations.
      - If not present in sources, say "Not found in document." and then answer
        from general knowledge (no fabricated citations).
    """
    source_blocks = []
    for i, c in enumerate(chunks, 1):
        heading = f" [{c['heading']}]" if c.get("heading") else ""
        source_type = " (OCR)" if c.get("source_type") == "ocr" else ""
        source_blocks.append(
            f"[Source {i} — Page {c['page']}{heading}{source_type}]\n{c['text']}"
        )

    context = "\n\n---\n\n".join(source_blocks)

    return (
        "You are a helpful assistant for PDF Q&A. "
        "You will be given SOURCE excerpts from the user's document.\n\n"
        "Rules:\n"
        "1) If the question can be answered using the SOURCES, answer using ONLY the SOURCES and cite them as [Source N] inline.\n"
        "2) If the answer is NOT present in the SOURCES, you MAY answer from general knowledge, but you MUST start with: 'Not found in document.' Then provide the best general answer.\n"
        "3) Never fabricate citations. Only cite sources that directly support the claim.\n"
        "4) Keep the answer concise.\n\n"
        f"Sources:\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer:"
    )


def _generate_openai_compatible(prompt: str) -> str:
    from openai import OpenAI

    client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY", "ollama"),
        base_url=os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"),
    )
    model = os.getenv("LLM_MODEL", "llama3.2")

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


def _generate_gemini(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip() or "gemini-1.5-flash"

    # google-genai SDK
    from google import genai

    client = genai.Client(api_key=api_key)

    # Minimal config; keep deterministic-ish.
    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "temperature": 0.2,
        },
    )

    # SDK keeps output in .text for most cases
    text = getattr(resp, "text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()

    # Fallback for safety
    return str(resp)


def generate_answer(question: str, chunks: List[Dict]) -> str:
    prompt = _build_prompt(question, chunks)

    # ── MOCK MODE ─────────────────────────────────────────────────────────────
    if not AI_ENABLED:
        log.info("AI_ENABLED=false — returning mock response")
        source_summary = "; ".join(
            f"[Source {i+1} p.{c['page']} score={c.get('score', 0):.3f}]"
            for i, c in enumerate(chunks)
        )
        return (
            f"[MOCK — AI not connected yet]\n\n"
            f"Retrieved {len(chunks)} chunks: {source_summary}\n\n"
            f"Prompt that will be sent to LLM:\n"
            f"{'─'*60}\n{prompt}\n{'─'*60}"
        )

    # ── LIVE MODE ─────────────────────────────────────────────────────────────
    if LLM_PROVIDER == "gemini":
        return _generate_gemini(prompt)

    if LLM_PROVIDER == "openai":
        return _generate_openai_compatible(prompt)

    raise RuntimeError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")
