/**
 * VoiceSave AI - Browser Native Multilingual SpeechSynthesis Provider
 * Controls live audio playback using Web Speech API with strict language-specific voice resolution.
 * Enforces that no English voice is ever silently substituted for a regional language.
 */

import { TTSProvider } from './provider.js';
import { getLanguageByCode } from '../language/languages.js';

export class BrowserTTSProvider extends TTSProvider {
  constructor() {
    super('BrowserTTSProvider');
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.currentUtterance = null;
    this.isSpeaking = false;
    this.isPaused = false;
    this.onBoundary = null;
    this.onEnd = null;
    this.onStart = null;
    this.onError = null;
  }

  isAvailable() {
    return !!(this.synth && typeof SpeechSynthesisUtterance !== 'undefined');
  }

  async getVoices() {
    if (!this.isAvailable()) return [];

    return new Promise((resolve) => {
      let voices = this.synth.getVoices();
      if (voices && voices.length > 0) {
        resolve(voices);
        return;
      }

      const handler = () => {
        voices = this.synth.getVoices();
        this.synth.removeEventListener('voiceschanged', handler);
        resolve(voices);
      };

      this.synth.addEventListener('voiceschanged', handler);
      setTimeout(() => {
        resolve(this.synth.getVoices() || []);
      }, 500);
    });
  }

  /**
   * Returns available voices filtered strictly for a specific language code
   * @param {string} languageCode - ISO code (e.g. 'ta', 'hi', 'en', 'es')
   * @returns {Promise<SpeechSynthesisVoice[]>}
   */
  async getVoicesForLanguage(languageCode) {
    const allVoices = await this.getVoices();
    if (!languageCode || languageCode === 'auto' || languageCode === 'original') {
      return allVoices;
    }

    const norm = languageCode.toLowerCase().split(/[-_]/)[0];
    const filtered = allVoices.filter((v) => {
      const vLang = (v.lang || '').toLowerCase().split(/[-_]/)[0];
      return vLang === norm;
    });

    return filtered;
  }

  /**
   * Checks if the browser has at least one native voice for this language
   * @param {string} languageCode
   * @returns {Promise<boolean>}
   */
  async hasVoiceForLanguage(languageCode) {
    if (!languageCode || languageCode === 'en' || languageCode === 'auto' || languageCode === 'original') {
      return true;
    }
    const voices = await this.getVoicesForLanguage(languageCode);
    return voices.length > 0;
  }

  /**
   * Finds the best matching voice for a language.
   * NEVER returns an English voice when a non-English language is requested!
   * @param {string} languageCode
   * @param {string} [preferredVoiceURI]
   * @returns {Promise<SpeechSynthesisVoice|null>}
   */
  async getBestVoice(languageCode, preferredVoiceURI = '') {
    const allVoices = await this.getVoices();
    const norm = (languageCode || 'en').toLowerCase().split(/[-_]/)[0];

    // 1. If preferred voice is specified, verify that it actually belongs to the target language!
    if (preferredVoiceURI) {
      const match = allVoices.find((v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI);
      if (match) {
        const matchLang = (match.lang || '').toLowerCase().split(/[-_]/)[0];
        if (norm === 'auto' || norm === 'original' || matchLang === norm) {
          return match;
        }
      }
    }

    if (!languageCode || languageCode === 'auto' || languageCode === 'original') {
      return allVoices.find((v) => v.default) || allVoices[0] || null;
    }

    // 2. Exact match on target locale (e.g. 'ta-IN')
    const langObj = getLanguageByCode(languageCode);
    const targetLocale = (langObj?.defaultLocale || '').toLowerCase();
    const exactMatch = allVoices.find((v) => (v.lang || '').toLowerCase() === targetLocale);
    if (exactMatch) return exactMatch;

    // 3. Prefix match on language family (e.g. 'ta')
    const langVoices = await this.getVoicesForLanguage(languageCode);
    if (langVoices.length > 0) {
      return (
        langVoices.find((v) => v.name.includes('Natural') || v.name.includes('Online')) ||
        langVoices.find((v) => v.default) ||
        langVoices[0]
      );
    }

    // 4. Return null if no genuine voice exists for this language.
    // NEVER silently fall back to an English voice!
    return null;
  }

  /**
   * Speaks the provided text with language-specific voice and locale
   * @param {string} text
   * @param {Object} options - { language, voiceURI, rate, pitch, volume }
   */
  async speak(text, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Web Speech API is not supported in this browser environment');
    }

    this.stop(); // Cancel any existing speech

    if (!text || text.trim() === '') {
      throw new Error('There is no response text to speak.');
    }

    const languageCode = options.language || 'en';
    const langObj = getLanguageByCode(languageCode);
    const targetVoice = await this.getBestVoice(languageCode, options.voiceURI);

    const utterance = new SpeechSynthesisUtterance(text);
    if (targetVoice) {
      utterance.voice = targetVoice;
      utterance.lang = targetVoice.lang;
    } else {
      utterance.lang = langObj.defaultLocale || 'en-US';
    }

    utterance.rate = options.rate !== undefined ? options.rate : 1.0;
    utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0;
    utterance.volume = options.volume !== undefined ? options.volume : 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.isPaused = false;
      if (this.onStart) this.onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      if (this.onEnd) this.onEnd();
    };

    utterance.onpause = () => {
      this.isPaused = true;
    };

    utterance.onresume = () => {
      this.isPaused = false;
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      if (this.onError) this.onError(event);
    };

    utterance.onboundary = (event) => {
      if (this.onBoundary) this.onBoundary(event);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  pause() {
    if (this.isAvailable() && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  resume() {
    if (this.isAvailable() && this.synth.paused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  stop() {
    if (this.isAvailable()) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
    }
  }
}
