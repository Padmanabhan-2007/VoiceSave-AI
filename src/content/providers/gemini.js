/**
 * VoiceSave AI - Google Gemini Site Adapter
 * Matches gemini.google.com
 */

import { SiteAdapter } from './provider.js';

export class GeminiAdapter extends SiteAdapter {
  constructor() {
    super('Gemini');
    this.verificationStatus = 'HEURISTIC';
  }

  isMatch(href) {
    return href.includes('gemini.google.com');
  }

  getResponseNodes() {
    const nodes = document.querySelectorAll(
      'message-content.model-response-text, .response-container, model-response, [data-test-id="model-turn"]'
    );
    return Array.from(nodes);
  }

  insertToolbar(element, toolbarEl) {
    const actionContainer = element.closest('model-response')?.querySelector('.response-actions') || 
                           element.querySelector('.response-footer');
    if (actionContainer && actionContainer.parentNode) {
      actionContainer.parentNode.insertBefore(toolbarEl, actionContainer.nextSibling);
    } else {
      element.appendChild(toolbarEl);
    }
  }
}
