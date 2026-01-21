# PDF Editor - Desktop Application

A modern, Edge-like PDF viewer and editor built as a standalone desktop application using Electron, Vite, and PDF.js.

## Features

### Multi-Document Tabs
- Open multiple PDFs in separate tabs
- Switch between tabs with Ctrl+Tab / Ctrl+Shift+Tab
- Close tabs with × button, middle-click, or Ctrl+W
- Each tab maintains independent state (zoom, page, tools, annotations)

### Toolbar (41px height)
Three-part layout with LEFT, CENTER (always centered), and RIGHT groups:

**Left Group:**
- Table of Contents toggle
- Highlight tool (with dropdown)
- Draw tool (with dropdown)
- Erase tool
- Text tool

**Center Group (Always Centered):**
- Zoom out
- Zoom in
- Fit to width
- Page navigation (number input + total)
- Rotate page
- Page layout (single/two-page)

**Right Group:**
- Document search (Ctrl+F)
- Print
- Save
- Fullscreen
- Settings

### Sidebar
- Slides in from left
- Two modes: Outline and Thumbnails
- Table of Contents navigation
- Page thumbnail previews with current page highlighting

### Annotation Tools
- **Highlight**: Multiple colors, adjustable thickness, text-only mode
- **Draw**: 30-color palette, thickness slider, freehand drawing
- **Erase**: Remove annotations
- **Text**: Add text annotations

### Search
- In-document text search
- Navigate between results
- Real-time highlighting
- Keyboard shortcuts (Enter/Shift+Enter)

### Settings
- Pin/unpin toolbar (auto-hide on hover when unpinned)
- Hide all annotations toggle
- View document properties
- Light/Dark theme support

### PDF Rendering
- Powered by PDF.js
- High-quality canvas rendering
- Text layer for selection and search
- Annotation overlay system
- Zoom: 50% to 300%
- Page rotation: 0°, 90°, 180°, 270°
- Page layouts: Single page, Two-page

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Build Tool**: Vite
- **PDF Engine**: PDF.js by Mozilla
- **Desktop Wrapper**: Electron
- **Node.js**: 18+

## Installation

```bash
npm install
```

## Development

Run the development server:

```bash
npm run electron:dev
```

This will start both Vite dev server and Electron in development mode.

## Building

Build the application:

```bash
npm run build
npm run electron
```

## Keyboard Shortcuts

- **Ctrl+F**: Open search
- **Ctrl+W**: Close current tab
- **Ctrl+Tab**: Next tab
- **Ctrl+Shift+Tab**: Previous tab
- **Ctrl + +**: Zoom in
- **Ctrl + -**: Zoom out
- **Escape**: Close popovers/search, exit fullscreen
- **Enter**: Next search result
- **Shift+Enter**: Previous search result

## Project Structure

```
goon/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Electron preload script
├── src/
│   ├── icons/           # Toolbar icons
│   │   ├── left/        # Left toolbar group icons
│   │   ├── center/      # Center toolbar group icons
│   │   └── right/       # Right toolbar group icons
│   ├── js/
│   │   ├── TabManager.js          # Multi-tab management
│   │   ├── Toolbar.js             # Toolbar controls
│   │   ├── Sidebar.js             # TOC and thumbnails
│   │   ├── PDFRenderer.js         # PDF.js integration
│   │   ├── AnnotationManager.js   # Drawing and annotations
│   │   ├── SearchManager.js       # Document search
│   │   └── SettingsManager.js     # App settings
│   ├── styles/
│   │   └── main.css     # Main stylesheet
│   └── main.js          # Application entry point
├── index.html           # Main HTML file
├── package.json
└── vite.config.js
```

## Architecture

### Tab System
Each tab maintains its own state:
- Current page number
- Zoom level
- Rotation angle
- Page layout mode
- Active tool
- Annotations
- Sidebar open/closed
- Scroll position

### PDF Rendering
- PDF.js renders pages to canvas elements
- Text layer overlay for text selection and search
- Annotation layer for user drawings and highlights
- Pages are always white (light and dark mode)

### Annotation System
- Canvas-based drawing for highlight and draw tools
- SVG/DOM-based for text annotations
- Per-tab annotation storage
- Undo/redo support (future enhancement)

### Settings Persistence
Settings are stored in localStorage:
- Toolbar pin state
- Annotation visibility
- Theme preference

## Design Specifications

### Colors
**Light Mode:**
- Toolbar: `#f7f7f7`
- Canvas: `#e6e6e6`
- Text: `#000`

**Dark Mode:**
- Toolbar: `#3b3b3b`
- Canvas: `#333333`
- Text: `#fff`

### Dimensions
- Tabs bar height: 36px
- Toolbar height: 41px
- Icon glyph size: 20×20px
- Clickable button size: 32×32px
- Sidebar width: 280px

## Constraints

- ✅ Offline-first application
- ✅ No cloud features
- ✅ No browser APIs (tabs, URLs, address bars)
- ✅ Desktop-only functionality
- ✅ Standalone executable

## Future Enhancements

- Undo/redo for annotations
- Form filling support
- Signature support
- PDF merge/split
- Bookmark management
- Advanced search (regex, case-sensitive)
- Custom keyboard shortcuts
- Plugin system

## License

MIT

## Credits

- PDF.js by Mozilla Foundation
- Icons: Custom icon set
- Built with Electron and Vite
