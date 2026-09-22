/**
 * VoiceSave AI - Interactive Desktop Simulator & Studio Logic
 * Visual Source of Truth: Stitch Project 12503820058086942140
 * Handles Unified Acoustic Workspace (Home), Live Host Simulator (AI Responses),
 * Long Script Studio, Recordings Archive, Languages & Voices Catalog, and Options Hub.
 */

import { DemoLLMProvider } from '../llm/demo-provider.js';
import { ToolbarInjector } from '../content/injector.js';
import { GenericAdapter } from '../content/providers/generic.js';
import { ResponseObserver } from '../content/observer.js';
import { TTSManager } from '../tts/tts-manager.js';
import { TranslationManager } from '../translation/translation-manager.js';
import { SettingsStore, DEFAULT_SETTINGS } from '../storage/settings.js';
import { encodeAudio } from '../audio/encoder.js';
import { downloadBlob } from '../utils/download.js';
import { generateAudioFilename } from '../utils/format.js';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../language/languages.js';

const llm = new DemoLLMProvider();
let activePlatform = 'claude';
let ttsManager = null;
let translationManager = null;
let settings = null;
let activeHomeLanguage = 'ta';
let activeHomeEncoding = 'MP3';
let isMasterPlaying = false;
let masterPlaybackTimer = null;
let masterSecondsElapsed = 24;
const MASTER_TOTAL_SECONDS = 102; // 01:42

// Initialize adapter and injector for demo page
const demoAdapter = new GenericAdapter();
const injector = new ToolbarInjector(demoAdapter);
const observer = new ResponseObserver(demoAdapter, injector, { debounceMs: 150 });

document.addEventListener('DOMContentLoaded', async () => {
  settings = await SettingsStore.getSettings();
  ttsManager = new TTSManager(settings);
  translationManager = new TranslationManager(settings);

  await injector.init();
  observer.start();

  // Inject into initial assistant turn if present
  const initialAssistantMsg = document.querySelector('.message.assistant-turn .message-body');
  if (initialAssistantMsg) {
    await injector.inject(initialAssistantMsg);
  }

  setupViewNavigation();
  setupHomeControls();
  setupSimulatorControls();
  setupStudioControls();
  setupRecordingsControls();
  setupLanguagesControls();
  setupSettingsControls();
  setupGlobalShortcuts();
});

