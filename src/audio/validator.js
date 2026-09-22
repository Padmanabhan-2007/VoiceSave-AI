/**
 * VoiceSave AI - Audio File Integrity & Validation Layer
 * Deep inspection and validation for WAV, MP3, and M4A/AAC containers.
 * Ensures the generated audio has valid headers, bit depth, frame syncs,
 * non-zero duration, and legitimate playable stream content.
 */

/**
 * Validates 16-bit PCM RIFF WAV format
 * @param {Blob|ArrayBuffer} data
 * @returns {Promise<{ valid: boolean, format: string, duration: number, sampleRate: number, channels: number, error?: string }>}
 */
export async function validateWAV(data) {
  try {
    const arrayBuffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
    if (arrayBuffer.byteLength < 44) {
      return { valid: false, format: 'WAV', error: 'File size is too small to contain a standard 44-byte WAV header' };
    }

    const view = new DataView(arrayBuffer);
    const readString = (offset, length) => {
      let str = '';
      for (let i = 0; i < length; i++) {
        str += String.fromCharCode(view.getUint8(offset + i));
      }
      return str;
    };

    // 1. RIFF Header
    const riff = readString(0, 4);
    if (riff !== 'RIFF') {
      return { valid: false, format: 'WAV', error: `Invalid RIFF header: expected "RIFF", found "${riff}"` };
    }

    // 2. Format
    const wave = readString(8, 4);
    if (wave !== 'WAVE') {
      return { valid: false, format: 'WAV', error: `Invalid WAVE header: expected "WAVE", found "${wave}"` };
    }

    // 3. "fmt " Subchunk
    const fmt = readString(12, 4);
    if (fmt !== 'fmt ') {
      return { valid: false, format: 'WAV', error: `Invalid subchunk: expected "fmt ", found "${fmt}"` };
    }

    const subchunk1Size = view.getUint32(16, true);
    const audioFormat = view.getUint16(20, true);
    if (audioFormat !== 1) {
      return { valid: false, format: 'WAV', error: `Unsupported audio format: ${audioFormat} (must be 1 for PCM)` };
    }

    const numChannels = view.getUint16(22, true);
    if (numChannels < 1 || numChannels > 8) {
      return { valid: false, format: 'WAV', error: `Invalid channels count: ${numChannels}` };
    }

    const sampleRate = view.getUint32(24, true);
    if (sampleRate < 8000 || sampleRate > 192000) {
      return { valid: false, format: 'WAV', error: `Invalid sample rate: ${sampleRate} Hz` };
    }

    const bitsPerSample = view.getUint16(34, true);
    if (bitsPerSample !== 16) {
      return { valid: false, format: 'WAV', error: `Expected 16-bit PCM, found ${bitsPerSample}-bit` };
    }

    // 4. "data" Subchunk
    let dataOffset = 20 + subchunk1Size;
    while (dataOffset < arrayBuffer.byteLength - 8) {
      const chunkId = readString(dataOffset, 4);
      const chunkSize = view.getUint32(dataOffset + 4, true);
      if (chunkId === 'data') {
        const bytesPerSample = (bitsPerSample / 8) * numChannels;
        const totalSamples = chunkSize / bytesPerSample;
        const duration = totalSamples / sampleRate;

        return {
          valid: true,
          format: 'WAV',
          sampleRate,
          channels: numChannels,
          bitsPerSample,
          duration: parseFloat(duration.toFixed(2)),
          dataSize: chunkSize
        };
      }
      dataOffset += 8 + chunkSize;
    }

    return { valid: false, format: 'WAV', error: 'Missing "data" chunk in WAV file' };
  } catch (err) {
    return { valid: false, format: 'WAV', error: err.message || 'Error parsing WAV' };
  }
}

/**
 * Validates MPEG-1 Layer III (MP3) format
 * Performs stream analysis, verifies frame sync words, bitrates, sample rates,
 * and confirms duration and playable frames.
 * @param {Blob|ArrayBuffer} data
 * @returns {Promise<{ valid: boolean, format: string, duration: number, framesCount: number, sampleRate: number, bitrate: number, error?: string }>}
 */
