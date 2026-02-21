# Okular PDF Viewer - Text Selection Implementation Guide
## For JavaScript/Electron PDF Viewers

**Source**: KDE Okular Repository (C++ Implementation)  
**Purpose**: Extract and translate text selection logic from Okular to JavaScript/Electron

---

## 📋 Overview

This document outlines the core text selection mechanism used in Okular PDF viewer, translated from C++ to JavaScript concepts. Understanding this will help you implement more robust text selection for your Electron-based PDF viewer.

---

## 🏗️ Architecture Overview

### Key Components (C++ → JavaScript equivalents)

| C++ Component | Purpose | JavaScript Equivalent |
|---|---|---|
| `PageView` | Main view controller | React component or Electron renderer process |
| `PageViewItem` | Individual page wrapper | Page object/class |
| `Okular::RegularAreaRect` | Selection geometry | Array of rectangle coordinates |
| `mousePressEvent()` | Drag start | `mousedown` event handler |
| `mouseMoveEvent()` | Drag update | `mousemove` event handler |
| `mouseReleaseEvent()` | Drag end | `mouseup` event handler |
| `selectionStart()` | Initialize selection | Start selection state |
| `updateSelection()` | Live update | Update selection bounds |
| `textSelections()` | Multi-page selection | Calculate spans across pages |
| `textSelectionForItem()` | Per-page extraction | Get text rects for single page |

---

## 🖱️ Mouse Event Flow

### 1. **Mouse Press Event** (`mousePressEvent`)

**Purpose**: Initialize text selection

**C++ Logic**:
```cpp
void PageView::mousePressEvent(QMouseEvent *e)
{
    // Skip if no document or already selecting
    if (d->items.isEmpty() || d->mouseSelecting) {
        return;
    }
    
    // Clear any previous text selection
    if (d->mouseMode != TextSelect) {
        textSelectionClear();
    }
    
    // Get position relative to content area
    const QPoint eventPos = contentAreaPoint(e->pos());
    
    // For TextSelect mode: store initial position
    if (d->mouseMode == TextSelect) {
        d->mouseSelectPos = eventPos;
        if (!rightButton) {
            textSelectionClear();
        }
    }
    
    // For other selection modes: start selection rectangle
    if (d->mouseMode == RectSelect || d->mouseMode == Zoom) {
        selectionStart(eventPos, highlightColor, false);
    }
}
```

**JavaScript Implementation**:
```javascript
class PDFViewer {
  onMouseDown(event) {
    // Skip if no document or already selecting
    if (!this.pages.length || this.isSelecting) return;
    
    // Clear previous text selection
    if (this.mouseMode !== 'TextSelect') {
      this.clearTextSelection();
    }
    
    // Get position relative to content area
    const pos = this.getContentAreaPoint(event.clientX, event.clientY);
    
    // Store initial selection position
    this.startSelectPos = pos;
    this.lastSelectPos = pos;
    
    // Initialize selection state
    if (this.mouseMode === 'TextSelect') {
      this.isTextSelecting = true;
      this.textSelectStartPos = pos;
    }
  }
}
```

---

### 2. **Mouse Move Event** (`mouseMoveEvent`)

**Purpose**: Update selection as user drags

**C++ Logic**:
```cpp
void PageView::mouseMoveEvent(QMouseEvent *e)
{
    const QPoint eventPos = contentAreaPoint(e->pos());
    
    switch (d->mouseMode) {
    case TextSelect:
        // Detect if movement is significant (>5px)
        if (!d->mouseTextSelecting && 
            !d->mousePressPos.isNull() && 
            d->document->supportsSearching() && 
            ((eventPos - d->mouseSelectPos).manhattanLength() > 5)) {
            d->mouseTextSelecting = true;
        }
        
        // Update selection with new position
        updateSelection(eventPos);
        updateCursor();
        break;
        
    case RectSelect:
    case Zoom:
    case TableSelect:
        // Update rectangular selection
        if (d->mouseSelecting) {
            updateSelection(eventPos);
            d->mouseOverLinkObject = nullptr;
        }
        break;
    }
}
```

