export class SettingsManager {
  constructor(app) {
    this.app = app;
    this.settings = {
      hideAnnotations: false,
      theme: 'light'
    };
    
    this.loadSettings();
    this.applySettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('pdf-editor-settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }

    // Update UI checkboxes
    const darkModeCheckbox = document.getElementById('setting-dark-mode');
    const hideAnnotationsCheckbox = document.getElementById('setting-hide-annotations');
    
    if (darkModeCheckbox) {
      darkModeCheckbox.checked = this.settings.theme === 'dark';
    }
    if (hideAnnotationsCheckbox) {
      hideAnnotationsCheckbox.checked = this.settings.hideAnnotations;
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('pdf-editor-settings', JSON.stringify(this.settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  applySettings() {
    // Apply theme
    if (this.settings.theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // Apply annotation visibility
    if (this.settings.hideAnnotations) {
      this.app.annotationManager.hideAllAnnotations(true);
    }
  }

  setHideAnnotations(hide) {
    this.settings.hideAnnotations = hide;
    this.saveSettings();
    
    this.app.annotationManager.hideAllAnnotations(hide);
  }

  setTheme(theme) {
    this.settings.theme = theme;
    this.saveSettings();
    
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  async showDocumentProperties() {
    const activeTab = this.app.tabManager.getActiveTab();
    if (!activeTab) {
      alert('No document open');
      return;
    }

    const doc = this.app.pdfRenderer.getDocument(activeTab.id);
    if (!doc) return;

    try {
      const metadata = await doc.getMetadata();
      const info = metadata.info || {};
      
      // Get first page for page size
      const firstPage = await doc.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      const pageWidth = (viewport.width * 0.0393701).toFixed(2); // Convert to cm
      const pageHeight = (viewport.height * 0.0393701).toFixed(2);
      
      // Populate modal fields
      document.getElementById('prop-filename').textContent = activeTab.name || '-';
      document.getElementById('prop-location').textContent = activeTab.path || '-';
      
      // Get file size from tab's fileData
      const fileSize = activeTab.fileData ? activeTab.fileData.byteLength : 0;
      document.getElementById('prop-filesize').textContent = this.formatFileSize(fileSize);
      
      document.getElementById('prop-title').textContent = info.Title || '-';
      document.getElementById('prop-author').textContent = info.Author || '-';
      document.getElementById('prop-subject').textContent = info.Subject || '-';
      document.getElementById('prop-keywords').textContent = info.Keywords || '-';
      document.getElementById('prop-creator').textContent = info.Creator || '-';
      document.getElementById('prop-producer').textContent = info.Producer || '-';
      document.getElementById('prop-created').textContent = this.formatDate(info.CreationDate) || '-';
      document.getElementById('prop-modified').textContent = this.formatDate(info.ModDate) || '-';
      document.getElementById('prop-pdfversion').textContent = metadata.info?.PDFFormatVersion || '-';
      document.getElementById('prop-pagecount').textContent = doc.numPages.toString();
      document.getElementById('prop-pagesize').textContent = `${pageWidth} × ${pageHeight} cm`;
      
      // Load fonts info
      this.loadFontsInfo(doc);
      
      // Show modal
      const modal = document.getElementById('doc-properties-modal');
      modal.style.display = 'flex';
      
    } catch (e) {
      console.error('Error getting document properties:', e);
      alert('Error retrieving document properties');
    }
  }

  async loadFontsInfo(doc) {
    const fontsList = document.getElementById('prop-fonts-list');
    fontsList.innerHTML = '<p>Loading fonts information...</p>';
    
    try {
      const fonts = [];
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const ops = await page.getOperatorList();
        // This is simplified - actual font extraction would need more work
        // For now, just show a message
      }
      fontsList.innerHTML = '<p>Font information is not available in this build.</p>';
    } catch (e) {
      fontsList.innerHTML = '<p>Error loading fonts information.</p>';
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(pdfDate) {
    if (!pdfDate) return null;
    // PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
    const match = pdfDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
    }
    return pdfDate;
  }
}