// ========================================================
// 1. SIDEBAR VIEW NAVIGATION
// ========================================================
function setupViewNavigation() {
  const sidebarLinks = document.querySelectorAll('.sidebar-nav .sidebar-link');
  const views = document.querySelectorAll('.workspace-view');

  sidebarLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetViewId = link.dataset.view;
      if (!targetViewId) return;

      sidebarLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      views.forEach((v) => {
        if (v.id === targetViewId) {
          v.classList.add('active');
        } else {
          v.classList.remove('active');
        }
      });

      // Scroll workspace to top on view change
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Topbar Quick Ask button switches to AI Responses simulator
  const btnQuickAsk = document.getElementById('btn-quick-ask');
  if (btnQuickAsk) {
    btnQuickAsk.addEventListener('click', () => {
      const navAi = document.getElementById('nav-ai-responses');
      if (navAi) navAi.click();
      const input = document.getElementById('demo-user-input');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
}

// ========================================================
// 2. VIEW 1: HOME — UNIFIED ACOUSTIC WORKSPACE (13769d3c)
// ========================================================
function setupHomeControls() {
  const tabAi = document.getElementById('tab-source-ai');
  const tabCustom = document.getElementById('tab-source-custom');
  const homeDocTitle = document.getElementById('home-doc-title');
  const homeDocBody = document.getElementById('home-doc-body');
  const btnSpeakEn = document.getElementById('btn-home-speak-en');
  const btnTranslateTa = document.getElementById('btn-home-translate-ta');
  const btnVoiceAnnotation = document.getElementById('btn-home-voice-annotation');
  const toggleDrawer = document.getElementById('toggle-translation-drawer');
  const drawerChevron = document.getElementById('drawer-chevron');
  const drawer = document.getElementById('translation-drawer');
  const btnCopyContent = document.getElementById('btn-copy-raw-content');
  const btnReloadContent = document.getElementById('btn-reload-content');

  // Synthesis Desk Controls
  const langChips = document.querySelectorAll('#home-lang-chips .lang-chip');
  const activeDialectLabel = document.getElementById('active-dialect-label');
  const timbreName = document.getElementById('home-timbre-name');
  const timbreDesc = document.getElementById('home-timbre-desc');
  const btnAuditionVoice = document.getElementById('btn-home-audition-voice');
  const encodingRadios = document.querySelectorAll('input[name="home-encoding"]');
  const inputPacing = document.getElementById('input-pacing');
  const pacingVal = document.getElementById('pacing-val');
  const inputPitch = document.getElementById('input-pitch');
  const pitchVal = document.getElementById('pitch-val');
  const btnHomeSpeakSynthesize = document.getElementById('btn-home-speak-synthesize');
  const btnHomeRecordMic = document.getElementById('btn-home-record-mic');

  // Master Obsidian Player Controls
  const btnMasterPlayPause = document.getElementById('btn-master-play-pause');
  const masterPlayIcon = document.getElementById('master-play-icon');
  const masterCurrentTime = document.getElementById('master-current-time');
  const masterFormatTag = document.getElementById('master-format-tag');
  const btnMasterDownload = document.getElementById('btn-master-download');
  const btnMasterReplay = document.getElementById('btn-master-replay');
  const btnMasterFwd = document.getElementById('btn-master-fwd');
  const masterBars = document.querySelectorAll('#master-waveform-bars .wbar');

  const TIMBRES = {
    ta: { name: 'Subhashini', desc: 'Natural Female · IndicNeural Warmth', phrase: 'வணக்கம்! வாய்ஸ்சேவ் ஏஐ தொழில்நுட்பத்திற்கு நல்வரவு.' },
    hi: { name: 'Aarav & Swara', desc: 'Neural Balanced · Devanagari Cadence', phrase: 'नमस्ते! वॉइससेव एआई में आपका स्वागत है।' },
    te: { name: 'Chaitanya', desc: 'Warm Resonance · Telugu Dravidian', phrase: 'నమస్కారం! వాయిస్ సేవ్ ఏఐ కి స్వాగతం.' },
    kn: { name: 'Mallikarjun', desc: 'Clear Articulation · Kannada Phonetic', phrase: 'ನಮಸ್ಕಾರ! ವಾಯ್ಸ್ ಸೇವ್ ಎಐ ಗೆ ಸ್ವಾಗತ.' },
    en: { name: 'Christopher & Emma', desc: 'Oxford Studio · Neutral Global', phrase: 'Welcome to VoiceSave AI. Your universal acoustic layer.' }
  };

  // Source Toggle
  if (tabAi && tabCustom) {
    tabAi.addEventListener('click', () => {
      tabAi.classList.add('active');
      tabCustom.classList.remove('active');
      if (homeDocTitle) homeDocTitle.textContent = 'The Architectural Difference Between Monolithic and Distributed Microservices';
    });
    tabCustom.addEventListener('click', () => {
      tabCustom.classList.add('active');
      tabAi.classList.remove('active');
      if (homeDocTitle) homeDocTitle.textContent = 'Custom Authored Script & Lecture Notes';
    });
  }

  // Copy Content
  if (btnCopyContent) {
    btnCopyContent.addEventListener('click', async () => {
      const text = homeDocBody ? homeDocBody.innerText : '';
      await navigator.clipboard.writeText(text);
      showToast('✓ Content markdown copied to clipboard');
    });
  }

  // Reload Content
  if (btnReloadContent) {
    btnReloadContent.addEventListener('click', () => {
      showToast('↻ Ingest buffer refreshed from DOM Hook');
    });
  }

  // Phonetic Drawer Toggle
  if (toggleDrawer && drawer) {
    toggleDrawer.addEventListener('click', () => {
      const isHidden = drawer.style.display === 'none';
      drawer.style.display = isHidden ? 'flex' : 'none';
      if (drawerChevron) {
        drawerChevron.classList.toggle('rotated', isHidden);
      }
    });
  }

  // Quick Action: Speak Original (EN)
  if (btnSpeakEn) {
    btnSpeakEn.addEventListener('click', async () => {
      const text = 'At its core, a monolithic architecture consolidates computation and memory into a single address space.';
      btnSpeakEn.disabled = true;
      btnSpeakEn.innerHTML = '<span class="material-symbols-outlined">volume_up</span><span>Speaking...</span>';
      try {
        await ttsManager.speak({
          text,
          language: 'en',
          onEnd: () => {
            btnSpeakEn.disabled = false;
            btnSpeakEn.innerHTML = '<span class="material-symbols-outlined">play_circle</span><span>Speak Original (EN)</span>';
          }
        });
      } catch (err) {
        console.error(err);
        btnSpeakEn.disabled = false;
        btnSpeakEn.innerHTML = '<span class="material-symbols-outlined">play_circle</span><span>Speak Original (EN)</span>';
      }
    });
  }

  // Quick Action: Translate & Synthesize (TA)
  if (btnTranslateTa) {
    btnTranslateTa.addEventListener('click', async () => {
      const text = 'அடிப்படையில், ஒரு மோனோலிதிக் கட்டமைப்பானது நினைவக தாமதங்களை முற்றிலும் நீக்குகிறது.';
      btnTranslateTa.disabled = true;
      btnTranslateTa.innerHTML = '<span class="material-symbols-outlined">volume_up</span><span>Synthesizing (TA)...</span>';
      try {
        await ttsManager.speak({
          text,
          language: 'ta',
          onEnd: () => {
            btnTranslateTa.disabled = false;
            btnTranslateTa.innerHTML = '<span class="material-symbols-outlined">translate</span><span>Translate & Synthesize (TA)</span>';
          }
        });
      } catch (err) {
        console.error(err);
        btnTranslateTa.disabled = false;
        btnTranslateTa.innerHTML = '<span class="material-symbols-outlined">translate</span><span>Translate & Synthesize (TA)</span>';
      }
    });
  }

  // Voice Annotation
  if (btnVoiceAnnotation) {
    btnVoiceAnnotation.addEventListener('click', () => {
      showToast('🎤 Voice Annotation mic active — speaking note attached to buffer');
    });
  }

  // Language Chips
  langChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      langChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeHomeLanguage = chip.dataset.lang || 'ta';

      const t = TIMBRES[activeHomeLanguage] || TIMBRES.ta;
      if (activeDialectLabel) {
        activeDialectLabel.textContent = `Active: ${chip.textContent}`;
      }
      if (timbreName) timbreName.textContent = t.name;
      if (timbreDesc) timbreDesc.textContent = t.desc;

      const masterSub = document.getElementById('master-player-sub');
      if (masterSub) {
        masterSub.textContent = `${t.name} IndicNeural · 48kHz ${activeHomeEncoding}`;
      }
    });
  });

  // Timbre Audition Button
  if (btnAuditionVoice) {
    btnAuditionVoice.addEventListener('click', async () => {
      const t = TIMBRES[activeHomeLanguage] || TIMBRES.ta;
      btnAuditionVoice.innerHTML = '<span class="material-symbols-outlined">graphic_eq</span>';
      try {
        await ttsManager.speak({
          text: t.phrase,
          language: activeHomeLanguage,
          onEnd: () => {
            btnAuditionVoice.innerHTML = '<span class="material-symbols-outlined">play_circle</span>';
          }
        });
      } catch (err) {
        console.error(err);
        btnAuditionVoice.innerHTML = '<span class="material-symbols-outlined">play_circle</span>';
      }
    });
  }

  // Encoding Radio Buttons
  encodingRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      activeHomeEncoding = radio.value;
      document.querySelectorAll('.encoding-radio-card').forEach((card) => {
        card.classList.toggle('active', card.contains(radio));
      });
      if (masterFormatTag) {
        masterFormatTag.textContent = activeHomeEncoding === 'WAV' ? '48kHz · Lossless PCM' : (activeHomeEncoding === 'M4A' ? 'Apple AAC' : '320kbps · MP3 CBR');
      }
    });
  });

  // Pacing & Pitch Sliders
  if (inputPacing && pacingVal) {
    inputPacing.addEventListener('input', () => {
      const val = parseFloat(inputPacing.value).toFixed(2);
      pacingVal.textContent = `${val}x (${val == 1.0 ? 'Natural' : val > 1 ? 'Swift' : 'Deliberate'})`;
      settings.speed = parseFloat(val);
    });
  }

  if (inputPitch && pitchVal) {
    inputPitch.addEventListener('input', () => {
      const val = parseInt(inputPitch.value, 10);
      const sign = val > 0 ? `+${val}` : `${val}`;
      pitchVal.textContent = `${sign} ST (${val === 0 ? 'Rich Neutral' : val > 0 ? 'Bright' : 'Deep'})`;
      settings.pitch = 1.0 + (val * 0.05);
    });
  }

  // Dominant Action: Speak & Synthesize Audio
  if (btnHomeSpeakSynthesize) {
    btnHomeSpeakSynthesize.addEventListener('click', async () => {
      btnHomeSpeakSynthesize.disabled = true;
      const orig = btnHomeSpeakSynthesize.innerHTML;
      btnHomeSpeakSynthesize.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span><span>Synthesizing Full Stream...</span>';

      try {
        const text = homeDocBody ? homeDocBody.innerText : 'VoiceSave AI high quality audio synthesis.';
        const canonical = await ttsManager.generateCanonicalSpeech({
          text,
          language: activeHomeLanguage
        });

        // Trigger Master Player Playback
        startMasterPlayback();
        showToast(`✓ Master synthesized in ${activeHomeLanguage.toUpperCase()} (${(canonical.duration || 102).toFixed(0)}s)`);

        btnHomeSpeakSynthesize.disabled = false;
        btnHomeSpeakSynthesize.innerHTML = orig;
      } catch (err) {
        console.error(err);
        showToast('✖ Synthesis encountered an issue');
        btnHomeSpeakSynthesize.disabled = false;
        btnHomeSpeakSynthesize.innerHTML = orig;
      }
    });
  }

  // Record Live Mic Annotation
  if (btnHomeRecordMic) {
    btnHomeRecordMic.addEventListener('click', () => {
      showToast('🔴 Recording live mic audio into acoustic buffer...');
    });
  }

  // Master Obsidian Player Play/Pause
  if (btnMasterPlayPause) {
    btnMasterPlayPause.addEventListener('click', () => {
      if (isMasterPlaying) {
        pauseMasterPlayback();
      } else {
        startMasterPlayback();
      }
    });
  }

  // Master Scrubber Waveform Click Seeking
  masterBars.forEach((bar, index) => {
    bar.addEventListener('click', () => {
      masterSecondsElapsed = Math.round((index / masterBars.length) * MASTER_TOTAL_SECONDS);
      updateMasterTimelineUI();
    });
  });

  if (btnMasterReplay) {
    btnMasterReplay.addEventListener('click', () => {
      masterSecondsElapsed = Math.max(0, masterSecondsElapsed - 10);
      updateMasterTimelineUI();
    });
  }

  if (btnMasterFwd) {
    btnMasterFwd.addEventListener('click', () => {
      masterSecondsElapsed = Math.min(MASTER_TOTAL_SECONDS, masterSecondsElapsed + 30);
      updateMasterTimelineUI();
    });
  }

  // Download Master Audio
  if (btnMasterDownload) {
    btnMasterDownload.addEventListener('click', async () => {
      btnMasterDownload.disabled = true;
      const origHtml = btnMasterDownload.innerHTML;
      btnMasterDownload.innerHTML = '<span>⏳ Exporting...</span>';

      try {
        const text = homeDocBody ? homeDocBody.innerText : 'VoiceSave AI Master Track';
        const canonical = await ttsManager.generateCanonicalSpeech({
          text,
          language: activeHomeLanguage
        });
        const encoded = await encodeAudio(canonical.audioBuffer, activeHomeEncoding);
        const filename = generateAudioFilename('monolith-vs-microservices', activeHomeLanguage, encoded.extension);
        await downloadBlob(encoded.blob, filename);

        btnMasterDownload.innerHTML = '<span>✓ Saved</span>';
        showToast(`✓ Master audio downloaded: ${filename}`);
        setTimeout(() => {
          btnMasterDownload.disabled = false;
          btnMasterDownload.innerHTML = origHtml;
        }, 2500);
      } catch (err) {
        console.error('Master download error:', err);
        btnMasterDownload.innerHTML = '<span>✖ Error</span>';
        setTimeout(() => {
          btnMasterDownload.disabled = false;
          btnMasterDownload.innerHTML = origHtml;
        }, 2000);
      }
    });
  }

  function startMasterPlayback() {
    isMasterPlaying = true;
    if (masterPlayIcon) masterPlayIcon.textContent = 'pause';
    clearInterval(masterPlaybackTimer);

    masterPlaybackTimer = setInterval(() => {
      masterSecondsElapsed++;
      if (masterSecondsElapsed >= MASTER_TOTAL_SECONDS) {
        masterSecondsElapsed = 0;
        pauseMasterPlayback();
      }
      updateMasterTimelineUI();
    }, 1000);
  }

  function pauseMasterPlayback() {
    isMasterPlaying = false;
    if (masterPlayIcon) masterPlayIcon.textContent = 'play_arrow';
    clearInterval(masterPlaybackTimer);
  }

  function updateMasterTimelineUI() {
    const mins = String(Math.floor(masterSecondsElapsed / 60)).padStart(2, '0');
    const secs = String(masterSecondsElapsed % 60).padStart(2, '0');
    if (masterCurrentTime) {
      masterCurrentTime.textContent = `${mins}:${secs}`;
    }

    const activeBarCount = Math.round((masterSecondsElapsed / MASTER_TOTAL_SECONDS) * masterBars.length);
    masterBars.forEach((bar, idx) => {
      bar.classList.toggle('active', idx < activeBarCount);
    });
  }
}