**JavaScript Implementation**:
```javascript
onMouseMove(event) {
  if (!this.isTextSelecting) return;
  
  const pos = this.getContentAreaPoint(event.clientX, event.clientY);
  
  // Calculate manhattan distance (simple distance metric)
  const distance = this.manhattanDistance(this.startSelectPos, pos);
  
  // Only start selecting after moving 5+ pixels
  if (distance > 5) {
    this.isTextSelecting = true;
    this.updateSelection(pos);
  }
}

manhattanDistance(p1, p2) {
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}
```

---

### 3. **Selection Start** (`selectionStart`)

**Purpose**: Initialize selection rectangle state

**C++ Logic**:
```cpp
void PageView::selectionStart(const QPoint pos, const QColor &color, bool aboveAll)
{
    selectionClear();
    d->mouseSelecting = true;
    d->mouseSelectionRect.setRect(pos.x(), pos.y(), 1, 1);
    d->mouseSelectionColor = color;
    
    // Ensure page doesn't scroll
    if (d->autoScrollTimer) {
        d->scrollIncrement = 0;
        d->autoScrollTimer->stop();
    }
}
```

**JavaScript Implementation**:
```javascript
selectionStart(pos, color = '#FF0000') {
  // Clear any previous selection
  this.clearSelection();
  
  // Initialize selection state
  this.isSelecting = true;
  this.selectionRect = {
    x: pos.x,
    y: pos.y,
    width: 1,
    height: 1,
    color: color
  };
  
  // Stop auto-scroll during selection
  this.stopAutoScroll();
}
```

---

### 4. **Update Selection** (`updateSelection`)

**Purpose**: Dynamically update selection rectangle and get text selections

**C++ Logic**:
```cpp
void PageView::updateSelection(const QPoint pos)
{
    if (d->mouseSelecting) {
        scrollPosIntoView(pos);
        
        // Update selection rect coordinates
        QRect updateRect = d->mouseSelectionRect;
        d->mouseSelectionRect.setBottomLeft(pos);
        updateRect |= d->mouseSelectionRect;
        
        // Redraw affected area
        updateRect.translate(-contentAreaPosition());
        viewport()->update(updateRect.adjusted(-1, -2, 2, 1));
        
    } else if (d->mouseTextSelecting) {
        scrollPosIntoView(pos);
        
        // Get text selections across all affected pages
        int firstPage = -1;
        std::vector<std::unique_ptr<Okular::RegularAreaRect>> selections = 
            textSelections(pos, d->mouseSelectPos.toPoint(), firstPage);
        
        QSet<int> pagesWithSelection;
        for (size_t i = 0; i < selections.size(); ++i) {
            pagesWithSelection.insert(i + firstPage);
        }
        
        // Clear old selections and set new ones
        const QSet<int> noMoreSelectedPages = 
            d->pagesWithTextSelection - pagesWithSelection;
        
        for (int p : noMoreSelectedPages) {
            d->document->clearTextSelection(p);
        }
        
        // Set new text selections on pages
        for (int i = 0; i < selections.size(); ++i) {
            if (selections[i]) {
                d->document->setTextSelection(firstPage + i, 
                    selections[i].get(), 
                    palette().color(QPalette::Active, QPalette::Highlight));
            }
        }
        
        d->pagesWithTextSelection = pagesWithSelection;
        updatePages();
    }
}
```

**JavaScript Implementation**:
```javascript
updateSelection(currentPos) {
  // Auto-scroll if selection reaches edge
  this.scrollPosIntoView(currentPos);
  
  // Get text selections across all affected pages
  const selections = this.getTextSelections(
    this.startSelectPos, 
    currentPos
  );
  
  // Track which pages have selections
  const pagesWithSelection = new Set();
  
  // Update selections on each page
  selections.forEach((selection, pageIndex) => {
    if (selection && selection.rects.length > 0) {
      pagesWithSelection.add(selection.pageNumber);
      
      // Update visual representation
      this.updatePageSelection(
        selection.pageNumber,
        selection.rects,
        this.highlightColor
      );
    }
  });
  
  // Clear selections from pages no longer selected
  this.pagesWithSelection.forEach(pageNum => {
    if (!pagesWithSelection.has(pageNum)) {
      this.clearPageSelection(pageNum);
    }
  });
  
  this.pagesWithSelection = pagesWithSelection;
}
```