export async function validateMP3(data) {
  try {
    const arrayBuffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
    if (arrayBuffer.byteLength < 128) {
      return { valid: false, format: 'MP3', error: 'File size is too small to contain valid MP3 frames' };
    }

    const bytes = new Uint8Array(arrayBuffer);
    const sampleRateTable = [44100, 48000, 32000];
    const bitrateTableV1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];

    let offset = 0;
    // Skip ID3v2 tag if present (10 bytes header)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const id3Size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
      offset = 10 + id3Size;
    }

    let framesCount = 0;
    let detectedSampleRate = 44100;
    let detectedBitrate = 128;
    let totalSamples = 0;

    // Scan through MP3 frames
    while (offset < bytes.length - 4) {
      // Check frame sync: 11 set bits (0xFF followed by top 3 bits set)
      if (bytes[offset] === 0xFF && (bytes[offset + 1] & 0xE0) === 0xE0) {
        const header = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
        
        const mpegVersion = (header >> 19) & 0x03; // 3 = MPEG-1
        const layer = (header >> 17) & 0x03;       // 1 = Layer III
        const bitrateIdx = (header >> 12) & 0x0F;
        const sampleRateIdx = (header >> 10) & 0x03;
        const padding = (header >> 9) & 0x01;

        if (mpegVersion === 3 && layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && sampleRateIdx < 3) {
          const bitrate = bitrateTableV1L3[bitrateIdx];
          const sampleRate = sampleRateTable[sampleRateIdx];
          detectedBitrate = bitrate;
          detectedSampleRate = sampleRate;

          // Frame size in bytes for Layer III = Math.floor(144 * Bitrate * 1000 / SampleRate) + Padding
          const frameLength = Math.floor((144 * bitrate * 1000) / sampleRate) + padding;
          if (frameLength > 0 && offset + frameLength <= bytes.length + 1) {
            framesCount++;
            totalSamples += 1152; // MPEG-1 Layer III has 1152 samples per frame
            offset += frameLength;
            continue;
          }
        }
      }
      offset++;
    }

    if (framesCount === 0) {
      return { valid: false, format: 'MP3', error: 'No valid MPEG-1 Layer 3 audio frames found in file' };
    }

    const duration = totalSamples / detectedSampleRate;

    return {
      valid: true,
      format: 'MP3',
      framesCount,
      duration: parseFloat(duration.toFixed(2)),
      sampleRate: detectedSampleRate,
      bitrate: detectedBitrate
    };
  } catch (err) {
    return { valid: false, format: 'MP3', error: err.message || 'Error parsing MP3' };
  }
}

/**
 * Validates M4A / MP4 Audio container
 * Checks for standard MP4 atoms (ftyp, moov, mdat)
 * @param {Blob|ArrayBuffer} data
 * @returns {Promise<{ valid: boolean, format: string, hasFtyp: boolean, hasMoovOrMdat: boolean, error?: string }>}
 */
export async function validateM4A(data) {
  try {
    const arrayBuffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
    if (arrayBuffer.byteLength < 32) {
      return { valid: false, format: 'M4A', error: 'File size too small for M4A container' };
    }

    const view = new DataView(arrayBuffer);
    const readString = (offset, length) => {
      let str = '';
      for (let i = 0; i < length; i++) {
        str += String.fromCharCode(view.getUint8(offset + i));
      }
      return str;
    };

    let offset = 0;
    let hasFtyp = false;
    let hasMoovOrMdat = false;

    while (offset < arrayBuffer.byteLength - 8) {
      const atomSize = view.getUint32(offset, false); // big-endian
      const atomType = readString(offset + 4, 4);

      if (atomType === 'ftyp') {
        hasFtyp = true;
      }
      if (atomType === 'moov' || atomType === 'mdat') {
        hasMoovOrMdat = true;
      }

      if (atomSize <= 0 || atomSize > arrayBuffer.byteLength - offset) {
        break;
      }
      offset += atomSize;
    }

    if (hasFtyp || hasMoovOrMdat) {
      return {
        valid: true,
        format: 'M4A',
        hasFtyp,
        hasMoovOrMdat
      };
    }

    return { valid: false, format: 'M4A', error: 'Missing MP4/M4A box structure (ftyp/moov/mdat)' };
  } catch (err) {
    return { valid: false, format: 'M4A', error: err.message || 'Error parsing M4A' };
  }
}

/**
 * Universal Audio Validator
 * @param {Blob|ArrayBuffer} data
 * @param {'WAV'|'MP3'|'M4A'|string} format
 * @returns {Promise<{ valid: boolean, format: string, duration?: number, sampleRate?: number, error?: string }>}
 */
export async function validateAudioFile(data, format) {
  const norm = (format || 'MP3').toUpperCase();
  if (norm === 'WAV') {
    return await validateWAV(data);
  } else if (norm === 'MP3') {
    return await validateMP3(data);
  } else if (norm === 'M4A') {
    return await validateM4A(data);
  } else {
    return { valid: false, format: norm, error: `Unknown format: ${format}` };
  }
}
