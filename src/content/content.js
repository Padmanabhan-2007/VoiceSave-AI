/**
 * VoiceSave AI - Content Script Entry Point
 * Detects site provider, initializes injector and observer.
 */

import { ChatGPTAdapter } from './providers/chatgpt.js';
import { GeminiAdapter } from './providers/gemini.js';
import { ClaudeAdapter } from './providers/claude.js';
import { PerplexityAdapter } from './providers/perplexity.js';
import { GenericAdapter } from './providers/generic.js';
import { ToolbarInjector } from './injector.js';
import { ResponseObserver } from './observer.js';
import { SettingsStore } from '../storage/settings.js';

(async function initVoiceSaveAI() {
  // Prevent duplicate runs in the same frame
  if (window.__voicesave_initialized) return;
  window.__voicesave_initialized = true;

  const settings = await SettingsStore.getSettings();
  if (!settings.enabled) {
    console.log('VoiceSave AI: Extension is disabled in settings.');
    return;
  }

  const href = window.location.href;
  const adapters = [
    new ChatGPTAdapter(),
    new GeminiAdapter(),
    new ClaudeAdapter(),
    new PerplexityAdapter()
  ];

  // Pick matching adapter or fallback to generic
  let activeAdapter = adapters.find((a) => a.isMatch(href)) || new GenericAdapter();
  console.log(`VoiceSave AI initialized on ${window.location.hostname} using [${activeAdapter.name}] adapter`);

  const injector = new ToolbarInjector(activeAdapter);
  const observer = new ResponseObserver(activeAdapter, injector);

  if (settings.autoInject) {
    observer.start();
  }

  // Listen for messages from popup or background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'PING') {
        sendResponse({ status: 'OK', site: activeAdapter.name });
      } else if (request.action === 'SCAN_RESPONSES') {
        observer.scan();
        sendResponse({ status: 'SCANNED' });
      }
      return true;
    });
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    observer.stop();
  });
})();
