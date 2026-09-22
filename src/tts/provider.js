/**
 * VoiceSave AI - Base TTS Provider Abstract Interface
 */

export class TTSProvider {
  constructor(name = 'BaseTTSProvider') {
    this.name = name;
  }

  /**
   * Generates genuine audio data for playback and export
   * @param {Object} params - { text, language, voice, speed, pitch, volume }
   * @returns {Promise<{ audioBuffer: AudioBuffer, audioBlob?: Blob, mimeType: string, sampleRate: number, channels: number, duration: number, language: string, voiceId: string, provider: string }>}
   */
  async generateSpeech(params = {}) {
    throw new Error('generateSpeech() must be implemented by export-capable subclass');
  }

  /**
   * Synthesizes text into an AudioBuffer
   * @param {string} text
   * @param {Object} options
   * @returns {Promise<AudioBuffer>}
   */
  async synthesizeBuffer(text, options = {}) {
    throw new Error('synthesizeBuffer() must be implemented by subclass');
  }

  /**
   * Speaks text aloud in real time
   * @param {string} text
   * @param {Object} options
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    throw new Error('speak() must be implemented by subclass');
  }

  pause() {}
  resume() {}
  stop() {}

  async getVoices() {
    return [];
  }
}
