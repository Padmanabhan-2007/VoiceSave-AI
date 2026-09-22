/**
 * VoiceSave AI - Cloud API TTS Provider (OpenAI TTS & ElevenLabs)
 * Fetches real studio audio buffers when external API keys are configured.
 */

import { TTSProvider } from './provider.js';

export class ApiTTSProvider extends TTSProvider {
  constructor(config = {}) {
    super('ApiTTSProvider');
    this.provider = config.provider || 'openai'; // 'openai' | 'elevenlabs'
    this.apiKey = config.apiKey || '';
    this.voice = config.voice || 'alloy';
    this.model = config.model || 'tts-1';
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Synthesizes audio using the configured Cloud API
   * @param {string} text
   * @param {Object} options
   * @returns {Promise<AudioBuffer>}
   */
  async synthesizeBuffer(text, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('API key is not configured for Cloud TTS. Please check extension settings or switch to Demo Mode.');
    }

    if (this.provider === 'openai') {
      return await this._synthesizeOpenAI(text, options);
    } else if (this.provider === 'elevenlabs') {
      return await this._synthesizeElevenLabs(text, options);
    } else {
      throw new Error(`Unsupported TTS provider: ${this.provider}`);
    }
  }

  async _synthesizeOpenAI(text, options = {}) {
    const voice = options.voice || this.voice || 'alloy';
    const speed = options.rate || 1.0;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model || 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: speed
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI TTS API error (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  async _synthesizeElevenLabs(text, options = {}) {
    const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel voice

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs TTS API error (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
}
