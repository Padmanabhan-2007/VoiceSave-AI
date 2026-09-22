/**
 * VoiceSave AI - Cloud API Translation Provider (Google / LibreTranslate / OpenAI)
 */

import { TranslationProvider } from './provider.js';

export class ApiTranslationProvider extends TranslationProvider {
  constructor(config = {}) {
    super('ApiTranslationProvider');
    this.provider = config.provider || 'openai'; // 'openai' | 'google' | 'libretranslate'
    this.apiKey = config.apiKey || '';
    this.endpoint = config.endpoint || '';
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.trim().length > 0);
  }

  async translate(textOrParams, sourceLanguage, targetLanguage, options = {}) {
    let text = textOrParams;
    let srcLang = sourceLanguage;
    let tgtLang = targetLanguage;

    if (typeof textOrParams === 'object' && textOrParams !== null && textOrParams.text) {
      text = textOrParams.text;
      srcLang = textOrParams.sourceLanguage || srcLang;
      tgtLang = textOrParams.targetLanguage || tgtLang;
    }

    if (!this.isConfigured()) {
      throw new Error('API key is not configured for Cloud Translation. Please check Settings or switch to Demo Mode.');
    }

    if (this.provider === 'openai') {
      return await this._translateOpenAI(text, srcLang, tgtLang);
    } else if (this.provider === 'libretranslate') {
      return await this._translateLibre(text, srcLang, tgtLang);
    } else {
      return await this._translateGoogle(text, srcLang, tgtLang);
    }
  }

  async _translateOpenAI(text, sourceLang, targetLang) {
    const prompt = `Translate the following text from ${sourceLang} into ${targetLang}. Preserve technical acronyms (such as SSD, Java, RAM, CPU, AI, API) and maintain a natural, conversational tone suitable for speech synthesis. Return ONLY the translated text without commentary:\n\n${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI translation API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim() || '';

    if (!translatedText || (sourceLang !== targetLang && translatedText === text)) {
      throw new Error(`OpenAI translation failed to produce ${targetLang} text.`);
    }

    return {
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      preservedTerms: []
    };
  }

  async _translateLibre(text, sourceLang, targetLang) {
    const endpoint = this.endpoint || 'https://libretranslate.de/translate';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
        api_key: this.apiKey
      })
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate API error (${response.status})`);
    }

    const data = await response.json();
    const translatedText = data.translatedText?.trim() || '';

    if (!translatedText || (sourceLang !== targetLang && translatedText === text)) {
      throw new Error(`LibreTranslate failed to produce ${targetLang} text.`);
    }

    return {
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      preservedTerms: []
    };
  }

  async _translateGoogle(text, sourceLang, targetLang) {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`Google Translate API error (${response.status})`);
    }

    const data = await response.json();
    const translatedText = data.data?.translations?.[0]?.translatedText?.trim() || '';

    if (!translatedText || (sourceLang !== targetLang && translatedText === text)) {
      throw new Error(`Google Translate failed to produce ${targetLang} text.`);
    }

    return {
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      preservedTerms: []
    };
  }
}
