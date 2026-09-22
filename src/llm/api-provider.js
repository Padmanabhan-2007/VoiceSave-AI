/**
 * VoiceSave AI - Cloud API LLM Provider (OpenAI / Anthropic)
 */

import { LLMProvider } from './provider.js';

export class ApiLLMProvider extends LLMProvider {
  constructor(config = {}) {
    super('ApiLLMProvider');
    this.provider = config.provider || 'openai'; // 'openai' | 'anthropic'
    this.apiKey = config.apiKey || '';
    this.model = config.model || (this.provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-haiku-20240307');
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.trim().length > 0);
  }

  async ask(question, onChunk = null) {
    if (!this.isConfigured()) {
      throw new Error('LLM API key is not configured. Please add your key in extension Settings or enable Demo Mode.');
    }

    if (this.provider === 'openai') {
      return await this._askOpenAI(question, onChunk);
    } else if (this.provider === 'anthropic') {
      return await this._askAnthropic(question, onChunk);
    } else {
      throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  async _askOpenAI(question, onChunk) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful, concise AI assistant providing clear explanations.' },
          { role: 'user', content: question }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'No response content returned.';
    if (onChunk) onChunk(answer, answer);
    return answer;
  }

  async _askAnthropic(question, onChunk) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: this.model || 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: question }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || 'No response content returned.';
    if (onChunk) onChunk(answer, answer);
    return answer;
  }
}