// ========================================================
// 3. VIEW 2: AI RESPONSES — LIVE HOST SIMULATOR (85639a4d)
// ========================================================
function setupSimulatorControls() {
  const tabs = document.querySelectorAll('.host-tab-btn');
  const platformName = document.getElementById('platform-name');
  const platformIcon = document.getElementById('platform-icon');
  const hostUrl = document.getElementById('host-url');
  const companionSourceTag = document.getElementById('companion-source-tag');
  const input = document.getElementById('demo-user-input');
  const btnSend = document.getElementById('btn-demo-send');
  const btnSplit = document.getElementById('btn-split');
  const btnFull = document.getElementById('btn-full');
  const simulatorLayout = document.getElementById('simulator-layout');
  const btnCompanionDownload = document.getElementById('btn-companion-download');

  const PLATFORMS = {
    claude: { name: 'Claude 3.5 Sonnet', icon: 'CLA', url: 'https://claude.ai/chat/c-89419b-acoustic-arch' },
    chatgpt: { name: 'ChatGPT 4o', icon: 'GPT', url: 'https://chatgpt.com/c/6789-voice-acoustic' },
    perplexity: { name: 'Perplexity Pro', icon: 'PPLX', url: 'https://www.perplexity.ai/search/acoustic-arch' },
    gemini: { name: 'Gemini Advanced', icon: 'GEM', url: 'https://gemini.google.com/app/c894-audio' }
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activePlatform = tab.dataset.platform;

      const p = PLATFORMS[activePlatform] || PLATFORMS.claude;
      if (platformName) platformName.textContent = p.name;
      if (platformIcon) platformIcon.textContent = p.icon;
      if (hostUrl) hostUrl.textContent = p.url;
      if (companionSourceTag) companionSourceTag.textContent = p.url.replace('https://', '');
    });
  });

  if (btnSplit && btnFull && simulatorLayout) {
    btnSplit.addEventListener('click', () => {
      btnSplit.classList.add('active');
      btnFull.classList.remove('active');
      simulatorLayout.classList.remove('full-layout');
    });

    btnFull.addEventListener('click', () => {
      btnFull.classList.add('active');
      btnSplit.classList.remove('active');
      simulatorLayout.classList.add('full-layout');
    });
  }

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.query;
      const targetLang = btn.dataset.lang || 'ta';
      sendMessage(targetLang);
    });
  });

  if (btnSend && input) {
    btnSend.addEventListener('click', () => sendMessage());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  if (btnCompanionDownload) {
    btnCompanionDownload.addEventListener('click', async () => {
      btnCompanionDownload.innerHTML = '<span>⏳ Downloading...</span>';
      try {
        const text = 'Architectural difference between Monolithic and Distributed Microservices, focusing on latency bottlenecks.';
        const canonical = await ttsManager.generateCanonicalSpeech({ text, language: 'ta' });
        const encoded = await encodeAudio(canonical.audioBuffer, 'MP3');
        const filename = generateAudioFilename('monolith-vs-microservices', 'ta', 'mp3');
        await downloadBlob(encoded.blob, filename);
        btnCompanionDownload.innerHTML = '<span>✓ Master MP3 Downloaded</span>';
        showToast(`✓ Master audio saved: ${filename}`);
        setTimeout(() => {
          btnCompanionDownload.innerHTML = `
            <span class="material-symbols-outlined">download</span>
            <span>Download Master MP3 (320k)</span>
          `;
        }, 2500);
      } catch (err) {
        console.error('Companion download failed:', err);
        btnCompanionDownload.innerHTML = '<span>✖ Download failed</span>';
        setTimeout(() => {
          btnCompanionDownload.innerHTML = `
            <span class="material-symbols-outlined">download</span>
            <span>Download Master MP3 (320k)</span>
          `;
        }, 2000);
      }
    });
  }

  async function sendMessage(targetLanguage = null) {
    if (!input) return;
    const query = input.value.trim();
    if (!query) return;

    input.value = '';
    btnSend.disabled = true;

    const messagesList = document.getElementById('messages-list');
    const p = PLATFORMS[activePlatform] || PLATFORMS.claude;

    // 1. User turn
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-turn';
    userMsg.innerHTML = `
      <div class="avatar user-avatar">You</div>
      <div class="message-body">
        <div class="message-text">${escapeHtml(query)}</div>
      </div>
    `;
    messagesList.appendChild(userMsg);
    messagesList.scrollTop = messagesList.scrollHeight;

    // 2. Assistant turn
    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'message assistant-turn';
    assistantMsg.setAttribute('data-ai-response', 'true');
    assistantMsg.setAttribute('data-message-author-role', 'assistant');
    assistantMsg.setAttribute('data-is-streaming', 'true');

    assistantMsg.innerHTML = `
      <div class="avatar ai-avatar">${p.icon}</div>
      <div class="message-body">
        <div class="assistant-meta-row">
          <span class="assistant-model-title">${p.name}</span>
          <span class="assistant-status-tag">generating speech stream...</span>
        </div>
        <div class="message-text markdown typing-cursor">Thinking...</div>
      </div>
    `;
    messagesList.appendChild(assistantMsg);
    messagesList.scrollTop = messagesList.scrollHeight;

    const textEl = assistantMsg.querySelector('.message-text');

    // 3. Stream text response
    await llm.ask(query, (word, currentText) => {
      textEl.textContent = currentText;
      messagesList.scrollTop = messagesList.scrollHeight;
    });

    textEl.classList.remove('typing-cursor');
    assistantMsg.removeAttribute('data-is-streaming');
    const statusTag = assistantMsg.querySelector('.assistant-status-tag');
    if (statusTag) statusTag.textContent = 'streaming complete';

    // 4. Inject VoiceSave AI toolbar
    const bodyEl = assistantMsg.querySelector('.message-body');
    await injector.inject(bodyEl);

    if (targetLanguage) {
      const selectEl = bodyEl.querySelector('.voicesave-lang-select');
      if (selectEl) {
        selectEl.value = targetLanguage;
        selectEl.dispatchEvent(new Event('change'));
      }
    }

    messagesList.scrollTop = messagesList.scrollHeight;
    btnSend.disabled = false;
  }
}

