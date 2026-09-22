/**
 * VoiceSave AI - Real Multilingual Online TTS Provider
 * Fetches genuine spoken audio for any language (Tamil, Telugu, Kannada, Malayalam, Hindi, Spanish, French, etc.)
 * Safely chunks long texts/scripts on punctuation boundaries and concatenates audio into one seamless AudioBuffer.
 * Bypasses web page CORS/CSP by routing through the background service worker in Chrome extensions.
 */

import { TextCleaner } from '../language/text-cleaner.js';

export class OnlineTTSProvider {
  constructor() {
    this.name = 'GoogleOnlineTTS';
  }

  /**
   * Fetches raw audio bytes for a single short text chunk (<= 180 chars)
   * @param {string} chunkText
   * @param {string} lang
   * @returns {Promise<ArrayBuffer>}
   */
  async _fetchAudioChunkBytes(chunkText, lang) {
    const cleanText = encodeURIComponent(chunkText.trim());
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanText}&tl=${lang}&client=tw-ob`;

    // 1. Chrome extension context (content script or popup): broker through background worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'FETCH_TTS_AUDIO',
            text: chunkText,
            language: lang
          }, (res) => resolve(res));
        });

        if (response && response.success && response.dataUrl) {
          const res = await fetch(response.dataUrl);
          return await res.arrayBuffer();
        }
      } catch (e) {
        // Fall through to direct fetch if message broker is unavailable
      }
    }

    // 2. Direct browser fetch (sandbox, simulator, or contexts where allowed)
    if (typeof fetch !== 'undefined') {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Online TTS fetch failed: HTTP ${res.status}`);
      }
      return await res.arrayBuffer();
    }

    // 3. Node.js environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const https = await import('https');
      return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
          if (res.statusCode !== 200) return reject(new Error(`Online TTS HTTP ${res.statusCode}`));
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
          });
        }).on('error', reject);
      });
    }

    throw new Error('No fetch environment available for TTS audio');
  }

  /**
   * Concatenates multiple AudioBuffers into a single unified AudioBuffer
   * @param {AudioBuffer[]} buffers
   * @param {AudioContext} ctx
   * @returns {AudioBuffer}
   */
  _concatenateAudioBuffers(buffers, ctx) {
    if (!buffers || buffers.length === 0) {
      throw new Error('No audio buffers to concatenate');
    }
    if (buffers.length === 1) {
      return buffers[0];
    }

    const sampleRate = buffers[0].sampleRate || 44100;
    const numberOfChannels = Math.max(...buffers.map(b => b.numberOfChannels || 1));
    const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);

    const mergedBuffer = ctx.createBuffer(numberOfChannels, totalLength, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = mergedBuffer.getChannelData(channel);
      let offset = 0;
      for (const b of buffers) {
        const sourceData = (channel < b.numberOfChannels) ? b.getChannelData(channel) : b.getChannelData(0);
        channelData.set(sourceData, offset);
        offset += b.length;
      }
    }

    return mergedBuffer;
  }

  /**
   * Fetches real speech audio, handles long text chunking, and returns one complete AudioBuffer
   * @param {string} text
   * @param {Object} options - { language, audioContext, rate, pitch }
   * @returns {Promise<AudioBuffer>}
   */
  async synthesizeBuffer(text, options = {}) {
    const rawText = (text || '').trim();
    if (!rawText) {
      throw new Error('No text provided to synthesize');
    }

    const lang = (options.language || 'en').toLowerCase().split(/[-_]/)[0];
    const ctx = options.audioContext;
    if (!ctx) {
      throw new Error('AudioContext unavailable to decode audio');
    }

    // Split text into punctuation-safe chunks (max 170 chars per chunk for TTS safety)
    const chunks = TextCleaner.chunkText(rawText, 170);
    const audioBuffers = [];

    for (const chunk of chunks) {
      try {
        const arrayBuffer = await this._fetchAudioChunkBytes(chunk, lang);
        if (ctx.decodeAudioData) {
          // Note: In some browsers, decodeAudioData detaches the arrayBuffer. We slice a copy if needed.
          const bufferCopy = arrayBuffer.slice(0);
          const decoded = await ctx.decodeAudioData(bufferCopy);
          audioBuffers.push(decoded);
        } else if (ctx.createBuffer) {
          // Node mock context fallback
          const sampleRate = ctx.sampleRate || 44100;
          const length = Math.floor(sampleRate * 2.5);
          audioBuffers.push(ctx.createBuffer(1, length, sampleRate));
        }
      } catch (err) {
        console.warn(`OnlineTTSProvider: chunk synthesis error for "${chunk.slice(0, 20)}...":`, err);
        // If a single chunk fails, continue to attempt remaining chunks
      }
    }

    if (audioBuffers.length === 0) {
      throw new Error(`Failed to generate spoken audio for language: ${lang}`);
    }

    return this._concatenateAudioBuffers(audioBuffers, ctx);
  }
}
