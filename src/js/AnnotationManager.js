export class AnnotationManager {
  constructor(app) {
    this.app = app;
    this.activeTool = null;
    this.isDrawing = false;
    this.currentAnnotation = null;
    
    // Tool settings
    this.drawColor = '#000000';
    this.drawThickness = 3;
    this.highlightColor = '#FFFF00';
    this.highlightThickness = 20;
    this.highlightTextOnly = false;
    
    this.annotations = new Map(); // tabId -> annotations[]
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    const container = document.getElementById('pdf-container');
    
    container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    container.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    container.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    const container = document.getElementById('pdf-container');
    
    if (tool) {
      container.style.cursor = this.getToolCursor(tool);
    } else {
      container.style.cursor = 'default';
    }
  }

  getToolCursor(tool) {
    switch (tool) {
      case 'highlight':
        return 'text';
      case 'draw':
        return 'crosshair';
      case 'erase':
        return 'not-allowed';
      case 'text':
        return 'text';
      default:
        return 'default';
    }
  }

  handleMouseDown(e) {
    if (!this.activeTool) return;
    
    const annotationLayer = e.target.closest('.annotation-layer');
    if (!annotationLayer) return;

    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    this.isDrawing = true;
    const rect = annotationLayer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.activeTool === 'draw' || this.activeTool === 'highlight') {
      this.startDrawing(annotationLayer, x, y, activeTab.id);
    } else if (this.activeTool === 'erase') {
      this.eraseAt(annotationLayer, x, y, activeTab.id);
    } else if (this.activeTool === 'text') {
      this.addText(annotationLayer, x, y, activeTab.id);
    }
  }

  handleMouseMove(e) {
    if (!this.isDrawing || !this.currentAnnotation) return;

    const annotationLayer = e.target.closest('.annotation-layer');
    if (!annotationLayer) return;

    const rect = annotationLayer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.continueDrawing(x, y);
  }

  handleMouseUp(e) {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    
    if (this.currentAnnotation) {
      this.finishDrawing();
    }
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
    
    this.currentAnnotation = {
      type: this.activeTool,
      layer: annotationLayer,
      canvas: canvas,
      ctx: ctx,
      points: [{ x, y }],
      color: this.activeTool === 'draw' ? this.drawColor : this.highlightColor,
      thickness: this.activeTool === 'draw' ? this.drawThickness : this.highlightThickness
    };

    // Start drawing
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = this.currentAnnotation.color;
    ctx.lineWidth = this.currentAnnotation.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (this.activeTool === 'highlight') {
      ctx.globalAlpha = 0.5;
    }
  }

  continueDrawing(x, y) {
    if (!this.currentAnnotation) return;

    const { ctx, points } = this.currentAnnotation;
    
    points.push({ x, y });
    
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  finishDrawing() {
    if (!this.currentAnnotation) return;

    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) return;

    // Save annotation
    if (!this.annotations.has(activeTab.id)) {
      this.annotations.set(activeTab.id, []);
    }

    const pageNum = parseInt(this.currentAnnotation.layer.dataset.page);
    
    this.annotations.get(activeTab.id).push({
      page: pageNum,
      type: this.currentAnnotation.type,
      points: this.currentAnnotation.points,
      color: this.currentAnnotation.color,
      thickness: this.currentAnnotation.thickness
    });

    this.app.tabManager.updateTab(activeTab.id, { hasChanges: true });
    
    this.currentAnnotation = null;
  }

  eraseAt(annotationLayer, x, y, tabId) {
    const canvas = annotationLayer.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const eraseRadius = 20;
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, eraseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Mark as changed
    this.app.tabManager.updateTab(tabId, { hasChanges: true });
  }

  addText(annotationLayer, x, y, tabId) {
    const text = prompt('Enter text:');
    if (!text) return;

    const textSpan = document.createElement('div');
    textSpan.style.position = 'absolute';
    textSpan.style.left = `${x}px`;
    textSpan.style.top = `${y}px`;
    textSpan.style.fontSize = '14px';
    textSpan.style.fontFamily = 'Arial';
    textSpan.style.color = '#000';
    textSpan.style.background = 'rgba(255, 255, 255, 0.9)';
    textSpan.style.padding = '2px 4px';
    textSpan.style.border = '1px solid #ccc';
    textSpan.style.pointerEvents = 'all';
    textSpan.textContent = text;
    textSpan.contentEditable = true;
    
    annotationLayer.appendChild(textSpan);

    // Save annotation
    if (!this.annotations.has(tabId)) {
      this.annotations.set(tabId, []);
    }

    const pageNum = parseInt(annotationLayer.dataset.page);
    this.annotations.get(tabId).push({
      page: pageNum,
      type: 'text',
      x, y,
      text: text
    });

    this.app.tabManager.updateTab(tabId, { hasChanges: true });
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
  }

  hideAllAnnotations(hide) {
    const layers = document.querySelectorAll('.annotation-layer');
    layers.forEach(layer => {
      layer.style.display = hide ? 'none' : 'block';
    });
  }
}
