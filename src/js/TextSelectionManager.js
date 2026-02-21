/**
 * TextSelectionManager - Text selection based on Okular PDF Viewer
 * Implements the exact Okular text selection algorithm
 * 
 * Based on KDE Okular C++ implementation:
 * https://github.com/KDE/okular/blob/master/part/pageview.cpp
 */

export class TextSelectionManager {
  constructor(app) {
    this.app = app;
    
    // Selection state - mirrors Okular's m_mouseMode, m_mouseAnnotation
    this.mouseMode = 'TextSelect'; // 'TextSelect' | 'Normal' | 'Draw' | etc
    this.isSelecting = false;
    this.selectionStarted = false;
    
    // Selection points - Okular uses QPointF
    this.selectionStart = null;
    this.selectionEnd = null;
    
    // Page selection data - mirrors Okular's Okular::RegularAreaRect
    this.pageSelections = new Map(); // pageNum -> { rects: [], text: '' }
    this.pagesWithSelection = new Set();
    
    // Text content cache for performance
    this.textContentCache = new Map(); // tabId-pageNum -> textContent
    
    // Visual settings
    this.selectionColor = 'rgba(0, 120, 215, 0.3)'; // Blue like Okular
    this.selectionBorderColor = 'rgba(0, 120, 215, 0.8)';
    
    // Performance settings
    this.minSelectionDistance = 5; // Minimum pixels before starting selection
    this.autoScrollPadding = 20;
    this.autoScrollDamping = 6;
    this.scrollTimer = null;
    this.updateTimer = null; // For debouncing selection updates
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   * Okular: PageView::mousePressEvent, mouseMoveEvent, mouseReleaseEvent
   */
  setupEventListeners() {
    const container = document.getElementById('pdf-container');
    
    // Mouse events for text selection
    container.addEventListener('mousedown', (e) => this.mousePressEvent(e), true);
    container.addEventListener('mousemove', (e) => this.mouseMoveEvent(e), true);
    container.addEventListener('mouseup', (e) => this.mouseReleaseEvent(e), true);
    
    // Context menu
    container.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && this.hasSelection()) {
        this.copyTextSelection();
      }
      if (e.key === 'Escape') {
        this.clearSelection();
      }
    });
  }

  /**
   * Mouse press event - Initialize selection
   * Based on Okular's PageView::mousePressEvent() at line 2381
   */
  mousePressEvent(event) {
    // Only handle left mouse button
    if (event.button !== 0) return;
    
    // Don't interfere when highlight tool or other annotation tools are active
    if (document.body.classList.contains('highlight-tool-active') ||
        document.body.classList.contains('draw-tool-active') ||
        document.body.classList.contains('eraser-tool-active') ||
        document.body.classList.contains('text-tool-active')) {
      return;
    }
    
    // Don't interfere with UI elements
    if (!this.isClickOnPage(event.target)) return;
    
    // Clear any existing selection
    this.clearSelection();
    
    // Get mouse position in document coordinates
    const pos = this.contentAreaPoint(event);
    
    // Store start position
    this.selectionStart = pos;
    this.selectionEnd = null;
    this.isSelecting = false;
    this.selectionStarted = false;
    
    // Prevent text selection on the page
    event.preventDefault();
  }

  /**
   * Mouse move event - Update selection as user drags
   * Based on Okular's PageView::mouseMoveEvent() at line 2251
   */
  mouseMoveEvent(event) {
    // Only process if we have a start point
    if (!this.selectionStart) return;
    
    const currentPos = this.contentAreaPoint(event);
    
    // Check if moved enough to start selection (5 pixels threshold)
    if (!this.selectionStarted) {
      const distance = this.manhattanLength(
        currentPos.x - this.selectionStart.x,
        currentPos.y - this.selectionStart.y
      );
      
      if (distance > this.minSelectionDistance) {
        this.selectionStarted = true;
        this.isSelecting = true;
      } else {
        return; // Not moved enough yet
      }
    }
    
    // Update selection end point
    this.selectionEnd = currentPos;
    
    // Auto-scroll if near edges
    this.scrollPosIntoView(currentPos);
    
    // Update immediately - no debounce
    this.updateSelection();
    
    event.preventDefault();
  }

  /**
   * Mouse release event - Finalize selection
   * Based on Okular's PageView::mouseReleaseEvent()
   */
  mouseReleaseEvent(event) {
    if (!this.selectionStart) return;
    
    // If we were selecting, finalize it
    if (this.isSelecting && this.selectionEnd) {
      // Selection is complete and already rendered
      this.isSelecting = false;
    } else {
      // Click without drag - clear selection
      this.clearSelection();
    }
    
    // Reset state but keep selection for copying
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
    
    // Stop auto-scrolling
    this.stopAutoScroll();
  }

  /**
   * Context menu - Show copy option if text selected
   */
  onContextMenu(event) {
    if (this.pagesWithSelection.size > 0) {
      event.preventDefault();
      
      // Simple browser context for copy
      const selectedText = this.getSelectedText();
      if (selectedText) {
        // Copy to clipboard
        this.copyTextSelection();
      }
    }
  }

  /**
   * Main selection update logic
   * Based on Okular's updateSelection() at line 3823
   */
  async updateSelection() {
    if (!this.selectionStart || !this.selectionEnd) return;
    
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;
    
    // Get all pages involved in selection
    const selections = await this.getTextSelections();
    
    // Track which pages have selections
    const newPagesWithSelection = new Set();
    
    // Update each page's selection
    for (const selection of selections) {
      if (selection && selection.rects.length > 0) {
        newPagesWithSelection.add(selection.pageNum);
        this.pageSelections.set(selection.pageNum, selection);
        this.renderPageSelection(activeTab.id, selection.pageNum, selection.rects);
      }
    }
    
    // Clear pages that are no longer selected
    this.pagesWithSelection.forEach(pageNum => {
      if (!newPagesWithSelection.has(pageNum)) {
        this.clearPageSelection(activeTab.id, pageNum);
        this.pageSelections.delete(pageNum);
      }
    });
    
    this.pagesWithSelection = newPagesWithSelection;
  }

  /**
   * Get text selections across multiple pages
   * Based on Okular's textSelections() at line 3441
   */
  async getTextSelections() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return [];
    
    const doc = this.app.pdfRenderer.getDocument(activeTab.id);
    const pageElements = this.app.pdfRenderer.pageElements.get(activeTab.id);
    if (!doc || !pageElements) return [];
    
    const selections = [];
    
    // Get selection bounds
    const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const endX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const endY = Math.max(this.selectionStart.y, this.selectionEnd.y);
    
    // Find which pages intersect the selection
    const affectedPages = [];
    pageElements.forEach((pageEl, index) => {
      const pageRect = pageEl.getBoundingClientRect();
      const container = document.getElementById('pdf-container');
      const containerRect = container.getBoundingClientRect();
      
      const pageTop = pageRect.top - containerRect.top + container.scrollTop;
      const pageLeft = pageRect.left - containerRect.left + container.scrollLeft;
      const pageBottom = pageTop + pageEl.offsetHeight;
      const pageRight = pageLeft + pageEl.offsetWidth;
      
      // Check if selection intersects this page
      if (!(endX < pageLeft || startX > pageRight || endY < pageTop || startY > pageBottom)) {
        affectedPages.push({
          index,
          pageNum: index + 1,
          element: pageEl,
          top: pageTop,
          left: pageLeft,
          bottom: pageBottom,
          right: pageRight
        });
      }
    });
    
    if (affectedPages.length === 0) return selections;
    
    // Process each affected page
    for (const pageData of affectedPages) {
      const selection = await this.getTextSelectionForPage(pageData);
      if (selection) {
        selections.push(selection);
      }
    }
    
    return selections;
  }

  /**
   * Get text selection for a single page
   * Based on Okular's textSelectionForItem() at line 3883
   * PROPER CHARACTER-BY-CHARACTER SELECTION LIKE OKULAR
   */
  async getTextSelectionForPage(pageData) {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return null;
    
    try {
      const doc = this.app.pdfRenderer.getDocument(activeTab.id);
      const page = await doc.getPage(pageData.pageNum);
      const textContent = await this.getPageTextContent(activeTab.id, pageData.pageNum);
      
      if (!textContent || !textContent.items) return null;
      
      // Convert selection coordinates to page-relative coordinates
      const pageWidth = pageData.element.offsetWidth;
      const pageHeight = pageData.element.offsetHeight;
      
      // Selection bounds relative to page
      let selStartX = this.selectionStart.x - pageData.left;
      let selStartY = this.selectionStart.y - pageData.top;
      let selEndX = this.selectionEnd.x - pageData.left;
      let selEndY = this.selectionEnd.y - pageData.top;
      
      // Build a list of all characters with their positions
      const characters = [];
      
      textContent.items.forEach(item => {
        const transform = item.transform;
        const itemX = transform[4];
        const itemY = transform[5];
        const itemWidth = item.width;
        const itemHeight = item.height;
        
        // Item position in screen coordinates (top-down)
        const itemScreenY = pageHeight - itemY - itemHeight;
        
        // For each character in the text
        const charWidth = itemWidth / (item.str.length || 1);
        
        for (let i = 0; i < item.str.length; i++) {
          const charX = itemX + (i * charWidth);
          const charY = itemScreenY;
          const charCenterX = charX + charWidth / 2;
          const charCenterY = charY + itemHeight / 2;
          
          characters.push({
            char: item.str[i],
            x: charX,
            y: charY,
            width: charWidth,
            height: itemHeight,
            centerX: charCenterX,
            centerY: charCenterY
          });
        }
      });
      
      // Sort characters in reading order (top to bottom, left to right)
      characters.sort((a, b) => {
        const yDiff = a.centerY - b.centerY;
        if (Math.abs(yDiff) < 5) { // Same line
          return a.centerX - b.centerX;
        }
        return yDiff;
      });
      
      // Find start and end character indices
      let startIdx = -1;
      let endIdx = -1;
      let minStartDist = Infinity;
      let minEndDist = Infinity;
      
      characters.forEach((ch, idx) => {
        // Distance from selection start point
        const startDist = Math.sqrt(
          Math.pow(ch.centerX - selStartX, 2) + 
          Math.pow(ch.centerY - selStartY, 2)
        );
        
        // Distance from selection end point
        const endDist = Math.sqrt(
          Math.pow(ch.centerX - selEndX, 2) + 
          Math.pow(ch.centerY - selEndY, 2)
        );
        
        if (startDist < minStartDist) {
          minStartDist = startDist;
          startIdx = idx;
        }
        
        if (endDist < minEndDist) {
          minEndDist = endDist;
          endIdx = idx;
        }
      });
      
      // Ensure startIdx <= endIdx
      if (startIdx > endIdx) {
        [startIdx, endIdx] = [endIdx, startIdx];
      }
      
      // Select characters from startIdx to endIdx
      const rects = [];
      const selectedChars = [];
      
      if (startIdx !== -1 && endIdx !== -1) {
        for (let i = startIdx; i <= endIdx; i++) {
          const ch = characters[i];
          rects.push({
            x: ch.x,
            y: ch.y,
            width: ch.width,
            height: ch.height,
            text: ch.char
          });
          selectedChars.push(ch.char);
        }
      }
      
      // Extract text
      const text = selectedChars.join('');
      
      return {
        pageNum: pageData.pageNum,
        rects,
        text
      };
    } catch (error) {
      console.error(`Error getting text selection for page ${pageData.pageNum}:`, error);
      return null;
    }
  }

  /**
   * Get or cache text content for a page
   */
  async getPageTextContent(tabId, pageNum) {
    const cacheKey = `${tabId}-${pageNum}`;
    
    if (this.textContentCache.has(cacheKey)) {
      return this.textContentCache.get(cacheKey);
    }
    
    try {
      const doc = this.app.pdfRenderer.getDocument(tabId);
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      this.textContentCache.set(cacheKey, textContent);
      return textContent;
    } catch (error) {
      console.error(`Error loading text content for page ${pageNum}:`, error);
      return { items: [] };
    }
  }

  /**
   * Render selection on a page
   */
  renderPageSelection(tabId, pageNum, rects) {
    const pages = this.app.pdfRenderer.pageElements.get(tabId);
    if (!pages || pageNum < 1 || pageNum > pages.length) return;
    
    const pageElement = pages[pageNum - 1];
    const annotationLayer = pageElement.querySelector('.annotation-layer');
    
    if (!annotationLayer) return;
    
    // Create or update selection overlay
    let overlay = annotationLayer.querySelector('.text-selection-overlay');
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.className = 'text-selection-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '1';
      annotationLayer.appendChild(overlay);
    }
    
    // Set canvas size to match page
    overlay.width = pageElement.offsetWidth;
    overlay.height = pageElement.offsetHeight;
    
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Draw selection rectangles - no border, just fill
    ctx.fillStyle = this.selectionColor;
    
    // Merge overlapping rectangles on the same line to avoid gaps
    const mergedRects = this.mergeRects(rects);
    
    mergedRects.forEach(rect => {
      // Only fill, no stroke
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    });
  }

  /**
   * Merge rectangles on the same line to avoid visual gaps
   */
  mergeRects(rects) {
    if (rects.length === 0) return [];
    
    // Sort by y position first, then x
    const sorted = [...rects].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) < 2) { // Same line (within 2px tolerance)
        return a.x - b.x;
      }
      return yDiff;
    });
    
    const merged = [];
    let current = { ...sorted[0] };
    
    for (let i = 1; i < sorted.length; i++) {
      const rect = sorted[i];
      
      // Check if on the same line
      if (Math.abs(rect.y - current.y) < 2 && Math.abs(rect.height - current.height) < 2) {
        // Check if adjacent or overlapping
        if (rect.x <= current.x + current.width + 2) {
          // Merge
          current.width = Math.max(current.x + current.width, rect.x + rect.width) - current.x;
          current.text = (current.text || '') + (rect.text || '');
        } else {
          // Not adjacent, push current and start new
          merged.push(current);
          current = { ...rect };
        }
      } else {
        // Different line, push current and start new
        merged.push(current);
        current = { ...rect };
      }
    }
    
    // Push the last one
    merged.push(current);
    
    return merged;
  }

  /**
   * Clear selection on a specific page
   */
  clearPageSelection(tabId, pageNum) {
    const pages = this.app.pdfRenderer.pageElements.get(tabId);
    if (!pages || pageNum < 1 || pageNum > pages.length) return;
    
    const pageElement = pages[pageNum - 1];
    const overlay = pageElement.querySelector('.text-selection-overlay');
    
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;
    
    this.pagesWithSelection.forEach(pageNum => {
      this.clearPageSelection(activeTab.id, pageNum);
    });
    
    this.pagesWithSelection.clear();
    this.pageSelections.clear();
    this.selectionStart = null;
    this.selectionEnd = null;
  }

  /**
   * Copy selected text to clipboard
   */
  async copyTextSelection() {
    if (this.pagesWithSelection.size === 0) return;
    
    let text = this.getSelectedText();
    
    try {
      await navigator.clipboard.writeText(text);
      console.log('Text copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }

  /**
   * Get selected text from all pages
   */
  getSelectedText() {
    let text = '';
    const sortedPages = Array.from(this.pagesWithSelection).sort((a, b) => a - b);
    
    sortedPages.forEach((pageNum, idx) => {
      const selection = this.pageSelections.get(pageNum);
      if (selection) {
        text += selection.text;
        if (idx < sortedPages.length - 1) {
          text += '\n\n'; // Separate pages with double newline
        }
      }
    });
    
    return text;
  }

  /**
   * Check if there is any selection
   */
  hasSelection() {
    return this.pagesWithSelection.size > 0;
  }

  /**
   * Auto-scroll when selection reaches viewport edge
   * Based on Okular's scrollPosIntoView()
   */
  scrollPosIntoView(pos) {
    const container = document.getElementById('pdf-container');
    const containerRect = container.getBoundingClientRect();
    
    const relX = pos.x - container.scrollLeft;
    const relY = pos.y - container.scrollTop;
    
    let scrollX = 0;
    let scrollY = 0;
    
    // Check horizontal scrolling
    if (relX < this.autoScrollPadding) {
      scrollX = (relX - this.autoScrollPadding) / this.autoScrollDamping;
    } else if (relX > containerRect.width - this.autoScrollPadding) {
      scrollX = (relX - (containerRect.width - this.autoScrollPadding)) / this.autoScrollDamping;
    }
    
    // Check vertical scrolling
    if (relY < this.autoScrollPadding) {
      scrollY = (relY - this.autoScrollPadding) / this.autoScrollDamping;
    } else if (relY > containerRect.height - this.autoScrollPadding) {
      scrollY = (relY - (containerRect.height - this.autoScrollPadding)) / this.autoScrollDamping;
    }
    
    // Apply scrolling
    if (scrollX !== 0 || scrollY !== 0) {
      if (!this.scrollTimer) {
        this.scrollTimer = setInterval(() => {
          container.scrollLeft += scrollX;
          container.scrollTop += scrollY;
        }, 1000 / 60); // 60 FPS
      }
    } else {
      this.stopAutoScroll();
    }
  }

  stopAutoScroll() {
    if (this.scrollTimer) {
      clearInterval(this.scrollTimer);
      this.scrollTimer = null;
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Get point in content area coordinates
   */
  contentAreaPoint(event) {
    const container = document.getElementById('pdf-container');
    const rect = container.getBoundingClientRect();
    
    return {
      x: event.clientX - rect.left + container.scrollLeft,
      y: event.clientY - rect.top + container.scrollTop
    };
  }

  /**
   * Manhattan distance (Okular uses this for movement threshold)
   */
  manhattanLength(dx, dy) {
    return Math.abs(dx) + Math.abs(dy);
  }

  /**
   * Check if click is on a page (not on UI elements)
   */
  isClickOnPage(element) {
    return element.closest('.page-container') !== null;
  }

  /**
   * Check if two rectangles overlap
   */
  rectsOverlap(x1, y1, x2, y2, x3, y3, x4, y4) {
    return !(x2 < x3 || x1 > x4 || y2 < y3 || y1 > y4);
  }
}
