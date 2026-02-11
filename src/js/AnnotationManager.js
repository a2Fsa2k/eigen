import { DrawToolState } from './DrawToolState.js';
import { DrawToolUI } from './DrawToolUI.js';
import { DrawingEngine } from './DrawingEngine.js';
import { EraserEngine } from './EraserEngine.js';
import { TextTool } from './TextTool.js';

export class AnnotationManager {
  constructor(app) {
    this.app = app;
    this.activeTool = null;
    this.isDrawing = false;
    this.currentAnnotation = null;
    
    // Initialize Draw Tool System
    this.drawToolState = new DrawToolState();
    this.drawToolUI = new DrawToolUI(this.drawToolState);
    this.drawingEngine = new DrawingEngine(this.drawToolState);
    
    // Initialize Eraser Engine
    this.eraserEngine = new EraserEngine();
    
    // Initialize Text Tool
    this.textTool = new TextTool(this);
    
    // Tool settings (legacy for highlight/text)
    this.drawColor = '#000000';
    this.drawThickness = 3;
    this.highlightColor = '#FFFF00';
    this.highlightThickness = 20;
    this.highlightTextOnly = false;
    
    this.annotations = new Map(); // tabId -> annotations[]
    this.drawPaths = new Map(); // tabId -> pageNum -> paths[]
    this.highlightPaths = new Map(); // tabId -> pageNum -> highlight paths[]
    this.highlights = new Map(); // tabId -> pageNum -> text-selection highlights[]
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    const container = document.getElementById('pdf-container');
    
    container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    container.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    container.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
  }

  /**
   * Mark tab as having changes and update save button state
   */
  markTabAsChanged(tabId) {
    this.app.tabManager.updateTab(tabId, { hasChanges: true });
    if (this.app.toolbar) {
      this.app.toolbar.markUnsavedChanges();
    }
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    const container = document.getElementById('pdf-container');
    
    // Remove empty text box when switching away from text tool
    if (tool !== 'text') {
      this.textTool.removeEmptyTextBox();
    }
    
    // Update draw tool state and body class
    if (tool === 'draw') {
      this.drawToolState.setState({ enabled: true });
      document.body.classList.add('draw-tool-active');
    } else {
      this.drawToolState.setState({ enabled: false });
      document.body.classList.remove('draw-tool-active');
    }
    
    // Add eraser-active class for eraser tool
    if (tool === 'erase') {
      document.body.classList.add('eraser-tool-active');
    } else {
      document.body.classList.remove('eraser-tool-active');
    }
    
    // Add highlight-active class for highlight tool
    if (tool === 'highlight') {
      document.body.classList.add('highlight-tool-active');
    } else {
      document.body.classList.remove('highlight-tool-active');
    }
    
    // Add text-tool-active class for text tool
    if (tool === 'text') {
      document.body.classList.add('text-tool-active');
    } else {
      document.body.classList.remove('text-tool-active');
    }
    
    if (tool) {
      container.style.cursor = this.getToolCursor(tool);
    } else {
      container.style.cursor = 'default';
    }
  }

  /**
   * Toggle draw tool dropdown
   */
  toggleDrawToolDropdown(buttonElement) {
    this.drawToolUI.toggle(buttonElement);
  }

  getToolCursor(tool) {
    switch (tool) {
      case 'highlight':
        return 'text';
      case 'draw':
        return 'crosshair';
      case 'erase':
        return 'crosshair'; // CSS will override with custom cursor
      case 'text':
        return 'text';
      default:
        return 'default';
    }
  }

