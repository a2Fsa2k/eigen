# Draw Tool Implementation

## Architecture

### 1. DrawToolState.js
- Centralized state management
- Observable pattern with listeners
- Single source of truth for:
  - `color`: Current draw color
  - `thickness`: Current line thickness
  - `enabled`: Whether draw tool is active

### 2. DrawToolUI.js
- Manages dropdown panel UI
- Features:
  - **Color Palette**: 12 predefined colors in grid layout
  - **Thickness Slider**: Range 1-30px
  - **Live Preview**: Shows current stroke style
- Auto-updates when state changes
- Handles positioning and visibility

### 3. DrawingEngine.js
- Handles actual drawing on overlay canvas
- Uses DrawToolState for all drawing parameters
- Methods:
  - `startDrawing(x, y)`: Begin path
  - `continueDrawing(x, y)`: Add points
  - `stopDrawing()`: End and return path data
  - `drawPath(pathData)`: Redraw saved path
  - `clear()`: Clear canvas

### 4. Integration with AnnotationManager
- Creates instances of State, UI, and Engine
- Wires up dropdown to draw arrow button
- Manages overlay canvas per page
- Stores paths per tab/page for persistence

## Usage

1. Click the **Draw** button to activate draw tool
2. Click the **dropdown arrow** next to Draw button
3. Select color from palette
4. Adjust thickness with slider
5. See live preview update
6. Draw on PDF pages

## Key Features

✅ Clean separation of concerns
✅ State-driven architecture
✅ Modular and testable
✅ No inline styles
✅ Dark UI theme
✅ Smooth drawing performance
✅ Per-page overlay canvases
✅ Path data persistence

## Files Modified

- `/src/js/DrawToolState.js` (new)
- `/src/js/DrawToolUI.js` (new)
- `/src/js/DrawingEngine.js` (new)
- `/src/js/AnnotationManager.js` (updated)
- `/src/js/Toolbar.js` (updated)
- `/src/styles/main.css` (added styles)
