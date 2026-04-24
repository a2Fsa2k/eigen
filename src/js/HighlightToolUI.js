import { Popover } from './Popover.js';

export class HighlightToolUI {
  constructor(annotationManager) {
    this.annotationManager = annotationManager;
    this.popover = new Popover('highlight-tool-popover', 'Highlight Options');
    
    this.setup();
    this.updateUI();
  }

  setup() {
    const content = this.popover.getContentElement();
    content.innerHTML = `
      <div class="popover-section">
        <div class="popover-section-title">Colours</div>
        <div class="color-swatch-row" id="highlight-color-row">
          <!-- Swatches will be injected by JS -->
        </div>
      </div>
      <div class="popover-section">
        <div class="thickness-preview" id="highlight-thickness-preview">
          <svg viewBox="0 0 100 20" preserveAspectRatio="none">
            <path d="M 5 10 Q 25 0, 45 10 T 85 10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </div>
        <div class="popover-section-title">
          Thickness
          <span class="info-icon" title="This controls the thickness of the freehand highlight.">ⓘ</span>
        </div>
        <div class="slider-container">
          <span class="slider-label">Thin</span>
          <input type="range" id="highlight-thickness-slider" min="10" max="50" step="1">
          <span class="slider-label">Thick</span>
        </div>
      </div>
      <div class="popover-section">
        <div class="highlight-mode-toggle">
          <label for="text-only-highlight-toggle">Text only highlight</label>
          <label class="switch">
            <input type="checkbox" id="text-only-highlight-toggle">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
    `;

    // --- Event Listeners ---
    
    // Color Swatches
    const colors = ['#FFFF00', '#A3E635', '#67E8F9', '#F472B6', '#F87171'];
    const colorRow = content.querySelector('#highlight-color-row');
    colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      swatch.addEventListener('click', () => {
        this.annotationManager.setHighlightColor(color);
        this.updateUI();
      });
      colorRow.appendChild(swatch);
    });

    // Thickness Slider
    this.thicknessSlider = content.querySelector('#highlight-thickness-slider');
    this.thicknessSlider.addEventListener('input', (e) => {
      this.annotationManager.setHighlightThickness(e.target.value);
      this.updateUI();
    });

    // Text Only Toggle
    this.textOnlyToggle = content.querySelector('#text-only-highlight-toggle');
    this.textOnlyToggle.addEventListener('change', (e) => {
      this.annotationManager.setHighlightTextOnly(e.target.checked);
      this.updateUI();
    });
  }

  updateUI() {
    // Update slider value
    this.thicknessSlider.value = this.annotationManager.highlightThickness;

    // Update color swatch selection
    const currentColor = this.annotationManager.highlightColor;
    this.popover.getContentElement().querySelectorAll('.color-swatch').forEach(swatch => {
      if (swatch.dataset.color && swatch.dataset.color.toLowerCase() === currentColor.toLowerCase()) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });

    // Update thickness preview
    const previewPath = this.popover.getContentElement().querySelector('#highlight-thickness-preview path');
    if (previewPath) {
      const thickness = this.annotationManager.highlightThickness;
      const color = this.annotationManager.highlightColor;
      
      // Convert hex to rgba with transparency
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const previewColor = `rgba(${r}, ${g}, ${b}, 0.6)`;

      previewPath.setAttribute('stroke', previewColor);
      // Scale stroke-width relative to the SVG viewbox (e.g., max thickness of 50 maps to 10 in viewbox)
      previewPath.setAttribute('stroke-width', thickness / 5);
    }
    
    // Update text-only toggle
    this.textOnlyToggle.checked = this.annotationManager.highlightTextOnly;
  }

  toggle(buttonElement) {
    this.updateUI(); // Ensure UI is up-to-date when opening
    this.popover.toggle(buttonElement);
  }
}
