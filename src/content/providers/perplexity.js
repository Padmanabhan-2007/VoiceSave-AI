/**
 * VoiceSave AI - Perplexity Site Adapter
 * Matches perplexity.ai
 */

import { SiteAdapter } from './provider.js';

export class PerplexityAdapter extends SiteAdapter {
  constructor() {
    super('Perplexity');
    this.verificationStatus = 'HEURISTIC';
  }

  isMatch(href) {
    return href.includes('perplexity.ai');
  }

  getResponseNodes() {
    const nodes = document.querySelectorAll(
      'div.prose, div[dir="auto"].break-words, .answer-body'
    );
    return Array.from(nodes);
  }

  insertToolbar(element, toolbarEl) {
    const parentContainer = element.closest('div.border-b') || element.parentNode;
    if (parentContainer) {
      parentContainer.appendChild(toolbarEl);
    } else {
      element.appendChild(toolbarEl);
    }
  }
}
