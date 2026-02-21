import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export class PDFRenderer {
  constructor(app) {
    this.app = app;
    this.documents = new Map();
    this.pageElements = new Map();
    this.viewer = document.getElementById('pdf-viewer');
    this.container = document.getElementById('pdf-container');
    
    this.setupScrollListener();
  }

  async loadDocument(data, tabId) {
    try {
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdfDoc = await loadingTask.promise;
      
      this.documents.set(tabId, pdfDoc);
      this.pageElements.set(tabId, []);
      
      // Update page count immediately after document is loaded
      this.app.updateUI();
      
      await this.renderDocument(tabId);
      
      return pdfDoc;
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Error loading PDF: ' + error.message);
      throw error;
    }
  }

  async renderDocument(tabId) {
    const doc = this.documents.get(tabId);
    if (!doc) return;

    const tab = this.app.tabManager.getTab(tabId);
    if (!tab) return;

    console.log('renderDocument called:', { tabId, pageLayout: tab.pageLayout });

    this.viewer.innerHTML = '';
    const pages = [];

    const pageLayout = tab.pageLayout || 'single';
    
    console.log('Applying page layout:', pageLayout);
    
    // Apply layout class
    if (pageLayout === 'two-page') {
      this.viewer.classList.add('two-page-layout');
      // Explicitly set flex properties for two-page layout
      this.viewer.style.display = 'flex';
      this.viewer.style.flexDirection = 'row';
      this.viewer.style.flexWrap = 'wrap';
      this.viewer.style.justifyContent = 'center';
      this.viewer.style.alignItems = 'flex-start';
      this.viewer.style.gap = '20px';
    } else {
      this.viewer.classList.remove('two-page-layout');
      // Reset to single page (column) layout
      this.viewer.style.display = 'flex';
      this.viewer.style.flexDirection = 'column';
      this.viewer.style.flexWrap = 'nowrap';
      this.viewer.style.alignItems = 'center';
      this.viewer.style.justifyContent = 'flex-start';
      this.viewer.style.gap = '0';
    }

    // Render pages
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const pageContainer = await this.createPageContainer(doc, pageNum, tabId);
      pages.push(pageContainer);
      this.viewer.appendChild(pageContainer);
    }

    this.pageElements.set(tabId, pages);
  }

  async createPageContainer(doc, pageNum, tabId) {
    const tab = this.app.tabManager.getTab(tabId);
    const page = await doc.getPage(pageNum);
    
    const scale = tab.zoom || 1.0;
    const rotation = tab.rotation || 0;
    
    // Use device pixel ratio for high-DPI displays (Retina, 4K, etc.)
    const dpr = window.devicePixelRatio || 1;
    
    const viewport = page.getViewport({ scale, rotation });

    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.dataset.page = pageNum;
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page';
    
    // Set canvas internal size to account for device pixel ratio
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    // Set canvas display size (CSS)
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const context = canvas.getContext('2d');
    // Use setTransform for sharp rendering
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Add text layer (custom, minimal, NO PDF.js helpers)
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'text-layer';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    try {
      const textContent = await page.getTextContent();
      textContent.items.forEach(item => {
        const span = document.createElement('span');
        // Use PDF.js Util to get transform for each text item
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        span.style.position = 'absolute';
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - item.height}px`;
        span.style.fontSize = `${item.height}px`;
        span.style.fontFamily = item.fontName;
        span.textContent = item.str;
        span.style.color = 'transparent';
        span.style.whiteSpace = 'pre';
        textLayerDiv.appendChild(span);
      });
    } catch (e) {
      console.error('Error rendering text layer:', e);
    }

    // Add annotation layer
    const annotationLayerDiv = document.createElement('div');
    annotationLayerDiv.className = 'annotation-layer';
    annotationLayerDiv.style.width = `${viewport.width}px`;
    annotationLayerDiv.style.height = `${viewport.height}px`;
    annotationLayerDiv.dataset.page = pageNum;
    annotationLayerDiv.dataset.tab = tabId;

    pageContainer.appendChild(canvas);
    pageContainer.appendChild(textLayerDiv);
    pageContainer.appendChild(annotationLayerDiv);

    return pageContainer;
  }

  switchToTab(tabId) {
    const doc = this.documents.get(tabId);
    if (!doc) {
      // Show empty state with open file button
      this.viewer.innerHTML = `
        <div class="empty-state">
          <p>Open a PDF to get started</p>
          <button id="btn-open-file" class="open-file-btn">Open File</button>
        </div>
      `;
      
      // Re-attach event listener for the open file button
      const openFileBtn = document.getElementById('btn-open-file');
      if (openFileBtn) {
        openFileBtn.addEventListener('click', () => {
          this.app.openFile();
        });
      }
      return;
    }

    // Check if pages are already rendered for this tab
    const existingPages = this.pageElements.get(tabId);
    const tab = this.app.tabManager.getTab(tabId);
    
    if (existingPages && existingPages.length > 0) {
      // Pages already rendered, just show them
      this.viewer.innerHTML = '';
      existingPages.forEach(page => {
        this.viewer.appendChild(page);
      });
      
      // Apply layout class
      const pageLayout = tab.pageLayout || 'single';
      if (pageLayout === 'two-page') {
        this.viewer.classList.add('two-page-layout');
        this.viewer.style.display = 'flex';
        this.viewer.style.flexDirection = 'row';
        this.viewer.style.flexWrap = 'wrap';
        this.viewer.style.justifyContent = 'center';
        this.viewer.style.alignItems = 'flex-start';
        this.viewer.style.gap = '20px';
      } else {
        this.viewer.classList.remove('two-page-layout');
        this.viewer.style.display = 'flex';
        this.viewer.style.flexDirection = 'column';
        this.viewer.style.flexWrap = 'nowrap';
        this.viewer.style.alignItems = 'center';
        this.viewer.style.justifyContent = 'flex-start';
        this.viewer.style.gap = '0';
      }
      
      // Restore scroll position after a short delay to ensure DOM is ready
      if (tab && tab.scrollPosition !== undefined) {
        requestAnimationFrame(() => {
          this.container.scrollTop = tab.scrollPosition;
        });
      }
    } else {
      // First time rendering this tab, render all pages
      this.renderDocument(tabId);
    }
  }

  closeDocument(tabId) {
    const doc = this.documents.get(tabId);
    if (doc) {
      doc.destroy();
    }
    this.documents.delete(tabId);
    this.pageElements.delete(tabId);
  }

  getDocument(tabId) {
    return this.documents.get(tabId);
  }

  async setZoom(tabId, zoom) {
    const tab = this.app.tabManager.getTab(tabId);
    if (!tab) return;

    tab.zoom = zoom;
    await this.renderDocument(tabId);
  }

  async fitToWidth(tabId, containerWidth) {
    const doc = this.documents.get(tabId);
    if (!doc) return;

    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    
    const scale = containerWidth / viewport.width;
    
    this.app.tabManager.updateTab(tabId, { zoom: scale });
    await this.renderDocument(tabId);
  }

  async setRotation(tabId, rotation) {
    const tab = this.app.tabManager.getTab(tabId);
    if (!tab) return;

    const currentPage = tab.currentPage || 1;
    
    await this.renderDocument(tabId);
    
    // Restore the current page position after rotation
    await this.goToPage(tabId, currentPage);
  }

  async setPageLayout(tabId, layout) {
    console.log('setPageLayout called:', { tabId, layout });
    await this.renderDocument(tabId);
  }

  async goToPage(tabId, pageNum) {
    const pages = this.pageElements.get(tabId);
    if (!pages || pageNum < 1 || pageNum > pages.length) return;

    const pageContainer = pages[pageNum - 1];
    if (pageContainer) {
      pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      this.app.tabManager.updateTab(tabId, { currentPage: pageNum });
      document.getElementById('page-number').value = pageNum;
      
      // Update sidebar
      this.app.sidebar.updateCurrentPage(tabId, pageNum);
    }
  }

  setupScrollListener() {
    let scrollTimeout;
    
    this.container.addEventListener('scroll', () => {
      const activeTab = this.app.tabManager.getActiveTab();
      if (!activeTab) return;

      // Save scroll position
      this.app.tabManager.updateTab(activeTab.id, { 
        scrollPosition: this.container.scrollTop 
      });

      // Debounce page detection
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.detectCurrentPage(activeTab.id);
      }, 100);
    });
  }

  detectCurrentPage(tabId) {
    const pages = this.pageElements.get(tabId);
    if (!pages) return;

    const containerRect = this.container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    for (let i = 0; i < pages.length; i++) {
      const pageRect = pages[i].getBoundingClientRect();
      
      if (pageRect.top <= containerCenter && pageRect.bottom >= containerCenter) {
        const pageNum = i + 1;
        const tab = this.app.tabManager.getTab(tabId);
        
        if (tab && tab.currentPage !== pageNum) {
          this.app.tabManager.updateTab(tabId, { currentPage: pageNum });
          document.getElementById('page-number').value = pageNum;
          this.app.sidebar.updateCurrentPage(tabId, pageNum);
        }
        break;
      }
    }
  }

  async exportPDF(tabId) {
    const tab = this.app.tabManager.getTab(tabId);
    
    console.log('exportPDF called for tab:', tabId);
    console.log('Tab object:', tab);
    console.log('fileData exists?', !!tab?.fileData);
    console.log('fileData type:', tab?.fileData ? tab.fileData.constructor.name : 'undefined');
    console.log('fileData size:', tab?.fileData ? tab.fileData.byteLength || tab.fileData.length : 0);
    
    if (!tab || !tab.fileData) {
      console.error('No tab or fileData found for export');
      return null;
    }

    // Get all annotations for this tab
    const drawPaths = this.app.annotationManager.drawPaths.get(tabId) || new Map();
    const highlightPaths = this.app.annotationManager.highlightPaths.get(tabId) || new Map();
    const highlights = this.app.annotationManager.highlights.get(tabId) || new Map();
    
    // Check if there are any annotations
    const hasAnnotations = drawPaths.size > 0 || highlightPaths.size > 0 || highlights.size > 0;
    
    console.log('Has annotations?', hasAnnotations);
    console.log('Draw paths:', drawPaths.size, 'Highlight paths:', highlightPaths.size, 'Highlights:', highlights.size);
    console.log('Draw paths Map:', drawPaths);
    
    // Count total paths across all pages
    let totalDrawPaths = 0;
    drawPaths.forEach((pagePaths) => {
      totalDrawPaths += pagePaths.length;
    });
    console.log('Total draw paths across all pages:', totalDrawPaths);
    
    // If no annotations, just return the original file
    if (!hasAnnotations) {
      console.log('No annotations, returning original file');
      if (tab.fileData instanceof Uint8Array) {
        return tab.fileData;
      } else if (tab.fileData instanceof ArrayBuffer) {
        return new Uint8Array(tab.fileData);
      } else if (Array.isArray(tab.fileData)) {
        return new Uint8Array(tab.fileData);
      }
      return new Uint8Array(tab.fileData);
    }

    try {
      // Import pdf-lib dynamically
      const { PDFDocument, rgb } = await import('pdf-lib');
      
      // Ensure fileData is a Uint8Array
      let pdfData;
      if (tab.fileData instanceof Uint8Array) {
        pdfData = tab.fileData;
      } else if (tab.fileData instanceof ArrayBuffer) {
        pdfData = new Uint8Array(tab.fileData);
      } else if (Array.isArray(tab.fileData)) {
        pdfData = new Uint8Array(tab.fileData);
      } else {
        console.error('Invalid fileData format:', typeof tab.fileData);
        return null;
      }
      
      console.log('Loading PDF, data size:', pdfData.byteLength);
      
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(pdfData);
      const pages = pdfDoc.getPages();
      
      console.log('PDF loaded, pages:', pages.length);
      
      // Draw annotations on each page
      for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
        const page = pages[pageNum - 1];
        const { width, height } = page.getSize();
        
        // Get the page element to extract scale
        const pageElements = this.pageElements.get(tabId);
        const pageElement = pageElements ? pageElements[pageNum - 1] : null;
        const scale = tab.zoom || 1.0;
        
        // Draw paths for this page
        const pagePaths = drawPaths.get(pageNum) || [];
        console.log(`Page ${pageNum}: Found ${pagePaths.length} draw paths`);
        pagePaths.forEach((path, pathIndex) => {
          console.log(`  Path ${pathIndex}:`, { points: path.points?.length, color: path.color, thickness: path.thickness });
          // Convert canvas coordinates to PDF coordinates
          const pdfPath = path.points.map(point => ({
            x: (point.x / scale),
            y: height - (point.y / scale) // Flip Y axis
          }));
          
          // Draw lines between points
          for (let i = 0; i < pdfPath.length - 1; i++) {
            page.drawLine({
              start: { x: pdfPath[i].x, y: pdfPath[i].y },
              end: { x: pdfPath[i + 1].x, y: pdfPath[i + 1].y },
              thickness: path.thickness / scale,
              color: this.hexToRgb(path.color),
              opacity: 1
            });
          }
        });
        
        // Draw highlight paths for this page
        const pageHighlights = highlightPaths.get(pageNum) || [];
        pageHighlights.forEach(highlight => {
          const pdfPath = highlight.points.map(point => ({
            x: (point.x / scale),
            y: height - (point.y / scale)
          }));
          
          for (let i = 0; i < pdfPath.length - 1; i++) {
            page.drawLine({
              start: { x: pdfPath[i].x, y: pdfPath[i].y },
              end: { x: pdfPath[i + 1].x, y: pdfPath[i + 1].y },
              thickness: highlight.thickness / scale,
              color: this.hexToRgb(highlight.color),
              opacity: 0.4
            });
          }
        });
        
        // Draw text-selection highlights for this page
        const pageTextHighlights = highlights.get(pageNum) || [];
        pageTextHighlights.forEach(highlight => {
          page.drawRectangle({
            x: highlight.x / scale,
            y: height - (highlight.y + highlight.height) / scale,
            width: highlight.width / scale,
            height: highlight.height / scale,
            color: this.hexToRgb(highlight.color),
            opacity: 0.4
          });
        });
      }
      
      // Save the PDF and return as Uint8Array
      const pdfBytes = await pdfDoc.save();
      console.log('PDF saved, output size:', pdfBytes.byteLength);
      return pdfBytes; // Return Uint8Array directly
      
    } catch (error) {
      console.error('Error exporting PDF with annotations:', error);
      // Fallback: return original data as Uint8Array
      if (tab.fileData instanceof Uint8Array) {
        return tab.fileData;
      } else if (tab.fileData instanceof ArrayBuffer) {
        return new Uint8Array(tab.fileData);
      } else if (Array.isArray(tab.fileData)) {
        return new Uint8Array(tab.fileData);
      }
      return new Uint8Array(tab.fileData);
    }
  }
  
  /**
   * Convert hex color to RGB for pdf-lib
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ) : rgb(0, 0, 0);
  }
}
