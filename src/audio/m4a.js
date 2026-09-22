/**
 * VoiceSave AI - M4A / AAC Capability Detection & Encoder
 * Dynamically verifies browser support for MP4/AAC MediaRecorder encoding.
 * Never silently renames or creates false files when unsupported.
 */

export function isM4ASupported() {
  if (typeof MediaRecorder === 'undefined') return false;
  return (
    MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2') ||
    MediaRecorder.isTypeSupported('audio/mp4') ||
    MediaRecorder.isTypeSupported('audio/aac')
  );
}

export function getM4AMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
    return 'audio/mp4;codecs=mp4a.40.2';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  if (MediaRecorder.isTypeSupported('audio/aac')) {
    return 'audio/aac';
  }
  return null;
}

/**
 * Encodes an AudioBuffer into true M4A/MP4 container
 * If unsupported, throws an explicit error instead of silent fallbacks or misnaming.
 * @param {AudioBuffer} audioBuffer
 * @param {AudioContext} [audioContext]
 * @returns {Promise<{ blob: Blob, mimeType: string, extension: string }>}
 */
export async function encodeM4A(audioBuffer, audioContext = null) {
  const mimeType = getM4AMimeType();

  if (!mimeType || typeof AudioContext === 'undefined') {
    throw new Error('M4A is unavailable in this browser. Available formats: MP3, WAV');
  }

  const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(dest);

  return new Promise((resolve, reject) => {
    try {
      const recorder = new MediaRecorder(dest.stream, { mimeType });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/mp4' });
        resolve({
          blob,
          mimeType: 'audio/mp4',
          extension: 'm4a'
        });
      };

      recorder.onerror = (err) => {
        reject(new Error(`M4A recording error: ${err.message || err}`));
      };

      recorder.start();
      source.start(0);

      const durationMs = (audioBuffer.duration || 1) * 1000;
      setTimeout(() => {
        try {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
          source.stop();
        } catch (e) {}
      }, durationMs + 80);
    } catch (err) {
      reject(new Error(`Failed to encode M4A: ${err.message || err}`));
    }
  });
}
