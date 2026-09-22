# VoiceSave AI — Speak. Save. Learn Anywhere.

> **A Universal Voice & Audio Recording Layer for the AI Web**  
> Chrome Extension Prototype (Manifest V3)

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Tests](https://img.shields.io/badge/Tests-22%20Passing-emerald.svg)](./test)
[![Encoders](https://img.shields.io/badge/Audio-MP3%20%7C%20WAV%20%7C%20M4A-indigo.svg)](./src/audio)

---

## 1. Overview & Value Proposition

**VoiceSave AI** turns reading AI responses into an interactive audio experience. When using LLM web apps like **ChatGPT**, **Google Gemini**, **Claude**, or **Perplexity**, VoiceSave AI automatically detects finished AI answers and attaches a sleek, native-feeling voice toolbar:

```
[ 🔊 Speak ]   [ 🔴 Record & Save ]   [ MP3 ▼ ]
```

Users can listen in real time, record the spoken response with a single click, and export genuine **MP3**, **WAV**, or **M4A** audio files to listen while commuting, studying, or exercising.

In addition, clicking the extension icon opens the **Quick Ask** popup:
> **Type Question → Stream AI Answer → Speak Answer → Record Spoken Audio → Download File**

---

## 2. Architecture & Directory Structure

VoiceSave AI is built from the ground up on modern **Manifest V3** standards with strict separation of concerns, zero runtime framework bloat, and local-first audio processing:

```text
voicesave-ai/
│
├── manifest.json                  # Manifest V3 configuration (narrow host permissions)
├── package.json                   # Project metadata and test scripts
├── README.md                      # Comprehensive user and developer guide
│
├── assets/
│   └── icons/                     # Crisp branded icons (16, 32, 48, 128 px)
│
├── src/
│   ├── background/
│   │   └── service-worker.js      # MV3 Service worker: downloads, context menu, options coordination
│   │
│   ├── storage/
│   │   └── settings.js            # chrome.storage.local wrapper (voice, rate, pitch, format, LLM keys)
│   │
│   ├── audio/
│   │   ├── wav.js                 # Canonical 16-bit PCM RIFF WAV encoder
│   │   ├── mp3.js                 # MPEG-1 Layer 3 encoder wrapper (lamejs)
│   │   ├── m4a.js                 # MediaRecorder AAC/M4A encoder with fallback detection
│   │   ├── lame.min.js            # Bundled client-side LAME MP3 library
│   │   ├── recorder.js            # Audio recorder state machine (idle, recording, processing, complete)
│   │   └── encoder.js             # Unified encodeAudio(audioBuffer, format) conversion layer
│   │
│   ├── tts/
│   │   ├── provider.js            # Base TTSProvider interface
│   │   ├── browser-tts.js         # Web Speech API engine (play, pause, resume, stop)
│   │   ├── acoustic-synth.js      # Web Audio PCM buffer generator for local demo speech recording
│   │   ├── api-tts.js             # OpenAI TTS and ElevenLabs API integration
│   │   └── tts-manager.js         # Unified TTS coordinator (switches between browser and API)
│   │
│   ├── llm/
│   │   ├── provider.js            # Base LLMProvider interface
│   │   ├── demo-provider.js       # Realistic simulated responses with streaming typing effect
│   │   └── api-provider.js        # Direct OpenAI / Anthropic API integration
│   │
│   ├── content/
│   │   ├── content.js             # Main content script entry point
│   │   ├── observer.js            # MutationObserver for dynamic AI response detection
│   │   ├── injector.js            # Injects [ 🔊 Speak ] and [ 🔴 Record & Save ] toolbar
│   │   ├── toolbar.css            # Scoped native-style toolbar CSS (dark/light theme responsive)
│   │   └── providers/             # Host website DOM adapters
│   │       ├── provider.js        # Base SiteAdapter interface
│   │       ├── chatgpt.js         # ChatGPT adapter (chatgpt.com, chat.openai.com)
│   │       ├── gemini.js          # Gemini adapter (gemini.google.com)
│   │       ├── claude.js          # Claude adapter (claude.ai)
│   │       ├── perplexity.js      # Perplexity adapter (perplexity.ai)
│   │       └── generic.js         # Generic AI response adapter & demo page adapter
│   │
│   ├── popup/
│   │   ├── popup.html             # Sleek extension popup UI (Quick Ask, Format, Recent Recordings)
│   │   ├── popup.css              # Deep navy / electric indigo styling, animations, accessible UI
│   │   └── popup.js               # Quick Ask workflow, recording, download, format picker
│   │
│   ├── options/
│   │   ├── options.html           # Full settings page (General, Speech, Audio, LLM, Privacy)
│   │   ├── options.css            # Settings page styling
│   │   └── options.js             # Settings persistence, voice preview, provider configuration
│   │
│   ├── utils/
│   │   ├── download.js            # Cross-context file downloader (chrome.downloads or Blob URL)
│   │   ├── format.js              # Time formatters, filename slug generator, audio byte size format
│   │   └── dom.js                 # DOM sanitization and helper utilities
│   │
│   └── demo/
│       ├── demo.html              # Standalone interactive simulator (ChatGPT/Gemini/Claude modes)
│       ├── demo.css               # Simulator UI styling
│       └── demo.js                # Simulated response generation for instantaneous testing
│
├── scripts/
│   ├── generate-icons.js          # Script to generate crisp PNG icons
│   └── serve.js                   # Lightweight static server for offline testing
│
└── test/
    └── audio-encoders.test.js     # Automated verification test suite
```

---

## 3. How to Install in Google Chrome

Loading VoiceSave AI takes under 15 seconds:

1. Open **Google Chrome** (or Microsoft Edge / Brave / Arc).
2. Navigate to `chrome://extensions` in the address bar.
3. In the top-right corner, toggle on **Developer mode**.
4. In the top-left corner, click **Load unpacked**.
5. Select the project directory (`c:\Users\padma\Desktop\mp3`).
6. VoiceSave AI will appear in your extensions list. Pin it to your Chrome toolbar for quick access!

---

## 4. How to Use Demo Mode (Zero Setup Needed)

VoiceSave AI comes with **Demo Mode enabled by default**. No OpenAI keys, no paid subscriptions, and no internet setup are required:

### Option A: Testing in the Built-In Interactive Simulator
1. Open the file `src/demo/demo.html` in Chrome (or click **"Launch Simulator"** in the popup/settings page).
2. Choose between **ChatGPT**, **Google Gemini**, or **Claude** simulation tabs.
3. Click any preset pill (e.g. `Java Polymorphism` or `Quantum Computing`) or type your own question.
4. Watch the AI response stream in with natural typing cadence.
5. Notice the injected toolbar: `[ 🔊 Speak ] [ 🔴 Record & Save ] [ MP3 ▼ ]`.
6. Click **Speak** to listen. Click **Record & Save** to record and download the audio file!

### Option B: Quick Ask in the Extension Popup
1. Click the **VoiceSave AI** icon in Chrome's extension bar.
2. Select a suggestion chip or type:
   > `Explain quantum computing in simple words.`
3. Click **🎙 Ask & Speak**.
4. The AI explanation streams into the answer card and speaks aloud automatically.
5. Click **Record & Save** to produce your downloadable audio file.

---

## 5. 60-Second Presentation & Demo Flow

Here is the recommended 1-minute live demo script for presentations:

| Time | Action | What to Say |
|---|---|---|
| **00:00 - 00:15** | Open ChatGPT (or the built-in Simulator) and ask: *"Explain polymorphism in Java in simple words."* | *"Notice how VoiceSave AI seamlessly detects the AI response in real time and attaches a native audio toolbar directly underneath."* |
| **00:15 - 00:30** | Click **[ 🔊 Speak ]**. Audio begins; toolbar shows animated waveform and pause/stop controls. | *"With one click, users can listen to the answer hands-free with pause, resume, and voice pitch/rate adjustments."* |
| **00:30 - 00:45** | Click **[ 🔴 Record & Save ]**. Timer ticks (`00:08`), then click Stop. | *"VoiceSave AI records the spoken answer, routes it through our client-side audio conversion pipeline, and triggers a direct download."* |
| **00:45 - 01:00** | Open popup and enter *"What is an SSD?"* -> Click **Ask & Speak**. | *"For quick research without navigating to ChatGPT, the Quick Ask popup generates, speaks, and exports answers in MP3, WAV, or M4A."* |

---

## 6. How Audio Recording & Encoding Works

A critical challenge with browser extensions is that `window.speechSynthesis` outputs audio directly to the OS hardware; it does not expose a raw `MediaStream` to client-side JavaScript.

VoiceSave AI solves this with an authentic, production-grade architecture:

```
[ Response Text ]
       │
       ├──► Live Playback: BrowserTTSProvider (Web Speech API)
       │
       └──► Audio Export: TTSManager
                 │
                 ├── [API Mode]: OpenAI TTS / ElevenLabs ──► AudioBuffer
                 │
                 └── [Demo Mode]: AcousticSpeechSynth ────► AudioBuffer (44.1kHz PCM)
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    ▼                         ▼
                                             WAV Encoder                MP3 Encoder
                                         (Canonical 16-bit)          (LAME MPEG-1 L3)
                                                    │                         │
                                            audio/wav Blob             audio/mp3 Blob
                                              (.wav file)                (.mp3 file)
```

### True Binary Encoders (No Fake Renames!)
* **MP3**: Encoded via client-side LAME (`lamejs`). Generates genuine MPEG-1 Layer 3 binary frames verified by standard `0xFFFB` sync headers.
* **WAV**: Encoded via a canonical 44-byte RIFF/WAVE header and clamped 16-bit PCM integer samples.
* **M4A**: Encoded via browser `MediaRecorder` targeting `audio/mp4;codecs=mp4a.40.2`. If the host browser lacks native AAC encoding support, VoiceSave AI transparently notifies the user and exports lossless MP3 instead of mislabeling containers.

---

## 7. Connecting Real LLM & TTS Providers (Optional)

If you wish to use production AI models:

1. Right-click the VoiceSave AI icon -> **Options** (or click the ⚙ gear in the popup).
2. In the **LLM & Cloud Providers** section, toggle off **Demo Mode**.
3. Select your provider:
   - **OpenAI**: Enter your `sk-...` API key (uses `gpt-4o-mini` and `tts-1`).
   - **Anthropic**: Enter your Claude API key (uses `claude-3-haiku`).
   - **ElevenLabs**: Enter your ElevenLabs API key for hyper-realistic cloned voices.
4. Click **Save Changes**.

> **Privacy Guarantee**: All API keys are stored strictly inside your browser's local `chrome.storage.local` sandbox. Keys are never sent to external servers other than the official provider endpoints.

---

## 8. Verification & Automated Testing

Run the automated test suite to verify the encoding algorithms and providers:

```bash
# Run 22 comprehensive tests
npm test
```

Test results:
* Canonical 16-bit PCM RIFF header verification: **PASS**
* MP3 LAME encoding & `0xFFFB` frame sync verification: **PASS**
* Demo LLM response accuracy & streaming simulation: **PASS**
* Filename slug generation & formatting utilities: **PASS**

---

## 9. Known Limitations

1. **Host Site DOM Updates**: LLM platforms (ChatGPT, Gemini, Claude) periodically alter their frontend class names. VoiceSave AI uses flexible structural selectors and a fallback `GenericAdapter`, but site adapters may need selector updates if a host undergoes a major redesign.
2. **Browser AAC Licensing**: Standard Chromium / Chrome builds support MP4/AAC recording, but certain custom Linux Chromium builds without proprietary media codecs may fall back to MP3.
3. **Background Tab Throttling**: Chrome may throttle `speechSynthesis` or `AudioContext` when a tab is minimized or inactive for prolonged periods.

---

## 10. Future Roadmap (Version 2.0)

- [ ] **Custom Hotkeys**: Global shortcuts (`Alt + S` to speak active response, `Alt + R` to record).
- [ ] **Automatic Summarization**: One-click *"Summarize before speaking"* for 2000+ word technical papers.
- [ ] **Multilingual Voice Detection**: Automatic language detection (Spanish, French, German, Japanese, Hindi) with language-matching TTS voices.
- [ ] **Playlist & Audio Queue Mode**: Queue multiple responses and export a combined podcast-style audio file.
- [ ] **Timestamped Transcripts (LRC/VTT)**: Export synchronized subtitle files alongside the audio for studying.
- [ ] **Cloud Drive Sync**: Automatic upload to Google Drive, Dropbox, or Notion.

---

## 11. License

MIT License © 2026 VoiceSave AI Team.

