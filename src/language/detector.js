/**
 * VoiceSave AI - Advanced Language Detection Layer
 * Multi-stage pipeline:
 * SCRIPT DETECTION → LANGUAGE IDENTIFICATION → CONFIDENCE SCORING → FALLBACK
 * Fully handles Indic scripts, Devanagari disambiguation (Hindi vs Marathi),
 * and code-switching (Tanglish, Hinglish, technical English mixed vocabulary).
 */

import { UNICODE_SCRIPTS, getLanguageByCode } from './languages.js';

export class LanguageDetector {
  /**
   * Detects the language of the provided text with confidence and methodology metrics
   * @param {string} text
   * @param {string} [fallbackLanguage='en']
   * @returns {{ language: string, code: string, name: string, nativeName: string, confidence: number, method: string, isConfident: boolean, script: string, isIndianLanguage: boolean, message?: string }}
   */
  static detectLanguage(text, fallbackLanguage = 'en') {
    const resolvedFallback = fallbackLanguage === 'auto' || fallbackLanguage === 'original' ? 'en' : fallbackLanguage;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const def = getLanguageByCode(resolvedFallback);
      return {
        language: def.code,
        code: def.code,
        name: def.name,
        nativeName: def.nativeName,
        confidence: 0.50,
        method: 'fallback-empty-input',
        isConfident: false,
        script: def.script || 'Latin',
        isIndianLanguage: !!def.isIndianLanguage
      };
    }

