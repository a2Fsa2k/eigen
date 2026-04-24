export class AIChatPanel {
  constructor(app) {
    this.app = app;

    this.panel = document.getElementById('ai-chat-panel');
    this.overlay = document.getElementById('ai-chat-overlay');
    this.closeBtn = document.getElementById('btn-ai-chat-close');
    this.form = document.getElementById('ai-chat-form');
    this.input = document.getElementById('ai-chat-text');
    this.messages = document.getElementById('ai-chat-messages');

    this._bind();
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

        // Placeholder response for now.
        // Wire this to your RAG backend next.
        this.addMessage('assistant', 'Got it. (Chat backend not wired yet)');
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
