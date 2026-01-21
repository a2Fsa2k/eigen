let popoverClickHandlerRegistered = false;

export class Toolbar {
  constructor(app) {
    this.app = app;
    this.activePopover = null;
    this.activeTool = null;
    
    this.init();
  }

  init() {
    this.setupToolButtons();
    this.setupZoomButtons();
    this.setupPageNavigation();
    this.setupViewControls();
    this.setupFileButtons();
    // REMOVE: this.setupPopovers();
    // Popover setup will be called after all managers are initialized
    if (!popoverClickHandlerRegistered) {
      document.addEventListener('click', (e) => {
        if (
          document.querySelector('.popover[style*="block"]') &&
          !e.target.closest('.popover') &&
          !e.target.closest('.toolbar-btn') &&
          !e.target.closest('.open-file-btn') &&
          !e.target.closest('.settings-option') &&
          !(e.target.tagName === 'INPUT' && (e.target.type === 'checkbox' || e.target.type === 'range'))
        ) {
          document.querySelectorAll('.popover').forEach(p => p.style.display = 'none');
        }
      });
      popoverClickHandlerRegistered = true;
    }
  }

  setupToolButtons() {
    // Table of Contents
    document.getElementById('btn-toc').addEventListener('click', () => {
      this.app.sidebar.toggle();
    });

    // Highlight button - activates tool
    document.getElementById('btn-highlight').addEventListener('click', () => {
      this.activateTool('highlight');
    });

    // Highlight arrow - opens popover
    document.getElementById('btn-highlight-arrow').addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePopover('highlight', e.target);
    });

    // Draw button - activates tool
    document.getElementById('btn-draw').addEventListener('click', () => {
      this.activateTool('draw');
    });

    // Draw arrow - opens popover
    document.getElementById('btn-draw-arrow').addEventListener('click', (e) => {
      this.togglePopover('draw', e.target);
    });

    // Erase button (no dropdown)
    document.getElementById('btn-erase').addEventListener('click', () => {
      this.activateTool('erase');
    });

    // Text button (no dropdown)
    document.getElementById('btn-text').addEventListener('click', () => {
      this.activateTool('text');
    });
  }

  activateTool(toolName) {
    // Deactivate current tool
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Activate new tool
    if (this.activeTool === toolName) {
      // Toggle off
      this.activeTool = null;
      this.app.annotationManager.setActiveTool(null);
    } else {
      this.activeTool = toolName;
      const toolBtn = document.querySelector(`[data-tool="${toolName}"]`);
      if (toolBtn) {
        toolBtn.classList.add('active');
      }
      this.app.annotationManager.setActiveTool(toolName);
    }

    // Update tab state
    const activeTab = this.app.tabManager.getActiveTab();
    if (activeTab) {
      this.app.tabManager.updateTab(activeTab.id, { activeTool: this.activeTool });
    }
  }

  setupZoomButtons() {
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.zoomIn();
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.zoomOut();
    });

    document.getElementById('btn-fit-width').addEventListener('click', () => {
      this.fitToWidth();
    });
  }

  zoomIn() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    const newZoom = Math.min(activeTab.zoom + 0.25, 3.0);
    this.app.tabManager.updateTab(activeTab.id, { zoom: newZoom });
    this.app.pdfRenderer.setZoom(activeTab.id, newZoom);
  }

  zoomOut() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    const newZoom = Math.max(activeTab.zoom - 0.25, 0.5);
    this.app.tabManager.updateTab(activeTab.id, { zoom: newZoom });
    this.app.pdfRenderer.setZoom(activeTab.id, newZoom);
  }

  fitToWidth() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    const container = document.getElementById('pdf-container');
    const containerWidth = container.clientWidth - 40; // padding
    
    this.app.pdfRenderer.fitToWidth(activeTab.id, containerWidth);
  }

  setupPageNavigation() {
    const pageInput = document.getElementById('page-number');
    
    pageInput.addEventListener('change', () => {
      const pageNum = parseInt(pageInput.value);
      const activeTab = this.app.tabManager.getActiveTab();
      
      if (activeTab) {
        const doc = this.app.pdfRenderer.getDocument(activeTab.id);
        if (doc && pageNum >= 1 && pageNum <= doc.numPages) {
          this.app.pdfRenderer.goToPage(activeTab.id, pageNum);
          this.app.tabManager.updateTab(activeTab.id, { currentPage: pageNum });
        } else {
          pageInput.value = activeTab.currentPage;
        }
      }
    });

    // Rotate button
    document.getElementById('btn-rotate').addEventListener('click', () => {
      this.rotatePage();
    });
  }

  rotatePage() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    const newRotation = (activeTab.rotation + 90) % 360;
    this.app.tabManager.updateTab(activeTab.id, { rotation: newRotation });
    this.app.pdfRenderer.setRotation(activeTab.id, newRotation);
  }

  setupViewControls() {
    document.getElementById('btn-page-layout').addEventListener('click', (e) => {
      this.togglePopover('page-layout', e.target);
    });
  }

  setupFileButtons() {
    document.getElementById('btn-search').addEventListener('click', () => {
      this.app.searchManager.toggleSearch();
    });

    document.getElementById('btn-print').addEventListener('click', () => {
      this.print();
    });

    document.getElementById('btn-save').addEventListener('click', () => {
      this.save();
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      this.toggleFullscreen();
    });

    document.getElementById('btn-settings').addEventListener('click', (e) => {
      this.togglePopover('settings', e.target);
    });
  }

  async print() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    window.print();
  }

  async save() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab || !activeTab.hasChanges) return;

    if (window.electronAPI && activeTab.path) {
      const pdfData = await this.app.pdfRenderer.exportPDF(activeTab.id);
      const result = await window.electronAPI.savePdf(activeTab.path, pdfData);
      
      if (result.success) {
        this.app.tabManager.updateTab(activeTab.id, { hasChanges: false });
        alert('File saved successfully');
      } else {
        alert('Error saving file: ' + result.error);
      }
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  setupPopovers() {
    // Draw popover
    this.setupDrawPopover();
    
    // Highlight popover
    this.setupHighlightPopover();
    
    // Page layout popover
    this.setupPageLayoutPopover();
    
    // Settings popover
    this.setupSettingsPopover();
  }

  setupDrawPopover() {
    const popover = document.getElementById('popover-draw');
    const colorGrid = document.getElementById('draw-color-grid');
    const thicknessSlider = document.getElementById('draw-thickness');
    const thicknessPreview = document.getElementById('draw-thickness-preview');

    // Create color grid
    const colors = [
      '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
      '#FF0000', '#FF6600', '#FFCC00', '#FFFF00', '#99FF00', '#00FF00',
      '#00FF99', '#00FFFF', '#0099FF', '#0000FF', '#9900FF', '#FF00FF',
      '#FF0066', '#FF9999', '#FFCC99', '#FFFF99', '#CCFF99', '#99FF99',
      '#99FFCC', '#99FFFF', '#99CCFF', '#9999FF', '#CC99FF', '#FF99FF'
    ];

    colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = color;
      swatch.addEventListener('click', () => {
        colorGrid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.app.annotationManager.setDrawColor(color);
      });
      colorGrid.appendChild(swatch);
    });

    // Set default
    colorGrid.firstChild.classList.add('active');

    // Thickness slider
    thicknessSlider.addEventListener('input', () => {
      const thickness = thicknessSlider.value;
      thicknessPreview.style.height = `${thickness}px`;
      this.app.annotationManager.setDrawThickness(thickness);
    });
  }

  setupHighlightPopover() {
    const popover = document.getElementById('popover-highlight');
    const colorRow = document.getElementById('highlight-color-row');
    const strokeCanvas = document.getElementById('highlight-stroke-canvas');
    const thicknessSlider = document.getElementById('highlight-thickness-slider');
    const textToggle = document.getElementById('highlight-text-toggle');

    // Fixed highlight palette
    const colors = [
      { name: 'Highlight Yellow', value: '#FFF176' },
      { name: 'Highlight Green', value: '#7CFF6B' },
      { name: 'Highlight Blue', value: '#9EE7FF' },
      { name: 'Highlight Pink', value: '#FF9EDB' },
      { name: 'Highlight Red', value: '#FF5A5A' }
    ];

    // Remove any existing swatches
    colorRow.innerHTML = '';
    colors.forEach((color, idx) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = color.value;
      swatch.title = color.name;
      if (this.app.annotationManager.highlightColor === color.value || (idx === 0 && !this.app.annotationManager.highlightColor)) {
        swatch.classList.add('selected');
      }
      swatch.addEventListener('click', (event) => {
        colorRow.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        this.app.annotationManager.setHighlightColor(color.value);
        renderStrokePreview();
        setTimeout(() => this.closeAllPopovers(), 0); // allow other click events to fire
        event.stopPropagation();
      });
      colorRow.appendChild(swatch);
    });

    // Stroke preview rendering
    function renderStrokePreview() {
      const ctx = strokeCanvas.getContext('2d');
      ctx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
      // Find selected color
      const selected = colorRow.querySelector('.color-swatch.selected');
      const color = selected ? selected.style.background : colors[0].value;
      const thickness = parseInt(thicknessSlider.value, 10);
      // Draw organic stroke
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(10, 12 + Math.sin(0) * 2);
      for (let x = 10; x <= 80; x += 7) {
        ctx.lineTo(x, 12 + Math.sin(x / 10) * 4);
      }
      ctx.stroke();
      ctx.restore();
    }
    thicknessSlider.addEventListener('input', () => {
      this.app.annotationManager.setHighlightThickness(parseInt(thicknessSlider.value, 10));
      renderStrokePreview();
    });

    // Initial render
    renderStrokePreview();

    // Toggle switch logic
    function setToggle(on) {
      if (on) {
        textToggle.classList.add('on');
      } else {
        textToggle.classList.remove('on');
      }
    }
    setToggle(this.app.annotationManager.highlightTextOnly);
    textToggle.onclick = () => {
      const isOn = !textToggle.classList.contains('on');
      setToggle(isOn);
      this.app.annotationManager.setHighlightTextOnly(isOn);
    };
  }

  setupPageLayoutPopover() {
    const popover = document.getElementById('popover-page-layout');
    const options = popover.querySelectorAll('.layout-option');

    options.forEach(option => {
      option.addEventListener('click', () => {
        const layout = option.dataset.layout;
        options.forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        
        const activeTab = this.app.tabManager.getActiveTab();
        if (activeTab) {
          this.app.tabManager.updateTab(activeTab.id, { pageLayout: layout });
          this.app.pdfRenderer.setPageLayout(activeTab.id, layout);
        }
        
        this.closeAllPopovers();
      });
    });

    // Set default
    options[0].classList.add('active');
  }

  setupSettingsPopover() {
    const darkModeCheckbox = document.getElementById('setting-dark-mode');
    const pinToolbarCheckbox = document.getElementById('setting-pin-toolbar');
    const hideAnnotationsCheckbox = document.getElementById('setting-hide-annotations');
    const docPropertiesBtn = document.getElementById('btn-doc-properties');

    darkModeCheckbox.addEventListener('change', () => {
      const theme = darkModeCheckbox.checked ? 'dark' : 'light';
      this.app.settingsManager.setTheme(theme);
    });

    pinToolbarCheckbox.addEventListener('change', () => {
      this.app.settingsManager.setPinToolbar(pinToolbarCheckbox.checked);
    });

    hideAnnotationsCheckbox.addEventListener('change', () => {
      this.app.settingsManager.setHideAnnotations(hideAnnotationsCheckbox.checked);
    });

    docPropertiesBtn.addEventListener('click', () => {
      this.app.settingsManager.showDocumentProperties();
      this.closeAllPopovers();
    });
  }

  togglePopover(type, anchorElement) {
    const popoverId = `popover-${type}`;
    const popover = document.getElementById(popoverId);

    if (this.activePopover === popoverId && popover.style.display === 'block') {
      this.closeAllPopovers();
      return;
    }

    this.closeAllPopovers();

    const rect = anchorElement.getBoundingClientRect();
    popover.style.display = 'block';
    
    // Check if this is a right-aligned button (settings, etc.)
    const isRightAligned = anchorElement.closest('.toolbar-right');
    
    if (isRightAligned) {
      // Position from the right edge to prevent going off-screen
      popover.style.left = 'auto';
      popover.style.right = `${window.innerWidth - rect.right}px`;
    } else {
      // Normal left positioning
      popover.style.left = `${rect.left}px`;
      popover.style.right = 'auto';
    }
    
    popover.style.top = `${rect.bottom + 4}px`;

    this.activePopover = popoverId;
  }

  closeAllPopovers() {
    document.querySelectorAll('.popover').forEach(p => {
      p.style.display = 'none';
    });
    this.activePopover = null;
  }

  restoreTabState(tab) {
    // Restore tool
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    if (tab.activeTool) {
      const toolBtn = document.querySelector(`[data-tool="${tab.activeTool}"]`);
      if (toolBtn) {
        toolBtn.classList.add('active');
      }
      this.activeTool = tab.activeTool;
    } else {
      this.activeTool = null;
    }

    // Restore TOC button state
    const tocBtn = document.getElementById('btn-toc');
    if (tab.sidebarOpen) {
      tocBtn.classList.add('active');
    } else {
      tocBtn.classList.remove('active');
    }
  }
}
