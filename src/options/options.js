/**
 * VoiceSave AI - Settings Page Logic (Multilingual Edition)
 */

import { SettingsStore, DEFAULT_SETTINGS } from '../storage/settings.js';
import { BrowserTTSProvider } from '../tts/browser-tts.js';
import { getLanguageByCode } from '../language/languages.js';
import { isM4ASupported } from '../audio/encoder.js';

let currentSettings = { ...DEFAULT_SETTINGS };
const browserTTS = new BrowserTTSProvider();

const TEST_GREETINGS = {
  'ta': 'வணக்கம்! வாய்ஸ்சேவ் ஏஐ தமிழ் குரல் மாதிரி தயாராக உள்ளது.',
  'hi': 'नमस्ते! वॉयससेव एआई हिंदी आवाज का परीक्षण तैयार है।',
  'te': 'నమస్కారం! వాయిస్‌సేవ్ ఏఐ తెలుగు వాయిస్ సిద్ధంగా ఉంది.',
  'kn': 'ನಮಸ್ಕಾರ! ವಾಯ್ಸ್‌ಸೇವ್ ಎಐ ಕನ್ನಡ ಧ್ವನಿ ಮಾದರಿ ಸಿದ್ಧವಾಗಿದೆ.',
  'ml': 'നമസ്കാരം! വോയ്‌സ് സേവ് എഐ മലയാളം വോയ്‌സ് തയ്യാറാണ്.',
  'bn': 'নমস্কার! ভয়েসসেভ এআই বাংলা ভয়েস প্রস্তুত রয়েছে।',
  'mr': 'नमस्कार! व्हॉइससेव्ह एआय मराठी आवाज चाचणीसाठी तयार आहे.',
  'gu': 'નમસ્તે! વોઇસસેવ એઆઇ ગુજરાતી અવાજ તૈયાર છે.',
  'pa': 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਵੌਇਸਸੇਵ ਏਆਈ ਪੰਜਾਬੀ ਆਵਾਜ਼ ਤਿਆਰ ਹੈ।',
  'ur': 'ہیلو! وائس سیو اے آئی اردو آواز تیار ہے۔',
  'es': '¡Hola! La prueba de voz en español de VoiceSave AI está lista.',
  'fr': 'Bonjour! Le test vocal français de VoiceSave AI est prêt.',
  'de': 'Hallo! Der deutsche Sprachtest von VoiceSave AI ist bereit.',
  'en': 'Hello! VoiceSave AI speech and multilingual settings are ready.'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadAndBindSettings();
  setupEventListeners();
});

async function loadAndBindSettings() {
  currentSettings = await SettingsStore.getSettings();

  // General
  document.getElementById('setting-enabled').checked = currentSettings.enabled;
  document.getElementById('setting-autoinject').checked = currentSettings.autoInject;
  document.getElementById('setting-readcode').checked = !!currentSettings.readCodeBlocks;

  // Language & Translation
  document.getElementById('setting-mylanguage').value = currentSettings.myLanguage || 'ta';
  document.getElementById('setting-langmode').value = currentSettings.languageMode || 'auto';
  document.getElementById('setting-transprovider').value = currentSettings.translationProvider || 'demo';

  // Speech
  document.getElementById('setting-speed').value = currentSettings.speed;
  document.getElementById('val-speed').textContent = `${currentSettings.speed}x`;

  document.getElementById('setting-pitch').value = currentSettings.pitch;
  document.getElementById('val-pitch').textContent = `${currentSettings.pitch}`;

  document.getElementById('setting-volume').value = currentSettings.volume;
  document.getElementById('val-volume').textContent = `${Math.round(currentSettings.volume * 100)}%`;

  // Audio Format
  const formatSelect = document.getElementById('setting-format');
  formatSelect.value = currentSettings.preferredFormat || 'MP3';
  updateFormatCards(currentSettings.preferredFormat || 'MP3');

  // LLM / Providers
  const demoToggle = document.getElementById('setting-demomode');
  demoToggle.checked = currentSettings.demoMode;
  toggleApiConfigVisibility(!currentSettings.demoMode);

  document.getElementById('setting-llmprovider').value = currentSettings.llmProvider || 'openai';
  document.getElementById('setting-llmapikey').value = currentSettings.llmApiKey || '';
  document.getElementById('setting-ttsprovider').value = currentSettings.ttsProvider || 'browser';
  document.getElementById('setting-ttsapikey').value = currentSettings.ttsApiKey || '';

  // Populate System Voices filtered by default to 'all' or user's language
  await populateVoices('all');
}

async function populateVoices(langFilter = 'all') {
  const voiceSelect = document.getElementById('setting-voice');
  const voices = langFilter === 'all' 
    ? await browserTTS.getVoices() 
    : await browserTTS.getVoicesForLanguage(langFilter);

  voiceSelect.innerHTML = '';

  if (voices.length === 0 && langFilter !== 'all') {
    const langObj = getLanguageByCode(langFilter);
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = `No compatible browser voice is available for ${langObj.name}`;
    emptyOpt.disabled = true;
    voiceSelect.appendChild(emptyOpt);

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Default System Voice';
    defaultOpt.selected = true;
    voiceSelect.appendChild(defaultOpt);
  } else {
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Default System Voice';
    voiceSelect.appendChild(defaultOpt);

    voices.forEach((voice) => {
      const opt = document.createElement('option');
      opt.value = voice.voiceURI || voice.name;
      opt.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — System Default' : ''}`;
      if (opt.value === currentSettings.voice) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });
  }
}