---

## 📊 Multi-Page Text Selection Algorithm

### `textSelections()` - Calculate selections across multiple pages

**Purpose**: Handle selections that span multiple PDF pages

**C++ Logic**:
```cpp
std::vector<std::unique_ptr<Okular::RegularAreaRect>> PageView::textSelections(
    const QPoint start, 
    const QPoint end, 
    int &firstpage)
{
    firstpage = -1;
    std::vector<std::unique_ptr<Okular::RegularAreaRect>> ret;
    QSet<int> affectedItemsSet;
    
    // 1. Find all pages intersected by selection rectangle
    QRect selectionRect = QRect::span(start, end);
    for (const PageViewItem *item : d->items) {
        if (item->isVisible() && 
            selectionRect.intersects(item->croppedGeometry())) {
            affectedItemsSet.insert(item->pageNumber());
        }
    }
    
    if (!affectedItemsSet.isEmpty()) {
        // 2. Determine selection direction
        // NE-SW (top-right to bottom-left) or NW-SE (top-left to bottom-right)
        bool direction_ne_sw = start == selectionRect.topRight() || 
                               start == selectionRect.bottomLeft();
        
        // 3. Find min/max page numbers
        int minPage = *affectedItemsSet.begin();
        int maxPage = *affectedItemsSet.rbegin();
        
        // 4. Handle single page selection
        if (minPage == maxPage) {
            const PageViewItem *item = d->items[minPage];
            QRect rectRelativeToItem = selectionRect;
            rectRelativeToItem.translate(-item->uncroppedGeometry().topLeft());
            
            ret.push_back(textSelectionForItem(
                item,
                direction_ne_sw ? rectRelativeToItem.topRight() 
                               : rectRelativeToItem.topLeft(),
                direction_ne_sw ? rectRelativeToItem.bottomLeft() 
                               : rectRelativeToItem.bottomRight()
            ));
        }
        // 5. Handle multi-page selection
        else {
            // First page: from start point to bottom/right edge
            const PageViewItem *first = d->items[minPage];
            QRect firstRect = first->croppedGeometry().intersected(selectionRect)
                                .translated(-first->uncroppedGeometry().topLeft());
            ret.push_back(textSelectionForItem(
                first,
                direction_ne_sw ? firstRect.topRight() : firstRect.topLeft(),
                QPoint()  // Empty = select to end of page
            ));
            
            // Middle pages: select all text
            for (int page = minPage + 1; page < maxPage; ++page) {
                ret.push_back(textSelectionForItem(d->items[page]));
            }
            
            // Last page: from top/left edge to end point
            const PageViewItem *last = d->items[maxPage];
            QRect lastRect = last->croppedGeometry().intersected(selectionRect)
                              .translated(-last->uncroppedGeometry().topLeft());
            ret.push_back(textSelectionForItem(
                last,
                QPoint(),  // Empty = select from start of page
                direction_ne_sw ? lastRect.bottomLeft() : lastRect.bottomRight()
            ));
        }
        
        firstpage = minPage;
    }
    
    return ret;
}
```