// ========================================================
// 4. VIEW 3: SCRIPT TO SPEECH — LONG-FORM STUDIO (b70d8fd1)
// ========================================================
function setupStudioControls() {
  const scriptEditor = document.getElementById('script-editor');
  const statChars = document.getElementById('stat-chars');
  const statWords = document.getElementById('stat-words');
  const btnClearScript = document.getElementById('btn-clear-script');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnImportScript = document.getElementById('btn-import-script');
  const btnSynthesizeStudio = document.getElementById('btn-synthesize-studio');
  const btnStudioDownload = document.getElementById('btn-studio-download');
  const studioLangSelect = document.getElementById('studio-language-select');
  const studioFormatSelect = document.getElementById('studio-format-select');

  function updateEditorStats() {
    if (!scriptEditor) return;
    const text = scriptEditor.value;
    if (statChars) statChars.textContent = text.length.toLocaleString();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (statWords) statWords.textContent = words.toLocaleString();
  }

  if (scriptEditor) {
    scriptEditor.addEventListener('input', updateEditorStats);
    updateEditorStats();
  }

  document.querySelectorAll('.ssml-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const directive = btn.dataset.directive;
      if (!directive || !scriptEditor) return;

      const start = scriptEditor.selectionStart;
      const end = scriptEditor.selectionEnd;
      const val = scriptEditor.value;
      scriptEditor.value = val.substring(0, start) + '\n' + directive + '\n' + val.substring(end);
      scriptEditor.selectionStart = scriptEditor.selectionEnd = start + directive.length + 2;
      scriptEditor.focus();
      updateEditorStats();
    });
  });

  if (btnClearScript && scriptEditor) {
    btnClearScript.addEventListener('click', () => {
      scriptEditor.value = '';
      updateEditorStats();
      scriptEditor.focus();
    });
  }

  if (btnLoadSample && scriptEditor) {
    btnLoadSample.addEventListener('click', () => {
      scriptEditor.value = `# Section I: The Paradigm of Edge Acoustic Latency

Modern neural text-to-speech architectures rely on low-parameter quantized decoders running directly on device client threads. By decoupling synthesis from remote server round-trips, perceived vocal onset latency drops from 850 milliseconds down to sub-45 milliseconds.

[pause: 0.5s]

When executing large multilingual prompt scripts across languages such as Tamil (தமிழ்), Hindi (हिन्दी), Telugu (తెలుగు), and Kannada (ಕನ್ನಡ), phonetic preservation of technical terms remains essential. VoiceSave AI protects specialized symbols and ensures smooth natural prosody across all decoded chunks.`;
      updateEditorStats();
      showToast('✓ Technical lecture template loaded into studio');
    });
  }

  if (btnImportScript) {
    btnImportScript.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (scriptEditor) {
              scriptEditor.value = evt.target.result;
              updateEditorStats();
              showToast(`✓ Imported ${file.name}`);
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });
  }

  async function triggerStudioSynthesis(btn) {
    if (!scriptEditor) return;
    const text = scriptEditor.value.trim();
    if (!text) {
      alert('Please enter or load a script before synthesizing.');
      scriptEditor.focus();
      return;
    }

    const lang = studioLangSelect ? studioLangSelect.value : 'ta';
    const format = studioFormatSelect ? studioFormatSelect.value : 'MP3';

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span>⏳ Synthesizing Audio Chunks...</span>';

    try {
      const canonical = await ttsManager.generateCanonicalSpeech({ text, language: lang });
      const encoded = await encodeAudio(canonical.audioBuffer, format);
      const filename = generateAudioFilename('studio-lecture', lang, encoded.extension);
      await downloadBlob(encoded.blob, filename);

      btn.innerHTML = '<span>✓ Download Complete</span>';
      showToast(`✓ Studio synthesis complete: ${filename}`);
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }, 3000);
    } catch (err) {
      console.error('Studio synthesis failed:', err);
      btn.innerHTML = '<span>✖ Synthesis Error</span>';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }, 2500);
    }
  }

  if (btnSynthesizeStudio) {
    btnSynthesizeStudio.addEventListener('click', () => triggerStudioSynthesis(btnSynthesizeStudio));
  }
  if (btnStudioDownload) {
    btnStudioDownload.addEventListener('click', () => triggerStudioSynthesis(btnStudioDownload));
  }
}