function updateFormatCards(selectedFmt) {
  const m4aSupported = isM4ASupported();
  const m4aSelectOption = document.querySelector('#setting-format option[value="M4A"]');
  if (m4aSelectOption && !m4aSupported) {
    m4aSelectOption.disabled = true;
    m4aSelectOption.textContent = 'M4A — MPEG-4 AAC (Unsupported in this browser)';
  }

  document.querySelectorAll('.format-card').forEach((card) => {
    const fmt = card.dataset.fmt;
    if (fmt === 'M4A' && !m4aSupported) {
      card.classList.add('disabled');
      card.setAttribute('title', 'M4A is unavailable in this browser. Available formats: MP3, WAV');
    }
    if (fmt === selectedFmt) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

function toggleApiConfigVisibility(show) {
  const apiBox = document.getElementById('api-config-block');
  apiBox.style.display = show ? 'flex' : 'none';
}

function setupEventListeners() {
  // Sliders feedback
  document.getElementById('setting-speed').addEventListener('input', (e) => {
    document.getElementById('val-speed').textContent = `${e.target.value}x`;
  });

  document.getElementById('setting-pitch').addEventListener('input', (e) => {
    document.getElementById('val-pitch').textContent = `${e.target.value}`;
  });

  document.getElementById('setting-volume').addEventListener('input', (e) => {
    document.getElementById('val-volume').textContent = `${Math.round(e.target.value * 100)}%`;
  });

  // Voice filter dropdown
  document.getElementById('setting-voice-filter').addEventListener('change', async (e) => {
    await populateVoices(e.target.value);
  });

  // Format cards click
  document.querySelectorAll('.format-card').forEach((card) => {
    card.addEventListener('click', () => {
      const fmt = card.dataset.fmt;
      document.getElementById('setting-format').value = fmt;
      updateFormatCards(fmt);
    });
  });

  document.getElementById('setting-format').addEventListener('change', (e) => {
    updateFormatCards(e.target.value);
  });

  // Demo mode toggle
  document.getElementById('setting-demomode').addEventListener('change', (e) => {
    toggleApiConfigVisibility(!e.target.checked);
  });

  // Sidebar navigation active state toggle
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Automatic voice re-enumeration when browser finishes loading voices
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', async () => {
      const filter = document.getElementById('setting-voice-filter')?.value || 'all';
      await populateVoices(filter);
    });
  }

  // Test voice button (plays greeting in filtered/selected language)
  const btnTestVoice = document.getElementById('btn-test-voice');
  btnTestVoice.addEventListener('click', async () => {
    if (browserTTS.isSpeaking) {
      browserTTS.stop();
      btnTestVoice.textContent = '🔊 Test Voice';
      return;
    }

    btnTestVoice.textContent = '■ Stop Test';
    browserTTS.onEnd = () => { btnTestVoice.textContent = '🔊 Test Voice'; };
    browserTTS.onError = () => { btnTestVoice.textContent = '🔊 Test Voice'; };

    const selectedVoice = document.getElementById('setting-voice').value;
    const filterLang = document.getElementById('setting-voice-filter').value;
    const myLang = document.getElementById('setting-mylanguage').value;
    const langToSpeak = filterLang !== 'all' ? filterLang : myLang;

    const greeting = TEST_GREETINGS[langToSpeak] || TEST_GREETINGS['en'];
    const speed = parseFloat(document.getElementById('setting-speed').value);
    const pitch = parseFloat(document.getElementById('setting-pitch').value);
    const volume = parseFloat(document.getElementById('setting-volume').value);

    await browserTTS.speak(greeting, {
      language: langToSpeak,
      voiceURI: selectedVoice,
      rate: speed,
      pitch: pitch,
      volume: volume
    });
  });

  // Save changes
  document.getElementById('btn-save').addEventListener('click', async () => {
    const updated = {
      enabled: document.getElementById('setting-enabled').checked,
      autoInject: document.getElementById('setting-autoinject').checked,
      readCodeBlocks: document.getElementById('setting-readcode').checked,
      myLanguage: document.getElementById('setting-mylanguage').value,
      languageMode: document.getElementById('setting-langmode').value,
      defaultTargetLanguage: document.getElementById('setting-mylanguage').value,
      translationProvider: document.getElementById('setting-transprovider').value,
      voice: document.getElementById('setting-voice').value,
      speed: parseFloat(document.getElementById('setting-speed').value),
      pitch: parseFloat(document.getElementById('setting-pitch').value),
      volume: parseFloat(document.getElementById('setting-volume').value),
      preferredFormat: document.getElementById('setting-format').value,
      demoMode: document.getElementById('setting-demomode').checked,
      llmProvider: document.getElementById('setting-llmprovider').value,
      llmApiKey: document.getElementById('setting-llmapikey').value.trim(),
      ttsProvider: document.getElementById('setting-ttsprovider').value,
      ttsApiKey: document.getElementById('setting-ttsapikey').value.trim()
    };

    await SettingsStore.saveSettings(updated);
    showToast();
  });

  // Reset to defaults
  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (confirm('Reset all VoiceSave AI settings to factory defaults?')) {
      await SettingsStore.saveSettings(DEFAULT_SETTINGS);
      await loadAndBindSettings();
      showToast('Settings reset to defaults');
    }
  });
}

function showToast(msg = '✓ Settings saved successfully') {
  const toast = document.getElementById('save-toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}
