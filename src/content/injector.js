/**
 * VoiceSave AI - In-Page Toolbar Injector & Controller (Hardened Edition)
 * Injects [ 🔊 Speak ], [ 🌐 Translate & Speak ], [ 🔴 Record & Save ], language & format selectors.
 * Strictly guarantees Canonical Audio synchronization between live playback and exported file.
 * Provides visible [ ▶ Play ] and [ ↓ Download Audio ] buttons after recording.
 */

import { TTSManager } from '../tts/tts-manager.js';
import { encodeAudio, isM4ASupported } from '../audio/encoder.js';
import { AudioRecorderManager, RecorderState } from '../audio/recorder.js';
import { downloadBlob } from '../utils/download.js';
import { generateAudioFilename, formatBytes } from '../utils/format.js';
import { SettingsStore } from '../storage/settings.js';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../language/languages.js';
import { LanguageDetector } from '../language/detector.js';

export class ToolbarInjector {
  constructor(siteAdapter) {
    this.adapter = siteAdapter;
    this.ttsManager = null;
    this.settings = null;
    this.initPromise = this.init();
  }

  async init() {
    this.settings = await SettingsStore.getSettings();
    this.ttsManager = new TTSManager(this.settings);
    return this;
  }

  /**
   * Injects the multilingual VoiceSave toolbar into the response element
   * @param {HTMLElement} element
   */
  async inject(element) {
    await this.initPromise;

    if (!element || element.getAttribute('data-voicesave-injected') === 'true') {
      return;
    }

    // Prevent duplicate toolbar in element or parents
    if (element.querySelector('.voicesave-toolbar-wrapper')) {
      element.setAttribute('data-voicesave-injected', 'true');
      return;
    }

    element.setAttribute('data-voicesave-injected', 'true');

    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'voicesave-toolbar-wrapper';

    const toolbar = document.createElement('div');
    toolbar.className = 'voicesave-toolbar';

    // 1. Speak Button
    const speakBtn = document.createElement('button');
    speakBtn.className = 'voicesave-btn voicesave-btn-speak';
    speakBtn.setAttribute('title', 'Read aloud response');
    speakBtn.innerHTML = `
      <span class="voicesave-icon">🔊</span>
      <span class="voicesave-label">Speak</span>
    `;

    // 2. Stop Button
    const stopSpeechBtn = document.createElement('button');
    stopSpeechBtn.className = 'voicesave-btn voicesave-btn-stop';
    stopSpeechBtn.style.display = 'none';
    stopSpeechBtn.innerHTML = `<span>■</span><span>Stop</span>`;

    // 3. Language Selector Dropdown for Translation
    const langSelect = document.createElement('select');
    langSelect.className = 'voicesave-lang-select';
    langSelect.setAttribute('title', 'Select target language for speech & audio');

    const preferredLang = this.settings.myLanguage || 'ta';

    SUPPORTED_LANGUAGES.filter((l) => !l.isSpecial).forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.displayName;
      if (lang.code === preferredLang) {
        opt.selected = true;
      }
      langSelect.appendChild(opt);
    });

    // 4. Translate & Speak Button
    const translateBtn = document.createElement('button');
    translateBtn.className = 'voicesave-btn voicesave-btn-translate';
    translateBtn.setAttribute('title', 'Translate response and speak in target language');
    translateBtn.innerHTML = `
      <span class="voicesave-icon">🌐</span>
      <span class="voicesave-label">Translate & Speak</span>
    `;

    // 5. Record & Save Button (Synchronized Canonical Audio)
    const recordBtn = document.createElement('button');
    recordBtn.className = 'voicesave-btn voicesave-btn-record';
    recordBtn.setAttribute('title', 'Record speech and save audio (MP3 / WAV / M4A)');
    recordBtn.innerHTML = `
      <span class="voicesave-record-dot">🔴</span>
      <span class="voicesave-record-label">Record & Save</span>
    `;

    // 6. Status / Timer Badge
    const statusBadge = document.createElement('span');
    statusBadge.className = 'voicesave-status-badge';
    statusBadge.style.display = 'none';

    // 7. Audio Format Selector
    const formatSelect = document.createElement('select');
    formatSelect.className = 'voicesave-format-select';
    formatSelect.setAttribute('title', 'Select Audio Export Format');

    const m4aAvailable = isM4ASupported();
    const formats = [
      { id: 'MP3', label: 'MP3' },
      { id: 'WAV', label: 'WAV' },
      { id: 'M4A', label: m4aAvailable ? 'M4A' : 'M4A (Unsupported)', disabled: !m4aAvailable }
    ];

    formats.forEach((fmt) => {
      const opt = document.createElement('option');
      opt.value = fmt.id;
      opt.textContent = fmt.label;
      if (fmt.disabled) opt.disabled = true;
      if (fmt.id === (this.settings.preferredFormat || 'MP3')) {
        if (!fmt.disabled) {
          opt.selected = true;
        } else {
          formatSelect.value = 'MP3';
        }
      }
      formatSelect.appendChild(opt);
    });

    formatSelect.addEventListener('change', async (e) => {
      if (e.target.value === 'M4A' && !isM4ASupported()) {
        alert('M4A is unavailable in this browser. Available formats: MP3, WAV');
        formatSelect.value = 'MP3';
        return;
      }
      this.settings.preferredFormat = formatSelect.value;
      await SettingsStore.saveSettings({ preferredFormat: formatSelect.value });
    });

    // 8. Play Audio Button (Shown when Audio is Ready)
    const playAudioBtn = document.createElement('button');
    playAudioBtn.className = 'voicesave-btn voicesave-btn-play';
    playAudioBtn.style.display = 'none';
    playAudioBtn.setAttribute('title', 'Play the recorded audio');
    playAudioBtn.innerHTML = `<span>▶</span><span>Play</span>`;

    // 9. Download Audio Button (Unmistakable & Visibly Prominent)
    const downloadAudioBtn = document.createElement('button');
    downloadAudioBtn.className = 'voicesave-btn voicesave-btn-download';
    downloadAudioBtn.style.display = 'none';
    downloadAudioBtn.setAttribute('title', 'Download the generated audio file');
    downloadAudioBtn.innerHTML = `<span>↓</span><span>Download Audio</span>`;

    // 10. Translation preview drawer
    const previewDrawer = document.createElement('div');
    previewDrawer.className = 'voicesave-translation-preview';

    // Assemble toolbar
    toolbar.appendChild(speakBtn);
    toolbar.appendChild(stopSpeechBtn);
    toolbar.appendChild(langSelect);
    toolbar.appendChild(translateBtn);
    toolbar.appendChild(recordBtn);
    toolbar.appendChild(statusBadge);
    toolbar.appendChild(playAudioBtn);
    toolbar.appendChild(downloadAudioBtn);
    toolbar.appendChild(formatSelect);

    wrapper.appendChild(toolbar);
    wrapper.appendChild(previewDrawer);

    // Mount using site adapter
    this.adapter.insertToolbar(element, wrapper);

    // Instance state for synchronized audio
    let activeTextForAudio = '';
    let activeLanguageCode = langSelect.value || 'ta';
    let currentRecordedResult = null;
    let activeCanonicalSpeech = null;

    // Language select change listener
    langSelect.addEventListener('change', async () => {
      activeLanguageCode = langSelect.value;
      this.settings.myLanguage = langSelect.value;
      this.settings.defaultTargetLanguage = langSelect.value;
      await SettingsStore.saveSettings({
        myLanguage: langSelect.value,
        defaultTargetLanguage: langSelect.value
      });

      const langObj = getLanguageByCode(activeLanguageCode);
      translateBtn.setAttribute('title', `Translate response to ${langObj.displayName} and speak`);
    });

    // Recorder State Manager with explicit states
    const recorder = new AudioRecorderManager({
      onStateChange: (state, payload) => {
        if (state === RecorderState.PREPARING || state === RecorderState.GENERATING_AUDIO) {
          recordBtn.disabled = true;
          recordBtn.className = 'voicesave-btn';
          recordBtn.innerHTML = `<span>⏳</span><span>Preparing...</span>`;
          statusBadge.className = 'voicesave-status-badge';
          statusBadge.style.display = 'inline-flex';
          statusBadge.textContent = 'Generating speech...';
          playAudioBtn.style.display = 'none';
          downloadAudioBtn.style.display = 'none';
        } else if (state === RecorderState.RECORDING) {
          recordBtn.disabled = false;
          recordBtn.className = 'voicesave-btn voicesave-btn-record is-recording';
          recordBtn.innerHTML = `<span>⏹</span><span>Stop Recording</span>`;
          statusBadge.className = 'voicesave-status-badge recording';
          statusBadge.style.display = 'inline-flex';
          statusBadge.innerHTML = `<span class="voicesave-red-dot"></span><span>${payload.formattedTime}</span>`;
          playAudioBtn.style.display = 'none';
          downloadAudioBtn.style.display = 'none';
        } else if (state === RecorderState.STOPPING || state === RecorderState.ENCODING) {
          recordBtn.disabled = true;
          recordBtn.className = 'voicesave-btn';
          recordBtn.innerHTML = `<span>⏳</span><span>Processing audio...</span>`;
          statusBadge.className = 'voicesave-status-badge';
          statusBadge.textContent = 'Processing audio...';
        } else if (state === RecorderState.VALIDATING) {
          recordBtn.disabled = true;
          recordBtn.className = 'voicesave-btn';
          recordBtn.innerHTML = `<span>🔍</span><span>Validating audio...</span>`;
          statusBadge.className = 'voicesave-status-badge';
          statusBadge.textContent = 'Validating audio...';
        } else if (state === RecorderState.SAVED) {
          recordBtn.disabled = false;
          recordBtn.className = 'voicesave-btn voicesave-btn-record';
          recordBtn.innerHTML = `<span>🔴</span><span>Record & Save</span>`;
          statusBadge.className = 'voicesave-status-badge ready';
          statusBadge.innerHTML = `<span>✓ Audio Ready</span>`;
          statusBadge.style.display = 'inline-flex';
          playAudioBtn.style.display = 'inline-flex';
          downloadAudioBtn.style.display = 'inline-flex';
          currentRecordedResult = payload.result;
        } else if (state === RecorderState.ERROR) {
          recordBtn.disabled = false;
          recordBtn.className = 'voicesave-btn voicesave-btn-record';
          recordBtn.innerHTML = `<span>🔴</span><span>Record & Save</span>`;
          statusBadge.className = 'voicesave-status-badge';
          statusBadge.innerHTML = `<span style="color: #C64545;">Audio export failed. Please try again.</span>`;
        } else if (state === RecorderState.IDLE) {
          recordBtn.disabled = false;
          recordBtn.className = 'voicesave-btn voicesave-btn-record';
          recordBtn.innerHTML = `<span>🔴</span><span>Record & Save</span>`;
          statusBadge.style.display = 'none';
        }
      },
      onTick: (seconds, formatted) => {
        statusBadge.innerHTML = `<span class="voicesave-red-dot"></span><span>${formatted}</span>`;
      }
    });

    const updateSpeakUI = (isSpeaking, label = 'Speaking...') => {
      if (isSpeaking) {
        speakBtn.className = 'voicesave-btn voicesave-btn-speak is-active';
        speakBtn.innerHTML = `
          <div class="voicesave-wave">
            <div class="voicesave-wave-bar"></div>
            <div class="voicesave-wave-bar"></div>
            <div class="voicesave-wave-bar"></div>
          </div>
          <span>${label}</span>
        `;
        stopSpeechBtn.style.display = 'inline-flex';
      } else {
        speakBtn.className = 'voicesave-btn voicesave-btn-speak';
        speakBtn.innerHTML = `<span class="voicesave-icon">🔊</span><span class="voicesave-label">Speak</span>`;
        translateBtn.className = 'voicesave-btn voicesave-btn-translate';
        translateBtn.innerHTML = `<span class="voicesave-icon">🌐</span><span class="voicesave-label">Translate & Speak</span>`;
        stopSpeechBtn.style.display = 'none';
      }
    };

    // Helper: Execute Translation & Display in preview drawer
    const executeTranslation = async (targetLang) => {
      const rawText = this.adapter.extractResponseText(element);
      if (!rawText) return null;

      const targetLangObj = getLanguageByCode(targetLang);

      translateBtn.className = 'voicesave-btn voicesave-btn-translate is-translating';
      translateBtn.innerHTML = `<span>🌐 Translating to ${targetLangObj.name}...</span>`;
      statusBadge.className = 'voicesave-status-badge translating';
      statusBadge.style.display = 'inline-flex';
      statusBadge.textContent = `Translating to ${targetLangObj.name}...`;

      try {
        const transOutcome = await this.ttsManager.translationManager.processAndTranslate(rawText, targetLang);

        if (transOutcome.isUnavailable) {
          statusBadge.className = 'voicesave-status-badge';
          statusBadge.textContent = 'Translation service unavailable';
          alert(transOutcome.message);
          translateBtn.className = 'voicesave-btn voicesave-btn-translate';
          translateBtn.innerHTML = `<span class="voicesave-icon">🌐</span><span class="voicesave-label">Translate & Speak</span>`;
          return null;
        }

        activeTextForAudio = transOutcome.translatedText;
        activeLanguageCode = targetLang;

        // Show translated text drawer
        previewDrawer.style.display = 'block';
        previewDrawer.innerHTML = `
          <div class="voicesave-translation-header">🌐 Translated to ${targetLangObj.displayName}:</div>
          <div>${escapeHtml(transOutcome.translatedText)}</div>
        `;

        translateBtn.className = 'voicesave-btn voicesave-btn-translate';
        translateBtn.innerHTML = `<span class="voicesave-icon">🌐</span><span class="voicesave-label">Translate & Speak</span>`;
        statusBadge.style.display = 'none';
        return transOutcome.translatedText;
      } catch (err) {
        console.error('VoiceSave AI translation error:', err);
        translateBtn.className = 'voicesave-btn voicesave-btn-translate';
        translateBtn.innerHTML = `<span class="voicesave-icon">🌐</span><span class="voicesave-label">Translate & Speak</span>`;
        statusBadge.textContent = 'Translation failed';
        return null;
      }
    };

    // Handler: Speak
    speakBtn.addEventListener('click', async () => {
      const rawText = this.adapter.extractResponseText(element);
      if (!rawText) {
        alert('VoiceSave AI: No text detected to speak.');
        return;
      }

      if (this.ttsManager.isSpeaking()) {
        this.ttsManager.stop();
        updateSpeakUI(false);
        return;
      }

      const detection = LanguageDetector.detectLanguage(rawText);
      const selectedTarget = langSelect.value;

      // Check if language mode requires translation or if user specifically selected a different target
      if (this.settings.languageMode === 'translate' || (selectedTarget && selectedTarget !== detection.code && selectedTarget !== 'original')) {
        let textToSpeak = activeTextForAudio;
        if (!textToSpeak || activeLanguageCode !== selectedTarget) {
          textToSpeak = await executeTranslation(selectedTarget);
        }

        if (textToSpeak) {
          const targetLangObj = getLanguageByCode(selectedTarget);
          updateSpeakUI(true, `Speaking ${targetLangObj.name}...`);
          await this.ttsManager.speakMultilingual(textToSpeak, {
            targetLanguage: selectedTarget,
            rate: this.settings.speed,
            pitch: this.settings.pitch,
            volume: this.settings.volume,
            onEnd: () => updateSpeakUI(false),
            onError: () => updateSpeakUI(false)
          });
          return;
        }
      }

      // Default: Speak in original language
      activeTextForAudio = rawText;
      activeLanguageCode = detection.code;

      updateSpeakUI(true, `Speaking (${detection.name})...`);

      await this.ttsManager.speakMultilingual(rawText, {
        targetLanguage: detection.code,
        voiceURI: this.settings.voice,
        rate: this.settings.speed,
        pitch: this.settings.pitch,
        volume: this.settings.volume,
        onEnd: () => updateSpeakUI(false),
        onError: () => updateSpeakUI(false)
      });
    });

    // Handler: Translate & Speak
    translateBtn.addEventListener('click', async () => {
      const rawText = this.adapter.extractResponseText(element);
      if (!rawText) {
        alert('VoiceSave AI: No text detected to translate.');
        return;
      }

      if (this.ttsManager.isSpeaking()) {
        this.ttsManager.stop();
        updateSpeakUI(false);
        return;
      }

      const targetLang = langSelect.value;
      const targetLangObj = getLanguageByCode(targetLang);

      const translated = await executeTranslation(targetLang);
      if (!translated) return;

      updateSpeakUI(true, `Speaking ${targetLangObj.name}...`);

      await this.ttsManager.speakMultilingual(translated, {
        targetLanguage: targetLang,
        rate: this.settings.speed,
        pitch: this.settings.pitch,
        volume: this.settings.volume,
        onEnd: () => updateSpeakUI(false),
        onError: () => updateSpeakUI(false)
      });
    });

    // Stop Handler
    stopSpeechBtn.addEventListener('click', () => {
      this.ttsManager.stop();
      updateSpeakUI(false);
      if (recorder.state === RecorderState.RECORDING) {
        finishRecordingFlow();
      }
    });

    // Finalize recording: Stop -> Encode -> Validate -> Ready for Download
    const finishRecordingFlow = async () => {
      if (recorder.state !== RecorderState.RECORDING) return;
      recorder.stopping();

      try {
        this.ttsManager.stop();
        updateSpeakUI(false);

        const format = formatSelect.value;
        const langCode = activeLanguageCode || 'ta';
        const textToSave = activeTextForAudio || this.adapter.extractResponseText(element);

        // Ensure we have the canonical audio source
        if (!activeCanonicalSpeech) {
          recorder.setGeneratingAudio();
          activeCanonicalSpeech = await this.ttsManager.generateCanonicalSpeech({
            text: textToSave,
            language: langCode,
            speed: this.settings.speed,
            pitch: this.settings.pitch
          });
        }

        // Encode to target format (WAV / MP3 / M4A)
        recorder.encoding();
        const encoded = await encodeAudio(activeCanonicalSpeech.audioBuffer, format);

        // Validate audio stream
        recorder.validating();
        if (!encoded.validation || !encoded.validation.valid) {
          throw new Error(encoded.validation?.error || 'Validation failed for audio stream');
        }

        // Language-aware filename: [topic]-[lang]-[date].[ext]
        const filename = generateAudioFilename(textToSave.slice(0, 24), langCode, encoded.extension);

        // Store metadata in recent recordings
        await SettingsStore.addRecording({
          id: 'rec-' + Date.now(),
          title: textToSave.slice(0, 36) + '...',
          filename: filename,
          format: encoded.extension.toUpperCase(),
          language: langCode,
          timestamp: Date.now(),
          duration: recorder.getFormattedTime(),
          size: formatBytes(encoded.blob.size)
        });

        // Set state to SAVED (Audio Ready)
        recorder.saved({
          blob: encoded.blob,
          filename: filename,
          canonicalSpeech: activeCanonicalSpeech
        });
      } catch (err) {
        console.error('VoiceSave AI recording failed:', err);
        recorder.error(err);
      }
    };

    // Handler: Record & Save (Synchronized Canonical Audio)
    recordBtn.addEventListener('click', async () => {
      if (recorder.state === RecorderState.RECORDING) {
        await finishRecordingFlow();
        return;
      }

      if (recorder.isBusy()) return;

      const rawText = this.adapter.extractResponseText(element);
      if (!rawText) {
        alert('VoiceSave AI: No text detected to record.');
        return;
      }

      const selectedTarget = langSelect.value;
      const detection = LanguageDetector.detectLanguage(rawText);

      // If a target language is selected that differs from original, translate first
      if (selectedTarget && selectedTarget !== detection.code && selectedTarget !== 'original') {
        if (!activeTextForAudio || activeLanguageCode !== selectedTarget) {
          const translated = await executeTranslation(selectedTarget);
          if (!translated) return;
        }
      }

      const textToRecord = activeTextForAudio || rawText;
      const langCode = activeLanguageCode || selectedTarget || 'ta';

      recorder.startPreparing();

      try {
        // Step 1: Generate Canonical Audio in memory
        recorder.setGeneratingAudio();
        activeCanonicalSpeech = await this.ttsManager.generateCanonicalSpeech({
          text: textToRecord,
          language: langCode,
          speed: this.settings.speed,
          pitch: this.settings.pitch
        });

        // Step 2: Start recorder timer and play canonical audio through Web Audio API
        recorder.start();
        updateSpeakUI(true, 'Recording...');

        await this.ttsManager.playCanonicalSpeech(activeCanonicalSpeech, {
          onEnd: async () => {
            if (recorder.state === RecorderState.RECORDING) {
              await finishRecordingFlow();
            }
          },
          onError: (err) => {
            recorder.error(err);
          }
        });
      } catch (err) {
        console.error('Failed to prepare canonical recording:', err);
        recorder.error(err);
      }
    });

    // Play Audio Button Handler (Preview recorded audio)
    playAudioBtn.addEventListener('click', async () => {
      if (currentRecordedResult && currentRecordedResult.canonicalSpeech) {
        if (this.ttsManager.isPlayingCanonical) {
          this.ttsManager.stop();
          playAudioBtn.innerHTML = `<span>▶</span><span>Play</span>`;
        } else {
          playAudioBtn.innerHTML = `<span>■</span><span>Stop</span>`;
          await this.ttsManager.playCanonicalSpeech(currentRecordedResult.canonicalSpeech, {
            onEnd: () => {
              playAudioBtn.innerHTML = `<span>▶</span><span>Play</span>`;
            }
          });
        }
      }
    });

    // Download Audio Button Handler (Direct download action)
    downloadAudioBtn.addEventListener('click', async () => {
      if (currentRecordedResult && currentRecordedResult.blob) {
        downloadAudioBtn.disabled = true;
        downloadAudioBtn.innerHTML = `<span>⏳</span><span>Downloading...</span>`;
        try {
          await downloadBlob(currentRecordedResult.blob, currentRecordedResult.filename);
          statusBadge.innerHTML = `<span style="color: #2F7A40; font-weight: 600;">✓ Downloaded</span>`;
          downloadAudioBtn.innerHTML = `<span>✓</span><span>Downloaded</span>`;
          setTimeout(() => {
            downloadAudioBtn.disabled = false;
            downloadAudioBtn.innerHTML = `<span>↓</span><span>Download Audio</span>`;
          }, 3000);
        } catch (e) {
          console.error('Download error:', e);
          statusBadge.innerHTML = `<span style="color: #C64545;">Download failed. Try again.</span>`;
          downloadAudioBtn.disabled = false;
          downloadAudioBtn.innerHTML = `<span>↓</span><span>Download Audio</span>`;
        }
      }
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
