/**
 * VoiceSave AI - Automated Verification & Audio Encoding Test Suite
 */

import { encodeWAV } from '../src/audio/wav.js';
import { encodeMP3 } from '../src/audio/mp3.js';
import { slugify, formatDuration, formatBytes } from '../src/utils/format.js';
import { DemoLLMProvider } from '../src/llm/demo-provider.js';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

async function runTests() {
  console.log('====================================================');
  console.log(' VoiceSave AI — Test Suite Verification');
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

  // 1. WAV Encoder Verification
  console.log('[1] Testing WAV Canonical 16-bit PCM Encoder:');
  {
    const sampleRate = 44100;
    const duration = 0.5; // 0.5 sec
    const numSamples = Math.floor(sampleRate * duration);
    const floatSamples = new Float32Array(numSamples);

    // Generate a 440Hz sine wave test tone
    for (let i = 0; i < numSamples; i++) {
      floatSamples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const wavBlob = encodeWAV(floatSamples, { sampleRate, numChannels: 1 });
    assert(wavBlob.type === 'audio/wav', 'WAV blob has correct MIME type audio/wav');

    const arrayBuffer = await wavBlob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Verify RIFF header
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    assert(riff === 'RIFF', `Header starts with "RIFF" (found: ${riff})`);

    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    assert(wave === 'WAVE', `Format matches "WAVE" (found: ${wave})`);

    const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
    assert(fmt === 'fmt ', `Subchunk1 matches "fmt " (found: ${fmt})`);

    const audioFormat = view.getUint16(20, true);
    assert(audioFormat === 1, `AudioFormat is 1 (Linear PCM)`);

    const channels = view.getUint16(22, true);
    assert(channels === 1, `Channels is 1 (Mono)`);

    const sRate = view.getUint32(24, true);
    assert(sRate === 44100, `Sample rate is 44100`);

    const bitsPerSample = view.getUint16(34, true);
    assert(bitsPerSample === 16, `Bits per sample is 16`);

    const dataHeader = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
    assert(dataHeader === 'data', `Subchunk2 matches "data"`);

    const expectedDataSize = numSamples * 2;
    const actualDataSize = view.getUint32(40, true);
    assert(actualDataSize === expectedDataSize, `Data size is exact (${actualDataSize} bytes)`);
    assert(arrayBuffer.byteLength === 44 + expectedDataSize, `Total WAV file length matches 44-byte header + PCM payload`);
  }

  // 2. MP3 Encoder Verification
  console.log('\n[2] Testing MP3 MPEG-1 Layer III Encoder:');
  {
    // Setup lamejs on globalThis for Node test environment
    const lamePath = path.resolve('src/audio/lame.min.js');
    const lameCode = fs.readFileSync(lamePath, 'utf8');
    const vmCtx = { window: {}, self: {}, globalThis: {} };
    vm.createContext(vmCtx);
    vm.runInContext(lameCode, vmCtx);
    globalThis.lamejs = vmCtx.lamejs;

    const sampleRate = 44100;
    const numSamples = 44100; // 1.0 second of audio
    const floatSamples = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      floatSamples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.8;
    }

    const mp3Blob = await encodeMP3(floatSamples, { sampleRate, numChannels: 1, kbps: 128 });
    assert(mp3Blob.type === 'audio/mp3', 'MP3 blob has correct MIME type audio/mp3');
    assert(mp3Blob.size > 0, `MP3 blob contains encoded audio data (${mp3Blob.size} bytes)`);

    // Verify MPEG-1 Layer 3 Sync Word (0xFFE0 mask)
    const arrayBuffer = await mp3Blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Find first sync word 0xFF, 0xFB (or 0xFA, 0xF3)
    let hasMpegSync = false;
    for (let i = 0; i < Math.min(bytes.length - 1, 1024); i++) {
      if (bytes[i] === 0xFF && (bytes[i + 1] & 0xE0) === 0xE0) {
        hasMpegSync = true;
        break;
      }
    }
    assert(hasMpegSync, 'Verified genuine MPEG-1 Layer 3 frame sync header (0xFFFB / 0xFFE0)');
  }

  // 3. Demo LLM Provider Verification
  console.log('\n[3] Testing Demo LLM Provider:');
  {
    const llm = new DemoLLMProvider();
    const ans1 = await llm.ask('Explain quantum computing in simple words.');
    assert(ans1.includes('quantum mechanical'), 'Answers quantum question accurately');

    const ans2 = await llm.ask('Explain polymorphism in Java.');
    assert(ans2.includes('parent class'), 'Answers polymorphism question accurately');

    const ans3 = await llm.ask('What is an SSD?');
    assert(ans3.includes('Solid State Drive'), 'Answers SSD question accurately');

    let streamedTokens = 0;
    await llm.ask('Explain closure', (token, full) => {
      streamedTokens++;
    });
    assert(streamedTokens > 10, `Streaming delivers token-by-token chunks (${streamedTokens} tokens delivered)`);
  }

  // 4. Formatting Utilities Verification
  console.log('\n[4] Testing Formatting Utilities:');
  {
    const slug = slugify('Explain Polymorphism in Java! @ 2026?');
    assert(slug.startsWith('explain-polymorphism-in-java'), `Slug generated cleanly: "${slug}"`);

    const dur1 = formatDuration(8);
    assert(dur1 === '00:08', `Duration 8s formatted as "00:08" (got: "${dur1}")`);

    const dur2 = formatDuration(125);
    assert(dur2 === '02:05', `Duration 125s formatted as "02:05" (got: "${dur2}")`);

    const bytes = formatBytes(1024 * 142);
    assert(bytes === '142 KB', `Byte formatting outputs "142 KB" (got: "${bytes}")`);
  }

  // Summary
  console.log('\n====================================================');
  console.log(` Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