**JavaScript Implementation**:
```javascript
getTextSelections(startPos, endPos) {
  const selections = [];
  
  // 1. Create bounding rectangle from start and end points
  const selectionBounds = this.getBoundingRect(startPos, endPos);
  
  // 2. Find all pages that intersect the selection rectangle
  const affectedPages = [];
  this.pages.forEach((page, index) => {
    if (page.isVisible && this.rectsIntersect(
      selectionBounds, 
      page.geometry
    )) {
      affectedPages.push(index);
    }
  });
  
  if (affectedPages.length === 0) return selections;
  
  // 3. Determine selection direction (left-to-right or right-to-left)
  const isNESW = (startPos.x > endPos.x && startPos.y < endPos.y) ||
                 (startPos.x < endPos.x && startPos.y > endPos.y);
  
  // 4. Handle single page selection
  if (affectedPages.length === 1) {
    const page = this.pages[affectedPages[0]];
    const relativeStart = this.pointRelativeTo(startPos, page);
    const relativeEnd = this.pointRelativeTo(endPos, page);
    
    selections.push(
      this.getTextSelectionForPage(
        page,
        isNESW ? { x: relativeStart.x, y: relativeEnd.y } : relativeStart,
        isNESW ? { x: relativeEnd.x, y: relativeStart.y } : relativeEnd
      )
    );
  }
  // 5. Handle multi-page selection
  else {
    const minPage = affectedPages[0];
    const maxPage = affectedPages[affectedPages.length - 1];
    
    // First page: from start to bottom/right
    const firstPage = this.pages[minPage];
    const firstRelStart = this.pointRelativeTo(startPos, firstPage);
    selections.push(
      this.getTextSelectionForPage(
        firstPage,
        isNESW ? { x: firstRelStart.x, y: firstPage.height } : firstRelStart,
        null  // To end of page
      )
    );
    
    // Middle pages: select all text
    for (let i = minPage + 1; i < maxPage; i++) {
      selections.push(
        this.getTextSelectionForPage(this.pages[i], null, null)
      );
    }
    
    // Last page: from top/left to end
    const lastPage = this.pages[maxPage];
    const lastRelEnd = this.pointRelativeTo(endPos, lastPage);
    selections.push(
      this.getTextSelectionForPage(
        lastPage,
        null,  // From start of page
        isNESW ? { x: lastRelEnd.x, y: 0 } : lastRelEnd
      )
    );
  }
  
  return selections;
}

getBoundingRect(p1, p2) {
  return {
    left: Math.min(p1.x, p2.x),
    top: Math.min(p1.y, p2.y),
    right: Math.max(p1.x, p2.x),
    bottom: Math.max(p1.y, p2.y),
    width: Math.abs(p1.x - p2.x),
    height: Math.abs(p1.y - p2.y)
  };
}
```

---

## 🔤 Per-Page Text Selection

### `textSelectionForItem()` - Extract text from single page

**Purpose**: Get the actual text rectangles for a single page given start/end points

**C++ Logic**:
```cpp
std::unique_ptr<Okular::RegularAreaRect> PageView::textSelectionForItem(
    const PageViewItem *item, 
    const QPoint startPoint, 
    const QPoint endPoint)
{
    const QRect &geometry = item->uncroppedGeometry();
    
    // 1. Convert screen coordinates to normalized coordinates (0-1)
    Okular::NormalizedPoint startCursor(0.0, 0.0);
    if (!startPoint.isNull()) {
        startCursor = rotateInNormRect(startPoint, geometry, 
                                       item->page()->rotation());
    }
    
    Okular::NormalizedPoint endCursor(1.0, 1.0);
    if (!endPoint.isNull()) {
        endCursor = rotateInNormRect(endPoint, geometry, 
                                     item->page()->rotation());
    }
    
    // 2. Create text selection info
    Okular::TextSelection mouseTextSelectionInfo(startCursor, endCursor);
    
    // 3. Ensure text page is loaded
    const Okular::Page *okularPage = item->page();
    if (!okularPage->hasTextPage()) {
        d->document->requestTextPage(okularPage->number());
    }
    
    // 4. Get text areas (rectangles containing text) for the selection
    std::unique_ptr<Okular::RegularAreaRect> selectionArea = 
        okularPage->textArea(mouseTextSelectionInfo);
    
    return selectionArea;
}
```

**Key Concept: Normalized Coordinates**

Okular uses normalized coordinates (0.0 to 1.0) where:
- (0, 0) = top-left of page
- (1, 1) = bottom-right of page

This allows the PDF to be rotated and scaled without recalculating text positions.

