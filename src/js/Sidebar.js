export class Sidebar {
  constructor(app) {
    this.app = app;
    this.isOpen = false;
    this.currentMode = 'outline';
    
    this.sidebar = document.getElementById('sidebar');
    this.content = document.getElementById('sidebar-content');
    
    this.init();
  }

  init() {
    document.getElementById('sidebar-close').addEventListener('click', () => {
      this.close();
    });

    document.getElementById('btn-outline-mode').addEventListener('click', () => {
      this.setMode('outline');
    });

    document.getElementById('btn-thumbnail-mode').addEventListener('click', () => {
      this.setMode('thumbnail');
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.sidebar.classList.add('open');
    document.getElementById('btn-toc').classList.add('active');
    
    const activeTab = this.app.tabManager.getActiveTab();
    if (activeTab) {
      this.app.tabManager.updateTab(activeTab.id, { sidebarOpen: true });
      this.loadContent(activeTab.id);
    }
  }

  close() {
    this.isOpen = false;
    this.sidebar.classList.remove('open');
    document.getElementById('btn-toc').classList.remove('active');
    
    const activeTab = this.app.tabManager.getActiveTab();
    if (activeTab) {
      this.app.tabManager.updateTab(activeTab.id, { sidebarOpen: false });
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    
    document.querySelectorAll('.sidebar-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    if (mode === 'outline') {
      document.getElementById('btn-outline-mode').classList.add('active');
    } else {
      document.getElementById('btn-thumbnail-mode').classList.add('active');
    }

    const activeTab = this.app.tabManager.getActiveTab();
    if (activeTab) {
      this.app.tabManager.updateTab(activeTab.id, { sidebarMode: mode });
      this.loadContent(activeTab.id);
    }
  }

  async loadContent(tabId) {
    const tab = this.app.tabManager.getTab(tabId);
    if (!tab) return;

    const doc = this.app.pdfRenderer.getDocument(tabId);
    if (!doc) return;

    this.content.innerHTML = '';

    if (this.currentMode === 'outline') {
      await this.loadOutline(doc, tabId);
    } else {
      await this.loadThumbnails(doc, tabId);
    }
  }

  async loadOutline(doc, tabId) {
    try {
      const outline = await doc.getOutline();
      
      if (!outline || outline.length === 0) {
        this.content.innerHTML = '<div style="padding: 12px; color: #888;">No outline available</div>';
        return;
      }

      const renderOutlineItem = (item, level = 0) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'outline-item';
        itemDiv.style.paddingLeft = `${8 + level * 16}px`;
        itemDiv.textContent = item.title;
        
        itemDiv.addEventListener('click', async () => {
          if (item.dest) {
            try {
              const dest = typeof item.dest === 'string' 
                ? await doc.getDestination(item.dest)
                : item.dest;
              
              if (dest) {
                const pageIndex = await doc.getPageIndex(dest[0]);
                this.app.pdfRenderer.goToPage(tabId, pageIndex + 1);
              }
            } catch (e) {
              console.error('Error navigating to outline item:', e);
            }
          }
        });

        this.content.appendChild(itemDiv);

        if (item.items && item.items.length > 0) {
          item.items.forEach(child => renderOutlineItem(child, level + 1));
        }
      };

      outline.forEach(item => renderOutlineItem(item));
    } catch (e) {
      console.error('Error loading outline:', e);
      this.content.innerHTML = '<div style="padding: 12px; color: #888;">Error loading outline</div>';
    }
  }

  async loadThumbnails(doc, tabId) {
    this.content.innerHTML = '<div style="padding: 12px; color: #888;">Loading thumbnails...</div>';
    
    try {
      const thumbnailsContainer = document.createElement('div');
      const fragment = document.createDocumentFragment();
      
      // Create placeholder thumbnails first (instant)
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const thumbnailItem = document.createElement('div');
        thumbnailItem.className = 'thumbnail-item';
        thumbnailItem.dataset.page = pageNum;
        
        // Create placeholder canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'thumbnail-canvas';
        canvas.width = 120;
        canvas.height = 160;
        
        // Draw placeholder
        const context = canvas.getContext('2d');
        context.fillStyle = '#f0f0f0';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#999';
        context.font = '14px sans-serif';
        context.textAlign = 'center';
        context.fillText(`Page ${pageNum}`, canvas.width / 2, canvas.height / 2);
        
        const label = document.createElement('div');
        label.className = 'thumbnail-label';
        label.textContent = `Page ${pageNum}`;
        
        thumbnailItem.appendChild(canvas);
        thumbnailItem.appendChild(label);
        
        thumbnailItem.addEventListener('click', () => {
          this.app.pdfRenderer.goToPage(tabId, pageNum);
          
          // Update active state
          thumbnailsContainer.querySelectorAll('.thumbnail-item').forEach(item => {
            item.classList.remove('active');
          });
          thumbnailItem.classList.add('active');
        });
        
        fragment.appendChild(thumbnailItem);
      }
      
      thumbnailsContainer.appendChild(fragment);
      this.content.innerHTML = '';
      this.content.appendChild(thumbnailsContainer);
      
      // Highlight current page
      const tab = this.app.tabManager.getTab(tabId);
      if (tab) {
        const activeThumbnail = thumbnailsContainer.querySelector(`[data-page="${tab.currentPage}"]`);
        if (activeThumbnail) {
          activeThumbnail.classList.add('active');
        }
      }
      
      // Render thumbnails progressively in batches
      const batchSize = 10;
      const renderBatch = async (startPage) => {
        const endPage = Math.min(startPage + batchSize, doc.numPages);
        
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          try {
            const thumbnailItem = thumbnailsContainer.querySelector(`[data-page="${pageNum}"]`);
            if (!thumbnailItem) continue;
            
            const page = await doc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.25 });
            
            const canvas = thumbnailItem.querySelector('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const context = canvas.getContext('2d');
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
          } catch (e) {
            console.error(`Error rendering thumbnail ${pageNum}:`, e);
          }
        }
        
        // Schedule next batch
        if (endPage < doc.numPages) {
          setTimeout(() => renderBatch(endPage + 1), 0);
        }
      };
      
      // Start rendering from page 1
      renderBatch(1);
      
    } catch (e) {
      console.error('Error loading thumbnails:', e);
      this.content.innerHTML = '<div style="padding: 12px; color: #888;">Error loading thumbnails</div>';
    }
  }

  restoreTabState(tab) {
    if (tab.sidebarOpen) {
      this.sidebar.classList.add('open');
      this.isOpen = true;
      this.setMode(tab.sidebarMode);
      this.loadContent(tab.id);
    } else {
      this.sidebar.classList.remove('open');
      this.isOpen = false;
    }
  }

  updateCurrentPage(tabId, pageNum) {
    if (this.currentMode === 'thumbnail' && this.isOpen) {
      const thumbnails = this.content.querySelectorAll('.thumbnail-item');
      thumbnails.forEach(item => {
        if (parseInt(item.dataset.page) === pageNum) {
          item.classList.add('active');
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          item.classList.remove('active');
        }
      });
    }
  }
}
