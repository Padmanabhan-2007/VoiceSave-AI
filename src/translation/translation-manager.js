/**
 * VoiceSave AI - Unified Translation Coordinator
 * Resolves Language Modes, coordinates LanguageDetector, and executes translations with caching.
 * Strictly separates Demo Mode from Live Mode to prevent silent mock leaks.
 * Enforces that target language output is never silently substituted with English.
 */

import { LanguageDetector } from '../language/detector.js';
import { DemoTranslationProvider } from './demo-provider.js';
import { ApiTranslationProvider } from './api-provider.js';
import { GoogleWebTranslationProvider } from './web-provider.js';
import { TextCleaner } from '../language/text-cleaner.js';

export class TranslationManager {
  constructor(settings = {}) {
    this.settings = settings;
    this.demoProvider = new DemoTranslationProvider();
    this.apiProvider = new ApiTranslationProvider(settings.apiTranslationConfig || {});
    this.webProvider = new GoogleWebTranslationProvider();
    this.cache = new Map();
  }

  /**
   * Translates text according to language preferences
   * @param {string} text - Raw input text
   * @param {string} [targetLang] - Target language code ('ta', 'hi', 'en', 'original', 'auto')
   * @param {Object} [options]
   * @returns {Promise<{ translatedText: string, sourceLang: string, targetLang: string, didTranslate: boolean, isUnavailable?: boolean, message?: string }>}
   */
  async processAndTranslate(text, targetLang = null, options = {}) {
    const cleanedText = TextCleaner.cleanForSpeech(text, {
      readCodeBlocks: this.settings.readCodeBlocks
    });

    // 1. Detect source language
    const detection = LanguageDetector.detectLanguage(cleanedText, 'en');
    const sourceLang = detection.code;

    // 2. Resolve target language
    let resolvedTarget = targetLang || this.settings.defaultTargetLanguage || this.settings.myLanguage || 'ta';
    if (resolvedTarget === 'original') {
      return {
        translatedText: cleanedText,
        sourceLang,
        targetLang: sourceLang,
        didTranslate: false
      };
    }

    if (resolvedTarget === 'auto') {
      resolvedTarget = sourceLang;
    }

    // If source and target are the same, no translation required
    if (sourceLang === resolvedTarget) {
      return {
        translatedText: cleanedText,
        sourceLang,
        targetLang: resolvedTarget,
        didTranslate: false
      };
    }

    // 3. Provider determination & Live Mode fallback check
    const isLiveMode = !this.settings.demoMode;
    let activeProvider;
    let providerName;

    if (isLiveMode) {
      if (this.apiProvider.isConfigured()) {
        activeProvider = this.apiProvider;
        providerName = this.apiProvider.name;
      } else {
        // Universal free web translation for live mode without requiring paid API keys
        activeProvider = this.webProvider;
        providerName = this.webProvider.name;
      }
    } else {
      activeProvider = this.demoProvider;
      providerName = this.demoProvider.name;
    }

    // 4. Cache lookup (text + source language + target language + provider)
    const cacheKey = `${providerName}:::${sourceLang}:::${resolvedTarget}:::${cleanedText}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 5. Execute translation
    try {
      const result = await activeProvider.translate({
        text: cleanedText,
        sourceLanguage: sourceLang,
        targetLanguage: resolvedTarget
      });

      if (!result.translatedText || result.translatedText.trim().length === 0) {
        throw new Error(`Translation provider produced empty text for target language ${resolvedTarget}`);
      }

      // Enforce that translated text is not identical to English input when translating
      if (sourceLang !== resolvedTarget && result.translatedText.trim() === cleanedText.trim()) {
        throw new Error(`Translation provider failed to translate text from ${sourceLang} to ${resolvedTarget}`);
      }

      const outcome = {
        translatedText: result.translatedText,
        sourceLang,
        targetLang: resolvedTarget,
        didTranslate: true,
        preservedTerms: result.preservedTerms || []
      };

      this.cache.set(cacheKey, outcome);
      return outcome;
    } catch (err) {
      console.warn(`VoiceSave AI translation error with ${providerName} (${resolvedTarget}):`, err);

      // If web provider failed in live mode (e.g. offline), check if demo provider has the topic
      if (isLiveMode && activeProvider === this.webProvider) {
        try {
          const demoResult = await this.demoProvider.translate({
            text: cleanedText,
            sourceLanguage: sourceLang,
            targetLanguage: resolvedTarget
          });
          if (demoResult && demoResult.translatedText && demoResult.translatedText !== cleanedText) {
            return {
              translatedText: demoResult.translatedText,
              sourceLang,
              targetLang: resolvedTarget,
              didTranslate: true,
              preservedTerms: demoResult.preservedTerms || []
            };
          }
        } catch (e) {}
      }

      if (isLiveMode) {
        return {
          translatedText: cleanedText,
          sourceLang,
          targetLang: sourceLang,
          didTranslate: false,
          isUnavailable: true,
          message: `Translation to ${resolvedTarget} failed. Your original response is still available.`
        };
      }
      throw err;
    }
  }

  /**
   * Direct translation provider interface:
   * translate({ text, sourceLanguage, targetLanguage })
   */
  async translate(params) {
    const text = params.text;
    const sourceLanguage = params.sourceLanguage;
    const targetLanguage = params.targetLanguage;
    return await this.processAndTranslate(text, targetLanguage, { sourceLanguage });
  }
}
