/**
 * VoiceSave AI - Generic & Demo Sandbox Site Adapter
 * Matches the built-in demo simulator and any element marked with [data-ai-response] or .ai-response
 */

import { SiteAdapter } from './provider.js';

export class GenericAdapter extends SiteAdapter {
  constructor() {
    super('Generic');
    this.verificationStatus = 'VERIFIED';
  }

  isMatch(href) {
    return true; // Catch-all fallback
  }

  getResponseNodes() {
    const nodes = document.querySelectorAll(
      '[data-ai-response], .ai-response, .assistant-response, .mock-response-content'
    );
    return Array.from(nodes);
  }

  insertToolbar(element, toolbarEl) {
    const customSlot = element.querySelector('.voicesave-slot') || element.nextElementSibling;
    if (customSlot && customSlot.classList?.contains('voicesave-slot')) {
      customSlot.appendChild(toolbarEl);
    } else {
      element.appendChild(toolbarEl);
    }
  }
}
