/**
 * VoiceSave AI - Base Translation Provider Abstract Interface
 */

export class TranslationProvider {
  constructor(name = 'BaseTranslationProvider') {
    this.name = name;
  }

  /**
   * Translates text from source language to target language.
   * Supports both object parameter: translate({ text, sourceLanguage, targetLanguage })
   * and positional arguments: translate(text, sourceLanguage, targetLanguage, options)
   * @param {string|Object} textOrParams
   * @param {string} [sourceLanguage]
   * @param {string} [targetLanguage]
   * @param {Object} [options]
   * @returns {Promise<{ translatedText: string, sourceLanguage: string, targetLanguage: string, preservedTerms: string[] }>}
   */
  async translate(textOrParams, sourceLanguage, targetLanguage, options = {}) {
    throw new Error('translate() must be implemented by subclass');
  }
}
