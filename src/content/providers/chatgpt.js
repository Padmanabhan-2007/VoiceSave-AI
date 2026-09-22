/**
 * VoiceSave AI - ChatGPT Site Adapter
 * Matches chatgpt.com and chat.openai.com
 */

import { SiteAdapter } from './provider.js';

export class ChatGPTAdapter extends SiteAdapter {
  constructor() {
    super('ChatGPT');
    this.verificationStatus = 'HEURISTIC';
  }

  isMatch(href) {
    return href.includes('chatgpt.com') || href.includes('chat.openai.com');
  }

  getResponseNodes() {
    // Queries assistant turns; excludes user questions
    const nodes = document.querySelectorAll(
      '[data-message-author-role="assistant"], div.agent-turn, [data-testid^="conversation-turn-"]:has([data-message-author-role="assistant"])'
    );
    return Array.from(nodes);
  }

  insertToolbar(element, toolbarEl) {
    // Find the markdown body or action buttons container
    const markdownBody = element.querySelector('.markdown') || element;
    const actionsRow = element.querySelector('.items-center.justify-start, [data-testid="turn-action-buttons"]');
    
    if (actionsRow && actionsRow.parentNode) {
      actionsRow.parentNode.insertBefore(toolbarEl, actionsRow.nextSibling);
    } else if (markdownBody && markdownBody.parentNode) {
      markdownBody.parentNode.appendChild(toolbarEl);
    } else {
      element.appendChild(toolbarEl);
    }
  }
}
