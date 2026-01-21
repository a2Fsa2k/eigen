export class SettingsManager {
  constructor(app) {
    this.app = app;
    this.settings = {
      pinToolbar: true,
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
    const pinToolbarCheckbox = document.getElementById('setting-pin-toolbar');
    const hideAnnotationsCheckbox = document.getElementById('setting-hide-annotations');
    
    if (darkModeCheckbox) {
      darkModeCheckbox.checked = this.settings.theme === 'dark';
    }
    if (pinToolbarCheckbox) {
      pinToolbarCheckbox.checked = this.settings.pinToolbar;
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

    // Apply toolbar pin
    const toolbar = document.getElementById('toolbar');
    if (this.settings.pinToolbar) {
      toolbar.classList.remove('hidden');
    }

    // Apply annotation visibility
    if (this.settings.hideAnnotations) {
      this.app.annotationManager.hideAllAnnotations(true);
    }
  }

  setPinToolbar(pinned) {
    this.settings.pinToolbar = pinned;
    this.saveSettings();
    
    const toolbar = document.getElementById('toolbar');
    if (pinned) {
      toolbar.classList.remove('hidden');
    } else {
      // Toolbar will be shown/hidden on hover
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

  isPinnedToolbar() {
    return this.settings.pinToolbar;
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
      
      const properties = [
        `File Name: ${activeTab.name}`,
        `File Path: ${activeTab.path || 'N/A'}`,
        `Pages: ${doc.numPages}`,
        `Title: ${info.Title || 'N/A'}`,
        `Author: ${info.Author || 'N/A'}`,
        `Subject: ${info.Subject || 'N/A'}`,
        `Creator: ${info.Creator || 'N/A'}`,
        `Producer: ${info.Producer || 'N/A'}`,
        `Creation Date: ${info.CreationDate || 'N/A'}`,
        `Modification Date: ${info.ModDate || 'N/A'}`,
        `PDF Version: ${metadata.contentDispositionFilename || 'N/A'}`
      ];

      alert('Document Properties:\n\n' + properties.join('\n'));
    } catch (e) {
      console.error('Error getting document properties:', e);
      alert('Error retrieving document properties');
    }
  }
}
