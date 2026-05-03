import { PDFDocument, rgb } from 'pdf-lib';

function clamp01(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function hexToRgb01(hex) {
  if (typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return { r, g, b };
}

function parseCssColorToRgb01(color) {
  if (typeof color !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
  const c = color.trim();

  // rgba(r,g,b,a)
  let m = c.match(/^rgba\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)\s*$/i);
  if (m) {
    return {
      r: clamp01(parseInt(m[1], 10) / 255),
      g: clamp01(parseInt(m[2], 10) / 255),
      b: clamp01(parseInt(m[3], 10) / 255),
      a: clamp01(parseFloat(m[4]))
    };
  }

  // rgb(r,g,b)
  m = c.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)\s*$/i);
  if (m) {
    return {
      r: clamp01(parseInt(m[1], 10) / 255),
      g: clamp01(parseInt(m[2], 10) / 255),
      b: clamp01(parseInt(m[3], 10) / 255),
      a: 1
    };
  }

  // #RRGGBB
  if (c.startsWith('#')) {
    const { r, g, b } = hexToRgb01(c);
    return { r, g, b, a: 1 };
  }

  // fallback
  return { r: 0, g: 0, b: 0, a: 1 };
}

function ensureUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  if (bytes && bytes.buffer instanceof ArrayBuffer) return new Uint8Array(bytes.buffer);
  throw new Error('exportPdf: originalPdfBytes must be a Uint8Array or number[]');
}

function safeGetPageIndex(pageNumber1Based, pageCount) {
  const idx = (pageNumber1Based | 0) - 1;
  if (idx < 0 || idx >= pageCount) return null;
  return idx;
}

/**
 * Shared export engine.
 *
 * Flattens current annotations into PDF page content using pdf-lib.
 * This produces a real modified PDF that will open in external viewers.
 *
 * Input:
 *  - originalPdfBytes: Uint8Array | number[]
 *  - annotationState: { drawPaths, highlightPaths, highlights }
 *      where each is Map(tabId -> Map(pageNum -> items[])) (we export current tab only)
 *  - options: { tabId, rotationDeg }
 */
