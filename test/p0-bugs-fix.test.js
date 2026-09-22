/**
 * VoiceSave AI - P0 Bugs Verification Test Suite
 * Specifically validates:
 * 1. Bug 1 Fix: Language Translation & Target Language Invariant (Tamil, Hindi, Telugu, Kannada, Malayalam, Spanish, French)
 * 2. Bug 2 Fix: Download Audio option, container validity, audio blob existence, filename formatting
 * 3. Script validation: Tamil [\u0B80-\u0BFF], Devanagari [\u0900-\u097F], Telugu [\u0C00-\u0C7F], Kannada [\u0C80-\u0CFF], Malayalam [\u0D00-\u0D7F]
 */

import { TTSManager } from '../src/tts/tts-manager.js';
import { TranslationManager } from '../src/translation/translation-manager.js';
import { DemoTranslationProvider } from '../src/translation/demo-provider.js';
import { encodeAudio } from '../src/audio/encoder.js';
import { validateWAV, validateMP3 } from '../src/audio/validator.js';
import { generateAudioFilename } from '../src/utils/format.js';
import { getLanguageByCode } from '../src/language/languages.js';

import fs from 'fs';
import path from 'path';
import vm from 'vm';

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

// Load LAME into global context
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
        { name: 'Microsoft David', lang: 'en-US' }
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
} else {
  globalThis.window.AudioContext = MockAudioContext;
}

