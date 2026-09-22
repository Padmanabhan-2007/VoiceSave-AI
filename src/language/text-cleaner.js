/**
 * VoiceSave AI - Text Cleaner, Chunker & Speech Normalizer
 * Sanitizes markdown, headings, citations, and code blocks before TTS or translation.
 * Provides punctuation-aware chunking for long texts and scripts without truncation.
 */

export class TextCleaner {
  /**
   * Prepares raw LLM text for speech synthesis and translation
   * @param {string} text - Raw text/markdown
   * @param {Object} options - { readCodeBlocks: boolean }
   * @returns {string} Cleaned, speakable text
   */
  static cleanForSpeech(text, options = {}) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text;

    // 1. Code blocks handling: skip or announce
    if (options.readCodeBlocks) {
      cleaned = cleaned.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return ` Code snippet in ${lang || 'programming language'}: ${code} `;
      });
    } else {
      cleaned = cleaned.replace(/```[\s\S]*?```/g, ' [Code snippet omitted for speech] ');
      cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    }

    // 2. Headings: "# Title" -> "Title." so speech pauses naturally
    cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1.');

    // 3. Remove citations like [1], [2], [citation needed]
    cleaned = cleaned.replace(/\[\d+\]/g, '');
    cleaned = cleaned.replace(/\[citation\s+needed\]/gi, '');

    // 4. Markdown links: [anchor text](url) -> anchor text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 5. Bare URLs: https://example.com -> website link
    cleaned = cleaned.replace(/https?:\/\/\S+/g, 'link');

    // 6. Bullet points and lists: convert "-" or "*" to natural punctuation
    cleaned = cleaned.replace(/^[\s*•-]+\s+/gm, '• ');

    // 7. Bold & Italics: **text** or *text* -> text
    cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1');

    // 8. Blockquotes: "> quote" -> quote
    cleaned = cleaned.replace(/^>\s+/gm, '');

    // 9. Tables: remove table separators |---|---|
    cleaned = cleaned.replace(/\|[-:\s|]+\|/g, '');
    cleaned = cleaned.replace(/\|/g, ', ');

    // 10. Normalize multiple spaces and extra linebreaks
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Splits long arbitrary text into sequential, sentence/clause-aware chunks
   * suitable for TTS engines (e.g. Google Online TTS max 180 chars, Web Speech API safety).
   * Guarantees zero silent truncation and preserves semantic sentence boundaries.
   * @param {string} text - Raw input text or cleaned speech text
   * @param {number} [maxChars=175] - Maximum characters per chunk
   * @returns {string[]} Ordered array of text chunks
   */
  static chunkText(text, maxChars = 175) {
    if (!text || typeof text !== 'string') return [];
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) {
      return [trimmed];
    }

    const chunks = [];
    // Split on sentence boundaries: periods, exclamation marks, question marks, Indic danda (।)
    const sentenceDelim = /([.!?।\n]+)/g;
    const parts = trimmed.split(sentenceDelim);

    // Reconstruct sentences with their delimiters
    const sentences = [];
    for (let i = 0; i < parts.length; i += 2) {
      const sentenceText = parts[i] || '';
      const delim = parts[i + 1] || '';
      const combined = (sentenceText + delim).trim();
      if (combined.length > 0) {
        sentences.push(combined);
      }
    }

    let currentChunk = '';

    for (const sentence of sentences) {
      // If a single sentence fits with current accumulator
      if ((currentChunk + ' ' + sentence).trim().length <= maxChars) {
        currentChunk = (currentChunk + ' ' + sentence).trim();
      } else {
        // Flush current chunk if non-empty
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        // If the sentence itself is longer than maxChars, break down by sub-clauses (, ; :)
        if (sentence.length > maxChars) {
          const subClauses = sentence.split(/([,;:\-—]\s*)/);
          let subChunk = '';
          for (let s = 0; s < subClauses.length; s++) {
            const piece = subClauses[s];
            if ((subChunk + piece).length <= maxChars) {
              subChunk += piece;
            } else {
              if (subChunk.trim().length > 0) {
                chunks.push(subChunk.trim());
              }
              // If single piece exceeds maxChars, split on words
              if (piece.length > maxChars) {
                const words = piece.split(/\s+/);
                let wordChunk = '';
                for (const w of words) {
                  if ((wordChunk + ' ' + w).trim().length <= maxChars) {
                    wordChunk = (wordChunk + ' ' + w).trim();
                  } else {
                    if (wordChunk.length > 0) chunks.push(wordChunk);
                    wordChunk = w;
                  }
                }
                subChunk = wordChunk;
              } else {
                subChunk = piece;
              }
            }
          }
          if (subChunk.trim().length > 0) {
            currentChunk = subChunk.trim();
          }
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(c => c.length > 0);
  }

  /**
   * Protects code blocks during translation so syntax is not altered
   * @param {string} text
   * @returns {{ maskedText: string, placeholders: Map<string, string> }}
   */
  static maskCodeBlocks(text) {
    if (!text) return { maskedText: '', placeholders: new Map() };
    const placeholders = new Map();
    let idx = 0;

    // Fenced code blocks
    let maskedText = text.replace(/```[\s\S]*?```/g, (match) => {
      const token = `__VOICESAVE_CODE_${idx++}__`;
      placeholders.set(token, match);
      return token;
    });

    // Inline code blocks
    maskedText = maskedText.replace(/`[^`\n]+`/g, (match) => {
      const token = `__VOICESAVE_INLINE_${idx++}__`;
      placeholders.set(token, match);
      return token;
    });

    return { maskedText, placeholders };
  }

  /**
   * Restores protected code blocks after translation
   * @param {string} text
   * @param {Map<string, string>} placeholders
   * @returns {string}
   */
  static unmaskCodeBlocks(text, placeholders) {
    if (!text || !placeholders || placeholders.size === 0) return text;
    let unmasked = text;
    for (const [token, original] of placeholders.entries()) {
      unmasked = unmasked.replace(token, original);
    }
    return unmasked;
  }
}
