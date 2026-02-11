/**
 * Centralized Draw Tool State
 * Single source of truth for draw tool configuration
 */
export class DrawToolState {
  constructor() {
    this.state = {
      color: '#000000',
      thickness: 3,
      enabled: false
    };
    
    this.listeners = [];
  }

  /**
   * Update draw tool state
   */
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    this.notifyListeners(oldState);
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners(oldState) {
    this.listeners.forEach(listener => {
      listener(this.state, oldState);
    });
  }

  // Convenience getters
  getColor() {
    return this.state.color;
  }

  getThickness() {
    return this.state.thickness;
  }

  isEnabled() {
    return this.state.enabled;
  }
}
