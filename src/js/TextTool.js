/**
 * Text Tool
 * Handles text annotation with floating toolbar for formatting
 */
export class TextTool {
  constructor(annotationManager) {
    this.annotationManager = annotationManager;
    this.activeTextBox = null;
    this.activeWrapper = null;
    this.toolbar = null;
    this.isCreatingTextBox = false;
    this.colorDropdownVisible = false;
    this.currentFormat = {
      fontSize: 16,
      color: '#000000',
      letterSpacing: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)'
    };
    
    // Available colors
    this.colors = ['#000000', '#FF0000', '#0000FF', '#00FF00'];
    
    this.createToolbar();
    this.setupGlobalEventListeners();
  }

  /**
   * Create floating toolbar
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'text-tool-toolbar';
    toolbar.innerHTML = `
      <div class="text-tool-section">
        <button class="text-tool-btn text-tool-color-btn" title="Text Color">
          <div class="color-preview" style="background: ${this.currentFormat.color}"></div>
        </button>
        <div class="text-tool-color-dropdown">
          ${this.colors.map(color => `
            <div class="color-option" data-color="${color}" style="background: ${color}"></div>
          `).join('')}
        </div>
      </div>
      
      <div class="text-tool-divider"></div>
      
      <div class="text-tool-section">
        <button class="text-tool-btn text-tool-size-decrease" title="Decrease Size">A-</button>
        <button class="text-tool-btn text-tool-size-increase" title="Increase Size">A+</button>
      </div>
      
      <div class="text-tool-divider"></div>
      
      <div class="text-tool-section">
        <button class="text-tool-btn text-tool-spacing-decrease" title="Decrease Spacing">⇔-</button>
        <button class="text-tool-btn text-tool-spacing-increase" title="Increase Spacing">⇔+</button>
      </div>
      
      <div class="text-tool-divider"></div>
      
      <div class="text-tool-section">
        <button class="text-tool-btn text-tool-delete" title="Delete Text">
          <span>🗑️</span>
        </button>
      </div>
    `;
    
    this.toolbar = toolbar;
    document.body.appendChild(toolbar);
  }

  /**
   * Setup global event listeners (called once in constructor)
   */
  setupGlobalEventListeners() {
    // Color button toggle
    const colorBtn = this.toolbar.querySelector('.text-tool-color-btn');
    const colorDropdown = this.toolbar.querySelector('.text-tool-color-dropdown');
    
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.colorDropdownVisible = !this.colorDropdownVisible;
      colorDropdown.classList.toggle('visible', this.colorDropdownVisible);
    });
    
    // Color options
    const colorOptions = this.toolbar.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = option.dataset.color;
        this.currentFormat.color = color;
        const colorPreview = colorBtn.querySelector('.color-preview');
        colorPreview.style.background = color;
        this.applyFormat();
        this.colorDropdownVisible = false;
        colorDropdown.classList.remove('visible');
      });
    });
    
    // Font size increase/decrease
    const sizeIncrease = this.toolbar.querySelector('.text-tool-size-increase');
    const sizeDecrease = this.toolbar.querySelector('.text-tool-size-decrease');
    
    sizeIncrease.addEventListener('click', () => {
      this.currentFormat.fontSize = Math.min(this.currentFormat.fontSize + 2, 40);
      this.applyFormat();
    });
    
    sizeDecrease.addEventListener('click', () => {
      this.currentFormat.fontSize = Math.max(this.currentFormat.fontSize - 2, 8);
      this.applyFormat();
    });
    
    // Letter spacing increase/decrease
    const spacingIncrease = this.toolbar.querySelector('.text-tool-spacing-increase');
    const spacingDecrease = this.toolbar.querySelector('.text-tool-spacing-decrease');
    
    spacingIncrease.addEventListener('click', () => {
      this.currentFormat.letterSpacing = Math.min(this.currentFormat.letterSpacing + 0.5, 10);
      this.applyFormat();
    });
    
    spacingDecrease.addEventListener('click', () => {
      this.currentFormat.letterSpacing = Math.max(this.currentFormat.letterSpacing - 0.5, -2);
      this.applyFormat();
    });
    
    // Delete button
    const deleteBtn = this.toolbar.querySelector('.text-tool-delete');
    deleteBtn.addEventListener('click', () => {
      this.deleteActiveTextBox();
    });
    
    // Close color dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.colorDropdownVisible && !colorDropdown.contains(e.target) && !colorBtn.contains(e.target)) {
        this.colorDropdownVisible = false;
        colorDropdown.classList.remove('visible');
      }
    });
  }

  /**
   * Create text box at position
   */
  createTextBox(annotationLayer, x, y, tabId) {
    // Remove any existing empty text box before creating a new one
    if (this.activeTextBox) {
      const text = this.activeTextBox.textContent.trim();
      if (text.length === 0) {
        this.activeTextBox.remove();
        this.toolbar.classList.remove('visible');
      }
    }
    
    // Prevent multiple rapid creations
    if (this.isCreatingTextBox) {
      return null;
    }
    
    this.isCreatingTextBox = true;
    
    // Create text box wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'text-annotation-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
    wrapper.style.minWidth = '100px';
    wrapper.style.maxWidth = '400px';
    wrapper.dataset.tabId = tabId;
    wrapper.dataset.page = annotationLayer.dataset.page;
    
    // Create drag handle (left)
    const dragHandle = document.createElement('div');
    dragHandle.className = 'text-drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'Drag to move';
    
    // Create text input
    const textBox = document.createElement('div');
    textBox.className = 'text-annotation';
    textBox.contentEditable = true;
    textBox.style.minHeight = '30px';
    textBox.style.flex = '1';
    
    // Create resize handle (right)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'text-resize-handle';
    resizeHandle.innerHTML = '⋮';
    resizeHandle.title = 'Drag to resize';
    
    // Apply current format
    this.applyFormatToElement(textBox);
    
    // Add placeholder
    textBox.setAttribute('data-placeholder', 'Start typing here...');
    
    // Assemble the wrapper
    wrapper.appendChild(dragHandle);
    wrapper.appendChild(textBox);
    wrapper.appendChild(resizeHandle);
    
    // Add to annotation layer
    annotationLayer.appendChild(wrapper);
    
    // Setup text box events
    this.setupTextBoxEvents(textBox, wrapper);
    
    // Setup drag functionality
    this.setupDragHandle(dragHandle, wrapper, annotationLayer);
    
    // Setup resize functionality
    this.setupResizeHandle(resizeHandle, wrapper);
    
    // Set as active and focus immediately for typing
    this.activeTextBox = textBox;
    this.activeWrapper = wrapper;
    
    // Force focus after a tiny delay to ensure DOM is ready
    setTimeout(() => {
      textBox.focus();
      // Move cursor to end of text box
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(textBox);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }, 10);
    
    // Show toolbar immediately after text box is added to DOM
    requestAnimationFrame(() => {
      this.showToolbar(textBox);
      this.isCreatingTextBox = false;
    });
    
    return textBox;
  }

  /**
   * Setup text box event listeners
   */
  setupTextBoxEvents(textBox, wrapper) {
    // Show toolbar on focus
    textBox.addEventListener('focus', () => {
      this.activeTextBox = textBox;
      this.activeWrapper = wrapper;
      this.showToolbar(textBox);
      this.syncToolbarWithFormat();
    });
    
    // Update on input
    textBox.addEventListener('input', () => {
      const tabId = wrapper.dataset.tabId;
      if (tabId && this.annotationManager.app.toolbar) {
        this.annotationManager.markTabAsChanged(tabId);
      }
    });
    
    // Hide toolbar on blur (after a delay to allow toolbar clicks)
    textBox.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement !== textBox && 
            !this.toolbar.contains(document.activeElement)) {
          // Just hide toolbar, keep activeTextBox reference
          this.toolbar.classList.remove('visible');
        }
      }, 200);
    });
  }

  /**
   * Setup drag handle for moving text box
   */
  setupDragHandle(dragHandle, wrapper, annotationLayer) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    
    dragHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = wrapper.getBoundingClientRect();
      const layerRect = annotationLayer.getBoundingClientRect();
      
      initialLeft = rect.left - layerRect.left;
      initialTop = rect.top - layerRect.top;
      
      dragHandle.style.cursor = 'grabbing';
      
      const onMouseMove = (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        wrapper.style.left = `${initialLeft + deltaX}px`;
        wrapper.style.top = `${initialTop + deltaY}px`;
        
        // Update toolbar position if visible
        if (this.toolbar.classList.contains('visible')) {
          this.showToolbar(wrapper.querySelector('.text-annotation'));
        }
      };
      
      const onMouseUp = () => {
        isDragging = false;
        dragHandle.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Mark as changed
        const tabId = wrapper.dataset.tabId;
        if (tabId) {
          this.annotationManager.markTabAsChanged(tabId);
        }
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Setup resize handle for changing text box width
   */
  setupResizeHandle(resizeHandle, wrapper) {
    let isResizing = false;
    let startX, initialWidth;
    
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      
      startX = e.clientX;
      initialWidth = wrapper.offsetWidth;
      
      resizeHandle.style.cursor = 'ew-resize';
      
      const onMouseMove = (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(100, Math.min(600, initialWidth + deltaX));
        
        wrapper.style.width = `${newWidth}px`;
        wrapper.style.maxWidth = `${newWidth}px`;
        
        // Update toolbar position if visible
        if (this.toolbar.classList.contains('visible')) {
          this.showToolbar(wrapper.querySelector('.text-annotation'));
        }
      };
      
      const onMouseUp = () => {
        isResizing = false;
        resizeHandle.style.cursor = 'ew-resize';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Mark as changed
        const tabId = wrapper.dataset.tabId;
        if (tabId) {
          this.annotationManager.markTabAsChanged(tabId);
        }
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Apply current format to active text box
   */
  applyFormat() {
    if (!this.activeTextBox) return;
    this.applyFormatToElement(this.activeTextBox);
  }

  /**
   * Apply format to a specific element
   */
  applyFormatToElement(element) {
    element.style.fontFamily = 'Arial';
    element.style.fontSize = `${this.currentFormat.fontSize}px`;
    element.style.color = this.currentFormat.color;
    element.style.letterSpacing = `${this.currentFormat.letterSpacing}px`;
    // Don't set border/background inline - let CSS handle it based on :focus and :empty states
    element.style.padding = '4px 8px';
    element.style.borderRadius = '2px';
    element.style.outline = 'none';
    element.style.whiteSpace = 'pre-wrap';
    element.style.wordWrap = 'break-word';
    element.style.pointerEvents = 'all';
  }

  /**
   * Remove empty text box (called when switching tools)
   */
  removeEmptyTextBox() {
    if (this.activeTextBox) {
      const text = this.activeTextBox.textContent.trim();
      if (text.length === 0) {
        // Remove the wrapper instead of just the text box
        const wrapper = this.activeTextBox.closest('.text-annotation-wrapper');
        if (wrapper) {
          wrapper.remove();
        } else {
          this.activeTextBox.remove();
        }
        this.activeTextBox = null;
        this.activeWrapper = null;
      }
      this.toolbar.classList.remove('visible');
      this.colorDropdownVisible = false;
      const colorDropdown = this.toolbar.querySelector('.text-tool-color-dropdown');
      if (colorDropdown) {
        colorDropdown.classList.remove('visible');
      }
    }
  }

  /**
   * Show toolbar near text box
   */
  showToolbar(textBox) {
    const rect = textBox.getBoundingClientRect();
    
    // Position toolbar above text box
    let top = rect.top - this.toolbar.offsetHeight - 10;
    let left = rect.left;
    
    // Adjust if toolbar goes off screen
    if (top < 10) {
      top = rect.bottom + 10;
    }
    
    if (left + this.toolbar.offsetWidth > window.innerWidth) {
      left = window.innerWidth - this.toolbar.offsetWidth - 10;
    }
    
    if (left < 10) {
      left = 10;
    }
    
    this.toolbar.style.top = `${top}px`;
    this.toolbar.style.left = `${left}px`;
    this.toolbar.classList.add('visible');
  }

  /**
   * Hide toolbar
   */
  hideToolbar() {
    this.toolbar.classList.remove('visible');
    // Keep the active reference so we can track empty text boxes
    // Only clear it when explicitly deleting or when focusing another text box
  }

  /**
   * Sync toolbar controls with current format
   */
  syncToolbarWithFormat() {
    const colorPreview = this.toolbar.querySelector('.color-preview');
    if (colorPreview) {
      colorPreview.style.background = this.currentFormat.color;
    }
  }

  /**
   * Delete active text box
   */
  deleteActiveTextBox() {
    if (!this.activeTextBox) return;
    
    const wrapper = this.activeTextBox.closest('.text-annotation-wrapper');
    const tabId = wrapper ? wrapper.dataset.tabId : null;
    
    if (wrapper) {
      wrapper.remove();
    } else {
      this.activeTextBox.remove();
    }
    
    this.activeTextBox = null;
    this.activeWrapper = null;
    this.hideToolbar();
    
    if (tabId) {
      this.annotationManager.markTabAsChanged(tabId);
    }
  }

  /**
   * Convert hex color to rgba
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.toolbar) {
      this.toolbar.remove();
    }
  }
}
