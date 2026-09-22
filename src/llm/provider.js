/**
 * VoiceSave AI - Base LLM Provider Interface
 */

export class LLMProvider {
  constructor(name = 'BaseLLMProvider') {
    this.name = name;
  }

  /**
   * Sends a prompt/question and receives the answer (optionally streaming)
   * @param {string} question
   * @param {Function} [onChunk] - callback(partialText, fullText)
   * @returns {Promise<string>}
   */
  async ask(question, onChunk = null) {
    throw new Error('ask() must be implemented by subclass');
  }
}
