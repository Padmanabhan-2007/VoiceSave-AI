/**
 * VoiceSave AI - Manifest V3 Background Service Worker
 * Handles installation, context menus, download brokering, TTS audio proxying,
 * translation proxying, and tab communication with full host permissions.
 */

import { DEFAULT_SETTINGS } from '../storage/settings.js';

// Setup defaults upon extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('VoiceSave AI: Installed successfully (Reason:', details.reason, ')');

  chrome.storage.local.get(null, (existing) => {
    if (!existing || Object.keys(existing).length === 0) {
      chrome.storage.local.set(DEFAULT_SETTINGS, () => {
        console.log('VoiceSave AI: Default settings initialized');
      });
    }
  });

  // Create right-click context menu for any selected text
  try {
    chrome.contextMenus.create({
      id: 'voicesave-speak-selection',
      title: '🔊 Speak with VoiceSave AI',
      contexts: ['selection']
    });
  } catch (e) {}
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'voicesave-speak-selection' && tab && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectedText) => {
        if ('speechSynthesis' in window && selectedText) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(selectedText);
          window.speechSynthesis.speak(utterance);
        }
      },
      args: [info.selectionText]
    });
  }
});

// Handle messages from popup, content scripts, or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ status: 'OK' });
    return false;
  }

  // Broker privileged Chrome downloads
  if (message.action === 'DOWNLOAD_AUDIO') {
    const downloadUrl = message.dataUrl || message.url;
    if (!downloadUrl) {
      sendResponse({ success: false, error: 'No download URL provided' });
      return false;
    }

    if (chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url: downloadUrl,
        filename: message.filename || 'voicesave-audio.mp3',
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('VoiceSave AI: Download failed:', chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      });
      return true; // Keep message channel open for asynchronous sendResponse
    } else {
      sendResponse({ success: false, error: 'chrome.downloads API unavailable in current environment' });
      return false;
    }
  }

  // Proxy TTS Audio Fetch (Bypasses web page CORS/CSP on ChatGPT, Gemini, Claude, etc.)
  if (message.action === 'FETCH_TTS_AUDIO') {
    const { text, language } = message;
    const lang = (language || 'en').toLowerCase().split(/[-_]/)[0];
    const cleanText = encodeURIComponent((text || '').trim());
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanText}&tl=${lang}&client=tw-ob`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`TTS HTTP error ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        // Convert to base64 Data URL for universal transfer across isolation boundaries
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:audio/mpeg;base64,${base64}`;
        sendResponse({ success: true, dataUrl, byteLength: arrayBuffer.byteLength });
      })
      .catch((err) => {
        console.error('VoiceSave AI: Background TTS fetch failed:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep channel open
  }

  // Proxy Translation Fetch (Bypasses web page CORS/CSP)
  if (message.action === 'TRANSLATE_TEXT') {
    const { text, sourceLanguage, targetLanguage } = message;
    const sl = (sourceLanguage || 'auto').toLowerCase().split(/[-_]/)[0];
    const tl = (targetLanguage || 'ta').toLowerCase().split(/[-_]/)[0];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text || '')}`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Translation HTTP error ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedText = data[0].map((item) => (item && item[0] ? item[0] : '')).join('');
          sendResponse({ success: true, translatedText });
        } else {
          throw new Error('Unexpected translation response structure');
        }
      })
      .catch((err) => {
        console.error('VoiceSave AI: Background translation fetch failed:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep channel open
  }

  // Settings update broadcast
  if (message.action === 'SETTINGS_UPDATED') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'SETTINGS_UPDATED', settings: message.settings }).catch(() => {});
        }
      });
    });
    sendResponse({ status: 'BROADCASTED' });
    return false;
  }

  return false;
});
