/**
 * RagManager.js — handles all communication with the eigen-rag server.
 * Drop into eigen/src/js/ and import from main.js.
 *
 * API contract:
 *   POST /ingest   multipart/form-data  { file: Blob }  → { doc_id, chunk_count, message }
 *   POST /query    application/json     { doc_id, q, k } → { answer, sources }
 *   GET  /status                                         → { ready, version }
 */

const RAG_BASE = 'http://localhost:8000';

export class RagManager {
  constructor(app) {
    this.app = app;

    // Legacy single-doc fields (kept for backward compatibility)
    this.docId = null;       // last successful ingest
    this.ready = false;

    // Per-tab doc ids (so multi-tab chat "just works")
    this.docIdsByTabId = new Map();
  }

  // ─── Server health ────────────────────────────────────────────────────────

  async checkStatus() {
    try {
      const res = await fetch(`${RAG_BASE}/status`);
      const data = await res.json();
      this.ready = data.ready === true;
    } catch {
      this.ready = false;
    }
    return this.ready;
  }

  /**
   * Clear any cached doc id for a tab (call when a tab closes).
   * @param {string} tabId
   */
  clearTab(tabId) {
    if (!tabId) return;
    this.docIdsByTabId.delete(tabId);
  }

  /**
   * Get the cached doc id for a tab.
   * @param {string} tabId
   */
  getDocIdForTab(tabId) {
    return tabId ? (this.docIdsByTabId.get(tabId) || null) : null;
  }

  // ─── Ingest ───────────────────────────────────────────────────────────────

  /**
   * @param {Uint8Array|ArrayBuffer} pdfBytes - raw PDF data
   * @param {string} filename
   * @param {string|null} tabId - optional, to cache doc_id per tab
   * @returns {Promise<{ doc_id: string, chunk_count: number }>}
   */
  async ingest(pdfBytes, filename = 'document.pdf', tabId = null) {
    this.docId = null;
    const form = new FormData();
    form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), filename);

    const res = await fetch(`${RAG_BASE}/ingest`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Ingest failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    this.docId = data.doc_id;
    if (tabId) this.docIdsByTabId.set(tabId, data.doc_id);
    return data;
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  /**
   * @param {string} question
   * @param {number} k  - number of chunks to retrieve
   * @param {string|null} tabId - optional, to use a tab-specific doc_id
   * @returns {Promise<{ answer: string, sources: Array }>}
   */
  async query(question, k = 5, tabId = null) {
    const docId = (tabId && this.docIdsByTabId.get(tabId)) || this.docId;
    if (!docId) throw new Error('No document ingested yet');

    const res = await fetch(`${RAG_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, q: question, k }),
    });
    if (!res.ok) throw new Error(`Query failed: ${res.status} ${await res.text()}`);
    return res.json();
  }
}