  handleMouseDown(e) {
    console.log('Mouse down:', {
      tool: this.activeTool,
      target: e.target,
      tagName: e.target.tagName,
      className: e.target.className
    });
    
    if (!this.activeTool) return;
    
    // Find annotation layer or get it from page structure
    let annotationLayer = e.target.closest('.annotation-layer');
    
    // If we're on a text span, get the annotation layer from page structure
    if (!annotationLayer && e.target.closest('.text-layer')) {
      const pageContainer = e.target.closest('.page-container');
      if (pageContainer) {
        annotationLayer = pageContainer.querySelector('.annotation-layer');
      }
    }
    
    console.log('Annotation layer found:', annotationLayer);
    
    if (!annotationLayer) return;

    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    this.isDrawing = true;
    const rect = annotationLayer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log('Mouse coordinates:', { x, y, clientX: e.clientX, clientY: e.clientY });

    if (this.activeTool === 'draw') {
      this.startNewDrawing(annotationLayer, x, y, activeTab.id);
    } else if (this.activeTool === 'highlight') {
      // For text-only mode, just track the annotation, text selection happens naturally
      if (this.highlightTextOnly) {
        this.currentAnnotation = {
          type: 'highlight',
          layer: annotationLayer,
          tabId: activeTab.id
        };
      } else {
        // Normal freehand highlight
        this.startDrawing(annotationLayer, x, y, activeTab.id);
      }
    } else if (this.activeTool === 'erase') {
      this.startErasing(annotationLayer, x, y, activeTab.id);
    } else if (this.activeTool === 'text') {
      // Don't create a new text box if clicking on an existing text annotation
      if (!e.target.closest('.text-annotation')) {
        this.addText(annotationLayer, x, y, activeTab.id);
      }
    }
  }

  /**
   * Start drawing with new DrawingEngine
   */
  startNewDrawing(annotationLayer, x, y, tabId) {
    // Get or create overlay canvas
    let canvas = annotationLayer.querySelector('.draw-overlay-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'draw-overlay-canvas';
      
      // Get dimensions from annotation layer or parent
      const width = annotationLayer.offsetWidth || annotationLayer.clientWidth;
      const height = annotationLayer.offsetHeight || annotationLayer.clientHeight;
      
      console.log('Creating overlay canvas:', { width, height, x, y });
      
      canvas.width = width;
      canvas.height = height;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // CSS handles pointer-events
      annotationLayer.appendChild(canvas);
      
      console.log('Canvas created:', canvas, 'Parent:', annotationLayer);
    }
    
    this.drawingEngine.initCanvas(canvas);
    this.drawingEngine.startDrawing(x, y);
    
    console.log('Drawing started at:', x, y, 'Canvas size:', canvas.width, canvas.height);
    
    this.currentAnnotation = {
      type: 'draw',
      layer: annotationLayer,
      canvas: canvas,
      tabId: tabId,
      pageNum: parseInt(annotationLayer.dataset.page)
    };
  }

