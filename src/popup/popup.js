/**
 * VoiceSave AI - Extension Popup Logic (Hardened Edition)
 * Handles Quick Ask, Language Selection, Voice Verification, Canonical Audio Recording, and Downloads.
 * Strictly guarantees target-language audio generation and prominent download UX.
 */

import { SettingsStore } from '../storage/settings.js';
import { DemoLLMProvider } from '../llm/demo-provider.js';
import { ApiLLMProvider } from '../llm/api-provider.js';
import { TTSManager } from '../tts/tts-manager.js';
import { encodeAudio, isM4ASupported } from '../audio/encoder.js';
import { downloadBlob } from '../utils/download.js';
import { generateAudioFilename, formatBytes } from '../utils/format.js';
import { AudioRecorderManager, RecorderState } from '../audio/recorder.js';
import { getLanguageByCode } from '../language/languages.js';
import { LanguageDetector } from '../language/detector.js';

let settings = null;
let ttsManager = null;
let currentRawAnswer = '';
let currentTranslatedAnswer = '';
let activeAudioText = '';
let activeLanguage = 'ta';
let currentAnswerBlob = null;
let currentAnswerFilename = '';
let activeCanonicalSpeech = null;

const FORMAT_DESCRIPTIONS = {
  MP3: 'Universal MPEG-1 Layer 3 (Compressed)',
  WAV: 'Lossless 16-bit PCM Studio (Uncompressed)',
  M4A: 'MPEG-4 AAC Container Audio'
};

document.addEventListener('DOMContentLoaded', async () => {
  await initPopup();
});

