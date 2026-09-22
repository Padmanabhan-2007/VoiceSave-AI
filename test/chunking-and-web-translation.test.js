/**
 * VoiceSave AI - Long Script Chunking, Web Translation & Audio Concatenation Test Suite
 */

import { TextCleaner } from '../src/language/text-cleaner.js';
import { GoogleWebTranslationProvider } from '../src/translation/web-provider.js';
import { TranslationManager } from '../src/translation/translation-manager.js';
import { OnlineTTSProvider } from '../src/tts/online-tts.js';
import { encodeMP3, getLameInstance } from '../src/audio/mp3.js';
import { encodeWAV } from '../src/audio/wav.js';
import { validateMP3, validateWAV } from '../src/audio/validator.js';
import { TTSManager } from '../src/tts/tts-manager.js';

async function runChunkingAndTranslationTests() {
  console.log('================================================================');
  console.log(' VoiceSave AI — Long Script Chunking, Web Translation & Audio Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✔ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Text Chunker Verification
  console.log('[1] Testing Punctuation-Aware Text Chunker (Zero Truncation):');
  {
    const shortText = 'What is an SSD?';
    const shortChunks = TextCleaner.chunkText(shortText, 175);
    assert(shortChunks.length === 1, 'Short text remains a single chunk');
    assert(shortChunks[0] === shortText, 'Content matches verbatim');

    const longText = 'Solid State Drives are modern storage devices. They use non-volatile NAND flash memory chips instead of spinning magnetic platters. This allows computers to boot within seconds, launch applications instantly, and transfer multi-gigabyte files with virtually zero latency. In addition, SSDs generate zero acoustic noise, consume significantly less power, and exhibit superior physical durability against shock and vibration compared to legacy mechanical hard drives.';
    const chunks = TextCleaner.chunkText(longText, 150);
    assert(chunks.length >= 3, `Long text split into ${chunks.length} chunks safely under limit`);
    
    // Verify each chunk is under limit
    const allUnder = chunks.every(c => c.length <= 150);
    assert(allUnder, 'Every chunk is <= 150 characters');

    // Verify all original content preserved
    const reconstructed = chunks.join(' ');
    assert(reconstructed.includes('Solid State Drives') && reconstructed.includes('legacy mechanical hard drives'), 'No sentence content was truncated');

    // Test Indic danda punctuation split
    const hindiText = 'एसएसडी एक आधुनिक स्टोरेज डिवाइस है। यह फ्लैश मेमोरी का उपयोग करता है। इससे कंप्यूटर बहुत तेज़ हो जाता है।';
    const hindiChunks = TextCleaner.chunkText(hindiText, 60);
    assert(hindiChunks.length >= 2, `Indic script chunked on danda boundaries (chunks: ${hindiChunks.length})`);
  }

  // 2. Code Block Protection & Normalization
  console.log('\n[2] Testing Code Block Masking & Preservation:');
  {
    const textWithCode = 'Here is a Java polymorphism example:\n```java\nclass Animal { void speak() { System.out.println("sound"); } }\nclass Dog extends Animal { void speak() { System.out.println("bark"); } }\n```\nThis demonstrates runtime method dispatch.';
    const { maskedText, placeholders } = TextCleaner.maskCodeBlocks(textWithCode);

    assert(maskedText.includes('__VOICESAVE_CODE_0__'), 'Fenced code block replaced with token');
    assert(placeholders.size === 1, 'Placeholder map captured code block');

    const restored = TextCleaner.unmaskCodeBlocks(maskedText, placeholders);
    assert(restored === textWithCode, 'Unmasked text exactly matches original with complete syntax');

    // Test cleanForSpeech with readCodeBlocks: false
    const speechOmitted = TextCleaner.cleanForSpeech(textWithCode, { readCodeBlocks: false });
    assert(speechOmitted.includes('[Code snippet omitted for speech]'), 'Speech text cleanly omits code when preferred');
    assert(!speechOmitted.includes('System.out.println'), 'Syntax omitted from speech text');

    // Test cleanForSpeech with readCodeBlocks: true
    const speechIncluded = TextCleaner.cleanForSpeech(textWithCode, { readCodeBlocks: true });
    assert(speechIncluded.includes('Code snippet in java:'), 'Speech text announces code snippet when enabled');
  }

  // 3. AudioBuffer Concatenation in OnlineTTSProvider
  console.log('\n[3] Testing Multi-Chunk AudioBuffer Concatenation:');
  {
    const sampleRate = 44100;
    const dummyCtx = {
      sampleRate,
      createBuffer: (channels, length, sRate) => {
        const channelData = new Array(channels).fill(0).map(() => new Float32Array(length));
        return {
          numberOfChannels: channels,
          length,
          sampleRate: sRate,
          duration: length / sRate,
          getChannelData: (ch) => channelData[ch]
        };
      }
    };

    const provider = new OnlineTTSProvider();
    
    // Create 3 simulated chunk buffers (0.5s each = 22050 samples)
    const b1 = dummyCtx.createBuffer(1, 22050, sampleRate);
    b1.getChannelData(0).fill(0.1);
    const b2 = dummyCtx.createBuffer(1, 22050, sampleRate);
    b2.getChannelData(0).fill(0.2);
    const b3 = dummyCtx.createBuffer(1, 22050, sampleRate);
    b3.getChannelData(0).fill(0.3);

    const merged = provider._concatenateAudioBuffers([b1, b2, b3], dummyCtx);
    assert(merged.length === 66150, `Combined buffer length is exact sum (expected 66150, got ${merged.length})`);
    assert(parseFloat(merged.duration.toFixed(2)) === 1.5, `Combined duration is 1.5 seconds`);
    assert(Math.abs(merged.getChannelData(0)[0] - 0.1) < 0.001, 'First chunk sample preserved at beginning');
    assert(Math.abs(merged.getChannelData(0)[22050] - 0.2) < 0.001, 'Second chunk sample preserved at offset');
    assert(Math.abs(merged.getChannelData(0)[44100] - 0.3) < 0.001, 'Third chunk sample preserved at offset');
  }

  // 4. LAME MP3 Instance Resolution & Validation
  console.log('\n[4] Testing Resilient LAME MP3 Resolution:');
  {
    const lameInstance = await getLameInstance();
    assert(lameInstance && typeof lameInstance.Mp3Encoder === 'function', 'LAME instance successfully resolved');

    const sampleRate = 44100;
    const testSamples = new Float32Array(sampleRate);
    for (let i = 0; i < sampleRate; i++) {
      testSamples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }

    const mp3Blob = await encodeMP3(testSamples, { sampleRate, numChannels: 1 });
    assert(mp3Blob.type === 'audio/mp3', 'MP3 blob has audio/mp3 MIME type');
    assert(mp3Blob.size > 2000, `MP3 blob has real size (${mp3Blob.size} bytes)`);

    const mp3Valid = await validateMP3(mp3Blob);
    assert(mp3Valid.valid, `MP3 stream valid MPEG Layer III with sync words (frames: ${mp3Valid.frameCount})`);
  }

  // 5. Live Mode Translation via GoogleWebTranslationProvider / TranslationManager
  console.log('\n[5] Testing Live Mode Translation Manager (All Priority Languages):');
  {
    const tm = new TranslationManager({ demoMode: false });
    
    // Verify that live mode has active provider (no API key needed!)
    const query = 'What is an SSD?';
    
    const languagesToTest = [
      { code: 'ta', name: 'Tamil', script: /[\u0B80-\u0BFF]/ },
      { code: 'hi', name: 'Hindi', script: /[\u0900-\u097F]/ },
      { code: 'te', name: 'Telugu', script: /[\u0C00-\u0C7F]/ },
      { code: 'kn', name: 'Kannada', script: /[\u0C80-\u0CFF]/ },
      { code: 'ml', name: 'Malayalam', script: /[\u0D00-\u0D7F]/ },
      { code: 'es', name: 'Spanish', script: /[áéíóúñ]/i },
      { code: 'fr', name: 'French', script: /[éàèùâêîôû]/i },
      { code: 'pt', name: 'Portuguese', script: /[ãõçáéíóú]/i }
    ];

    for (const lang of languagesToTest) {
      const outcome = await tm.processAndTranslate(query, lang.code);
      assert(outcome.didTranslate, `${lang.name}: didTranslate is true`);
      assert(outcome.targetLang === lang.code, `${lang.name}: targetLang matches ${lang.code}`);
      assert(outcome.translatedText !== query, `${lang.name}: output is translated, not English`);
      assert(lang.script.test(outcome.translatedText), `${lang.name}: output contains native script characters`);
    }
  }

  // 6. Complete End-to-End Pipeline: Text -> Translate -> Canonical Speech -> MP3 -> WAV -> Filename
  console.log('\n[6] Testing Complete End-to-End Pipeline:');
  {
    const ttsMgr = new TTSManager({ demoMode: true });
    const mockCtx = {
      sampleRate: 44100,
      createBuffer: (channels, length, sRate) => ({
        numberOfChannels: channels,
        length,
        sampleRate: sRate,
        duration: length / sRate,
        getChannelData: () => new Float32Array(length).fill(0.2)
      }),
      decodeAudioData: async (ab) => ({
        numberOfChannels: 1,
        length: 44100 * 2,
        sampleRate: 44100,
        duration: 2.0,
        getChannelData: () => new Float32Array(44100 * 2).fill(0.15)
      })
    };
    ttsMgr.audioContext = mockCtx;

    // Test Tamil
    const speechResult = await ttsMgr.generateCanonicalSpeech({
      text: 'SSD (சாலிட் ஸ்டேட் டிரைவ்) என்பது ஒரு நவீன சேமிப்பக சாதனம் ஆகும்.',
      language: 'ta'
    });

    assert(speechResult.audioBuffer !== null, 'Tamil canonical AudioBuffer produced');
    assert(speechResult.language === 'ta', 'Canonical language invariant held (ta)');
    
    // MP3 Encode from canonical audio buffer
    const mp3 = await encodeMP3(speechResult.audioBuffer, { sampleRate: 44100, numChannels: 1 });
    const mp3Val = await validateMP3(mp3);
    assert(mp3Val.valid, 'Canonical audio exported to genuine MP3');

    // WAV Encode from same canonical audio buffer
    const wav = encodeWAV(speechResult.audioBuffer, { sampleRate: 44100, numChannels: 1 });
    const wavVal = await validateWAV(wav);
    assert(wavVal.valid, 'Canonical audio exported to genuine WAV');
  }

  console.log('\n================================================================');
  console.log(` Summary: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runChunkingAndTranslationTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