  handleMouseMove(e) {
    if (!this.isDrawing || !this.currentAnnotation) return;

    // Find annotation layer
    let annotationLayer = e.target.closest('.annotation-layer');
    
    // If we're on text, find annotation layer from page structure
    if (!annotationLayer && e.target.closest('.text-layer')) {
      const pageContainer = e.target.closest('.page-container');
      if (pageContainer) {
        annotationLayer = pageContainer.querySelector('.annotation-layer');
      }
    }
    
    if (!annotationLayer) return;

    const rect = annotationLayer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.activeTool === 'draw') {
      this.drawingEngine.continueDrawing(x, y);
    } else if (this.activeTool === 'erase') {
      this.continueErasing(x, y);
    } else if (this.activeTool === 'highlight') {
      // For highlight, capture text selection on mouse up
      this.continueDrawing(x, y);
    } else {
      this.continueDrawing(x, y);
    }
  }

  handleMouseUp(e) {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    
    if (this.currentAnnotation) {
      if (this.activeTool === 'draw') {
        this.finishNewDrawing();
      } else if (this.activeTool === 'erase') {
        this.finishErasing();
      } else if (this.activeTool === 'highlight') {
        this.finishHighlight();
      } else {
        this.finishDrawing();
      }
    }
  }

  /**
   * Finish highlight by capturing text selection
   */
  finishHighlight() {
    const selection = window.getSelection();
    
    // Check if text-only mode and if there's a selection
    if (this.highlightTextOnly && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      
      if (rects.length > 0) {
        const { layer, tabId } = this.currentAnnotation;
        const pageNum = parseInt(layer.dataset.page);
        const canvas = layer.querySelector('canvas') || this.createHighlightCanvas(layer);
        const ctx = canvas.getContext('2d');
        
        // Collect rectangle data
        const highlightRects = [];
        
        // Draw highlight rectangles over selected text
        // Convert hex to rgba with transparency (lower opacity)
        const r = parseInt(this.highlightColor.slice(1, 3), 16);
        const g = parseInt(this.highlightColor.slice(3, 5), 16);
        const b = parseInt(this.highlightColor.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`; // Reduced from 0.4 to 0.25
        ctx.globalAlpha = 1.0;
        
        for (let rect of rects) {
          const x = rect.left - layerRect.left;
          const y = rect.top - layerRect.top;
          const w = rect.width;
          const h = rect.height;
          
          ctx.fillRect(x, y, w, h);
          highlightRects.push({ x, y, w, h });
        }
        
        // Store highlight data
        if (!this.highlights.has(tabId)) {
          this.highlights.set(tabId, new Map());
        }
        if (!this.highlights.get(tabId).has(pageNum)) {
          this.highlights.get(tabId).set(pageNum, []);
        }
        
        this.highlights.get(tabId).get(pageNum).push({
          rects: highlightRects,
          color: this.highlightColor,
          timestamp: Date.now()
        });
        
        // Mark as changed
        const activeTab = this.app.tabManager.getActiveTab();
        if (activeTab) {
          this.markTabAsChanged(activeTab.id);
        }
        
        // Clear selection
        selection.removeAllRanges();
      }
    } else {
      // Normal highlight (freehand)
      this.finishDrawing();
    }
    
    this.currentAnnotation = null;
  }

  createHighlightCanvas(annotationLayer) {
    const canvas = document.createElement('canvas');
    canvas.width = annotationLayer.offsetWidth;
    canvas.height = annotationLayer.offsetHeight;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    annotationLayer.appendChild(canvas);
    return canvas;
  }

  /**
   * Finish drawing with new DrawingEngine
   */
  finishNewDrawing() {
    const pathData = this.drawingEngine.stopDrawing();
    
    if (pathData && this.currentAnnotation) {
      const { tabId, pageNum } = this.currentAnnotation;
      
      // Store path data
      if (!this.drawPaths.has(tabId)) {
        this.drawPaths.set(tabId, new Map());
      }
      if (!this.drawPaths.get(tabId).has(pageNum)) {
        this.drawPaths.get(tabId).set(pageNum, []);
      }
      
      this.drawPaths.get(tabId).get(pageNum).push(pathData);
      
      // Mark tab as changed
      this.markTabAsChanged(tabId);
    }
    
    this.currentAnnotation = null;
  }

  startDrawing(annotationLayer, x, y, tabId) {
    // Create canvas for drawing
    let canvas = annotationLayer.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = annotationLayer.offsetWidth;
      canvas.height = annotationLayer.offsetHeight;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      annotationLayer.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    
    // For highlights, create rgba color with transparency (lower opacity)
    let displayColor;
    if (this.activeTool === 'highlight') {
      const r = parseInt(this.highlightColor.slice(1, 3), 16);
      const g = parseInt(this.highlightColor.slice(3, 5), 16);
      const b = parseInt(this.highlightColor.slice(5, 7), 16);
      displayColor = `rgba(${r}, ${g}, ${b}, 0.25)`; // Reduced from 0.4 to 0.25
    } else {
      displayColor = this.drawColor;
    }
    
    // For highlights, save the current canvas state before drawing
    let savedImageData = null;
    if (this.activeTool === 'highlight') {
      savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    
    this.currentAnnotation = {
      type: this.activeTool,
      layer: annotationLayer,
      canvas: canvas,
      ctx: ctx,
      points: [{ x, y }],
      color: displayColor, // Save the rgba color for highlights
      thickness: this.activeTool === 'draw' ? this.drawThickness : this.highlightThickness,
      savedImageData: savedImageData // Store the saved image data for highlights
    };

    // Start drawing
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Apply the color
    ctx.strokeStyle = displayColor;
    ctx.globalAlpha = 1.0;
    
    // For highlights, use 'lighten' mode to prevent overlapping from darkening
    if (this.activeTool === 'highlight') {
      ctx.globalCompositeOperation = 'lighten';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.lineWidth = this.currentAnnotation.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  continueDrawing(x, y) {
    if (!this.currentAnnotation) return;

    const { ctx, points, type, canvas, savedImageData } = this.currentAnnotation;
    
    points.push({ x, y });
    
    if (type === 'highlight') {
      // For highlights, restore saved content, then redraw the entire path for uniform opacity
      ctx.putImageData(savedImageData, 0, 0);
      
      // Reapply the drawing settings
      ctx.strokeStyle = this.currentAnnotation.color;
      ctx.lineWidth = this.currentAnnotation.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'lighten';
      
      // Draw the entire path from scratch
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    } else {
      // For draw tool, stroke incrementally as before
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  finishDrawing() {
    if (!this.currentAnnotation) return;

    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    const pageNum = parseInt(this.currentAnnotation.layer.dataset.page);
    const tabId = activeTab.id;

    // For highlights, the final stroke is already drawn in continueDrawing
    // Store in highlightPaths for erasing
    if (this.currentAnnotation.type === 'highlight') {
      if (!this.highlightPaths.has(tabId)) {
        this.highlightPaths.set(tabId, new Map());
      }
      if (!this.highlightPaths.get(tabId).has(pageNum)) {
        this.highlightPaths.get(tabId).set(pageNum, []);
      }
      
      this.highlightPaths.get(tabId).get(pageNum).push({
        points: this.currentAnnotation.points,
        color: this.currentAnnotation.color,
        thickness: this.currentAnnotation.thickness,
        timestamp: Date.now()
      });
    } else {
      // For other tools, use the old annotation system
      if (!this.annotations.has(tabId)) {
        this.annotations.set(tabId, []);
      }
      
      this.annotations.get(tabId).push({
        page: pageNum,
        type: this.currentAnnotation.type,
        points: this.currentAnnotation.points,
        color: this.currentAnnotation.color,
        thickness: this.currentAnnotation.thickness
      });
    }

    this.markTabAsChanged(tabId);
    
    this.currentAnnotation = null;
  }

  /**
   * Start erasing with new EraserEngine
   */
  startErasing(annotationLayer, x, y, tabId) {
    const pageNum = parseInt(annotationLayer.dataset.page);
    let hasErasedSomething = false;
    
    // 1. Erase from draw overlay canvas (draw strokes)
    let drawCanvas = annotationLayer.querySelector('.draw-overlay-canvas');
    if (drawCanvas && this.drawPaths.has(tabId) && this.drawPaths.get(tabId).has(pageNum)) {
      const paths = this.drawPaths.get(tabId).get(pageNum);
      this.eraserEngine.initCanvas(drawCanvas);
      
      // Find and remove paths that intersect with eraser
      const result = this.eraserEngine.erasePaths(paths, x, y);
      
      if (result.erasedPaths.length > 0) {
        // Update stored paths
        this.drawPaths.get(tabId).set(pageNum, result.survivingPaths);
        
        // Redraw canvas with remaining paths
        this.redrawPage(drawCanvas, result.survivingPaths);
        
        hasErasedSomething = true;
      }
    }
    
    // 2. Erase freehand highlights (path-based)
    let highlightCanvas = annotationLayer.querySelector('canvas:not(.draw-overlay-canvas)');
    if (highlightCanvas && this.highlightPaths.has(tabId) && this.highlightPaths.get(tabId).has(pageNum)) {
      const paths = this.highlightPaths.get(tabId).get(pageNum);
      this.eraserEngine.initCanvas(highlightCanvas);
      
      // Find and remove highlight paths that intersect with eraser
      const result = this.eraserEngine.erasePaths(paths, x, y);
      
      if (result.erasedPaths.length > 0) {
        // Update stored highlight paths
        this.highlightPaths.get(tabId).set(pageNum, result.survivingPaths);
        
        // Redraw canvas with remaining highlight paths
        this.redrawHighlightPaths(highlightCanvas, result.survivingPaths);
        
        hasErasedSomething = true;
      }
    }
    
    // 3. Erase text-selection highlights (rect-based)
    if (this.highlights.has(tabId) && this.highlights.get(tabId).has(pageNum)) {
      const highlights = this.highlights.get(tabId).get(pageNum);
      const survivingHighlights = [];
      
      highlights.forEach(highlight => {
        // Check if eraser intersects with any rect in this highlight
        const intersects = highlight.rects.some(rect => {
          return this.eraserIntersectsRect(x, y, rect);
        });
        
        if (!intersects) {
          // Keep this highlight
          survivingHighlights.push(highlight);
        } else {
          hasErasedSomething = true;
        }
      });
      
      // Update stored highlights
      this.highlights.get(tabId).set(pageNum, survivingHighlights);
      
      // Redraw text-selection highlights
      if (highlightCanvas) {
        this.redrawTextHighlights(highlightCanvas, survivingHighlights);
      }
    }
    
    // Mark as changed if something was erased
    if (hasErasedSomething) {
      this.markTabAsChanged(tabId);
    }
    
    this.currentAnnotation = {
      type: 'erase',
      layer: annotationLayer,
      tabId: tabId,
      pageNum: pageNum
    };
  }

  /**
   * Check if eraser circle intersects with a rectangle
   */
  eraserIntersectsRect(eraserX, eraserY, rect) {
    const radius = this.eraserEngine.getRadius();
    
    // Find closest point on rectangle to eraser center
    const closestX = Math.max(rect.x, Math.min(eraserX, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(eraserY, rect.y + rect.h));
    
    // Distance from eraser center to closest point
    const dx = eraserX - closestX;
    const dy = eraserY - closestY;
    const distSquared = dx * dx + dy * dy;
    
    return distSquared <= radius * radius;
  }

  /**
   * Redraw freehand highlight paths on a canvas
   */
  redrawHighlightPaths(canvas, highlightPaths) {
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Initialize drawing engine with this canvas
    this.drawingEngine.initCanvas(canvas);
    
    // Redraw all highlight paths
    highlightPaths.forEach(pathData => {
      this.drawingEngine.drawPath(pathData);
    });
  }

  /**
   * Redraw text-selection highlights (rectangles) on a canvas
   */
  redrawTextHighlights(canvas, highlights) {
    const ctx = canvas.getContext('2d');
    
    // Don't clear - there might be freehand highlights already drawn
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw all text-selection highlights
    highlights.forEach(highlight => {
      // Convert hex to rgba with transparency (lower opacity)
      const r = parseInt(highlight.color.slice(1, 3), 16);
      const g = parseInt(highlight.color.slice(3, 5), 16);
      const b = parseInt(highlight.color.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`; // Reduced from 0.4 to 0.25
      ctx.globalAlpha = 1.0;
      
      highlight.rects.forEach(rect => {
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      });
    });
  }

  /**
   * Continue erasing (mouse drag)
   */
  continueErasing(x, y) {
    if (!this.currentAnnotation) return;
    
    const { tabId, pageNum, layer } = this.currentAnnotation;
    
    // 1. Erase from draw paths
    let drawCanvas = layer.querySelector('.draw-overlay-canvas');
    if (drawCanvas && this.drawPaths.has(tabId) && this.drawPaths.get(tabId).has(pageNum)) {
      const paths = this.drawPaths.get(tabId).get(pageNum);
      
      // Find and remove paths that intersect with eraser
      const result = this.eraserEngine.erasePaths(paths, x, y);
      
      if (result.erasedPaths.length > 0) {
        // Update stored paths
        this.drawPaths.get(tabId).set(pageNum, result.survivingPaths);
        
        // Redraw canvas with remaining paths
        this.redrawPage(drawCanvas, result.survivingPaths);
      }
    }
    
    // 2. Erase freehand highlight paths
    let highlightCanvas = layer.querySelector('canvas:not(.draw-overlay-canvas)');
    if (highlightCanvas && this.highlightPaths.has(tabId) && this.highlightPaths.get(tabId).has(pageNum)) {
      const paths = this.highlightPaths.get(tabId).get(pageNum);
      
      // Find and remove highlight paths that intersect with eraser
      const result = this.eraserEngine.erasePaths(paths, x, y);
      
      if (result.erasedPaths.length > 0) {
        // Update stored highlight paths
        this.highlightPaths.get(tabId).set(pageNum, result.survivingPaths);
        
        // Redraw canvas with remaining highlight paths
        this.redrawHighlightPaths(highlightCanvas, result.survivingPaths);
      }
    }
    
    // 3. Erase text-selection highlights (rect-based)
    if (this.highlights.has(tabId) && this.highlights.get(tabId).has(pageNum)) {
      const highlights = this.highlights.get(tabId).get(pageNum);
      const survivingHighlights = [];
      
      highlights.forEach(highlight => {
        // Check if eraser intersects with any rect in this highlight
        const intersects = highlight.rects.some(rect => {
          return this.eraserIntersectsRect(x, y, rect);
        });
        
        if (!intersects) {
          survivingHighlights.push(highlight);
        }
      });
      
      // Update stored highlights
      this.highlights.get(tabId).set(pageNum, survivingHighlights);
      
      // Redraw text-selection highlights
      if (highlightCanvas) {
        this.redrawTextHighlights(highlightCanvas, survivingHighlights);
      }
    }
  }

  /**
   * Finish erasing
   */
  finishErasing() {
    // Just clear the current annotation, changes already saved
    this.currentAnnotation = null;
  }

  /**
   * Redraw a page canvas with given paths
   */
  redrawPage(canvas, paths) {
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Initialize drawing engine with this canvas
    this.drawingEngine.initCanvas(canvas);
    
    // Redraw all paths
    paths.forEach(pathData => {
      this.drawingEngine.drawPath(pathData);
    });
  }

  addText(annotationLayer, x, y, tabId) {
    // Use TextTool to create a text box with formatting toolbar
    this.textTool.createTextBox(annotationLayer, x, y, tabId);
  }

  switchToTab(tabId) {
    // Annotations are re-rendered with pages
    // This method can be used to restore annotations if needed
  }

  closeTab(tabId) {
    this.annotations.delete(tabId);
  }

  setDrawColor(color) {
    this.drawColor = color;
  }

  setDrawThickness(thickness) {
    this.drawThickness = parseInt(thickness);
  }

  setHighlightColor(color) {
    this.highlightColor = color;
  }

  setHighlightThickness(thickness) {
    this.highlightThickness = parseInt(thickness);
  }

  setHighlightTextOnly(enabled) {
    this.highlightTextOnly = enabled;
    
    // Add/remove body class for CSS styling
    if (enabled) {
      document.body.classList.add('text-only-mode');
    } else {
      document.body.classList.remove('text-only-mode');
    }
  }

  hideAllAnnotations(hide) {
    console.log(`${hide ? 'Hiding' : 'Showing'} all annotations`);
    const layers = document.querySelectorAll('.annotation-layer');
    console.log(`Found ${layers.length} annotation layers`);
    layers.forEach(layer => {
      layer.style.display = hide ? 'none' : '';
    });
  }
}