    // 1. Text Cleaning: strip code fences, URLs, digits, markdown syntax
    // BUT preserve words and mixed vocabulary
    const cleaned = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[0-9\-_#*>[\]()]/g, ' ')
      .trim();

    if (cleaned.length === 0) {
      const def = getLanguageByCode(resolvedFallback);
      return {
        language: def.code,
        code: def.code,
        name: def.name,
        nativeName: def.nativeName,
        confidence: 0.50,
        method: 'fallback-no-text',
        isConfident: false,
        script: def.script || 'Latin',
        isIndianLanguage: !!def.isIndianLanguage
      };
    }

    // 2. Script Detection: Count Unicode characters across known scripts
    const totalChars = cleaned.length;
    let highestIndicCount = 0;
    let detectedScriptItem = null;

    for (const item of UNICODE_SCRIPTS) {
      const matches = cleaned.match(item.regex);
      const count = matches ? matches.length : 0;
      if (count > highestIndicCount) {
        highestIndicCount = count;
        detectedScriptItem = item;
      }
    }

    // 3. Indic & Vernacular Script Branch
    // Code-switching detection: even a 7%+ presence of an Indic script (or >=3 characters)
    // indicates the vernacular target language (e.g. "SSD என்பது fast storage device ஆகும்.")
    if (detectedScriptItem && highestIndicCount >= 3 && (highestIndicCount / totalChars) > 0.07) {
      let langCode = detectedScriptItem.lang;
      let method = 'script+vernacular-analysis';
      let confidence = Math.min(0.98, Math.max(0.85, (highestIndicCount / totalChars) * 1.6));
      let isConfident = true;
      let message = undefined;

      // Section 11: Handle Devanagari Correctly (Hindi vs Marathi)
      if (detectedScriptItem.script === 'Devanagari') {
        const hasMarathiUniqueChar = /[\u0933]/.test(cleaned); // Marathi character 'ळ'
        const hasMarathiWords = /\b(आहे|नाही|झाले|केले|आणि|मध्ये|करतात|होते|म्हणून)\b/i.test(cleaned);
        const hasHindiWords = /\b(है|हूँ|था|थी|थे|के|में|और|का|की|को|होता|होती|हैं|इस|यह|वह)\b/i.test(cleaned);

        if (hasMarathiUniqueChar || hasMarathiWords) {
          langCode = 'mr';
          method = 'script+marathi-lexical';
          confidence = 0.94;
        } else if (hasHindiWords) {
          langCode = 'hi';
          method = 'script+hindi-lexical';
          confidence = 0.95;
        } else {
          // Ambiguous Devanagari text without conclusive lexical markers
          langCode = resolvedFallback === 'mr' ? 'mr' : 'hi';
          confidence = 0.62;
          isConfident = false;
          method = 'script-devanagari-ambiguous';
          message = 'Unable to confidently identify the language between Hindi and Marathi. Using your selected language.';
        }
      } else {
        // Pure or code-switched non-Devanagari Indic scripts (Tamil, Telugu, Kannada, Malayalam, Bengali, etc.)
        method = highestIndicCount / totalChars > 0.40 ? 'script+language-analysis' : 'script+code-switching';
      }

      const langObj = getLanguageByCode(langCode);
      return {
        language: langObj.code,
        code: langObj.code,
        name: langObj.name,
        nativeName: langObj.nativeName,
        confidence: parseFloat(confidence.toFixed(2)),
        method,
        isConfident,
        script: detectedScriptItem.script,
        isIndianLanguage: true,
        ...(message ? { message } : {})
      };
    }

    // 4. Latin Script Analysis: Differentiate English, Spanish, French, German, Italian, etc.
    const lower = cleaned.toLowerCase();
    const words = lower.split(/\s+/).filter((w) => w.length > 1);

    const latinProfiles = [
      {
        lang: 'es',
        keywords: ['el', 'la', 'los', 'las', 'un', 'una', 'es', 'son', 'que', 'en', 'de', 'para', 'con', 'por', 'como', 'su'],
        script: 'Latin'
      },
      {
        lang: 'fr',
        keywords: ['le', 'la', 'les', 'un', 'une', 'est', 'sont', 'que', 'dans', 'pour', 'avec', 'par', 'ce', 'qui', 'sur'],
        script: 'Latin'
      },
      {
        lang: 'de',
        keywords: ['der', 'die', 'das', 'ein', 'eine', 'ist', 'sind', 'und', 'in', 'von', 'mit', 'für', 'nicht', 'auf', 'den'],
        script: 'Latin'
      },
      {
        lang: 'pt',
        keywords: ['o', 'a', 'os', 'as', 'um', 'uma', 'é', 'são', 'que', 'em', 'de', 'para', 'com', 'por', 'como'],
        script: 'Latin'
      },
      {
        lang: 'it',
        keywords: ['il', 'la', 'lo', 'i', 'gli', 'le', 'un', 'una', 'è', 'sono', 'che', 'in', 'di', 'per', 'con'],
        script: 'Latin'
      },
      {
        lang: 'nl',
        keywords: ['de', 'het', 'een', 'is', 'zijn', 'en', 'van', 'in', 'met', 'voor', 'op', 'niet'],
        script: 'Latin'
      }
    ];

    let bestLatin = null;
    let maxMatches = 0;

    for (const profile of latinProfiles) {
      let matches = 0;
      for (const w of words) {
        if (profile.keywords.includes(w)) matches++;
      }
      if (matches > maxMatches && matches >= 3) {
        maxMatches = matches;
        bestLatin = profile;
      }
    }

    if (bestLatin) {
      const langObj = getLanguageByCode(bestLatin.lang);
      return {
        language: langObj.code,
        code: langObj.code,
        name: langObj.name,
        nativeName: langObj.nativeName,
        confidence: 0.92,
        method: 'latin-lexical-analysis',
        isConfident: true,
        script: 'Latin',
        isIndianLanguage: false
      };
    }

    // Default to English or specified fallback
    const def = getLanguageByCode(resolvedFallback);
    return {
      language: def.code,
      code: def.code,
      name: def.name,
      nativeName: def.nativeName,
      confidence: 0.88,
      method: 'latin-default-fallback',
      isConfident: true,
      script: def.script || 'Latin',
      isIndianLanguage: !!def.isIndianLanguage
    };
  }
}
