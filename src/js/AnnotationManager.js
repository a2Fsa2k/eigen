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
    
    // Store ALL annotations by page number within a tab
    // Structure: pageAnnotations.get(tabId) -> Map(pageNum -> { 
    //   drawings: paths[], 
    //   highlights: paths[],
    //   textHighlights: highlights[],
    //   texts: textBlocks[]
    // })
    this.pageAnnotations = new Map();
    
    // Legacy maps (will be maintained for backward compatibility or migrated to pageAnnotations)
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
    
    // Scale coordinates by current zoom level so they are independent of zoom
    const activeTabObj = this.app.tabManager.getTab(activeTab.id);
    const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;
    const unscaledX = x / zoom;
    const unscaledY = y / zoom;
    
    console.log('Mouse coordinates:', { x, y, unscaledX, unscaledY, clientX: e.clientX, clientY: e.clientY });

    if (this.activeTool === 'draw') {
      this.startNewDrawing(annotationLayer, x, y, activeTab.id, unscaledX, unscaledY);
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
        this.startDrawing(annotationLayer, x, y, activeTab.id, unscaledX, unscaledY);
      }
    } else if (this.activeTool === 'erase') {
      this.startErasing(annotationLayer, x, y, activeTab.id, unscaledX, unscaledY);
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
  startNewDrawing(annotationLayer, x, y, tabId, unscaledX, unscaledY) {
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
    
    const activeTabObj = this.app.tabManager ? this.app.tabManager.getTab(tabId) : null;
    const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;

    // Apply current stroke width taking zoom into account for DrawingEngine dynamically
    this.drawToolState.setState({ thickness: this.drawThickness * zoom });

    this.drawingEngine.startDrawing(x, y);
    
    console.log('Drawing started at:', x, y, 'Canvas size:', canvas.width, canvas.height);
    
    this.currentAnnotation = {
      type: 'draw',
      layer: annotationLayer,
      canvas: canvas,
      tabId: tabId,
      pageNum: parseInt(annotationLayer.dataset.page),
      pointsUnscaled: [{ x: unscaledX, y: unscaledY }],
      thickness: this.drawThickness
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

    const activeTab = this.app.tabManager.getActiveTab();
    const activeTabObj = activeTab ? this.app.tabManager.getTab(activeTab.id) : null;
    const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;
    const unscaledX = x / zoom;
    const unscaledY = y / zoom;

    if (this.activeTool === 'draw') {
      this.drawingEngine.continueDrawing(x, y);
      if (this.currentAnnotation && this.currentAnnotation.pointsUnscaled) {
        this.currentAnnotation.pointsUnscaled.push({ x: unscaledX, y: unscaledY });
      }
    } else if (this.activeTool === 'erase') {
      this.continueErasing(x, y);
    } else if (this.activeTool === 'highlight') {
      // For highlight, capture text selection on mouse up
      this.continueDrawing(x, y, unscaledX, unscaledY);
    } else {
      this.continueDrawing(x, y, unscaledX, unscaledY);
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
        const layerRect = layer.getBoundingClientRect(); // FIX: Get layer rect
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
        
        const activeTabObj = this.app.tabManager.getTab(tabId);
        const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;
        
        for (let rect of rects) {
          const x = rect.left - layerRect.left;
          const y = rect.top - layerRect.top;
          const w = rect.width;
          const h = rect.height;
          
          ctx.fillRect(x, y, w, h);
          
          // Store unscaled coordinates
          highlightRects.push({ 
            x: x / zoom, 
            y: y / zoom, 
            w: w / zoom, 
            h: h / zoom 
          });
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
      const { tabId, pageNum, pointsUnscaled, thickness } = this.currentAnnotation;
      
      // Override points with unscaled points so they can be properly scalled on redraw
      if (pointsUnscaled && pointsUnscaled.length > 0) {
        pathData.points = pointsUnscaled;
      }
      pathData.thickness = thickness;
      
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

  startDrawing(annotationLayer, x, y, tabId, unscaledX, unscaledY) {
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
      pointsUnscaled: [{ x: unscaledX, y: unscaledY }],
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
    
    const activeTab = this.app.tabManager.getActiveTab();
    const activeTabObj = activeTab ? this.app.tabManager.getTab(activeTab.id) : null;
    const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;

    // Scale brush thickness dynamically for current draw preview
    ctx.lineWidth = this.currentAnnotation.thickness * zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  continueDrawing(x, y, unscaledX, unscaledY) {
    if (!this.currentAnnotation) return;

    const { ctx, points, pointsUnscaled, type, canvas, savedImageData } = this.currentAnnotation;
    
    points.push({ x, y });
    if (pointsUnscaled && unscaledX !== undefined && unscaledY !== undefined) {
      pointsUnscaled.push({ x: unscaledX, y: unscaledY });
    }
    
    if (type === 'highlight') {
      // For highlights, restore saved content, then redraw the entire path for uniform opacity
      ctx.putImageData(savedImageData, 0, 0);
      
      // Reapply the drawing settings
      ctx.strokeStyle = this.currentAnnotation.color;
      
      const activeTab = this.app.tabManager.getActiveTab();
      const activeTabObj = activeTab ? this.app.tabManager.getTab(activeTab.id) : null;
      const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;

      ctx.lineWidth = this.currentAnnotation.thickness * zoom;
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
        points: this.currentAnnotation.pointsUnscaled || this.currentAnnotation.points,
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
        points: this.currentAnnotation.pointsUnscaled || this.currentAnnotation.points,
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
  startErasing(annotationLayer, x, y, tabId, unscaledX, unscaledY) {
    const pageNum = parseInt(annotationLayer.dataset.page);
    let hasErasedSomething = false;
    
    const activeTabObj = this.app.tabManager.getTab(tabId);
    const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;
    
    // 1. Erase from draw overlay canvas (draw strokes)
    let drawCanvas = annotationLayer.querySelector('.draw-overlay-canvas');
    if (drawCanvas && this.drawPaths.has(tabId) && this.drawPaths.get(tabId).has(pageNum)) {
      const paths = this.drawPaths.get(tabId).get(pageNum);
      this.eraserEngine.initCanvas(drawCanvas);
      
      // Need to convert stored paths (unscaled) to screen coordinates for eraser intersection
      const scaledPaths = paths.map(path => ({
        ...path,
        points: path.points.map(p => ({ x: p.x * zoom, y: p.y * zoom }))
      }));
      
      // Find and remove paths that intersect with eraser
      const result = this.eraserEngine.erasePaths(scaledPaths, x, y);
      
      if (result.erasedPaths.length > 0) {
        // Convert surviving paths back to unscaled coordinates for storage
        const survivingUnscaledPaths = result.survivingPaths.map(path => ({
          ...path,
          points: path.points.map(p => ({ x: p.x / zoom, y: p.y / zoom }))
        }));
        
        // Update stored paths
        this.drawPaths.get(tabId).set(pageNum, survivingUnscaledPaths);
        
        // Redraw canvas with remaining paths
        this.redrawPage(drawCanvas, survivingUnscaledPaths, zoom);
        
        hasErasedSomething = true;
      }
    }
    
    // 2. Erase freehand highlights (path-based)
    let highlightCanvas = annotationLayer.querySelector('canvas:not(.draw-overlay-canvas)');
    if (highlightCanvas && this.highlightPaths.has(tabId) && this.highlightPaths.get(tabId).has(pageNum)) {
      const paths = this.highlightPaths.get(tabId).get(pageNum);
      this.eraserEngine.initCanvas(highlightCanvas);
      
      const scaledPaths = paths.map(path => ({
        ...path,
        points: path.points.map(p => ({ x: p.x * zoom, y: p.y * zoom }))
      }));
      
      // Find and remove highlight paths that intersect with eraser
      const result = this.eraserEngine.erasePaths(scaledPaths, x, y);
      
      if (result.erasedPaths.length > 0) {
        const survivingUnscaledPaths = result.survivingPaths.map(path => ({
          ...path,
          points: path.points.map(p => ({ x: p.x / zoom, y: p.y / zoom }))
        }));

        // Update stored highlight paths
        this.highlightPaths.get(tabId).set(pageNum, survivingUnscaledPaths);
        
        // Redraw canvas with remaining highlight paths
        this.redrawHighlightPaths(highlightCanvas, survivingUnscaledPaths, zoom);
        
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
          return this.eraserIntersectsRect(x, y, rect, zoom);
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
  eraserIntersectsRect(eraserX, eraserY, rect, zoom = 1.0) {
    const radius = this.eraserEngine.getRadius();
    
    // Scale rectangle for intersection test to match screen coordinates
    const rectX = rect.x * zoom;
    const rectY = rect.y * zoom;
    const rectW = rect.w * zoom;
    const rectH = rect.h * zoom;
    
    // Find closest point on rectangle to eraser center
    const closestX = Math.max(rectX, Math.min(eraserX, rectX + rectW));
    const closestY = Math.max(rectY, Math.min(eraserY, rectY + rectH));
    
    // Distance from eraser center to closest point
    const dx = eraserX - closestX;
    const dy = eraserY - closestY;
    const distSquared = dx * dx + dy * dy;
    
    return distSquared <= radius * radius;
  }

  /**
   * Redraw freehand highlight paths on a canvas
   */
  redrawHighlightPaths(canvas, highlightPaths, zoom = 1.0) {
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Initialize drawing engine with this canvas
    this.drawingEngine.initCanvas(canvas);
    
    // Redraw all highlight paths
    highlightPaths.forEach(pathData => {
      const scaledPathData = {
        ...pathData,
        points: pathData.points ? pathData.points.map(p => ({ x: p.x * zoom, y: p.y * zoom })) : [],
        thickness: pathData.thickness * zoom
      };
      this.drawingEngine.drawPath(scaledPathData);
    });
  }

  /**
   * Redraw text-selection highlights (rectangles) on a canvas
   */
  redrawTextHighlights(canvas, highlights, zoom = 1.0) {
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
        ctx.fillRect(rect.x * zoom, rect.y * zoom, rect.w * zoom, rect.h * zoom);
      });
    });
  }

  /**
   * Redraw draw strokes on a canvas
   */
  redrawPage(canvas, paths, zoom = 1.0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    this.drawingEngine.initCanvas(canvas);
    
    paths.forEach(pathData => {
      const scaledPathData = {
        ...pathData,
        points: pathData.points ? pathData.points.map(p => ({ x: p.x * zoom, y: p.y * zoom })) : [],
        thickness: (pathData.thickness || 3) * zoom
      };
      this.drawingEngine.drawPath(scaledPathData);
    });
  }

  /**
   * Restore annotations for a re-rendered page (e.g., after zoom)
   */
  restorePageAnnotations(tabId, pageNum, annotationLayerDiv) {
    if (!annotationLayerDiv) return;

    const activeTabObj = this.app.tabManager.getTab(tabId);
    const zoom = activeTabObj ? (activeTabObj.zoom || 1.0) : 1.0;

    // 1. Restore draw paths
    if (this.drawPaths.has(tabId) && this.drawPaths.get(tabId).has(pageNum)) {
      const paths = this.drawPaths.get(tabId).get(pageNum);
      if (paths && paths.length > 0) {
        let drawCanvas = annotationLayerDiv.querySelector('.draw-overlay-canvas');
        if (!drawCanvas) {
          drawCanvas = document.createElement('canvas');
          drawCanvas.className = 'draw-overlay-canvas';
          const width = annotationLayerDiv.offsetWidth;
          const height = annotationLayerDiv.offsetHeight;
          drawCanvas.width = width;
          drawCanvas.height = height;
          drawCanvas.style.position = 'absolute';
          drawCanvas.style.top = '0';
          drawCanvas.style.left = '0';
          drawCanvas.style.width = `${width}px`;
          drawCanvas.style.height = `${height}px`;
          annotationLayerDiv.appendChild(drawCanvas);
        }
        this.redrawPage(drawCanvas, paths, zoom);
      }
    }

    // 2. Restore highlight paths
    const hasHighlightPaths = this.highlightPaths.has(tabId) && this.highlightPaths.get(tabId).has(pageNum) && this.highlightPaths.get(tabId).get(pageNum).length > 0;
    const hasTextHighlights = this.highlights.has(tabId) && this.highlights.get(tabId).has(pageNum) && this.highlights.get(tabId).get(pageNum).length > 0;

    if (hasHighlightPaths || hasTextHighlights) {
      let highlightCanvas = annotationLayerDiv.querySelector('canvas:not(.draw-overlay-canvas)');
      if (!highlightCanvas) {
        highlightCanvas = document.createElement('canvas');
        const width = annotationLayerDiv.offsetWidth || annotationLayerDiv.clientWidth;
        const height = annotationLayerDiv.offsetHeight || annotationLayerDiv.clientHeight;
        highlightCanvas.width = width;
        highlightCanvas.height = height;
        highlightCanvas.style.position = 'absolute';
        highlightCanvas.style.top = '0';
        highlightCanvas.style.left = '0';
        annotationLayerDiv.appendChild(highlightCanvas);
      }

      const ctx = highlightCanvas.getContext('2d');
      ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);

      if (hasHighlightPaths) {
        const hPaths = this.highlightPaths.get(tabId).get(pageNum);
        // Call redrawHighlightPaths WITHOUT clearing the canvas
        // (but wait, redrawHighlightPaths DOES clear the canvas internally in our code, so let's handle it)
        this.drawingEngine.initCanvas(highlightCanvas);
        hPaths.forEach(pathData => {
          const scaledPathData = {
            ...pathData,
            points: pathData.points ? pathData.points.map(p => ({ x: p.x * zoom, y: p.y * zoom })) : [],
            thickness: pathData.thickness * zoom
          };
          this.drawingEngine.drawPath(scaledPathData);
        });
      }

      if (hasTextHighlights) {
        const tHighlights = this.highlights.get(tabId).get(pageNum);
        // Redraw without clearing
        tHighlights.forEach(highlight => {
          const r = parseInt(highlight.color.slice(1, 3), 16);
          const g = parseInt(highlight.color.slice(3, 5), 16);
          const b = parseInt(highlight.color.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
          ctx.globalAlpha = 1.0;
          
          highlight.rects.forEach(rect => {
            ctx.fillRect(rect.x * zoom, rect.y * zoom, rect.w * zoom, rect.h * zoom);
          });
        });
      }
    }
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

  /**
   * Called when user switches between tabs.
   * Ensures annotations are restored for the newly active tab.
   */
  switchToTab(tabId) {
    // Defensive: older code paths expect this method.
    // Actual redraw will also happen when pages are re-rendered via PDFRenderer.
    try {
      const tab = this.app.tabManager.getTab(tabId);
      if (!tab) return;

      // Restore tool state for the tab
      if (typeof tab.activeTool !== 'undefined') {
        this.setActiveTool(tab.activeTool);
      }

      // Restore annotations for currently rendered pages (if any)
      const layers = document.querySelectorAll(`.annotation-layer[data-tab="${tabId}"]`);
      if (layers.length > 0) {
        layers.forEach(layer => {
          const pageNum = parseInt(layer.dataset.page, 10);
          if (!Number.isNaN(pageNum)) {
            this.restorePageAnnotations(tabId, pageNum, layer);
          }
        });
      } else {
        // Fallback: restore by page num only
        document.querySelectorAll('.annotation-layer').forEach(layer => {
          const pageNum = parseInt(layer.dataset.page, 10);
          if (!Number.isNaN(pageNum)) {
            this.restorePageAnnotations(tabId, pageNum, layer);
          }
        });
      }
    } catch (e) {
      console.error('AnnotationManager.switchToTab error:', e);
    }
  }

  /**
   * Cleanup annotations for a closed tab.
   */
  closeTab(tabId) {
    try {
      this.annotations.delete(tabId);
      this.drawPaths.delete(tabId);
      this.highlightPaths.delete(tabId);
      this.highlights.delete(tabId);
      this.pageAnnotations.delete(tabId);

      // If active tool was tied to this tab, just clear tool state
      const activeTab = this.app.tabManager.getActiveTab();
      if (!activeTab || activeTab.id === tabId) {
        this.setActiveTool(null);
      }
    } catch (e) {
      console.error('AnnotationManager.closeTab error:', e);
    }
  }
}
