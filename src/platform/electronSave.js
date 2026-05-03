/**
 * Electron delivery.
 *
 * Uses existing preload IPC: window.electronAPI.savePdf(filePath, data)
 *
 * @param {Uint8Array|number[]} pdfBytes
 * @param {{ filePath: string }} opts
 */
export async function electronSave(pdfBytes, opts = {}) {
  const filePath = opts.filePath;
  if (!filePath) throw new Error('electronSave: opts.filePath is required');
  if (!window.electronAPI?.savePdf) throw new Error('electronSave: electronAPI.savePdf not available');

  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const result = await window.electronAPI.savePdf(filePath, Array.from(bytes));
  return result;
}