// ========================================================
// 5. VIEW 4: RECORDINGS ARCHIVE (3c2e6046)
// ========================================================
function setupRecordingsControls() {
  const container = document.getElementById('recordingListContainer');
  const searchInput = document.getElementById('archiveSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  const filterChips = document.querySelectorAll('.archive-filter-chips .archive-chip');

  const DEMO_RECORDINGS = [
    {
      id: 'rec-1',
      title: 'SSD Explanation & Flash Architecture',
      language: 'ta',
      langName: 'Tamil — தமிழ்',
      format: 'MP3',
      duration: '00:08',
      model: 'ChatGPT 4o',
      text: 'எஸ்எஸ்டி என்பது சாலிட் ஸ்டேட் டிரைவ் ஆகும். இது விரைவான தரவு மீட்டெடுப்பு வேகத்தை வழங்குகிறது.',
      dateGroup: 'Today'
    },
    {
      id: 'rec-2',
      title: 'Java Polymorphism & Method Overriding',
      language: 'hi',
      langName: 'Hindi — हिन्दी',
      format: 'WAV',
      duration: '00:12',
      model: 'Claude 3.5 Sonnet',
      text: 'पॉलीमॉर्फिज्म का अर्थ है कई रूप धारण करना। यह उप-वर्गों को अपने विशिष्ट तरीके से व्यवहार करने की अनुमति देता है।',
      dateGroup: 'Today'
    },
    {
      id: 'rec-3',
      title: 'Cloud Computing Scalability & Latency',
      language: 'te',
      langName: 'Telugu — తెలుగు',
      format: 'MP3',
      duration: '00:15',
      model: 'Perplexity AI',
      text: 'క్లౌడ్ కంప్యూటింగ్ అనేది ఇంటర్నెట్ ద్వారా కంప్యూటింగ్ సేవలను అందించే ప్రక్రియ.',
      dateGroup: 'Yesterday'
    },
    {
      id: 'rec-4',
      title: 'Quantum Computing Superposition Principles',
      language: 'en',
      langName: 'English (US)',
      format: 'MP3',
      duration: '00:10',
      model: 'Gemini Advanced',
      text: 'Quantum computing exploits principles of superposition and entanglement to solve intractable computations.',
      dateGroup: 'Yesterday'
    }
  ];

  let currentFilter = 'all';
  let searchQuery = '';

  function renderRecordings() {
    if (!container) return;
    container.innerHTML = '';

    const filtered = DEMO_RECORDINGS.filter((item) => {
      const matchFilter = currentFilter === 'all' || item.language === currentFilter;
      const matchSearch = !searchQuery ||
        item.title.toLowerCase().includes(searchQuery) ||
        item.langName.toLowerCase().includes(searchQuery) ||
        item.model.toLowerCase().includes(searchQuery);
      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--vs-secondary); font-size: 14px;">
          No recordings matched your filter or search query.
        </div>
      `;
      return;
    }

    // Group by DateGroup
    const groups = {};
    filtered.forEach((item) => {
      if (!groups[item.dateGroup]) groups[item.dateGroup] = [];
      groups[item.dateGroup].push(item);
    });

    Object.keys(groups).forEach((dateGroup) => {
      const groupEl = document.createElement('section');
      groupEl.className = 'recording-date-group';

      groupEl.innerHTML = `
        <div class="date-group-header">
          <span class="date-group-title">${dateGroup}</span>
          <span class="date-group-count">${groups[dateGroup].length} file${groups[dateGroup].length > 1 ? 's' : ''}</span>
        </div>
      `;

      groups[dateGroup].forEach((item) => {
        const card = document.createElement('article');
        card.className = 'recording-card';
        card.innerHTML = `
          <div class="card-top-row">
            <div>
              <h3 class="rec-title">${escapeHtml(item.title)}</h3>
              <div class="rec-meta-tags">
                <span class="rec-lang-pill">${item.langName}</span>
                <span>·</span>
                <span>${item.format}</span>
                <span>·</span>
                <span class="font-mono">${item.duration}</span>
                <span>·</span>
                <span>${item.model}</span>
              </div>
            </div>
            <button class="btn-icon" title="More options" type="button">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
          </div>

          <div class="rec-player-bar">
            <button class="rec-play-btn" data-id="${item.id}" type="button" title="Play recording">
              <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <div class="rec-waveform-progress">
              <div class="rec-bars-row">
                <span class="rbar active" style="height: 60%"></span>
                <span class="rbar active" style="height: 80%"></span>
                <span class="rbar active" style="height: 100%"></span>
                <span class="rbar active" style="height: 70%"></span>
                <span class="rbar active" style="height: 40%"></span>
                <span class="rbar" style="height: 80%"></span>
                <span class="rbar" style="height: 50%"></span>
                <span class="rbar" style="height: 90%"></span>
                <span class="rbar" style="height: 60%"></span>
                <span class="rbar" style="height: 40%"></span>
                <span class="rbar" style="height: 70%"></span>
                <span class="rbar" style="height: 30%"></span>
              </div>
              <div class="rec-time-row">
                <span>00:02</span>
                <span>${item.duration}</span>
              </div>
            </div>
            <button class="btn-rec-download" data-id="${item.id}" type="button" title="Download Audio">
              <span class="material-symbols-outlined">download</span>
              <span>${item.format}</span>
            </button>
          </div>
        `;

        // Wire Play
        const playBtn = card.querySelector('.rec-play-btn');
        playBtn.addEventListener('click', async () => {
          playBtn.innerHTML = '<span class="material-symbols-outlined">graphic_eq</span>';
          try {
            await ttsManager.speak({
              text: item.text,
              language: item.language,
              onEnd: () => {
                playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
              }
            });
          } catch (err) {
            console.error(err);
            playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
          }
        });

        // Wire Download
        const dlBtn = card.querySelector('.btn-rec-download');
        dlBtn.addEventListener('click', async () => {
          dlBtn.innerHTML = '<span>⏳</span>';
          try {
            const canonical = await ttsManager.generateCanonicalSpeech({ text: item.text, language: item.language });
            const encoded = await encodeAudio(canonical.audioBuffer, item.format);
            const filename = generateAudioFilename(item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), item.language, encoded.extension);
            await downloadBlob(encoded.blob, filename);
            dlBtn.innerHTML = '<span>✓</span>';
            showToast(`✓ Downloaded: ${filename}`);
            setTimeout(() => {
              dlBtn.innerHTML = `<span class="material-symbols-outlined">download</span><span>${item.format}</span>`;
            }, 2000);
          } catch (err) {
            console.error(err);
            dlBtn.innerHTML = '<span>✖</span>';
          }
        });

        groupEl.appendChild(card);
      });

      container.appendChild(groupEl);
    });
  }

  // Filter Chips
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter || 'all';
      renderRecordings();
    });
  });

  // Search Input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
      renderRecordings();
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.style.display = 'none';
      renderRecordings();
    });
  }

  renderRecordings();
}

// ========================================================
// 6. VIEW 5: LANGUAGES & VOICES (74beb1eb)
// ========================================================
function setupLanguagesControls() {
  const indicContainer = document.getElementById('indicCardsContainer');
  const globalContainer = document.getElementById('globalCardsContainer');
  const searchInput = document.getElementById('languageSearchInput');
  const filterPills = document.querySelectorAll('#langFilterPills .lang-filter-pill');
  const heroAuditionBtn = document.getElementById('heroAuditionBtn');

  const INDIC_DETAILS = [
    { code: 'ta', glyph: 'த', family: 'Dravidian · IndicNeural v4.8 Engine', timbres: ['Subhashini', 'Kural', 'Madurai', 'Priyadharshini'], greeting: 'வணக்கம்! வாய்ஸ்சேவ் ஏஐ.' },
    { code: 'hi', glyph: 'ह', family: 'Indo-Aryan · Devanagari Core v4.8', timbres: ['Aarav', 'Swara', 'Kavya', 'Dhruv'], greeting: 'नमस्ते! वॉइससेव एआई.' },
    { code: 'te', glyph: 'తె', family: 'Dravidian · Andhra Telugina Core', timbres: ['Chaitanya', 'Shruti', 'Sravani'], greeting: 'నమస్కారం! వాయిస్ సేవ్ ఏఐ.' },
    { code: 'kn', glyph: 'ಕ', family: 'Dravidian · Kannada Rashtriya Engine', timbres: ['Mallikarjun', 'Sapna', 'Girish'], greeting: 'ನಮಸ್ಕಾರ! ವಾಯ್ಸ್ ಸೇವ್ ಎಐ.' },
    { code: 'ml', glyph: 'മ', family: 'Dravidian · Kerala Kairali Engine', timbres: ['Ananya', 'Rahul', 'Devika'], greeting: 'നമസ്കാരം! വോയ്സ് സേവ് എഐ.' },
    { code: 'bn', glyph: 'বা', family: 'Indo-Aryan · Bengali Shonar Engine', timbres: ['Tanusree', 'Joy', 'Debasish'], greeting: 'নমস্কার! ভয়েসসেভ এআই.' },
    { code: 'mr', glyph: 'म', family: 'Indo-Aryan · Marathi Sahyadri Engine', timbres: ['Ananya', 'Aarav', 'Nandita'], greeting: 'नमस्कार! व्हॉईससेव्ह एआय.' },
    { code: 'gu', glyph: 'ગુ', family: 'Indo-Aryan · Gujarati Garvi Engine', timbres: ['Nirav', 'Dhwani', 'Hiren'], greeting: 'નમસ્તે! વોઇસસેવ એઆઈ.' },
    { code: 'pa', glyph: 'ਪੰ', family: 'Indo-Aryan · Punjabi Gurmukhi Engine', timbres: ['Harpreet', 'Gurinder'], greeting: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਵਾਇਸਸੇਵ ਏਆਈ.' },
    { code: 'ur', glyph: 'اردو', family: 'Indo-Aryan · Urdu Nastaliq Engine', timbres: ['Tariq', 'Noor', 'Bilal'], greeting: 'آداب! وائس سیو اے آئی.' }
  ];

  const GLOBAL_DETAILS = [
    { code: 'en', glyph: 'A', name: 'English', native: 'English (UK/US)', family: 'Germanic · Universal Global Lingua', timbres: ['Christopher', 'Emma', 'Arthur'], greeting: 'Welcome to VoiceSave AI.' },
    { code: 'es', glyph: 'Ñ', name: 'Spanish', native: 'Español', family: 'Romance · Castilian & Latin Core', timbres: ['Mateo', 'Sofia', 'Alvaro'], greeting: '¡Hola! Bienvenido a VoiceSave AI.' },
    { code: 'fr', glyph: 'É', name: 'French', native: 'Français', family: 'Romance · Parisian Hexagonal Core', timbres: ['Henri', 'Camille', 'Eloise'], greeting: 'Bonjour! Bienvenue sur VoiceSave AI.' },
    { code: 'de', glyph: 'Ö', name: 'German', native: 'Deutsch', family: 'Germanic · Central European Core', timbres: ['Lucas', 'Marlene', 'Hans'], greeting: 'Guten Tag! Willkommen bei VoiceSave AI.' },
    { code: 'ja', glyph: '日', name: 'Japanese', native: '日本語', family: 'Japonic · Tokyo Neural Engine', timbres: ['Takumi', 'Sakura', 'Kenji'], greeting: 'こんにちは！VoiceSave AIへようこそ。' },
    { code: 'zh', glyph: '中', name: 'Chinese', native: '中文 (Mandarin)', family: 'Sino-Tibetan · Beijing Standard', timbres: ['Zhiyu', 'Xiaoxiao', 'Yunxi'], greeting: '你好！欢迎使用 VoiceSave AI。' }
  ];

  function renderCatalog(filter = 'all', query = '') {
    if (indicContainer) indicContainer.innerHTML = '';
    if (globalContainer) globalContainer.innerHTML = '';

    const showIndic = filter === 'all' || filter === 'indic';
    const showGlobal = filter === 'all' || filter === 'global';

    if (showIndic && indicContainer) {
      INDIC_DETAILS.forEach((item) => {
        const langObj = getLanguageByCode(item.code) || { name: item.code, nativeName: item.code };
        if (query && !langObj.name.toLowerCase().includes(query) && !langObj.nativeName.toLowerCase().includes(query)) {
          return;
        }

        const card = document.createElement('article');
        card.className = 'lang-catalog-card';
        card.innerHTML = `
          <div class="lang-card-top">
            <div class="lang-card-ident">
              <div class="lang-glyph-box">${item.glyph}</div>
              <div class="lang-card-names">
                <div class="lang-name-row">
                  <span class="lang-name-en">${langObj.name}</span>
                  <span class="lang-name-native">${langObj.nativeName}</span>
                  ${item.code === 'ta' ? '<span class="default-tag">DEFAULT</span>' : ''}
                </div>
                <span class="lang-card-family">${item.family}</span>
              </div>
            </div>
          </div>

          <div class="timbres-box">
            <div class="timbres-header">
              <span>Available Neural Timbres (${item.timbres.length})</span>
              <span>Phoneme Accuracy: 99.4%</span>
            </div>
            <div class="timbres-grid">
              ${item.timbres.map((t, idx) => `
                <div class="timbre-item">
                  <div class="timbre-left">
                    <button class="timbre-play-btn" data-lang="${item.code}" data-phrase="${escapeHtml(item.greeting)}" title="Audition ${t}" type="button">
                      <span class="material-symbols-outlined">play_arrow</span>
                    </button>
                    <span class="timbre-title">${t}</span>
                  </div>
                  ${idx === 0 ? '<span class="timbre-active-tag">Active</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;

        card.querySelectorAll('.timbre-play-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const langCode = btn.dataset.lang;
            const phrase = btn.dataset.phrase;
            btn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';
            try {
              await ttsManager.speak({
                text: phrase,
                language: langCode,
                onEnd: () => {
                  btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
                }
              });
            } catch (e) {
              btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
            }
          });
        });

        indicContainer.appendChild(card);
      });
    }

    if (showGlobal && globalContainer) {
      GLOBAL_DETAILS.forEach((item) => {
        if (query && !item.name.toLowerCase().includes(query) && !item.native.toLowerCase().includes(query)) {
          return;
        }

        const card = document.createElement('article');
        card.className = 'lang-catalog-card';
        card.innerHTML = `
          <div class="lang-card-top">
            <div class="lang-card-ident">
              <div class="lang-glyph-box">${item.glyph}</div>
              <div class="lang-card-names">
                <div class="lang-name-row">
                  <span class="lang-name-en">${item.name}</span>
                  <span class="lang-name-native">${item.native}</span>
                </div>
                <span class="lang-card-family">${item.family}</span>
              </div>
            </div>
          </div>

          <div class="timbres-box">
            <div class="timbres-header">
              <span>Neural Timbres (${item.timbres.length})</span>
              <span>HD 48kHz Studio</span>
            </div>
            <div class="timbres-grid">
              ${item.timbres.map((t, idx) => `
                <div class="timbre-item">
                  <div class="timbre-left">
                    <button class="timbre-play-btn" data-lang="${item.code}" data-phrase="${escapeHtml(item.greeting)}" title="Audition ${t}" type="button">
                      <span class="material-symbols-outlined">play_arrow</span>
                    </button>
                    <span class="timbre-title">${t}</span>
                  </div>
                  ${idx === 0 ? '<span class="timbre-active-tag">Active</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;

        card.querySelectorAll('.timbre-play-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const langCode = btn.dataset.lang;
            const phrase = btn.dataset.phrase;
            btn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';
            try {
              await ttsManager.speak({
                text: phrase,
                language: langCode,
                onEnd: () => {
                  btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
                }
              });
            } catch (e) {
              btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
            }
          });
        });

        globalContainer.appendChild(card);
      });
    }
  }

  // Hero Audition Button
  if (heroAuditionBtn) {
    heroAuditionBtn.addEventListener('click', async () => {
      heroAuditionBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span><span>Playing Default...</span>';
      try {
        await ttsManager.speak({
          text: 'வணக்கம்! வாய்ஸ்சேவ் ஏஐ முதன்மை தமிழ் குரல் மாதிரி.',
          language: 'ta',
          onEnd: () => {
            heroAuditionBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span><span>Audition Default</span>';
          }
        });
      } catch (err) {
        heroAuditionBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span><span>Audition Default</span>';
      }
    });
  }

  // Filter Pills
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter || 'all';
      const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
      renderCatalog(filter, q);
    });
  });

  // Search Input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const activePill = document.querySelector('#langFilterPills .lang-filter-pill.active');
      const filter = activePill ? activePill.dataset.filter : 'all';
      renderCatalog(filter, q);
    });
  }

  renderCatalog();
}

// ========================================================
// 7. VIEW 6: SETTINGS — OPTIONS HUB (0145d37f)
// ========================================================
function setupSettingsControls() {
  const btnSave = document.getElementById('btn-save-settings');
  const optTargetLang = document.getElementById('opt-target-lang');
  const optRateSlider = document.getElementById('opt-rate-slider');
  const optRateVal = document.getElementById('opt-rate-val');
  const optPitchSlider = document.getElementById('opt-pitch-slider');
  const optPitchVal = document.getElementById('opt-pitch-val');
  const optAutoTranslate = document.getElementById('opt-auto-translate');
  const optPhoneticPreservation = document.getElementById('opt-phonetic-preservation');
  const optAutoSpeak = document.getElementById('opt-auto-speak');
  const btnClearCache = document.getElementById('btn-clear-cache');
  const btnExportAll = document.getElementById('btn-export-all-recordings');

  if (optRateSlider && optRateVal) {
    optRateSlider.addEventListener('input', () => {
      optRateVal.textContent = `${parseFloat(optRateSlider.value).toFixed(2)}x`;
    });
  }

  if (optPitchSlider && optPitchVal) {
    optPitchSlider.addEventListener('input', () => {
      const v = parseInt(optPitchSlider.value, 10);
      optPitchVal.textContent = `${v > 0 ? '+' : ''}${v} ST`;
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const formatRadio = document.querySelector('input[name="opt-audio-format"]:checked');
      if (formatRadio) settings.preferredFormat = formatRadio.value;
      if (optTargetLang) settings.defaultTargetLanguage = optTargetLang.value;
      if (optRateSlider) settings.speed = parseFloat(optRateSlider.value);
      if (optPitchSlider) settings.pitch = 1.0 + (parseInt(optPitchSlider.value, 10) * 0.05);
      if (optAutoTranslate) settings.languageMode = optAutoTranslate.checked ? 'auto' : 'original';

      await SettingsStore.saveSettings(settings);
      showToast('✓ Preferences & Acoustic settings saved successfully');
    });
  }

  if (btnClearCache) {
    btnClearCache.addEventListener('click', () => {
      if (confirm('Clear local audio cache? (IndexedDB temporary buffers will be recycled)')) {
        showToast('✓ Local buffer cache cleared. Storage quota reset.');
      }
    });
  }

  if (btnExportAll) {
    btnExportAll.addEventListener('click', () => {
      showToast('📦 Bundling audio recordings into archive package...');
    });
  }
}

// ========================================================
// 8. GLOBAL HOTKEYS & TOAST
// ========================================================
function setupGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    // ⌘+Shift+S: Quick speak trigger
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      showToast('⚡ Quick Capture Hotkey Triggered');
      const btnSpeak = document.getElementById('btn-home-speak-synthesize');
      if (btnSpeak) btnSpeak.click();
    }
    // ⌘+Enter: Synthesize active text
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const activeView = document.querySelector('.workspace-view.active');
      if (activeView && activeView.id === 'view-home') {
        const btnSpeak = document.getElementById('btn-home-speak-synthesize');
        if (btnSpeak) btnSpeak.click();
      }
    }
  });
}

function showToast(message) {
  const toast = document.getElementById('vs-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'flex';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.display = 'none';
  }, 3200);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
