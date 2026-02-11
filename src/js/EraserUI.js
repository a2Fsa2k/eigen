/**
 * Eraser Tool UI
 * Manages the eraser options dropdown
 */
export class EraserUI {
  constructor(eraserEngine) {
    this.eraserEngine = eraserEngine;
    this.dropdown = null;
    this.isOpen = false;
    
    this.createDropdown();
    this.setupEventListeners();
  }

  /**
   * Create the dropdown panel
   */
  createDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'eraser-tool-dropdown';
    dropdown.innerHTML = `
      <div class="eraser-tool-section">
        <label class="eraser-tool-label">Eraser Size</label>
        <input 
          type="range" 
          class="eraser-tool-slider" 
          min="5" 
          max="50" 
          value="${this.eraserEngine.getRadius()}" 
          id="eraser-size-slider"
        />
        <div class="eraser-size-display">${this.eraserEngine.getRadius()}px</div>
      </div>
      
      <div class="eraser-tool-section">
        <label class="eraser-tool-label">Preview</label>
        <div class="eraser-preview-container">
          <canvas class="eraser-preview-canvas" width="200" height="80"></canvas>
        </div>
      </div>
    `;
    
    document.body.appendChild(dropdown);
    this.dropdown = dropdown;
    
    // Draw initial preview
    this.updatePreview();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const slider = this.dropdown.querySelector('#eraser-size-slider');
    const sizeDisplay = this.dropdown.querySelector('.eraser-size-display');
    
    slider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      this.eraserEngine.setRadius(size);
      sizeDisplay.textContent = `${size}px`;
      this.updatePreview();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && 
          !this.dropdown.contains(e.target) && 
          !e.target.closest('#btn-erase-arrow')) {
        this.close();
      }
    });
  }

  /**
   * Update the preview canvas
   */
  updatePreview() {
    const canvas = this.dropdown.querySelector('.eraser-preview-canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background with some sample strokes
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    // Draw a wavy line
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 5) {
      const y = canvas.height / 2 + Math.sin(x / 20) * 15;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw eraser circle in the center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = this.eraserEngine.getRadius();
    
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw crosshair
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius - 5, centerY);
    ctx.lineTo(centerX + radius + 5, centerY);
    ctx.moveTo(centerX, centerY - radius - 5);
    ctx.lineTo(centerX, centerY + radius + 5);
    ctx.stroke();
  }

  /**
   * Toggle dropdown visibility
   */
  toggle(buttonElement) {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(buttonElement);
    }
  }

  /**
   * Open dropdown
   */
  open(buttonElement) {
    const rect = buttonElement.getBoundingClientRect();
    
    this.dropdown.style.left = `${rect.left}px`;
    this.dropdown.style.top = `${rect.bottom + 5}px`;
    this.dropdown.classList.add('open');
    
    this.isOpen = true;
    this.updatePreview();
  }

  /**
   * Close dropdown
   */
  close() {
    this.dropdown.classList.remove('open');
    this.isOpen = false;
  }
}
