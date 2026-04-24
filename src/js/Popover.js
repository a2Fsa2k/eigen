export class Popover {
  constructor(id, title) {
    this.element = document.createElement('div');
    this.element.id = id;
    this.element.className = 'popover';
    
    const titleBar = document.createElement('div');
    titleBar.className = 'popover-title';
    titleBar.textContent = title;
    
    this.content = document.createElement('div');
    this.content.className = 'popover-content';
    
    this.element.appendChild(titleBar);
    this.element.appendChild(this.content);
    
    // Append to a dedicated container for better management
    const container = document.getElementById('popover-container');
    if (container) {
      container.appendChild(this.element);
    } else {
      document.body.appendChild(this.element);
    }
    
    this.anchorElement = null; // Keep track of the element that opened the popover
    this.hide = this.hide.bind(this);
    this.element.addEventListener('click', (e) => e.stopPropagation());
  }

  getContentElement() {
    return this.content;
  }

  toggle(anchorElement) {
    // If it's already open and the same anchor is clicked, hide it.
    // Otherwise, show it.
    if (this.element.classList.contains('open') && this.anchorElement === anchorElement) {
      this.hide();
    } else {
      this.show(anchorElement);
    }
  }

  show(anchorElement) {
    // If another popover is open, hide it first.
    // This is a simple way to manage a single active popover.
    if (Popover.activePopover && Popover.activePopover !== this) {
      Popover.activePopover.hide();
    }

    this.anchorElement = anchorElement; // Store the anchor
    const rect = anchorElement.getBoundingClientRect();
    
    // Position the popover
    this.element.style.top = `${rect.bottom + 5}px`;
    this.element.style.left = `${rect.left}px`;
    
    // Add 'open' class and the event listener to close it
    this.element.classList.add('open');
    document.addEventListener('click', this.hide, true);

    Popover.activePopover = this; // Set as active popover
  }

  hide(event) {
    // If the click is on the anchor element, don't hide.
    // The toggle method will handle this.
    if (event && this.anchorElement && this.anchorElement.contains(event.target)) {
      return;
    }
    
    // Remove 'open' class and the event listener
    this.element.classList.remove('open');
    document.removeEventListener('click', this.hide, true);
    this.anchorElement = null; // Clear the anchor

    if (Popover.activePopover === this) {
      Popover.activePopover = null;
    }
  }
}

// Static property to track the currently active popover
Popover.activePopover = null;
