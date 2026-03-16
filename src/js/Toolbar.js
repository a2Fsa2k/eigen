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
    
    // Initialize save button to saved state (no changes initially)
    setTimeout(() => {
      const saveBtn = document.getElementById('btn-save');
      if (saveBtn) {
        saveBtn.classList.add('saved');
        console.log('Save button initialized with saved state');
      }
    }, 100);
    
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

  /**
   * Mark save button as having unsaved changes
   */
  markUnsavedChanges() {
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.classList.remove('saved');
      console.log('Save button marked as having unsaved changes');
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

    // Draw arrow - opens new dropdown
    document.getElementById('btn-draw-arrow').addEventListener('click', (e) => {
      e.stopPropagation();
      const button = e.target.closest('.toolbar-btn-arrow') || e.target;
      this.app.annotationManager.toggleDrawToolDropdown(button);
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
      console.log('Page layout button clicked');
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

    const viewer = document.getElementById('pdf-viewer');
    if (!viewer) {
      window.print();
      return;
    }

    const pageEls = Array.from(viewer.querySelectorAll('.page-container'));
    if (pageEls.length === 0) {
      window.print();
      return;
    }

    // IMPORTANT: cloning <canvas> does NOT copy its pixels. For printing we need to
    // convert canvases to images (data URLs) so the bitmap is preserved.
    const pagesHtml = pageEls
      .map((pageEl) => {
        const pageCanvas = pageEl.querySelector('canvas.pdf-page');
        if (!pageCanvas) return '';

        const pageW = pageCanvas.width;
        const pageH = pageCanvas.height;

        const pageUrl = pageCanvas.toDataURL('image/png');

        const overlayUrls = [];
        pageEl.querySelectorAll('.annotation-layer canvas, canvas.draw-overlay-canvas')
          .forEach((c) => {
            try {
              // Skip the base PDF canvas if it matches selector somehow
              if (c.classList.contains('pdf-page')) return;
              overlayUrls.push(c.toDataURL('image/png'));
            } catch {
              // ignore
            }
          });

        const overlaysHtml = overlayUrls
          .map((url) => `<img class="overlay" src="${url}" alt="" />`)
          .join('');

        return `
          <div class="print-page" style="width:${pageW}px;height:${pageH}px">
            <img class="base" src="${pageUrl}" alt="" />
            ${overlaysHtml}
          </div>
        `;
      })
      .join('\n');

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const frameWin = iframe.contentWindow;
    const doc = frameWin?.document;
    if (!doc || !frameWin) {
      iframe.remove();
      window.print();
      return;
    }

    let didPrint = false;
    const cleanup = () => setTimeout(() => iframe.remove(), 1000);

    const triggerPrintOnce = () => {
      if (didPrint) return;
      didPrint = true;
      try {
        frameWin.focus();
        frameWin.print();
      } finally {
        cleanup();
      }
    };

    iframe.onload = () => {
      frameWin.requestAnimationFrame(() => {
        frameWin.requestAnimationFrame(triggerPrintOnce);
      });
    };

    doc.open();
    doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print</title>
  <style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }

    .print-page {
      position: relative;
      margin: 0 auto;
      page-break-after: always;
    }
    .print-page:last-child { page-break-after: auto; }

    .print-page > img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`);
    doc.close();

    const readyPoll = setInterval(() => {
      if (didPrint) {
        clearInterval(readyPoll);
        return;
      }
      const state = doc.readyState;
      if (state === 'interactive' || state === 'complete') {
        clearInterval(readyPoll);
        frameWin.requestAnimationFrame(() => {
          frameWin.requestAnimationFrame(triggerPrintOnce);
        });
      }
    }, 25);
  }

  async save() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    const saveBtn = document.getElementById('btn-save');
    
    console.log('save(): activeTab:', activeTab);
    console.log('save(): fileData exists?', !!activeTab.fileData);
    console.log('save(): fileData size:', activeTab.fileData ? activeTab.fileData.byteLength : 0);
    
    try {
      const pdfBytes = await this.app.pdfRenderer.exportPDF(activeTab.id);
      
      if (!pdfBytes) {
        alert('Error: Could not export PDF data');
        return;
      }
      
      // Check if running in Electron
      if (window.electronAPI && activeTab.path) {
        // Electron needs regular array for IPC
        const pdfArray = Array.from(pdfBytes);
        const result = await window.electronAPI.savePdf(activeTab.path, pdfArray);
        
        if (result.success) {
          this.app.tabManager.updateTab(activeTab.id, { hasChanges: false });
          saveBtn.classList.add('saved');
          alert('File saved successfully');
        } else {
          alert('Error saving file: ' + result.error);
        }
      } else {
        // Web version - trigger download directly with Uint8Array
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeTab.filename || activeTab.name || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Mark as saved
        if (activeTab.hasChanges) {
          this.app.tabManager.updateTab(activeTab.id, { hasChanges: false });
          saveBtn.classList.add('saved');
        }
        
        console.log('PDF downloaded successfully');
      }
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert('Error saving PDF: ' + error.message);
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
    const colorGrid = document.getElementById('highlight-color-grid');
    const thicknessSlider = document.getElementById('highlight-thickness');
    const textOnlyToggle = document.getElementById('highlight-text-only');

    // SVG preview elements
    const previewPath = document.getElementById('highlight-preview-path');

    const colors = [
      '#FFFF00', '#7CFF5B', '#7FD9FF', '#FF8FD0', '#FF4B4B'
    ];

    colorGrid.innerHTML = '';
    colors.forEach(color => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-swatch';
      swatch.style.background = color;
      swatch.setAttribute('aria-label', `Highlight color ${color}`);

      swatch.addEventListener('click', () => {
        colorGrid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected', 'active'));
        swatch.classList.add('selected');
        this.app.annotationManager.setHighlightColor(color);
        if (previewPath) previewPath.setAttribute('stroke', color);
      });

      colorGrid.appendChild(swatch);
    });

    // Defaults: sync UI from manager
    const initialColor = this.app.annotationManager.highlightColor || colors[0];
    const initialThickness = parseInt(this.app.annotationManager.highlightThickness || thicknessSlider.value || '15', 10);

    // select closest matching swatch
    const swatches = Array.from(colorGrid.querySelectorAll('.color-swatch'));
    const found = swatches.find(s => String(s.style.background).toLowerCase() === initialColor.toLowerCase());
    (found || swatches[0])?.classList.add('selected');

    this.app.annotationManager.setHighlightColor(initialColor);
    this.app.annotationManager.setHighlightThickness(initialThickness);

    thicknessSlider.value = String(initialThickness);
    if (previewPath) {
      previewPath.setAttribute('stroke', initialColor);
      previewPath.setAttribute('stroke-width', String(initialThickness));
    }

    // Thickness slider
    thicknessSlider.addEventListener('input', () => {
      const thickness = parseInt(thicknessSlider.value, 10);
      this.app.annotationManager.setHighlightThickness(thickness);
      if (previewPath) previewPath.setAttribute('stroke-width', String(thickness));
    });

    // Text only mode
    if (textOnlyToggle) {
      const thicknessSection = popover.querySelector('.highlight-thickness-section');

      const applyTextOnlyUI = () => {
        const disabled = !!textOnlyToggle.checked;
        if (thicknessSection) {
          thicknessSection.style.opacity = disabled ? '0.45' : '1';
          thicknessSection.style.pointerEvents = disabled ? 'none' : 'auto';
        }
      };

      textOnlyToggle.checked = !!this.app.annotationManager.highlightTextOnly;
      applyTextOnlyUI();

      textOnlyToggle.addEventListener('change', () => {
        this.app.annotationManager.setHighlightTextOnly(textOnlyToggle.checked);
        applyTextOnlyUI();
      });
    }
  }

  setupPageLayoutPopover() {
    const popover = document.getElementById('popover-page-layout');
    const options = popover.querySelectorAll('.layout-option');

    console.log('Setting up page layout popover', { popover, options: options.length });

    const applyActiveStateFromTab = () => {
      const activeTab = this.app.tabManager.getActiveTab();
      const layout = activeTab?.pageLayout || 'single';
      options.forEach(o => o.classList.toggle('active', o.dataset.layout === layout));
    };

    options.forEach(option => {
      option.addEventListener('click', async () => {
        const layout = option.dataset.layout;
        console.log('Layout option clicked:', layout);

        try {
          const activeTab = this.app.tabManager.getActiveTab();
          if (activeTab) {
            // PDFRenderer.setPageLayout now persists state + rerenders
            await this.app.pdfRenderer.setPageLayout(activeTab.id, layout);
          }
        } finally {
          applyActiveStateFromTab();
          this.closeAllPopovers();
        }
      });
    });

    // Initialize active state
    applyActiveStateFromTab();
  }

  setupSettingsPopover() {
    const darkModeCheckbox = document.getElementById('setting-dark-mode');
    const hideAnnotationsCheckbox = document.getElementById('setting-hide-annotations');
    const docPropertiesBtn = document.getElementById('btn-doc-properties');

    darkModeCheckbox.addEventListener('change', () => {
      const theme = darkModeCheckbox.checked ? 'dark' : 'light';
      this.app.settingsManager.setTheme(theme);
    });

    hideAnnotationsCheckbox.addEventListener('change', () => {
      this.app.settingsManager.setHideAnnotations(hideAnnotationsCheckbox.checked);
    });

    docPropertiesBtn.addEventListener('click', () => {
      this.app.settingsManager.showDocumentProperties();
      this.closeAllPopovers();
    });

    // Setup modal controls
    this.setupDocumentPropertiesModal();
  }

  setupDocumentPropertiesModal() {
    const modal = document.getElementById('doc-properties-modal');
    const closeBtn = document.getElementById('doc-properties-close');
    const okBtn = document.getElementById('doc-properties-ok');
    const tabs = document.querySelectorAll('.prop-tab');
    const panels = document.querySelectorAll('.prop-panel');

    // Close modal handlers
    const closeModal = () => {
      modal.style.display = 'none';
    };

    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        panels.forEach(panel => {
          panel.classList.remove('active');
          if (panel.id === `prop-${targetTab}`) {
            panel.classList.add('active');
          }
        });
      });
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
    
    // Also close draw and highlight dropdowns
    document.querySelectorAll('.draw-tool-dropdown, .highlight-popover').forEach(d => {
      d.classList.remove('open');
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