async function initPopup() {
  settings = await SettingsStore.getSettings();
  ttsManager = new TTSManager(settings);

  // Setup UI elements
  const languageSelect = document.getElementById('language-select');
  const voiceSelect = document.getElementById('voice-select');
  const formatSelect = document.getElementById('format-select');
  const formatDesc = document.getElementById('format-desc');
  const modeBadge = document.getElementById('mode-badge');
  const btnSettings = document.getElementById('btn-settings');
  const btnAskSpeak = document.getElementById('btn-ask-speak');
  const questionInput = document.getElementById('question-input');
  const answerSection = document.getElementById('answer-section');
  const answerText = document.getElementById('answer-text');
  const detectedLangPill = document.getElementById('detected-lang-pill');
  const translatedBox = document.getElementById('translated-box');
  const translatedLangLabel = document.getElementById('translated-lang-label');
  const translatedText = document.getElementById('translated-text');
  const btnAnswerSpeak = document.getElementById('btn-answer-speak');
  const btnAnswerTranslate = document.getElementById('btn-answer-translate');
  const btnAnswerStop = document.getElementById('btn-answer-stop');
  const btnAnswerRecord = document.getElementById('btn-answer-record');
  const statusReadyBadge = document.getElementById('status-ready-badge');
  const btnAnswerPlay = document.getElementById('btn-answer-play');
  const btnAnswerDownload = document.getElementById('btn-answer-download');
  const recordLabel = document.getElementById('record-label');
  const recordTimer = document.getElementById('record-timer');
  const btnClearRecent = document.getElementById('btn-clear-recent');
  const linkDemoSandbox = document.getElementById('link-demo-sandbox');

  // Dark Audio Player Elements
  const audioPlayerCard = document.getElementById('audio-player-card');
  const playerTrackTitle = document.getElementById('player-track-title');
  const playerTrackMeta = document.getElementById('player-track-meta');
  const playerProgressFill = document.getElementById('player-progress-fill');
  const playerTimeDisplay = document.getElementById('player-time-display');

  // Mode Badge (Explicit distinction between Demo and Live Mode)
  if (settings.demoMode) {
    modeBadge.textContent = 'DEMO MODE';
    modeBadge.className = 'mode-badge demo';
  } else {
    modeBadge.textContent = `${(settings.llmProvider || 'LIVE').toUpperCase()} MODE`;
    modeBadge.className = 'mode-badge api';
  }

  // Format Dropdown with M4A availability check
  const m4aSupported = isM4ASupported();
  const m4aOption = formatSelect.querySelector('option[value="M4A"]');
  if (m4aOption) {
    if (!m4aSupported) {
      m4aOption.disabled = true;
      m4aOption.textContent = 'M4A (Unsupported)';
      if (settings.preferredFormat === 'M4A') {
        settings.preferredFormat = 'MP3';
        SettingsStore.saveSettings({ preferredFormat: 'MP3' });
      }
    } else {
      m4aOption.disabled = false;
      m4aOption.textContent = 'M4A';
    }
  }

  const formatPills = document.querySelectorAll('.format-pill');
  function syncFormatPills(val) {
    formatPills.forEach((p) => {
      if (p.dataset.format === val) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  formatSelect.value = settings.preferredFormat || 'MP3';
  formatDesc.textContent = FORMAT_DESCRIPTIONS[formatSelect.value] || '';
  syncFormatPills(formatSelect.value);

  formatPills.forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      const fmt = pill.dataset.format;
      if (fmt === 'M4A' && !isM4ASupported()) {
        alert('M4A is unavailable in this browser. Available formats: MP3, WAV');
        return;
      }
      formatSelect.value = fmt;
      formatSelect.dispatchEvent(new Event('change'));
    });
  });

  formatSelect.addEventListener('change', async (e) => {
    const val = e.target.value;
    if (val === 'M4A' && !isM4ASupported()) {
      alert('M4A is unavailable in this browser. Available formats: MP3, WAV');
      formatSelect.value = 'MP3';
      syncFormatPills('MP3');
      return;
    }
    syncFormatPills(val);
    formatDesc.textContent = FORMAT_DESCRIPTIONS[formatSelect.value] || '';
    settings.preferredFormat = formatSelect.value;
    await SettingsStore.saveSettings({ preferredFormat: formatSelect.value });
  });

  // Language Dropdown Setup
  languageSelect.value = settings.myLanguage || 'ta';
  activeLanguage = languageSelect.value;
  await updateVoiceListForLanguage(languageSelect.value);

  languageSelect.addEventListener('change', async (e) => {
    const lang = e.target.value;
    activeLanguage = lang;
    settings.myLanguage = lang;
    settings.defaultTargetLanguage = lang;
    await SettingsStore.saveSettings({ myLanguage: lang, defaultTargetLanguage: lang });
    await updateVoiceListForLanguage(lang);

    // If there is an active answer, re-translate when language dropdown changes
    if (currentRawAnswer && lang !== 'original') {
      await performTranslationAndDisplay(lang);
    }
  });

  async function updateVoiceListForLanguage(langCode) {
    voiceSelect.innerHTML = '';
    const langObj = getLanguageByCode(langCode);
    const voices = await ttsManager.browserTTS.getVoicesForLanguage(langCode);

    if (voices.length === 0) {
      // Honest reporting: notify user of local synthesizer fallback
      const acousticOpt = document.createElement('option');
      acousticOpt.value = '';
      acousticOpt.textContent = `Acoustic Synthesizer (${langObj?.name || 'Local'})`;
      acousticOpt.selected = true;
      voiceSelect.appendChild(acousticOpt);
    } else {
      const autoOpt = document.createElement('option');
      autoOpt.value = '';
      autoOpt.textContent = `Default Voice for ${langObj?.name || langCode}`;
      voiceSelect.appendChild(autoOpt);

      voices.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI || v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        if (opt.value === settings.voice) opt.selected = true;
        voiceSelect.appendChild(opt);
      });
    }
  }

  voiceSelect.addEventListener('change', async (e) => {
    settings.voice = e.target.value;
    await SettingsStore.saveSettings({ voice: e.target.value });
  });

  // Re-populate voices when browser dynamically finishes enumerating speech synthesis voices
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', async () => {
      if (languageSelect) {
        await updateVoiceListForLanguage(languageSelect.value);
      }
    });
  }

  // Settings & Sandbox Links
  btnSettings.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/options.html', '_blank');
    }
  });

  linkDemoSandbox.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/demo/demo.html') });
    } else {
      window.open('../demo/demo.html', '_blank');
    }
  });

  // Preset Chips
  const charCounter = document.getElementById('char-counter');
  const clearTextBtn = document.getElementById('clear-text-btn');

  function updateCharCount() {
    const len = questionInput.value.length;
    if (charCounter) charCounter.textContent = `${len}/500`;
    if (clearTextBtn) {
      if (len > 0) clearTextBtn.classList.remove('hidden');
      else clearTextBtn.classList.add('hidden');
    }
  }

  questionInput.addEventListener('input', updateCharCount);
  if (clearTextBtn) {
    clearTextBtn.addEventListener('click', () => {
      questionInput.value = '';
      updateCharCount();
      questionInput.focus();
    });
  }

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      questionInput.value = chip.dataset.query;
      updateCharCount();
      const chipLang = chip.dataset.lang;
      if (chipLang) {
        languageSelect.value = chipLang;
        activeLanguage = chipLang;
        settings.myLanguage = chipLang;
        settings.defaultTargetLanguage = chipLang;
        await SettingsStore.saveSettings({ myLanguage: chipLang, defaultTargetLanguage: chipLang });
        await updateVoiceListForLanguage(chipLang);
      }
      questionInput.focus();
    });
  });

  // Render recent recordings
  renderRecentRecordings();

  btnClearRecent.addEventListener('click', async () => {
    await SettingsStore.saveSettings({ recordings: [] });
    settings.recordings = [];
    renderRecentRecordings();
  });

  // Recorder State Manager with explicit states
  const popupRecorder = new AudioRecorderManager({
    onStateChange: (state, payload) => {
      if (state === RecorderState.PREPARING || state === RecorderState.GENERATING_AUDIO) {
        btnAnswerRecord.disabled = true;
        recordLabel.textContent = 'Preparing...';
        recordTimer.style.display = 'none';
        if (statusReadyBadge) statusReadyBadge.style.display = 'none';
        btnAnswerPlay.style.display = 'none';
        btnAnswerDownload.style.display = 'none';
        if (audioPlayerCard) audioPlayerCard.style.display = 'none';
      } else if (state === RecorderState.RECORDING) {
        btnAnswerRecord.disabled = false;
        btnAnswerRecord.className = 'btn btn-record is-recording';
        recordLabel.textContent = 'Stop Recording';
        recordTimer.style.display = 'inline-block';
        recordTimer.textContent = payload.formattedTime;
        if (statusReadyBadge) statusReadyBadge.style.display = 'none';
        btnAnswerPlay.style.display = 'none';
        btnAnswerDownload.style.display = 'none';
        if (audioPlayerCard) audioPlayerCard.style.display = 'none';
      } else if (state === RecorderState.STOPPING || state === RecorderState.ENCODING) {
        btnAnswerRecord.disabled = true;
        recordLabel.textContent = 'Processing audio...';
      } else if (state === RecorderState.VALIDATING) {
        btnAnswerRecord.disabled = true;
        recordLabel.textContent = 'Validating audio...';
      } else if (state === RecorderState.SAVED) {
        btnAnswerRecord.disabled = false;
        btnAnswerRecord.className = 'btn btn-record';
        recordLabel.textContent = 'Record & Save';
        recordTimer.style.display = 'none';

        // Show Audio Ready badge and visible Play + Download Audio buttons
        if (statusReadyBadge) {
          statusReadyBadge.style.display = 'inline-flex';
          statusReadyBadge.textContent = '✓ Audio Ready';
        }
        btnAnswerPlay.style.display = 'inline-flex';
        btnAnswerDownload.style.display = 'inline-flex';

        // Populate and display the Signature Dark Audio Player
        const langObj = getLanguageByCode(activeLanguage || 'ta');
        if (audioPlayerCard) {
          audioPlayerCard.style.display = 'flex';
          if (playerTrackTitle) playerTrackTitle.textContent = `${langObj?.name || 'Spoken'} Audio`;
          if (playerTrackMeta) playerTrackMeta.textContent = `${langObj?.displayName || 'Tamil'} · ${formatSelect.value} · ${popupRecorder.getFormattedTime()}`;
          if (playerTimeDisplay) playerTimeDisplay.textContent = popupRecorder.getFormattedTime();
          if (playerProgressFill) playerProgressFill.style.width = '0%';
        }
      } else if (state === RecorderState.ERROR) {
        btnAnswerRecord.disabled = false;
        btnAnswerRecord.className = 'btn btn-record';
        recordLabel.textContent = 'Record & Save';
        recordTimer.style.display = 'none';
        if (audioPlayerCard) audioPlayerCard.style.display = 'none';
        if (statusReadyBadge) {
          statusReadyBadge.style.display = 'inline-flex';
          statusReadyBadge.textContent = 'Audio export failed';
          statusReadyBadge.style.color = '#C64545';
        }
      } else if (state === RecorderState.IDLE) {
        btnAnswerRecord.disabled = false;
        btnAnswerRecord.className = 'btn btn-record';
        recordLabel.textContent = 'Record & Save';
        recordTimer.style.display = 'none';
      }
    },
    onTick: (seconds, formatted) => {
      recordTimer.textContent = formatted;
    }
  });

  // Perform translation & update UI box
  async function performTranslationAndDisplay(targetLang) {
    if (!currentRawAnswer) return;

    const targetLangObj = getLanguageByCode(targetLang);
    const transOutcome = await ttsManager.translationManager.processAndTranslate(currentRawAnswer, targetLang);

    if (transOutcome.isUnavailable) {
      alert(transOutcome.message);
      translatedBox.style.display = 'none';
      activeAudioText = currentRawAnswer;
      activeLanguage = 'en';
      return currentRawAnswer;
    }

    currentTranslatedAnswer = transOutcome.translatedText;
    activeAudioText = transOutcome.translatedText;
    activeLanguage = transOutcome.targetLang;

    if (transOutcome.didTranslate) {
      translatedBox.style.display = 'flex';
      translatedLangLabel.textContent = `🌐 ${targetLangObj.displayName} Translation:`;
      translatedText.textContent = transOutcome.translatedText;
    } else {
      translatedBox.style.display = 'none';
    }

    return transOutcome.translatedText;
  }

  // Ask & Speak Handler
  btnAskSpeak.addEventListener('click', async () => {
    const question = questionInput.value.trim();
    if (!question) {
      questionInput.focus();
      return;
    }

    btnAskSpeak.disabled = true;
    btnAskSpeak.innerHTML = `<span>⏳ Thinking...</span>`;
    answerSection.style.display = 'block';
    answerText.textContent = 'Generating AI answer...';
    translatedBox.style.display = 'none';
    if (statusReadyBadge) statusReadyBadge.style.display = 'none';
    btnAnswerPlay.style.display = 'none';
    btnAnswerDownload.style.display = 'none';
    if (audioPlayerCard) audioPlayerCard.style.display = 'none';

    try {
      // Pick LLM provider
      let llm;
      if (settings.demoMode || !settings.llmApiKey) {
        llm = new DemoLLMProvider();
      } else {
        llm = new ApiLLMProvider({
          provider: settings.llmProvider,
          apiKey: settings.llmApiKey
        });
      }

      // Stream text to answer section
      answerText.textContent = '';
      currentRawAnswer = await llm.ask(question, (chunk, fullText) => {
        answerText.textContent = fullText;
      });

      // Detect language of response
      const detection = LanguageDetector.detectLanguage(currentRawAnswer);
      detectedLangPill.textContent = `Detected: ${detection.name} (${Math.round(detection.confidence * 100)}%)`;

      // Check target language
      const targetLang = languageSelect.value;
      if (targetLang === 'original') {
        activeAudioText = currentRawAnswer;
        activeLanguage = detection.code;
        translatedBox.style.display = 'none';
      } else {
        await performTranslationAndDisplay(targetLang);
      }

      // Playback via TTS coordinator
      await startSpeechPlayback();
    } catch (err) {
      console.error('Ask error:', err);
      answerText.textContent = `Error: ${err.message || err}`;
    } finally {
      btnAskSpeak.disabled = false;
      btnAskSpeak.innerHTML = `
        <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" x2="12" y1="19" y2="22"></line>
        </svg>
        <span>Ask & Speak</span>
      `;
    }
  });

  async function startSpeechPlayback(textToSpeak = activeAudioText, lang = activeLanguage) {
    if (!textToSpeak) return;
    const targetLangObj = getLanguageByCode(lang);
    btnAnswerSpeak.textContent = `🔊 Speaking (${targetLangObj.name})...`;
    btnAnswerStop.style.display = 'inline-flex';

    const onFinish = () => {
      btnAnswerSpeak.textContent = '🔊 Speak';
      btnAnswerStop.style.display = 'none';
    };

    await ttsManager.speakMultilingual(textToSpeak, {
      targetLanguage: lang,
      voiceURI: voiceSelect.value || settings.voice,
      rate: settings.speed,
      pitch: settings.pitch,
      volume: settings.volume,
      onEnd: onFinish,
      onError: onFinish
    });
  }

  // Speak Button: speaks currently active text
  btnAnswerSpeak.addEventListener('click', async () => {
    if (ttsManager.isSpeaking()) {
      ttsManager.stop();
      btnAnswerSpeak.textContent = '🔊 Speak';
      btnAnswerStop.style.display = 'none';
    } else {
      await startSpeechPlayback();
    }
  });

  // Translate & Speak Button
  btnAnswerTranslate.addEventListener('click', async () => {
    if (!currentRawAnswer) return;
    const targetLang = languageSelect.value;
    await performTranslationAndDisplay(targetLang);
    await startSpeechPlayback();
  });

  btnAnswerStop.addEventListener('click', () => {
    ttsManager.stop();
    btnAnswerSpeak.textContent = '🔊 Speak';
    btnAnswerStop.style.display = 'none';
    if (btnAnswerPlay) btnAnswerPlay.textContent = '▶ Play';
    if (playerPlayTimer) clearInterval(playerPlayTimer);
    if (playerProgressFill) playerProgressFill.style.width = '0%';
    if (popupRecorder.state === RecorderState.RECORDING) {
      finishPopupRecording();
    }
  });

  // Finalize popup recording with canonical audio validation
  async function finishPopupRecording() {
    if (popupRecorder.state !== RecorderState.RECORDING) return;
    popupRecorder.stopping();

    try {
      ttsManager.stop();
      btnAnswerSpeak.textContent = '🔊 Speak';
      btnAnswerStop.style.display = 'none';

      const textToRecord = activeAudioText || currentRawAnswer;
      const format = formatSelect.value;
      const langCode = activeLanguage || 'ta';

      if (!activeCanonicalSpeech) {
        popupRecorder.setGeneratingAudio();
        activeCanonicalSpeech = await ttsManager.generateCanonicalSpeech({
          text: textToRecord,
          language: langCode,
          speed: settings.speed,
          pitch: settings.pitch
        });
      }

      // Encode from canonical audio buffer
      popupRecorder.encoding();
      const encoded = await encodeAudio(activeCanonicalSpeech.audioBuffer, format);

      // Validate stream
      popupRecorder.validating();
      if (!encoded.validation || !encoded.validation.valid) {
        throw new Error(encoded.validation?.error || 'Validation failed');
      }

      // Filename [topic]-[lang]-[date].[ext]
      const filename = generateAudioFilename(textToRecord.slice(0, 24), langCode, encoded.extension);

      currentAnswerBlob = encoded.blob;
      currentAnswerFilename = filename;

      // Store recording in history
      await SettingsStore.addRecording({
        id: 'rec-' + Date.now(),
        title: textToRecord.slice(0, 36) + '...',
        filename: filename,
        format: encoded.extension.toUpperCase(),
        language: langCode,
        timestamp: Date.now(),
        duration: popupRecorder.getFormattedTime(),
        size: formatBytes(encoded.blob.size)
      });

      settings = await SettingsStore.getSettings();
      renderRecentRecordings();

      popupRecorder.saved({ blob: encoded.blob, filename });
    } catch (err) {
      console.error('Recording failed:', err);
      popupRecorder.error(err);
    }
  }

  // Record Button (Synchronized Canonical Audio)
  btnAnswerRecord.addEventListener('click', async () => {
    if (popupRecorder.state === RecorderState.RECORDING) {
      await finishPopupRecording();
      return;
    }

    if (popupRecorder.isBusy()) return;
    if (!currentRawAnswer && !activeAudioText) return;

    // Ensure target language translation has occurred if needed
    const targetLang = languageSelect.value;
    if (targetLang !== 'original' && (!activeAudioText || activeLanguage !== targetLang)) {
      await performTranslationAndDisplay(targetLang);
    }

    popupRecorder.startPreparing();

    try {
      const textToRecord = activeAudioText || currentRawAnswer;
      const langCode = activeLanguage || 'ta';

      popupRecorder.setGeneratingAudio();
      activeCanonicalSpeech = await ttsManager.generateCanonicalSpeech({
        text: textToRecord,
        language: langCode,
        speed: settings.speed,
        pitch: settings.pitch
      });

      popupRecorder.start();
      btnAnswerSpeak.textContent = '🔊 Recording...';
      btnAnswerStop.style.display = 'inline-flex';

      await ttsManager.playCanonicalSpeech(activeCanonicalSpeech, {
        onEnd: async () => {
          if (popupRecorder.state === RecorderState.RECORDING) {
            await finishPopupRecording();
          }
        },
        onError: (err) => {
          popupRecorder.error(err);
        }
      });
    } catch (err) {
      console.error('Failed to prepare recording:', err);
      popupRecorder.error(err);
    }
  });

  // Play Audio Button Handler (Synchronized with Dark Audio Player Scrubber)
  let playerPlayTimer = null;
  btnAnswerPlay.addEventListener('click', async () => {
    if (activeCanonicalSpeech) {
      if (ttsManager.isPlayingCanonical) {
        ttsManager.stop();
        btnAnswerPlay.textContent = '▶ Play';
        if (playerPlayTimer) clearInterval(playerPlayTimer);
        if (playerProgressFill) playerProgressFill.style.width = '0%';
      } else {
        btnAnswerPlay.textContent = '■ Stop';
        const durationSec = activeCanonicalSpeech.duration || (activeCanonicalSpeech.audioBuffer?.duration) || 5;
        let elapsed = 0;
        if (playerProgressFill) playerProgressFill.style.width = '0%';
        if (playerPlayTimer) clearInterval(playerPlayTimer);

        playerPlayTimer = setInterval(() => {
          elapsed += 0.1;
          const pct = Math.min(100, (elapsed / durationSec) * 100);
          if (playerProgressFill) playerProgressFill.style.width = `${pct}%`;
          if (playerTimeDisplay) {
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
            playerTimeDisplay.textContent = `${m}:${s}`;
          }
        }, 100);

        await ttsManager.playCanonicalSpeech(activeCanonicalSpeech, {
          onEnd: () => {
            btnAnswerPlay.textContent = '▶ Play';
            if (playerPlayTimer) clearInterval(playerPlayTimer);
            if (playerProgressFill) playerProgressFill.style.width = '100%';
            setTimeout(() => {
              if (playerProgressFill) playerProgressFill.style.width = '0%';
              if (playerTimeDisplay) playerTimeDisplay.textContent = popupRecorder.getFormattedTime();
            }, 600);
          },
          onError: () => {
            btnAnswerPlay.textContent = '▶ Play';
            if (playerPlayTimer) clearInterval(playerPlayTimer);
            if (playerProgressFill) playerProgressFill.style.width = '0%';
          }
        });
      }
    }
  });

  // Download Audio Button Handler
  btnAnswerDownload.addEventListener('click', async () => {
    if (currentAnswerBlob && currentAnswerFilename) {
      btnAnswerDownload.disabled = true;
      btnAnswerDownload.innerHTML = '<span>⏳ Downloading...</span>';
      try {
        await downloadBlob(currentAnswerBlob, currentAnswerFilename);
        btnAnswerDownload.innerHTML = '<span>✓ Downloaded</span>';
        if (statusReadyBadge) {
          statusReadyBadge.textContent = '✓ Downloaded';
          statusReadyBadge.style.color = '#2F7A40';
        }
        setTimeout(() => {
          btnAnswerDownload.disabled = false;
          btnAnswerDownload.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download Audio</span>
          `;
        }, 3000);
      } catch (err) {
        console.error('Download failed:', err);
        btnAnswerDownload.disabled = false;
        btnAnswerDownload.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Audio</span>
        `;
        if (statusReadyBadge) {
          statusReadyBadge.textContent = 'Download failed';
          statusReadyBadge.style.color = '#C64545';
        }
      }
    }
  });
}

function renderRecentRecordings() {
  const container = document.getElementById('recordings-list');
  const recordings = settings?.recordings || [];

  if (recordings.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 16px 12px; color: var(--vs-muted, #6C6A64); font-size: 11.5px; line-height: 1.5;">No recordings yet.<br/><span style="color: var(--vs-faint, #9E9B93); font-size: 10.5px;">Your saved AI responses will appear here.</span></div>`;
    return;
  }

  container.innerHTML = '';

  recordings.slice(0, 5).forEach((rec) => {
    const item = document.createElement('div');
    item.className = 'recording-item';
    const langCode = rec.language ? rec.language.toUpperCase() : 'EN';

    item.innerHTML = `
      <div class="recording-meta">
        <span class="recording-title" title="${rec.title}">${rec.title}</span>
        <div class="recording-subtitle">
          <span class="recording-lang-tag">${langCode}</span>
          <span class="recording-tag">${rec.format}</span>
          <span>${rec.duration || ''}</span>
          <span>•</span>
          <span>${rec.size || ''}</span>
        </div>
      </div>
      <div class="recording-actions">
        <button class="rec-btn btn-play" title="Play preview">▶</button>
        <button class="rec-btn btn-download-rec" title="Download Audio">↓ Download</button>
      </div>
    `;

    const btnPlay = item.querySelector('.btn-play');
    btnPlay.addEventListener('click', async () => {
      if (ttsManager.isSpeaking()) {
        ttsManager.stop();
        btnPlay.textContent = '▶';
      } else {
        btnPlay.textContent = '■';
        const onEnd = () => { btnPlay.textContent = '▶'; };
        await ttsManager.speakMultilingual(rec.title, {
          targetLanguage: rec.language || 'ta',
          rate: settings.speed,
          pitch: settings.pitch,
          onEnd,
          onError: onEnd
        });
      }
    });

    const btnDown = item.querySelector('.btn-download-rec');
    btnDown.addEventListener('click', async () => {
      btnDown.textContent = '⏳';
      try {
        const canonical = await ttsManager.generateCanonicalSpeech({
          text: rec.title,
          language: rec.language || 'ta'
        });
        const encoded = await encodeAudio(canonical.audioBuffer, rec.format);
        await downloadBlob(encoded.blob, rec.filename);
        btnDown.textContent = '✓';
        setTimeout(() => { btnDown.textContent = '↓ Download'; }, 2000);
      } catch (err) {
        console.error('Download error:', err);
        btnDown.textContent = '✖';
        setTimeout(() => { btnDown.textContent = '↓ Download'; }, 2000);
      }
    });

    container.appendChild(item);
  });
}
