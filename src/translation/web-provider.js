/**
 * VoiceSave AI - Free Web Translation Provider
 * Translates arbitrary text into 22+ languages (Tamil, Hindi, Telugu, Kannada, Malayalam, etc.)
 * using Google's public translation endpoint without requiring commercial API keys.
 * Automatically masks and preserves programming code blocks during translation.
 */

import { TranslationProvider } from './provider.js';
import { TextCleaner } from '../language/text-cleaner.js';

export class GoogleWebTranslationProvider extends TranslationProvider {
  constructor() {
    super('GoogleWebTranslationProvider');
  }

  isConfigured() {
    return true; // Zero-config, always available when online
  }

  /**
   * Translates a single text chunk
   * @param {string} text
   * @param {string} sourceLang
   * @param {string} targetLang
   * @returns {Promise<string>}
   */
  async _fetchTranslationChunk(text, sourceLang, targetLang) {
    const sl = (sourceLang || 'auto').toLowerCase().split(/[-_]/)[0];
    const tl = (targetLang || 'ta').toLowerCase().split(/[-_]/)[0];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

    // 1. In Chrome content script context, broker through service worker to bypass page CSP/CORS
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'TRANSLATE_TEXT',
            text,
            sourceLanguage: sl,
            targetLanguage: tl
          }, (res) => resolve(res));
        });

        if (response && response.success && response.translatedText) {
          return response.translatedText;
        }
      } catch (err) {
        // Fall through to direct fetch if message broker is unavailable
      }
    }

    // 2. Direct browser fetch (popup, options page, service worker, or sandbox)
    if (typeof fetch !== 'undefined') {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Web translation HTTP ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((item) => (item && item[0] ? item[0] : '')).join('');
      }
      throw new Error('Unexpected translation response format');
    }

    // 3. Node.js environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const https = await import('https');
      return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
          if (res.statusCode !== 200) return reject(new Error(`Web translation HTTP ${res.statusCode}`));
          let raw = '';
          res.on('data', c => raw += c);
          res.on('end', () => {
            try {
              const data = JSON.parse(raw);
              if (Array.isArray(data) && Array.isArray(data[0])) {
                const combined = data[0].map((item) => (item && item[0] ? item[0] : '')).join('');
                resolve(combined);
              } else {
                reject(new Error('Unexpected translation structure'));
              }
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
    }

    throw new Error('No network fetch environment available for translation');
  }

  /**
   * Translates arbitrary text with code block protection and chunk management
   */
  async translate(textOrParams, sourceLanguage, targetLanguage) {
    let text = textOrParams;
    let src = sourceLanguage || 'auto';
    let tgt = targetLanguage || 'ta';

    if (typeof textOrParams === 'object' && textOrParams !== null && textOrParams.text) {
      text = textOrParams.text;
      src = textOrParams.sourceLanguage || src;
      tgt = textOrParams.targetLanguage || tgt;
    }

    if (!text || text.trim().length === 0) {
      return { translatedText: '', sourceLanguage: src, targetLanguage: tgt };
    }

    // Protect code blocks before translation
    const { maskedText, placeholders } = TextCleaner.maskCodeBlocks(text);

    // Break into manageable chunks for URL safety
    const chunks = TextCleaner.chunkText(maskedText, 350);
    const translatedChunks = [];

    for (const chunk of chunks) {
      const transChunk = await this._fetchTranslationChunk(chunk, src, tgt);
      translatedChunks.push(transChunk);
    }

    let fullTranslated = translatedChunks.join(' ');

    // Restore protected code blocks
    fullTranslated = TextCleaner.unmaskCodeBlocks(fullTranslated, placeholders);

    return {
      translatedText: fullTranslated,
      sourceLanguage: src,
      targetLanguage: tgt,
      preservedTerms: []
    };
  }
}
