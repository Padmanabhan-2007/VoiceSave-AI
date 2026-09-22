/**
 * VoiceSave AI - Supported Languages Catalog
 * Definitive dictionary with priority Indian languages and major global languages.
 */

export const SUPPORTED_LANGUAGES = [
  // Special Modes
  {
    code: 'auto',
    name: 'Auto Detect',
    nativeName: 'Auto Detect',
    displayName: 'Auto Detect (Smart)',
    defaultLocale: 'en-US',
    isSpecial: true
  },
  {
    code: 'original',
    name: 'Original Language',
    nativeName: 'Original Language',
    displayName: 'Original Language',
    defaultLocale: 'en-US',
    isSpecial: true
  },

  // Priority Indian Languages
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    displayName: 'English (India / Global)',
    defaultLocale: 'en-IN',
    script: 'Latin',
    isIndianLanguage: true
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    displayName: 'Hindi — हिन्दी',
    defaultLocale: 'hi-IN',
    script: 'Devanagari',
    isIndianLanguage: true
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    displayName: 'Tamil — தமிழ்',
    defaultLocale: 'ta-IN',
    script: 'Tamil',
    isIndianLanguage: true
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    displayName: 'Telugu — తెలుగు',
    defaultLocale: 'te-IN',
    script: 'Telugu',
    isIndianLanguage: true
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    displayName: 'Kannada — ಕನ್ನಡ',
    defaultLocale: 'kn-IN',
    script: 'Kannada',
    isIndianLanguage: true
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    displayName: 'Malayalam — മലയാളം',
    defaultLocale: 'ml-IN',
    script: 'Malayalam',
    isIndianLanguage: true
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    displayName: 'Bengali — বাংলা',
    defaultLocale: 'bn-IN',
    script: 'Bengali',
    isIndianLanguage: true
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    displayName: 'Marathi — मराठी',
    defaultLocale: 'mr-IN',
    script: 'Devanagari',
    isIndianLanguage: true
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    displayName: 'Gujarati — ગુજરાતી',
    defaultLocale: 'gu-IN',
    script: 'Gujarati',
    isIndianLanguage: true
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    displayName: 'Punjabi — ਪੰਜਾਬੀ',
    defaultLocale: 'pa-IN',
    script: 'Gurmukhi',
    isIndianLanguage: true
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    displayName: 'Urdu — اردو',
    defaultLocale: 'ur-IN',
    script: 'Arabic',
    isIndianLanguage: true
  },

  // Major Global Languages
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    displayName: 'Spanish — Español',
    defaultLocale: 'es-ES',
    script: 'Latin',
    isIndianLanguage: false
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    displayName: 'French — Français',
    defaultLocale: 'fr-FR',
    script: 'Latin',
    isIndianLanguage: false
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    displayName: 'Portuguese — Português',
    defaultLocale: 'pt-BR',
    script: 'Latin',
    isIndianLanguage: false
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    displayName: 'German — Deutsch',
    defaultLocale: 'de-DE',
    script: 'Latin',
    isIndianLanguage: false
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    displayName: 'Italian — Italiano',
    defaultLocale: 'it-IT',
    script: 'Latin',
    isIndianLanguage: false
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    displayName: 'Dutch — Nederlands',
    defaultLocale: 'nl-NL',
    script: 'Latin',
    isIndianLanguage: false
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    displayName: 'Russian — Русский',
    defaultLocale: 'ru-RU',
    script: 'Cyrillic',
    isIndianLanguage: false
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    displayName: 'Japanese — 日本語',
    defaultLocale: 'ja-JP',
    script: 'Japanese',
    isIndianLanguage: false
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    displayName: 'Korean — 한국어',
    defaultLocale: 'ko-KR',
    script: 'Hangul',
    isIndianLanguage: false
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    displayName: 'Chinese — 中文',
    defaultLocale: 'zh-CN',
    script: 'Han',
    isIndianLanguage: false
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    displayName: 'Arabic — العربية',
    defaultLocale: 'ar-SA',
    script: 'Arabic',
    isIndianLanguage: false
  }
];

export const INDIAN_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.isIndianLanguage);
export const GLOBAL_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => !l.isSpecial && !l.isIndianLanguage);

/**
 * Returns language definition by code
 * @param {string} code - ISO code (e.g. 'ta', 'hi', 'en')
 */
export function getLanguageByCode(code) {
  if (!code) return SUPPORTED_LANGUAGES.find((l) => l.code === 'en');
  const normalized = code.toLowerCase().split(/[-_]/)[0];
  return (
    SUPPORTED_LANGUAGES.find((l) => l.code === code) ||
    SUPPORTED_LANGUAGES.find((l) => l.code === normalized) ||
    SUPPORTED_LANGUAGES.find((l) => l.code === 'en')
  );
}

/**
 * Script Unicode ranges for smart language detection
 */
export const UNICODE_SCRIPTS = [
  { script: 'Tamil', lang: 'ta', regex: /[\u0B80-\u0BFF]/g },
  { script: 'Telugu', lang: 'te', regex: /[\u0C00-\u0C7F]/g },
  { script: 'Kannada', lang: 'kn', regex: /[\u0C80-\u0CFF]/g },
  { script: 'Malayalam', lang: 'ml', regex: /[\u0D00-\u0D7F]/g },
  { script: 'Devanagari', lang: 'hi', regex: /[\u0900-\u097F]/g },
  { script: 'Bengali', lang: 'bn', regex: /[\u0980-\u09FF]/g },
  { script: 'Gujarati', lang: 'gu', regex: /[\u0A80-\u0AFF]/g },
  { script: 'Gurmukhi', lang: 'pa', regex: /[\u0A00-\u0A7F]/g },
  { script: 'Arabic', lang: 'ur', regex: /[\u0600-\u06FF\u0750-\u077F]/g },
  { script: 'Japanese', lang: 'ja', regex: /[\u3040-\u309F\u30A0-\u30FF]/g },
  { script: 'Hangul', lang: 'ko', regex: /[\uAC00-\uD7AF\u1100-\u11FF]/g },
  { script: 'Han', lang: 'zh', regex: /[\u4E00-\u9FFF]/g },
  { script: 'Cyrillic', lang: 'ru', regex: /[\u0400-\u04FF]/g }
];
