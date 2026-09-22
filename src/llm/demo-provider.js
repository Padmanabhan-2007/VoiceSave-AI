/**
 * VoiceSave AI - Demo LLM Provider
 * Produces realistic, high quality responses with streaming simulation for offline/demo workflows.
 */

import { LLMProvider } from './provider.js';

export const DEMO_RESPONSES = {
  'quantum': 'Quantum computing is a type of computing that uses quantum mechanical effects, such as superposition and entanglement, to process information differently and exponentially faster for certain complex problems than traditional binary computers.',
  'polymorphism': 'Polymorphism in Java allows objects to be treated as instances of their parent class rather than their actual class. The most common use of polymorphism in OOP occurs when a parent class reference is used to refer to a child class object, enabling dynamic method dispatch at runtime.',
  'ssd': 'An SSD, or Solid State Drive, is a modern data storage device that uses flash memory chips instead of spinning magnetic platters. This allows SSDs to read and write data nearly instantaneously, drastically improving boot times, file transfers, and overall system responsiveness.',
  'closure': 'A closure in JavaScript is the combination of a function bundled together with references to its surrounding lexical state. In other words, a closure gives an inner function access to an outer function’s scope even after the outer function has finished executing.',
  'machine learning': 'Machine learning is a subset of artificial intelligence focused on building applications that learn from data and improve their accuracy over time without being explicitly programmed for every scenario.',
  'photosynthesis': 'Photosynthesis is the biological process by which green plants and certain other organisms transform light energy into chemical energy. During photosynthesis, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds.'
};

export class DemoLLMProvider extends LLMProvider {
  constructor() {
    super('DemoLLMProvider');
  }

  /**
   * Finds the best matching mock answer or generates a realistic AI explanation
   * @param {string} question
   * @returns {string}
   */
  getAnswer(question) {
    const q = (question || '').toLowerCase();

    for (const [key, answer] of Object.entries(DEMO_RESPONSES)) {
      if (q.includes(key)) {
        return answer;
      }
    }

    return `Here is a clear explanation of "${question.trim()}": In modern technology and science, this concept represents an essential framework designed to solve challenging problems through structured principles, reliable optimization, and systematic execution.`;
  }

  /**
   * Simulates streaming output token-by-token
   * @param {string} question
   * @param {Function} [onChunk]
   * @returns {Promise<string>}
   */
  async ask(question, onChunk = null) {
    const fullAnswer = this.getAnswer(question);

    if (!onChunk) {
      return fullAnswer;
    }

    // Stream words with realistic typing delays
    const words = fullAnswer.split(' ');
    let currentText = '';

    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? '' : ' ') + words[i];
      onChunk(words[i], currentText);
      // Small randomized delay to feel natural
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 20));
    }

    return fullAnswer;
  }
}
