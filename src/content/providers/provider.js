/**
 * VoiceSave AI - Base Site Adapter Interface
 */

export class SiteAdapter {
  constructor(name = 'Generic') {
    this.name = name;
    this.verificationStatus = 'UNVERIFIED';
  }

  /**
   * Returns true if current location matches this provider
   * @param {string} href
   * @returns {boolean}
   */
  isMatch(href) {
    return false;
  }

  /**
   * Queries and returns all AI response elements currently present in the DOM
   * @returns {HTMLElement[]}
   */
  getResponseNodes() {
    return [];
  }

  /**
   * Extracts clean, readable text from an AI response element
   * @param {HTMLElement} element
   * @returns {string}
   */
  extractResponseText(element) {
    if (!element) return '';
    
    // Clone element to safely remove unwanted UI artifacts like copy buttons, toolbars
    const clone = element.cloneNode(true);
    
    // Remove buttons, toolbars, feedback icons, or existing VoiceSave toolbars
    const selectorsToRemove = [
      '.voicesave-toolbar-wrapper',
      '.voicesave-toolbar',
      '.voicesave-translation-preview',
      '.voicesave-slot',
      'button',
      '[role="button"]',
      'svg',
      '.feedback-actions',
      '.copy-button',
      '.action-buttons'
    ];

    selectorsToRemove.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    return clone.innerText ? clone.innerText.trim() : (clone.textContent || '').trim();
  }

  /**
   * Mounts the VoiceSave toolbar into the response element
   * @param {HTMLElement} element
   * @param {HTMLElement} toolbarEl
   */
  insertToolbar(element, toolbarEl) {
    // Look for an existing actions row or append at the bottom of the response
    const actionRow = element.querySelector('.actions, [data-actions], footer');
    if (actionRow && actionRow.parentNode) {
      actionRow.parentNode.insertBefore(toolbarEl, actionRow.nextSibling);
    } else {
      element.appendChild(toolbarEl);
    }
  }
}