export async function exportPdf(originalPdfBytes, annotationState, options = {}) {
  const { tabId, rotationDeg = 0 } = options;
  if (!tabId) throw new Error('exportPdf: options.tabId is required');

  const pdfBytes = ensureUint8Array(originalPdfBytes);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const pageCount = pages.length;

  const drawPathsByPage = annotationState?.drawPaths?.get?.(tabId);
  const highlightPathsByPage = annotationState?.highlightPaths?.get?.(tabId);
  const textHighlightsByPage = annotationState?.highlights?.get?.(tabId);

  // Draw strokes + freehand highlights as polyline approximations.
  // NOTE: Input is normalized points (nx, ny). Rotation is assumed already normalized in restore;
  // for export we apply the same normalized rotation transform before mapping into PDF coords.
  function rotateNormalizedPoint(nx, ny) {
    const rot = ((rotationDeg % 360) + 360) % 360;
    switch (rot) {
      case 90:
        return { nx: 1 - ny, ny: nx };
      case 180:
        return { nx: 1 - nx, ny: 1 - ny };
      case 270:
        return { nx: ny, ny: 1 - nx };
      case 0:
      default:
        return { nx, ny };
    }
  }

  function mapNormToPdfXY(page, nx, ny) {
    const { width, height } = page.getSize();
    // UI normalized space is top-left origin; PDF is bottom-left.
    const x = clamp01(nx) * width;
    const y = (1 - clamp01(ny)) * height;
    return { x, y };
  }

  function drawPolyline(page, points, stroke, thickness) {
    if (!Array.isArray(points) || points.length < 2) return;

    for (let i = 1; i < points.length; i++) {
      const a0 = points[i - 1];
      const b0 = points[i];
      if (!a0 || !b0) continue;

      const aN = rotateNormalizedPoint(a0.nx ?? (a0.x != null ? a0.x : 0), a0.ny ?? (a0.y != null ? a0.y : 0));
      const bN = rotateNormalizedPoint(b0.nx ?? (b0.x != null ? b0.x : 0), b0.ny ?? (b0.y != null ? b0.y : 0));

      // If legacy pixel coords leak in, this will be wrong. We intentionally only export normalized points.
      if (typeof aN.nx !== 'number' || typeof aN.ny !== 'number' || typeof bN.nx !== 'number' || typeof bN.ny !== 'number') continue;

      const a = mapNormToPdfXY(page, aN.nx, aN.ny);
      const b = mapNormToPdfXY(page, bN.nx, bN.ny);

      page.drawLine({
        start: a,
        end: b,
        thickness: Math.max(0.1, thickness || 1),
        color: stroke,
        opacity: 1
      });
    }
  }

  // 1) draw strokes
  if (drawPathsByPage) {
    for (const [pageNum, paths] of drawPathsByPage.entries()) {
      const idx = safeGetPageIndex(pageNum, pageCount);
      if (idx == null) continue;
      const page = pages[idx];

      for (const p of (paths || [])) {
        const pts = p?.points;
        if (!Array.isArray(pts) || pts.length < 2) continue;
        const { r, g, b } = parseCssColorToRgb01(p?.color || '#000000');
        drawPolyline(page, pts, rgb(r, g, b), p?.thickness || 3);
      }
    }
  }

  // 2) freehand highlights
  if (highlightPathsByPage) {
    for (const [pageNum, paths] of highlightPathsByPage.entries()) {
      const idx = safeGetPageIndex(pageNum, pageCount);
      if (idx == null) continue;
      const page = pages[idx];

      for (const p of (paths || [])) {
        const pts = p?.points;
        if (!Array.isArray(pts) || pts.length < 2) continue;

        // highlight color sometimes stored as rgba(...) already
        const { r, g, b, a } = parseCssColorToRgb01(p?.color || '#FFF176');
        // pdf-lib drawLine supports opacity per call; we approximate highlight by drawing semi-transparent lines.
        for (let i = 1; i < pts.length; i++) {
          const a0 = pts[i - 1];
          const b0 = pts[i];
          if (!a0 || !b0) continue;

          const aN = rotateNormalizedPoint(a0.nx, a0.ny);
          const bN = rotateNormalizedPoint(b0.nx, b0.ny);
          if (typeof aN.nx !== 'number' || typeof aN.ny !== 'number' || typeof bN.nx !== 'number' || typeof bN.ny !== 'number') continue;

          const aP = mapNormToPdfXY(page, aN.nx, aN.ny);
          const bP = mapNormToPdfXY(page, bN.nx, bN.ny);

          page.drawLine({
            start: aP,
            end: bP,
            thickness: Math.max(0.1, p?.thickness || 12),
            color: rgb(r, g, b),
            opacity: clamp01(a * 0.5) // UI uses ~0.25; keep conservative
          });
        }
      }
    }
  }

  // 3) text highlight rectangles
  if (textHighlightsByPage) {
    for (const [pageNum, highlights] of textHighlightsByPage.entries()) {
      const idx = safeGetPageIndex(pageNum, pageCount);
      if (idx == null) continue;
      const page = pages[idx];
      const { width, height } = page.getSize();

      for (const h of (highlights || [])) {
        const rects = h?.rects;
        if (!Array.isArray(rects) || rects.length === 0) continue;
        const { r, g, b } = parseCssColorToRgb01(h?.color || '#FFF176');

        rects.forEach(rn => {
          if (!rn || typeof rn.nx !== 'number' || typeof rn.ny !== 'number' || typeof rn.nw !== 'number' || typeof rn.nh !== 'number') return;

          // Rotate four corners in normalized space then bound
          const corners = [
            rotateNormalizedPoint(rn.nx, rn.ny),
            rotateNormalizedPoint(rn.nx + rn.nw, rn.ny),
            rotateNormalizedPoint(rn.nx, rn.ny + rn.nh),
            rotateNormalizedPoint(rn.nx + rn.nw, rn.ny + rn.nh)
          ];

          const minX = Math.min(...corners.map(c => c.nx));
          const maxX = Math.max(...corners.map(c => c.nx));
          const minY = Math.min(...corners.map(c => c.ny));
          const maxY = Math.max(...corners.map(c => c.ny));

          const x = clamp01(minX) * width;
          const yTop = clamp01(minY);
          const yBottom = clamp01(maxY);

          const rectW = clamp01(maxX) * width - clamp01(minX) * width;
          const rectH = (yBottom - yTop) * height;

          // PDF origin is bottom-left: y = (1 - (yTop + rectHNorm)) * height
          const y = (1 - yBottom) * height;

          page.drawRectangle({
            x,
            y,
            width: rectW,
            height: rectH,
            color: rgb(r, g, b),
            opacity: 0.25,
            borderWidth: 0
          });
        });
      }
    }
  }

  const out = await pdfDoc.save();
  return out;
}
