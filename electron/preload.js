import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openPdfDialog: () => ipcRenderer.invoke('open-pdf-dialog'),
  savePdf: (filePath, data) => ipcRenderer.invoke('save-pdf', { filePath, data }),
  printPdf: (pdfData) => ipcRenderer.invoke('print-pdf', pdfData)
});
