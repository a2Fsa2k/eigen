/**
 * Draw Tool Dropdown UI
 * Manages the UI for configuring draw tool settings
 */
export class DrawToolUI {
  constructor(drawToolState) {
    this.state = drawToolState;
    this.dropdown = null;
    this.previewCanvas = null;
    this.previewCtx = null;
    
    this.colors = [
      '#000000', '#FFFFFF', '#FF0000', '#00FF00', 
      '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
      '#FFA500', '#800080', '#808080', '#A52A2A'
    ];
    
    this.init();
  }

  /**
   * Initialize dropdown UI
   */
  init() {
    this.createDropdown();
    this.setupEventListeners();
    
    // Subscribe to state changes for live updates
    this.state.subscribe((newState, oldState) => {
      if (newState.color !== oldState.color || newState.thickness !== oldState.thickness) {
        this.updatePreview();
        this.updateSelectedColor();
      }
    });
  }

  /**
   * Create dropdown HTML structure
   */
  createDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'draw-tool-dropdown';
    dropdown.innerHTML = `
      <div class="draw-tool-section">
        <label class="draw-tool-label">Color</label>
        <div class="color-palette" id="draw-color-palette"></div>
      </div>
      
      <div class="draw-tool-section">
        <label class="draw-tool-label">Thickness: <span id="draw-thickness-value">3</span>px</label>
        <input 
          type="range" 
          id="draw-thickness-slider" 
          class="draw-tool-slider"
          min="1" 
          max="30" 
          value="3"
        />
      </div>
      
      <div class="draw-tool-section">
        <label class="draw-tool-label">Preview</label>
        <canvas id="draw-preview-canvas" class="draw-preview-canvas" width="200" height="60"></canvas>
      </div>
    `;
    
    this.dropdown = dropdown;
    
    // Add to DOM (hidden by default)
    document.body.appendChild(dropdown);
    
    // Create color swatches
    this.createColorPalette();
    
    // Setup preview canvas
    this.previewCanvas = dropdown.querySelector('#draw-preview-canvas');
    this.previewCtx = this.previewCanvas.getContext('2d');
    this.updatePreview();
  }

  /**
   * Create color palette swatches
   */
  createColorPalette() {
    const palette = this.dropdown.querySelector('#draw-color-palette');
    
    this.colors.forEach(color => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      
      if (color === this.state.getColor()) {
        swatch.classList.add('active');
      }
      
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectColor(color);
      });
      
      palette.appendChild(swatch);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Thickness slider
    const slider = this.dropdown.querySelector('#draw-thickness-slider');
    const valueLabel = this.dropdown.querySelector('#draw-thickness-value');
    
    slider.addEventListener('input', (e) => {
      const thickness = parseInt(e.target.value);
      valueLabel.textContent = thickness;
      this.state.setState({ thickness });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen() && 
          !this.dropdown.contains(e.target) && 
          !e.target.closest('#btn-draw')) {
        this.close();
      }
    });
    
    // Prevent dropdown from closing when clicking inside
    this.dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Select a color
   */
  selectColor(color) {
    this.state.setState({ color });
  }

  /**
   * Update selected color visual state
   */
  updateSelectedColor() {
    const swatches = this.dropdown.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      if (swatch.dataset.color === this.state.getColor()) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });
  }

  /**
   * Update live preview canvas
   */
  updatePreview() {
    const ctx = this.previewCtx;
    const canvas = this.previewCanvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw preview stroke
    ctx.strokeStyle = this.state.getColor();
    ctx.lineWidth = this.state.getThickness();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw a curved line
    ctx.beginPath();
    ctx.moveTo(20, 40);
    ctx.bezierCurveTo(60, 10, 140, 50, 180, 30);
    ctx.stroke();
  }

  /**
   * Position dropdown relative to button
   */
  positionDropdown(buttonElement) {
    const rect = buttonElement.getBoundingClientRect();
    const dropdownRect = this.dropdown.getBoundingClientRect();
    
    // Position below button, aligned to left
    let top = rect.bottom + 5;
    let left = rect.left;
    
    // Adjust if dropdown goes off screen
    if (left + dropdownRect.width > window.innerWidth) {
      left = window.innerWidth - dropdownRect.width - 10;
    }
    
    if (top + dropdownRect.height > window.innerHeight) {
      top = rect.top - dropdownRect.height - 5;
    }
    
    this.dropdown.style.top = `${top}px`;
    this.dropdown.style.left = `${left}px`;
  }

  /**
   * Toggle dropdown visibility
   */
  toggle(buttonElement) {
    // Close other dropdowns first
    this.closeOtherDropdowns();
    
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(buttonElement);
    }
  }

  /**
   * Close other dropdowns and popovers
   */
  closeOtherDropdowns() {
    // Close all popovers
    document.querySelectorAll('.popover').forEach(p => {
      p.style.display = 'none';
    });
    
    // Close highlight dropdown
    document.querySelectorAll('.highlight-popover').forEach(d => {
      d.classList.remove('open');
    });
  }

  /**
   * Open dropdown
   */
  open(buttonElement) {
    this.dropdown.classList.add('open');
    this.positionDropdown(buttonElement);
  }

  /**
   * Close dropdown
   */
  close() {
    this.dropdown.classList.remove('open');
  }

  /**
   * Check if dropdown is open
   */
  isOpen() {
    return this.dropdown.classList.contains('open');
  }

  /**
   * Sync UI with current state
   */
  syncWithState() {
    const slider = this.dropdown.querySelector('#draw-thickness-slider');
    const valueLabel = this.dropdown.querySelector('#draw-thickness-value');
    
    slider.value = this.state.getThickness();
    valueLabel.textContent = this.state.getThickness();
    
    this.updateSelectedColor();
    this.updatePreview();
  }
}
