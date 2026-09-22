/**
 * VoiceSave AI - Canonical 16-bit PCM RIFF WAV Encoder
 * Converts AudioBuffer / Float32Array PCM into valid, standard-compliant audio/wav Blob
 */

export function encodeWAV(audioBuffer, options = {}) {
  const numChannels = options.numChannels || audioBuffer.numberOfChannels || 1;
  const sampleRate = options.sampleRate || audioBuffer.sampleRate || 44100;
  
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
    throw new Error('Invalid audio data provided to encodeWAV');
  }

  const length = leftChannel.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII strings into DataView
  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // Little endian
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);              // AudioFormat (1 = Linear PCM)
  view.setUint16(22, numChannels, true);    // NumChannels
  view.setUint32(24, sampleRate, true);     // SampleRate
  view.setUint32(28, byteRate, true);       // ByteRate
  view.setUint16(32, blockAlign, true);     // BlockAlign
  view.setUint16(34, bitsPerSample, true);  // BitsPerSample (16-bit)

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < length; i++) {
    // Left channel
    let sample = Math.max(-1, Math.min(1, leftChannel[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;

    if (numChannels > 1) {
      sample = Math.max(-1, Math.min(1, rightChannel[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