**JavaScript Implementation**:
```javascript
getTextSelectionForPage(page, startPoint, endPoint) {
  // 1. Convert screen coordinates to normalized coordinates (0-1)
  let normalizedStart = { x: 0, y: 0 };
  if (startPoint) {
    normalizedStart = {
      x: startPoint.x / page.width,
      y: startPoint.y / page.height
    };
    // Clamp to valid range
    normalizedStart.x = Math.max(0, Math.min(1, normalizedStart.x));
    normalizedStart.y = Math.max(0, Math.min(1, normalizedStart.y));
  }
  
  let normalizedEnd = { x: 1, y: 1 };
  if (endPoint) {
    normalizedEnd = {
      x: endPoint.x / page.width,
      y: endPoint.y / page.height
    };
    // Clamp to valid range
    normalizedEnd.x = Math.max(0, Math.min(1, normalizedEnd.x));
    normalizedEnd.y = Math.max(0, Math.min(1, normalizedEnd.y));
  }
  
  // 2. Ensure we have normalized start < end
  if (normalizedStart.x > normalizedEnd.x) {
    [normalizedStart.x, normalizedEnd.x] = [normalizedEnd.x, normalizedStart.x];
  }
  if (normalizedStart.y > normalizedEnd.y) {
    [normalizedStart.y, normalizedEnd.y] = [normalizedEnd.y, normalizedStart.y];
  }
  
  // 3. Request text extraction from PDF library
  // This depends on your PDF.js or pdfium setup
  const textSelection = {
    pageNumber: page.index,
    startNorm: normalizedStart,
    endNorm: normalizedEnd
  };
  
  // 4. Get actual text rectangles
  const rects = this.extractTextRects(page, textSelection);
  
  return {
    pageNumber: page.index,
    rects: rects,
    normalizedBounds: {
      start: normalizedStart,
      end: normalizedEnd
    }
  };
}

extractTextRects(page, selection) {
  // This is library-specific (pdfjs, pdfium, etc.)
  // Pseudocode:
  const rects = [];
  
  // Get all text items from the page
  const textItems = page.getTextContent(); // PDF.js method
  
  // Filter text items within selection bounds
  textItems.forEach(item => {
    const itemNorm = {
      x: item.x / page.width,
      y: item.y / page.height,
      width: item.width / page.width,
      height: item.height / page.height
    };
    
    // Check if item overlaps with selection
    if (this.rectsIntersect(itemNorm, selection.startNorm, selection.endNorm)) {
      rects.push({
        x: itemNorm.x,
        y: itemNorm.y,
        width: itemNorm.width,
        height: itemNorm.height,
        text: item.str
      });
    }
  });
  
  return rects;
}
```

---

## 📝 Text Selection State Management

### State Variables to Track

**C++ State (in `PageViewPrivate`)**:
```cpp
struct PageViewPrivate {
    bool mouseSelecting;                    // Is rectangular selection active?
    bool mouseTextSelecting;                // Is text selection active?
    QRect mouseSelectionRect;               // Current selection rectangle
    QColor mouseSelectionColor;             // Color to highlight selection
    QPoint mouseSelectPos;                  // Initial selection position
    QPoint mousePressPos;                   // Mouse press position
    QSet<int> pagesWithTextSelection;       // Which pages have selected text
    Okular::Settings::EnumMouseMode mouseMode;  // Current interaction mode
};
```

**JavaScript Equivalent**:
```javascript
class PDFViewer {
  constructor() {
    // Selection state
    this.isSelecting = false;               // Rectangle selection active?
    this.isTextSelecting = false;           // Text selection active?
    this.selectionRect = null;              // Current selection bounds
    this.startSelectPos = null;             // Selection start position
    this.lastSelectPos = null;              // Last recorded position
    this.pagesWithSelection = new Set();    // Page numbers with selected text
    
    // Visual properties
    this.highlightColor = '#FFFF00';        // Selection highlight color
    this.highlightOpacity = 0.4;            // Transparency
    
    // Mode tracking
    this.mouseMode = 'TextSelect';          // 'TextSelect', 'RectSelect', 'Browse'
    
    // Performance
    this.lastUpdateTime = 0;
    this.updateDebounceMs = 16;             // ~60 FPS
  }
}
```

---

## 🎯 Selection Modes

Okular supports multiple selection modes (controlled by `mouseMode`):

