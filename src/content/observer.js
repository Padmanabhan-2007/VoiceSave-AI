/**
 * VoiceSave AI - Hardened MutationObserver for Dynamic Response Detection
 * Watches DOM updates, waits for LLM streaming response stabilization,
 * and guarantees strictly one toolbar per AI response node across re-renders.
 */

export class ResponseObserver {
  constructor(siteAdapter, toolbarInjector, options = {}) {
    this.adapter = siteAdapter;
    this.injector = toolbarInjector;
    this.observer = null;
    this.debounceTimer = null;
    this.debounceMs = options.debounceMs || 250;
    this.isObserving = false;
    this.nodeTextSnapshots = new WeakMap();
  }

  start() {
    if (this.isObserving || typeof document === 'undefined') return;

    // Initial scan of already-rendered responses
    this.scan();

    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        // Skip mutations inside VoiceSave toolbar to avoid feedback loop
        if (mutation.target && mutation.target.closest && mutation.target.closest('.voicesave-toolbar-wrapper')) {
          continue;
        }

        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        this.scheduleScan();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    this.isObserving = true;
  }

  scheduleScan() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.scan();
    }, this.debounceMs);
  }

  /**
   * Checks if an element is still actively streaming text from an LLM
   * @param {HTMLElement} node
   * @returns {boolean}
   */
  isNodeStreaming(node) {
    if (!node) return false;

    // 1. Explicit data attributes / CSS classes
    if (node.getAttribute('data-is-streaming') === 'true') return true;
    if (node.classList.contains('result-streaming')) return true;
    if (node.querySelector('.result-streaming, .typing-cursor, [data-is-streaming="true"]')) return true;

    // 2. Text growth rate check across debounced scans
    const currentText = node.textContent || '';
    const lastLength = this.nodeTextSnapshots.get(node);

    if (lastLength !== undefined && currentText.length !== lastLength) {
      // Content is still changing, update snapshot and defer
      this.nodeTextSnapshots.set(node, currentText.length);
      return true;
    }

    this.nodeTextSnapshots.set(node, currentText.length);
    return false;
  }

  scan() {
    if (!this.adapter || !this.injector) return;

    const nodes = this.adapter.getResponseNodes();
    nodes.forEach((node) => {
      // Prevent duplicate injection: check attribute and existing DOM children
      if (node.getAttribute('data-voicesave-injected') === 'true') {
        // Even if marked, verify wrapper still exists in case of DOM re-render
        const existingWrapper = node.querySelector('.voicesave-toolbar-wrapper') || 
                                (node.parentNode && node.parentNode.querySelector('.voicesave-toolbar-wrapper'));
        if (existingWrapper) {
          return; // Already has toolbar
        }
        // If re-rendered without toolbar, reset flag to allow re-injection
        node.removeAttribute('data-voicesave-injected');
      }

      // If response is still streaming, postpone injection
      if (this.isNodeStreaming(node)) {
        node.setAttribute('data-voicesave-status', 'generating');
        this.scheduleScan();
        return;
      }

      // Response stabilized
      node.setAttribute('data-voicesave-status', 'ready');
      this.injector.inject(node);
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isObserving = false;
  }
}
