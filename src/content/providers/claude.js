/**
 * VoiceSave AI - Claude Site Adapter
 * Matches claude.ai
 */

import { SiteAdapter } from './provider.js';

export class ClaudeAdapter extends SiteAdapter {
  constructor() {
    super('Claude');
    this.verificationStatus = 'HEURISTIC';
  }

  isMatch(href) {
    return href.includes('claude.ai');
  }

  getResponseNodes() {
    const nodes = document.querySelectorAll(
      '[data-is-streaming="false"] .font-claude-message, div[data-testid="chat-message-assistant"], .claude-response'
    );
    return Array.from(nodes);
  }

  insertToolbar(element, toolbarEl) {
    const actionsBar = element.querySelector('.flex.items-center.gap-1') || element.querySelector('footer');
    if (actionsBar && actionsBar.parentNode) {
      actionsBar.parentNode.insertBefore(toolbarEl, actionsBar.nextSibling);
    } else {
      element.appendChild(toolbarEl);
    }
  }
}
