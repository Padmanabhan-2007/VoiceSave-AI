/**
 * VoiceSave AI - Settings & Storage Manager
 * Stores user language preferences, voice settings, audio format, and recording history.
 */

export const DEFAULT_SETTINGS = {
  enabled: true,
  autoInject: true,
  preferredFormat: 'MP3',
  myLanguage: 'ta',                 // Default preferred language (Tamil — தமிழ்)
  languageMode: 'auto',             // 'auto' | 'original' | 'translate'
  defaultTargetLanguage: 'ta',      // Target for Translate & Speak
  readCodeBlocks: false,            // Skip code blocks by default for natural speech
  translationProvider: 'demo',      // 'demo' | 'api'
  voice: '',
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  demoMode: true,
  llmProvider: 'demo',
  llmApiKey: '',
  ttsProvider: 'browser',
  ttsApiKey: '',
  recordings: [
    {
      id: 'rec-1',
      title: 'SSD Explanation (Tamil Translation)',
      filename: 'ssd-explanation-ta-20260909.mp3',
      format: 'MP3',
      language: 'ta',
      timestamp: Date.now() - 3600000 * 2,
      duration: '00:18',
      size: '184 KB'
    },
    {
      id: 'rec-2',
      title: 'Java Polymorphism (Hindi Translation)',
      filename: 'java-polymorphism-hi-20260909.wav',
      format: 'WAV',
      language: 'hi',
      timestamp: Date.now() - 3600000 * 24,
      duration: '00:24',
      size: '412 KB'
    },
    {
      id: 'rec-3',
      title: 'Quantum Computing (English Original)',
      filename: 'quantum-computing-en-20260909.mp3',
      format: 'MP3',
      language: 'en',
      timestamp: Date.now() - 3600000 * 48,
      duration: '00:16',
      size: '162 KB'
    }
  ]
};

export class SettingsStore {
  static isChromeStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  static async getSettings() {
    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
          resolve({ ...DEFAULT_SETTINGS, ...items });
        });
      });
    }

    try {
      const stored = localStorage.getItem('voicesave_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {}

    return { ...DEFAULT_SETTINGS };
  }

  static async saveSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };

    if (this.isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.set(updated, () => {
          resolve(updated);
        });
      });
    }

    try {
      localStorage.setItem('voicesave_settings', JSON.stringify(updated));
    } catch (e) {}

    return updated;
  }

  static async addRecording(recording) {
    const settings = await this.getSettings();
    const recordings = [recording, ...(settings.recordings || [])].slice(0, 25);
    await this.saveSettings({ recordings });
    return recordings;
  }

  static async removeRecording(recordingId) {
    const settings = await this.getSettings();
    const recordings = (settings.recordings || []).filter((r) => r.id !== recordingId);
    await this.saveSettings({ recordings });
    return recordings;
  }
}
