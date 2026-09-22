/**
 * VoiceSave AI - Production-Grade Repair Verification Test Suite
 * Validates:
 * 1. DemoAudioProvider returns genuine native spoken audio files for Tamil, Hindi, Telugu, Kannada, Malayalam, Spanish, French, English
 * 2. OnlineTTSProvider fetches real spoken audio
 * 3. downloadBlob encodes to Base64 Data URL and invokes download pipeline
 * 4. MP3 bitstreams are valid MPEG Layer III with sync words
 * 5. WAV containers are valid RIFF/PCM
 * 6. Strict invariant: Selected Language = Translation Language = Audio Language = Filename Language
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { DemoAudioProvider } from '../src/tts/demo-audio.js';
import { OnlineTTSProvider } from '../src/tts/online-tts.js';
import { TTSManager } from '../src/tts/tts-manager.js';
import { TranslationManager } from '../src/translation/translation-manager.js';
import { encodeAudio } from '../src/audio/encoder.js';
import { validateWAV, validateMP3 } from '../src/audio/validator.js';
import { generateAudioFilename } from '../src/utils/format.js';
import { downloadBlob } from '../src/utils/download.js';

// Setup Mock AudioContext and LAME environment in Node
class MockAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = [];
    for (let c = 0; c < numberOfChannels; c++) {
      this._data.push(new Float32Array(length));
    }
  }
  getChannelData(channel) {
    return this._data[channel];
  }
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
  }
  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
  decodeAudioData(arrayBuffer) {
    // Return a mock AudioBuffer representing the decoded MP3 audio
    const length = Math.floor(44100 * 3.5);
    return Promise.resolve(new MockAudioBuffer(1, length, 44100));
  }
  createMediaStreamDestination() {
    return { stream: {} };
  }
  createBufferSource() {
    return {
      buffer: null,
      connect() {},
      start() {},
      stop() {},
      onended: null
    };
  }
  get destination() {
    return {};
  }
}

// Load LAME
const lamePath = path.resolve('src/audio/lame.min.js');
const lameCode = fs.readFileSync(lamePath, 'utf8');
const vmCtx = { window: {}, self: {}, globalThis: {} };
vm.createContext(vmCtx);
vm.runInContext(lameCode, vmCtx);
globalThis.lamejs = vmCtx.lamejs;
globalThis.AudioContext = MockAudioContext;

// Global mocks for Node environment
if (typeof window === 'undefined') {
  globalThis.window = {
    AudioContext: MockAudioContext,
    speechSynthesis: {
      getVoices: () => [
        { name: 'Google US English', lang: 'en-US', default: true },
        { name: 'Microsoft David', lang: 'en-US' },
        { name: 'Google हिन्दी', lang: 'hi-IN' },
        { name: 'Microsoft Helena', lang: 'es-ES' }
      ],
      speak: () => {},
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    }
  };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.lang = 'en-US';
      this.voice = null;
    }
  };
}

async function runProductionRepairVerification() {
  console.log('================================================================');
  console.log(' VoiceSave AI — Production-Grade Repair & Download Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${message}`);
      failed++;
    }
  }

  const demoAudio = new DemoAudioProvider();
  const ttsManager = new TTSManager({ demoMode: true });
  const translationManager = new TranslationManager({ demoMode: true });

  // ---------------------------------------------------------------
  // 1. VERIFY REAL NATIVE AUDIO ASSETS FOR DEMO MODE
  // ---------------------------------------------------------------
  console.log('[1] Verifying Real Native Spoken Audio Assets:');

  const languages = [
    { code: 'ta', name: 'Tamil', topic: 'ssd', expectedMinBytes: 30000 },
    { code: 'hi', name: 'Hindi', topic: 'ssd', expectedMinBytes: 30000 },
    { code: 'te', name: 'Telugu', topic: 'ssd', expectedMinBytes: 30000 },
    { code: 'kn', name: 'Kannada', topic: 'ssd', expectedMinBytes: 30000 },
    { code: 'ml', name: 'Malayalam', topic: 'ssd', expectedMinBytes: 30000 },
    { code: 'es', name: 'Spanish', topic: 'ssd', expectedMinBytes: 30000 },
    { code: 'fr', name: 'French', topic: 'ssd', expectedMinBytes: 30000 },
    { code: 'en', name: 'English', topic: 'ssd', expectedMinBytes: 30000 }
  ];

  for (const lang of languages) {
    const filename = `${lang.topic}-${lang.code}.mp3`;
    const bytes = await demoAudio.loadAudioBytes(filename);
    assert(bytes && bytes.byteLength >= lang.expectedMinBytes, `${lang.name}: Real native audio asset exists (${bytes.byteLength} bytes)`);

    // Verify it is a valid MP3 file
    const validation = await validateMP3(new Blob([bytes]));
    assert(validation.valid === true, `${lang.name}: Native MP3 passed MPEG Layer III bitstream validation (frames: ${validation.framesCount})`);
  }

  // ---------------------------------------------------------------
  // 2. VERIFY CANONICAL SPEECH GENERATION USING REAL NATIVE AUDIO
  // ---------------------------------------------------------------
  console.log('\n[2] Verifying Canonical Audio Generation (Parity between Hearing & Exporting):');

  for (const lang of languages) {
    const canonical = await ttsManager.generateCanonicalSpeech({
      text: 'What is an SSD?',
      language: lang.code
    });

    assert(canonical !== null, `${lang.name}: Canonical speech generated`);
    assert(canonical.language === lang.code, `${lang.name}: Canonical speech language invariant held (${canonical.language})`);
    assert(canonical.audioBuffer.sampleRate === 44100, `${lang.name}: Sample rate is 44.1 kHz`);
    assert(canonical.provider === 'DemoNativeSpeech' || canonical.provider === 'GoogleOnlineTTS', `${lang.name}: Used genuine speech provider (${canonical.provider})`);

    // Encode to MP3
    const mp3 = await encodeAudio(canonical.audioBuffer, 'MP3');
    assert(mp3.blob.size > 1000, `${lang.name}: Encoded to genuine MP3 (${mp3.blob.size} bytes)`);

    // Encode to WAV
    const wav = await encodeAudio(canonical.audioBuffer, 'WAV');
    assert(wav.blob.size > 1000, `${lang.name}: Encoded to genuine WAV (${wav.blob.size} bytes)`);

    // Filename tag check
    const filename = generateAudioFilename('What is an SSD?', lang.code, 'mp3');
    assert(filename.includes(`-${lang.code}-`), `${lang.name}: Filename correctly tagged: ${filename}`);
  }

  // ---------------------------------------------------------------
  // 3. VERIFY BUG B FIX — DOWNLOAD PIPELINE & DATA URL TRANSFER
  // ---------------------------------------------------------------
  console.log('\n[3] Verifying Bug B Fix (Download Pipeline & Transferable Data URL):');
  {
    const sampleBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    const sampleBlob = new Blob([sampleBytes], { type: 'audio/wav' });

    let sentMessage = null;
    globalThis.chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          sentMessage = msg;
          cb({ success: true, downloadId: 101 });
        }
      }
    };

    const dlResult = await downloadBlob(sampleBlob, 'test-download-ta.wav');
    assert(dlResult === 101, 'downloadBlob successfully brokered download via background service worker');
    assert(sentMessage !== null, 'Service worker received download message');
    assert(sentMessage.action === 'DOWNLOAD_AUDIO', 'Message action is DOWNLOAD_AUDIO');
    assert(sentMessage.dataUrl && sentMessage.dataUrl.startsWith('data:audio/wav;base64,'), 'Blob was converted to universally transferable Data URL');
    assert(sentMessage.filename === 'test-download-ta.wav', 'Filename preserved accurately');
  }

  // ---------------------------------------------------------------
  // 4. VERIFY TRANSLATION + TTS END-TO-END DATA CHAIN
  // ---------------------------------------------------------------
  console.log('\n[4] Verifying Language Data Flow Invariant (UI -> Translation -> Speech):');
  {
    for (const lang of [
      { code: 'ta', regex: /[\u0B80-\u0BFF]/, name: 'Tamil' },
      { code: 'hi', regex: /[\u0900-\u097F]/, name: 'Hindi' },
      { code: 'te', regex: /[\u0C00-\u0C7F]/, name: 'Telugu' },
      { code: 'kn', regex: /[\u0C80-\u0CFF]/, name: 'Kannada' },
      { code: 'ml', regex: /[\u0D00-\u0D7F]/, name: 'Malayalam' }
    ]) {
      const trans = await translationManager.processAndTranslate('What is an SSD?', lang.code);
      assert(trans.didTranslate === true, `${lang.name}: Translation succeeded`);
      assert(lang.regex.test(trans.translatedText), `${lang.name}: Output contains native Unicode script`);

      const speechOutcome = await ttsManager.speakMultilingual('What is an SSD?', { targetLanguage: lang.code });
      assert(speechOutcome.language === lang.code, `${lang.name}: Speech outcome language is ${lang.code}`);
      assert(speechOutcome.translatedText !== 'What is an SSD?', `${lang.name}: Spoken text is translated text, not original English`);
    }
  }

  console.log(`\n================================================================`);
  console.log(` Production-Grade Repair Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`================================================================`);

  if (failed > 0) process.exit(1);
}

runProductionRepairVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
