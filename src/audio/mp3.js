/**
 * VoiceSave AI - Client-side MPEG-1 Layer III (MP3) Encoder
 * Uses bundled LAME MP3 encoder (lamejs) to encode raw PCM into true MP3 files.
 */

export async function getLameInstance() {
  if (typeof globalThis !== 'undefined' && globalThis.lamejs) {
    return globalThis.lamejs;
  }
  if (typeof window !== 'undefined' && window.lamejs) {
    return window.lamejs;
  }
  if (typeof self !== 'undefined' && self.lamejs) {
    return self.lamejs;
  }

  // 1. Dynamic script injection in browser DOM (content script, popup, options, demo)
  if (typeof document !== 'undefined' && document.head) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          script.src = chrome.runtime.getURL('src/audio/lame.min.js');
        } else {
          script.src = '../audio/lame.min.js';
        }
        script.onload = () => resolve();
        script.onerror = () => {
          // Secondary fallback attempt for root-relative or direct path
          const fallback = document.createElement('script');
          fallback.src = '/src/audio/lame.min.js';
          fallback.onload = () => resolve();
          fallback.onerror = reject;
          document.head.appendChild(fallback);
        };
        document.head.appendChild(script);
      });

      if (typeof window !== 'undefined' && window.lamejs) {
        return window.lamejs;
      }
      if (typeof globalThis !== 'undefined' && globalThis.lamejs) {
        return globalThis.lamejs;
      }
    } catch (e) {
      console.warn('VoiceSave AI: Dynamic script load of lame.min.js failed:', e);
    }
  }

  // 2. Web Worker context
  if (typeof importScripts === 'function') {
    try {
      importScripts('/src/audio/lame.min.js');
      if (self.lamejs) return self.lamejs;
    } catch (e) {}
  }

  // 3. Node.js environment: load verified bundled lame.min.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const vm = await import('vm');
      const candidatePaths = [
        path.resolve('src/audio/lame.min.js'),
        path.resolve('./src/audio/lame.min.js'),
        path.resolve('../src/audio/lame.min.js')
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const code = fs.readFileSync(p, 'utf8');
          const vmCtx = { window: {}, self: {}, globalThis: {} };
          vm.createContext(vmCtx);
          vm.runInContext(code, vmCtx);
          if (vmCtx.lamejs) {
            globalThis.lamejs = vmCtx.lamejs;
            return vmCtx.lamejs;
          }
        }
      }
    } catch (e) {}
  }

  throw new Error('LAME MP3 encoder library is not loaded');
}

/**
 * Encodes Float32Array PCM or AudioBuffer to an audio/mp3 Blob
 * @param {AudioBuffer|Float32Array|Object} audioBuffer
 * @param {Object} options
 * @returns {Promise<Blob>}
 */
export async function encodeMP3(audioBuffer, options = {}) {
  const lamejs = await getLameInstance();
  const numChannels = options.numChannels || audioBuffer.numberOfChannels || 1;
  const sampleRate = options.sampleRate || audioBuffer.sampleRate || 44100;
  const kbps = options.kbps || 128;

  // Extract channel samples
  let leftChannel;
  let rightChannel;

  if (audioBuffer.getChannelData) {
    leftChannel = audioBuffer.getChannelData(0);
    rightChannel = numChannels > 1 && audioBuffer.numberOfChannels > 1 
      ? audioBuffer.getChannelData(1) 
      : leftChannel;
  } else if (audioBuffer.left) {
    leftChannel = audioBuffer.left;
    rightChannel = audioBuffer.right || leftChannel;
  } else if (audioBuffer instanceof Float32Array) {
    leftChannel = audioBuffer;
    rightChannel = audioBuffer;
  } else {
    throw new Error('Invalid audio data provided to encodeMP3');
  }

  // Convert Float32Array (-1.0 .. +1.0) to Int16Array (-32768 .. 32767)
  const sampleCount = leftChannel.length;
  const leftInt16 = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const s = Math.max(-1, Math.min(1, leftChannel[i]));
    leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  let rightInt16 = null;
  if (numChannels > 1) {
    rightInt16 = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const s = Math.max(-1, Math.min(1, rightChannel[i]));
      rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  }

  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data = [];
  const chunkSize = 1152; // standard MP3 chunk size

  for (let i = 0; i < sampleCount; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, i + chunkSize);
    let chunk;
    if (numChannels === 1) {
      chunk = encoder.encodeBuffer(leftChunk);
    } else {
      const rightChunk = rightInt16.subarray(i, i + chunkSize);
      chunk = encoder.encodeBuffer(leftChunk, rightChunk);
    }
    if (chunk.length > 0) {
      mp3Data.push(chunk);
    }
  }

  const flush = encoder.flush();
  if (flush.length > 0) {
    mp3Data.push(flush);
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}
