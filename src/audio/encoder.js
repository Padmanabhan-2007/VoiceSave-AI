/**
 * VoiceSave AI - Unified Audio Conversion Layer with Integrity Validation
 * Encodes AudioBuffer into genuine WAV, MP3, or M4A formats.
 * Performs immediate validation to guarantee valid container format and playback integrity.
 */

import { encodeWAV } from './wav.js';
import { encodeMP3 } from './mp3.js';
import { encodeM4A, isM4ASupported } from './m4a.js';
import { validateAudioFile } from './validator.js';

export const SUPPORTED_FORMATS = ['MP3', 'WAV', 'M4A'];

/**
 * Encodes audio buffer into requested format and validates the result
 * @param {AudioBuffer|Float32Array|Object} audioBuffer
 * @param {'MP3'|'WAV'|'M4A'|string} format
 * @param {Object} options
 * @returns {Promise<{ blob: Blob, mimeType: string, extension: string, validation: Object }>}
 */
export async function encodeAudio(audioBuffer, format = 'MP3', options = {}) {
  const normalizedFormat = (format || 'MP3').toUpperCase();

  let result;
  switch (normalizedFormat) {
    case 'WAV': {
      const blob = encodeWAV(audioBuffer, options);
      result = {
        blob,
        mimeType: 'audio/wav',
        extension: 'wav'
      };
      break;
    }

    case 'MP3': {
      const blob = await encodeMP3(audioBuffer, options);
      result = {
        blob,
        mimeType: 'audio/mp3',
        extension: 'mp3'
      };
      break;
    }

    case 'M4A': {
      if (!isM4ASupported()) {
        throw new Error('M4A is unavailable in this browser. Available formats: MP3, WAV');
      }
      result = await encodeM4A(audioBuffer, options.audioContext);
      break;
    }

    default:
      throw new Error(`Unsupported audio format: ${format}. Supported formats are: ${SUPPORTED_FORMATS.join(', ')}`);
  }

  // Validate the generated audio file
  const validation = await validateAudioFile(result.blob, normalizedFormat);
  if (!validation.valid) {
    throw new Error(`Audio validation failed for ${normalizedFormat}: ${validation.error}`);
  }

  return {
    ...result,
    validation
  };
}

export { isM4ASupported };