async function runP0BugsVerification() {
  console.log('====================================================');
  console.log(' VoiceSave AI — P0 Bugs & Multilingual Audio Tests');
  console.log('====================================================\n');

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

  const translationManager = new TranslationManager({ demoMode: true });
  const ttsManager = new TTSManager({ demoMode: true });

  // ----------------------------------------------------
  // SECTION 1: BUG 1 — Script & Translation Content Tests
  // ----------------------------------------------------
  console.log('[1] Testing Target Language Translations (No English Leakage):');

  const testLanguages = [
    { code: 'ta', name: 'Tamil', scriptRegex: /[\u0B80-\u0BFF]/, query: 'What is an SSD?' },
    { code: 'hi', name: 'Hindi', scriptRegex: /[\u0900-\u097F]/, query: 'Explain polymorphism in Java in simple words.' },
    { code: 'te', name: 'Telugu', scriptRegex: /[\u0C00-\u0C7F]/, query: 'Explain cloud computing.' },
    { code: 'kn', name: 'Kannada', scriptRegex: /[\u0C80-\u0CFF]/, query: 'What is machine learning?' },
    { code: 'ml', name: 'Malayalam', scriptRegex: /[\u0D00-\u0D7F]/, query: 'Explain the internet.' },
    { code: 'es', name: 'Spanish', scriptRegex: /[áéíóúñ¿¡]/i, query: 'Explain quantum computing.' },
    { code: 'fr', name: 'French', scriptRegex: /[éèêëàâîïôûùç]/i, query: 'What is an SSD?' }
  ];

  for (const lang of testLanguages) {
    const res = await translationManager.processAndTranslate(lang.query, lang.code);
    assert(res.didTranslate === true, `${lang.name} translation flag is true`);
    assert(res.targetLang === lang.code, `${lang.name} target language is ${lang.code}`);
    assert(res.translatedText !== lang.query, `${lang.name} translated text is NOT identical to English input`);
    assert(lang.scriptRegex.test(res.translatedText), `${lang.name} output contains genuine native script / characters`);
  }

  // ----------------------------------------------------
  // SECTION 2: Dynamic Translation for Arbitrary Queries
  // ----------------------------------------------------
  console.log('\n[2] Testing Dynamic Translation on Arbitrary Questions:');
  {
    const arbitraryQuery = 'Explain the architecture of operating systems in detail.';
    
    // Tamil
    const taArb = await translationManager.processAndTranslate(arbitraryQuery, 'ta');
    assert(taArb.didTranslate === true, 'Arbitrary query translated to Tamil');
    assert(/[\u0B80-\u0BFF]/.test(taArb.translatedText), 'Arbitrary Tamil contains genuine Tamil Unicode characters');
    assert(!taArb.translatedText.startsWith('Here is the explanation for'), 'Tamil output does NOT start with English template');

    // Hindi
    const hiArb = await translationManager.processAndTranslate(arbitraryQuery, 'hi');
    assert(/[\u0900-\u097F]/.test(hiArb.translatedText), 'Arbitrary Hindi contains genuine Devanagari Unicode characters');

    // Telugu
    const teArb = await translationManager.processAndTranslate(arbitraryQuery, 'te');
    assert(/[\u0C00-\u0C7F]/.test(teArb.translatedText), 'Arbitrary Telugu contains genuine Telugu Unicode characters');

    // Kannada
    const knArb = await translationManager.processAndTranslate(arbitraryQuery, 'kn');
    assert(/[\u0C80-\u0CFF]/.test(knArb.translatedText), 'Arbitrary Kannada contains genuine Kannada Unicode characters');

    // Malayalam
    const mlArb = await translationManager.processAndTranslate(arbitraryQuery, 'ml');
    assert(/[\u0D00-\u0D7F]/.test(mlArb.translatedText), 'Arbitrary Malayalam contains genuine Malayalam Unicode characters');

    // French
    const frArb = await translationManager.processAndTranslate(arbitraryQuery, 'fr');
    assert(/[éèêëàâîïôûùç]/i.test(frArb.translatedText), 'Arbitrary French contains genuine French accents/vocabulary');
  }

  // ----------------------------------------------------
  // SECTION 3: TTS Target Language & Voice Invariant
  // ----------------------------------------------------
  console.log('\n[3] Testing TTS Language & Voice Invariant:');
  {
    const browserTTS = ttsManager.browserTTS;

    // Test that getBestVoice NEVER returns English voice for Tamil
    const taVoice = await browserTTS.getBestVoice('ta', 'Microsoft David');
    assert(taVoice === null || taVoice.lang.startsWith('ta'), 'Tamil request does NOT return English voice (returns null or ta voice)');

    // Test that getBestVoice NEVER returns English voice for Hindi
    const hiVoice = await browserTTS.getBestVoice('hi', 'Google US English');
    assert(hiVoice === null || hiVoice.lang.startsWith('hi'), 'Hindi request does NOT return English voice');

    // Test speakMultilingual fallback when browser has no voice
    const speakOutcome = await ttsManager.speakMultilingual('An SSD is fast flash storage.', {
      targetLanguage: 'ta'
    });
    assert(speakOutcome.language === 'ta', 'Spoken language recorded as ta');
    assert(speakOutcome.usedCanonicalPlayback === true, 'Seamlessly used canonical playback when browser has no native Tamil voice');
    assert(speakOutcome.canonicalSpeech !== undefined, 'Canonical speech object was produced');
  }

  // ----------------------------------------------------
  // SECTION 4: BUG 2 — Download Flow & File Integrity
  // ----------------------------------------------------
  console.log('\n[4] Testing Bug 2 — Download Audio Flow & Integrity:');
  {
    for (const lang of ['ta', 'hi', 'te', 'kn', 'ml', 'es', 'fr']) {
      // 1. Translate query
      const translated = await translationManager.processAndTranslate('What is an SSD?', lang);
      
      // 2. Generate canonical audio
      const canonical = await ttsManager.generateCanonicalSpeech({
        text: translated.translatedText,
        language: lang
      });
      assert(canonical && canonical.audioBuffer, `${lang.toUpperCase()}: Generated canonical audio buffer`);
      assert(canonical.language === lang, `${lang.toUpperCase()}: Canonical language matches target language`);

      // 3. Encode to MP3
      const mp3Encoded = await encodeAudio(canonical.audioBuffer, 'MP3');
      assert(mp3Encoded.blob.size > 1000, `${lang.toUpperCase()}: Encoded MP3 blob has non-trivial size (${mp3Encoded.blob.size} bytes)`);
      
      // 4. Validate MP3 integrity
      const mp3Val = await validateMP3(mp3Encoded.blob);
      assert(mp3Val.valid === true, `${lang.toUpperCase()}: MP3 bitstream passed sync word validation (frames: ${mp3Val.framesCount})`);

      // 5. Filename formatting
      const filename = generateAudioFilename('What is an SSD?', lang, 'mp3');
      assert(filename.includes(`-${lang}-`), `${lang.toUpperCase()}: Filename contains language tag: ${filename}`);

      // 6. Encode to WAV
      const wavEncoded = await encodeAudio(canonical.audioBuffer, 'WAV');
      const wavVal = await validateWAV(wavEncoded.blob);
      assert(wavVal.valid === true, `${lang.toUpperCase()}: WAV container passed RIFF/PCM validation`);
    }
  }

  console.log(`\n====================================================`);
  console.log(` P0 Bugs Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runP0BugsVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
