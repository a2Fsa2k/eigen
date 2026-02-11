# Testing "Hide All Annotations" Feature

## How to Test

1. **Open the application** at http://localhost:5177/
2. **Load a PDF** document
3. **Create some annotations**:
   - Draw some lines (Draw tool)
   - Add some highlights (Highlight tool)
   - Add some text boxes (Text tool)
   - Make sure you have a variety of annotations visible

4. **Open Settings** (gear icon in top right)
5. **Toggle "Hide All Annotations"** checkbox
   - ✅ When checked: All annotations should disappear
   - ✅ When unchecked: All annotations should reappear

6. **Check the console** (F12 → Console tab)
   - You should see messages like:
     ```
     Hiding all annotations
     Found X annotation layers
     ```
   - Or:
     ```
     Showing all annotations
     Found X annotation layers
     ```

## How It Works

The `hideAllAnnotations()` function:
- Finds all `.annotation-layer` elements on the page
- Sets their `display` style to `none` (hidden) or `''` (visible)
- This hides/shows ALL content in those layers:
  - Draw paths (canvas elements)
  - Highlight paths (canvas elements)
  - Text boxes (div elements)

## Architecture

```
page-container
├── canvas (PDF page)
├── text-layer (selectable text)
└── annotation-layer ← This gets hidden/shown
    ├── draw-overlay-canvas (drawings)
    ├── draw-overlay-canvas (highlights)
    └── text-annotation-wrapper (text boxes)
```

## Expected Behavior

✅ **Should hide**: All drawings, highlights, and text annotations
✅ **Should NOT hide**: The PDF content itself (the actual document pages)
✅ **Should persist**: The setting is saved to localStorage
✅ **Should apply on startup**: If you had it enabled, it should be enabled when you reload

## Debugging

If it's not working:
1. Check the browser console for the log messages
2. If you see "Found 0 annotation layers", the PDF might not be loaded yet
3. Try drawing something first to ensure annotation layers are created
4. Inspect the DOM (F12 → Elements) to see if `.annotation-layer` elements exist
5. Check if the inline style `display: none` is being applied to the annotation layers

## Code Location

- **Feature implementation**: `/src/js/AnnotationManager.js` (line ~810)
- **Settings handler**: `/src/js/SettingsManager.js` (line ~53, ~61)
- **UI checkbox**: `/index.html` (settings popover)
