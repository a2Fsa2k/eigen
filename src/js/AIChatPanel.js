export class AIChatPanel {
  constructor(app) {
    this.app = app;

    this.panel = document.getElementById('ai-chat-panel');
    this.overlay = document.getElementById('ai-chat-overlay');
    this.closeBtn = document.getElementById('btn-ai-chat-close');
    this.form = document.getElementById('ai-chat-form');
    this.input = document.getElementById('ai-chat-text');
    this.messages = document.getElementById('ai-chat-messages');

    this._lastIngestedTabId = null;
    this._ingesting = false;

    // Reset per-tab ingest tracking as tabs change.
    this.app?.tabManager?.on?.('tabChanged', (tabId) => {
      // If user switches tabs, force next submit to consider ingest for that tab.
      if (tabId !== this._lastIngestedTabId) this._lastIngestedTabId = null;
    });

    this._bind();
  }

  async _ensureActivePdfIngested() {
    const tab = this.app?.tabManager?.getActiveTab?.();
    if (!tab) throw new Error('No active tab');

    if (!this.app?.ragManager) throw new Error('RAG client not initialized');

    // If we've already ingested this tab, don't re-ingest.
    const existingDocId = this.app.ragManager.getDocIdForTab?.(tab.id) || null;
    if (existingDocId) {
      this._lastIngestedTabId = tab.id;
      return;
    }

    // Avoid concurrent ingest if user spams enter.
    if (this._ingesting) return;
    this._ingesting = true;

    try {
      const ok = await this.app.ragManager.checkStatus();
      if (!ok) throw new Error('RAG server not reachable at http://localhost:8000');

      // Source of truth: if the PDF is visible, PDF.js has the full bytes.
      const pdfDoc = this.app?.pdfRenderer?.getDocument?.(tab.id);
      if (!pdfDoc) throw new Error('No PDF loaded in current tab');

      const data = await pdfDoc.getData(); // Uint8Array
      if (!(data instanceof Uint8Array) || data.length === 0) {
        throw new Error('Could not read PDF bytes from renderer');
      }

      await this.app.ragManager.ingest(data, tab.name || 'document.pdf', tab.id);
      this._lastIngestedTabId = tab.id;
    } finally {
      this._ingesting = false;
    }
  }

  _bind() {
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.close());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    if (this.form) {
      this.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = (this.input?.value || '').trim();
        if (!text) return;
        this.input.value = '';

        this.addMessage('user', text);

        try {
          await this._ensureActivePdfIngested();
          const activeTab = this.app?.tabManager?.getActiveTab?.();
          const res = await this.app.ragManager.query(text, 5, activeTab?.id || null);
          this.addMessage('assistant', res?.answer || '(no answer)');
        } catch (err) {
          this.addMessage('assistant', 'Error: ' + (err?.message || String(err)));
        }
      });
    }
  }

  isOpen() {
    return this.panel?.classList.contains('open');
  }

  open() {
    if (!this.panel || !this.overlay) return;
    this.overlay.style.display = 'block';
    this.panel.classList.add('open');
    this.panel.setAttribute('aria-hidden', 'false');

    // Focus input after animation starts
    setTimeout(() => this.input?.focus(), 50);
  }

  close() {
    if (!this.panel || !this.overlay) return;
    this.panel.classList.remove('open');
    this.panel.setAttribute('aria-hidden', 'true');

    // Hide overlay after slide-out transition
    setTimeout(() => {
      if (!this.isOpen()) this.overlay.style.display = 'none';
    }, 230);
  }

  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  addMessage(role, text) {
    if (!this.messages) return;
    const el = document.createElement('div');
    el.className = `ai-chat-bubble ${role}`;
    el.textContent = text;
    this.messages.appendChild(el);

    // Scroll to bottom
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}