| Mode | Purpose | Behavior |
|------|---------|----------|
| **TextSelect** | Extract text | Drag to highlight text across pages |
| **RectSelect** | Rectangular area | Drag to create rectangle selection |
| **Browse** | Normal browsing | Click to follow links, drag to pan |
| **Zoom** | Zoom region | Drag to zoom into rectangular area |
| **TableSelect** | Table extraction | Click to add/remove table row/column dividers |
| **Magnifier** | Magnified view | Show magnified region under cursor |

**JavaScript Mode Implementation**:
```javascript
class PDFViewer {
  setMouseMode(mode) {
    this.mouseMode = mode;
    this.updateCursor();
  }
  
  onMouseDown(event) {
    switch (this.mouseMode) {
      case 'TextSelect':
        this.startTextSelection(event);
        break;
      case 'RectSelect':
        this.startRectangleSelection(event);
        break;
      case 'Zoom':
        this.startZoomSelection(event);
        break;
      case 'Browse':
        this.handleBrowseClick(event);
        break;
    }
  }
  
  onMouseMove(event) {
    switch (this.mouseMode) {
      case 'TextSelect':
        this.updateTextSelection(event);
        break;
      case 'RectSelect':
        this.updateRectangleSelection(event);
        break;
      case 'Zoom':
        this.updateZoomSelection(event);
        break;
    }
  }
}
```

---

## 🔄 Auto-Scroll During Selection

When user drags selection to page edges, auto-scroll keeps selection moving.

**C++ Logic**:
```cpp
void PageView::scrollPosIntoView(const QPoint pos)
{
    const int damping = 6;  // Scroll smoothness factor
    
    // Check horizontal scrolling need
    if (pos.x() < horizontalScrollBar()->value()) {
        d->dragScrollVector.setX(
            (pos.x() - horizontalScrollBar()->value()) / damping
        );
    } else if (horizontalScrollBar()->value() + viewport()->width() < pos.x()) {
        d->dragScrollVector.setX(
            (pos.x() - horizontalScrollBar()->value() - viewport()->width()) / damping
        );
    } else {
        d->dragScrollVector.setX(0);
    }
    
    // Check vertical scrolling need
    if (pos.y() < verticalScrollBar()->value()) {
        d->dragScrollVector.setY(
            (pos.y() - verticalScrollBar()->value()) / damping
        );
    } else if (verticalScrollBar()->value() + viewport()->height() < pos.y()) {
        d->dragScrollVector.setY(
            (pos.y() - verticalScrollBar()->value() - viewport()->height()) / damping
        );
    } else {
        d->dragScrollVector.setY(0);
    }
    
    // Start timer if scrolling needed
    if (d->dragScrollVector != QPoint(0, 0)) {
        if (!d->dragScrollTimer.isActive()) {
            d->dragScrollTimer.start(1000 / 60);  // 60 FPS
        }
    } else {
        d->dragScrollTimer.stop();
    }
}
```

**JavaScript Implementation**:
```javascript
scrollPosIntoView(pos) {
  const damping = 6;
  const viewport = this.getViewport();
  const scrollPos = this.getScrollPosition();
  
  let scrollX = 0;
  let scrollY = 0;
  
  // Check if we need to scroll horizontally
  if (pos.x < scrollPos.x) {
    scrollX = (pos.x - scrollPos.x) / damping;
  } else if (pos.x > scrollPos.x + viewport.width) {
    scrollX = (pos.x - (scrollPos.x + viewport.width)) / damping;
  }
  
  // Check if we need to scroll vertically
  if (pos.y < scrollPos.y) {
    scrollY = (pos.y - scrollPos.y) / damping;
  } else if (pos.y > scrollPos.y + viewport.height) {
    scrollY = (pos.y - (scrollPos.y + viewport.height)) / damping;
  }
  
  // Apply smooth scrolling
  if (scrollX !== 0 || scrollY !== 0) {
    if (!this.dragScrollTimer) {
      this.startDragScrollTimer();
    }
    this.dragScrollVector = { x: scrollX, y: scrollY };
  } else {
    this.stopDragScrollTimer();
  }
}

startDragScrollTimer() {
  this.dragScrollTimer = setInterval(() => {
    this.scroll(this.dragScrollVector.x, this.dragScrollVector.y);
  }, 1000 / 60);  // 60 FPS
}
```

