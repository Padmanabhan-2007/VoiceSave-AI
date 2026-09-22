/**
 * VoiceSave AI - Audio Recorder State Machine & Resource Manager
 * Manages explicit recording states, elapsed duration timers, race condition locks,
 * and comprehensive cleanup of Object URLs, MediaStreams, and audio nodes.
 */

export const RecorderState = {
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  GENERATING_AUDIO: 'GENERATING_AUDIO',
  READY: 'READY',
  PLAYING: 'PLAYING',
  RECORDING: 'RECORDING',
  STOPPING: 'STOPPING',
  ENCODING: 'ENCODING',
  VALIDATING: 'VALIDATING',
  SAVED: 'SAVED',
  ERROR: 'ERROR'
};

export class AudioRecorderManager {
  constructor(options = {}) {
    this.state = RecorderState.IDLE;
    this.startTime = 0;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.currentData = null;
    this.activeObjectUrls = new Set();
    this.activeStreams = new Set();
    this.activeAudioNodes = new Set();

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onTick = options.onTick || (() => {});
    this.onError = options.onError || (() => {});
  }

  setState(newState, payload = {}) {
    this.state = newState;
    this.onStateChange(newState, {
      state: newState,
      elapsedSeconds: this.elapsedSeconds,
      formattedTime: this.getFormattedTime(),
      ...payload
    });
  }

  getFormattedTime(seconds = this.elapsedSeconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  isBusy() {
    return (
      this.state === RecorderState.PREPARING ||
      this.state === RecorderState.GENERATING_AUDIO ||
      this.state === RecorderState.RECORDING ||
      this.state === RecorderState.STOPPING ||
      this.state === RecorderState.ENCODING ||
      this.state === RecorderState.VALIDATING
    );
  }

  startPreparing() {
    if (this.isBusy()) {
      console.warn('VoiceSave AI: Recorder is already busy in state', this.state);
      return false;
    }
    this.setState(RecorderState.PREPARING);
    return true;
  }

  setGeneratingAudio() {
    this.setState(RecorderState.GENERATING_AUDIO);
  }

  setReady(payload = {}) {
    this.setState(RecorderState.READY, payload);
  }

  setPlaying(payload = {}) {
    this.setState(RecorderState.PLAYING, payload);
  }

  start() {
    if (this.state === RecorderState.RECORDING) {
      console.warn('VoiceSave AI: Recorder is already recording');
      return false;
    }

    this.elapsedSeconds = 0;
    this.startTime = Date.now();
    this.setState(RecorderState.RECORDING);

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.onTick(this.elapsedSeconds, this.getFormattedTime());
    }, 1000);

    return true;
  }

  stopping() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.setState(RecorderState.STOPPING);
  }

  encoding() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.setState(RecorderState.ENCODING);
  }

  validating() {
    this.setState(RecorderState.VALIDATING);
  }

  saved(result) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.currentData = result;
    this.setState(RecorderState.SAVED, { result });
  }

  error(err) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const message = err?.message || String(err) || 'Recording operation failed';
    this.setState(RecorderState.ERROR, { error: message });
    this.onError(err);
  }

  trackUrl(url) {
    if (url) {
      this.activeObjectUrls.add(url);
    }
    return url;
  }

  trackStream(stream) {
    if (stream) {
      this.activeStreams.add(stream);
    }
    return stream;
  }

  trackAudioNode(node) {
    if (node) {
      this.activeAudioNodes.add(node);
    }
    return node;
  }

  cleanupResources() {
    // Revoke Object URLs
    for (const url of this.activeObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    }
    this.activeObjectUrls.clear();

    // Stop MediaStreams
    for (const stream of this.activeStreams) {
      try {
        if (stream.getTracks) {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (e) {}
    }
    this.activeStreams.clear();

    // Stop audio nodes
    for (const node of this.activeAudioNodes) {
      try {
        if (typeof node.stop === 'function') {
          node.stop();
        }
        if (typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch (e) {}
    }
    this.activeAudioNodes.clear();
  }

  reset() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.cleanupResources();
    this.elapsedSeconds = 0;
    this.currentData = null;
    this.setState(RecorderState.IDLE);
  }
}
