/**
 * Web download delivery.
 *
 * @param {Uint8Array|ArrayBuffer|number[]} pdfBytes
 * @param {{ filename?: string }} opts
 */
export function webSave(pdfBytes, opts = {}) {
  const filename = opts.filename || 'document-edited.pdf';

  const bytes = pdfBytes instanceof Uint8Array
    ? pdfBytes
    : Array.isArray(pdfBytes)
      ? new Uint8Array(pdfBytes)
      : new Uint8Array(pdfBytes);

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // allow navigation to start before revoking
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