---

## 🎨 Visual Rendering

### Selection Rectangle Display

**C++ Rendering**:
- Uses Qt's painter to draw rectangles
- Redraws only affected areas for performance
- Color set to theme highlight color

**JavaScript Canvas/DOM Approach**:
```javascript
renderSelectionRectangle(rect) {
  const canvas = this.selectionCanvas;
  const ctx = canvas.getContext('2d');
  
  // Clear previous
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw rectangle with semi-transparent fill and border
  ctx.fillStyle = `rgba(255, 255, 0, ${this.highlightOpacity})`;
  ctx.strokeStyle = '#FF8C00';
  ctx.lineWidth = 2;
  
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

renderTextSelection(pageNumber, rects) {
  const page = this.pages[pageNumber];
  const overlay = page.selectionOverlay;
  
  const canvas = overlay.canvas;
  const ctx = canvas.getContext('2d');
  
  // Clear previous
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw each text rectangle
  ctx.fillStyle = `rgba(255, 255, 0, ${this.highlightOpacity})`;
  rects.forEach(rect => {
    ctx.fillRect(
      rect.x * page.width,
      rect.y * page.height,
      rect.width * page.width,
      rect.height * page.height
    );
  });
}
```

---

## 📋 Copy Selected Text

After selection, users often want to copy text to clipboard.

**C++ Logic** (simplified):
```cpp
void PageView::copyTextSelection(TextCopyMode mode)
{
    QString selectedText;
    
    // Iterate through selected pages in order
    for (int page : d->pagesWithTextSelection) {
        const Okular::Page *okularPage = d->document->page(page);
        
        // Get text from this page's selection
        if (okularPage->textSelection()) {
            QString pageText = okularPage->getText(
                okularPage->textSelection()
            );
            
            // Handle line breaks based on mode
            if (mode == TextCopyMode::WithoutLineBreaks) {
                pageText = pageText.replace("\n", " ");
            }
            
            selectedText += pageText;
        }
    }
    
    // Copy to clipboard
    QApplication::clipboard()->setText(selectedText);
}
```

**JavaScript Implementation**:
```javascript
async copyTextSelection() {
  let selectedText = '';
  
  // Iterate through pages with selection in order
  const sortedPages = Array.from(this.pagesWithSelection).sort((a, b) => a - b);
  
  for (const pageNum of sortedPages) {
    const page = this.pages[pageNum];
    
    // Get text from selected rectangles on this page
    const pageText = this.getTextFromRects(page, page.selectedRects);
    selectedText += pageText;
  }
  
  // Copy to clipboard (Electron)
  try {
    await navigator.clipboard.writeText(selectedText);
    this.showNotification('Text copied to clipboard');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

getTextFromRects(page, rects) {
  let text = '';
  
  // Get all text items from page
  const textItems = page.textContent;
  
  // Filter items within selected rectangles
  rects.forEach(selRect => {
    textItems.forEach(item => {
      if (this.rectsIntersect(item.bbox, selRect)) {
        text += item.str;
      }
    });
    text += '\n';  // Add line break between rectangles
  });
  
  return text;
}
```

---

## ⚡ Performance Optimization Tips

1. **Debounce Mouse Move Events**
   - Don't update selection on every single mouse move
   - Use requestAnimationFrame or setTimeout

   ```javascript
   let lastUpdateTime = 0;
   const UPDATE_INTERVAL = 16; // ms (60 FPS)
   
   onMouseMove(event) {
     const now = Date.now();
     if (now - lastUpdateTime > UPDATE_INTERVAL) {
       this.updateSelection(event);
       lastUpdateTime = now;
     }
   }
   ```

2. **Dirty Rectangle Updates**
   - Only redraw affected areas, not entire canvas
   - Track previous selection rectangle

   ```javascript
   updateSelection(newRect) {
     const oldRect = this.selectionRect;
     const dirtyRect = this.unionRect(oldRect, newRect);
     
     // Only redraw dirty area
     this.renderRegion(dirtyRect);
     
     this.selectionRect = newRect;
   }
   ```

3. **Lazy Text Extraction**
   - Only extract text for visible pages
   - Cache results

   ```javascript
   getVisiblePages() {
     return this.pages.filter(p => p.isVisible);
   }
   
   extractTextRects(page) {
     if (this.textRectCache[page.index]) {
       return this.textRectCache[page.index];
     }
     
     const rects = this._extractTextRects(page);
     this.textRectCache[page.index] = rects;
     return rects;
   }
   ```

4. **Right-Click Context Menu**
   - Show copy option only if text is selected

   ```javascript
   onContextMenu(event) {
     if (this.pagesWithSelection.size > 0) {
       // Show copy option
       menu.addAction('Copy', () => this.copyTextSelection());
     }
   }
   ```

---

## 🔗 Key Okular Source Files

For deeper understanding, check these files in the Okular repository:

- **`part/pageview.h`** - PageView class declaration
  - Line 114: `textSelections()` method
  - Line 115: `textSelectionForItem()` method
  - Line 216: `selectionStart()` method

- **`part/pageview.cpp`** - Main implementation
  - Line 2251: `mouseMoveEvent()` - Drag tracking
  - Line 2381: `mousePressEvent()` - Selection start
  - Line 3441: `textSelections()` - Multi-page logic
  - Line 3756: `selectionStart()` - Initialize
  - Line 3823: `updateSelection()` - Live update
  - Line 3883: `textSelectionForItem()` - Per-page extraction

- **`core/page.h/cpp`** - Text extraction interface
  - `textArea()` - Get text rectangles
  - `getText()` - Get raw text

---

## 🎓 Key Takeaways

1. **Three-Phase Process**: Press → Move → Release
2. **Normalized Coordinates**: Use 0-1 range for rotation-independence
3. **Multi-Page Aware**: Handle selections spanning multiple pages
4. **Performance First**: Update only dirty regions, debounce events
5. **State Management**: Track which pages have selections
6. **Direction Detection**: Support both LTR and RTL selections
7. **Auto-Scroll**: Smoothly scroll when dragging to edges

---

## 💡 Electron Implementation Starter

```javascript
class ElectronPDFViewer {
  constructor(containerEl) {
    this.container = containerEl;
    this.canvas = document.createElement('canvas');
    this.selectionCanvas = document.createElement('canvas');
    
    this.pages = [];
    this.isTextSelecting = false;
    this.pagesWithSelection = new Set();
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
    this.canvas.addEventListener('contextmenu', e => this.onContextMenu(e));
  }
  
  onMouseDown(event) {
    if (this.mouseMode === 'TextSelect') {
      this.startSelectPos = this.getContentPos(event);
      this.lastSelectPos = this.startSelectPos;
      this.isTextSelecting = false;  // Wait for movement
    }
  }
  
  onMouseMove(event) {
    if (!this.startSelectPos) return;
    
    const currentPos = this.getContentPos(event);
    const distance = this.manhattanDistance(this.startSelectPos, currentPos);
    
    // Start selection after 5px movement
    if (distance > 5) {
      this.isTextSelecting = true;
    }
    
    if (this.isTextSelecting) {
      const selections = this.getTextSelections(this.startSelectPos, currentPos);
      this.renderSelections(selections);
    }
  }
  
  onMouseUp(event) {
    if (this.isTextSelecting) {
      // Selection complete
      this.isTextSelecting = false;
    }
  }
  
  onContextMenu(event) {
    if (this.pagesWithSelection.size > 0) {
      const menu = new Menu();
      menu.append(new MenuItem({
        label: 'Copy',
        click: () => this.copyTextSelection()
      }));
      menu.popup({ window: remote.getCurrentWindow() });
    }
  }
}
```

---

## 📚 References

- KDE Okular GitHub: https://github.com/KDE/okular
- PDF.js Text Layer: https://mozilla.github.io/pdf.js/
- Qt Documentation: https://doc.qt.io/
- Electron IPC: https://www.electronjs.org/docs/api/ipc-main

---

**Created**: February 21, 2026  
**Source**: KDE Okular C++ Implementation  
**Target**: JavaScript/Electron PDF Viewers
