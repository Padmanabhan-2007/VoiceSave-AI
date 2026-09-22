/**
 * VoiceSave AI - Automated Multilingual & Translation Test Suite
 */

import { LanguageDetector } from '../src/language/detector.js';
import { DemoTranslationProvider } from '../src/translation/demo-provider.js';
import { TextCleaner } from '../src/language/text-cleaner.js';
import { generateAudioFilename } from '../src/utils/format.js';
import { SUPPORTED_LANGUAGES, INDIAN_LANGUAGES, getLanguageByCode } from '../src/language/languages.js';

async function runMultilingualTests() {
  console.log('====================================================');
  console.log(' VoiceSave AI — Multilingual & Translation Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Language Catalog Verification
  console.log('[1] Testing Languages Catalog:');
  {
    assert(INDIAN_LANGUAGES.length >= 11, `Catalog contains at least 11 priority Indian languages (found: ${INDIAN_LANGUAGES.length})`);
    
    const hindi = getLanguageByCode('hi');
    assert(hindi && hindi.nativeName === 'हिन्दी', 'Hindi metadata defined correctly');

    const tamil = getLanguageByCode('ta');
    assert(tamil && tamil.nativeName === 'தமிழ்', 'Tamil metadata defined correctly');

    const telugu = getLanguageByCode('te');
    assert(telugu && telugu.nativeName === 'తెలుగు', 'Telugu metadata defined correctly');

    const kannada = getLanguageByCode('kn');
    assert(kannada && kannada.nativeName === 'ಕನ್ನಡ', 'Kannada metadata defined correctly');

    const malayalam = getLanguageByCode('ml');
    assert(malayalam && malayalam.nativeName === 'മലയാളം', 'Malayalam metadata defined correctly');
  }

  // 2. Smart Language Detection Across Indian & Global Scripts
  console.log('\n[2] Testing Smart Language Detection:');
  {
    // Tamil
    const dTa = LanguageDetector.detectLanguage('இது செயற்கை நுண்ணறிவு பற்றிய எளிய விளக்கம்.');
    assert(dTa.code === 'ta' && dTa.name === 'Tamil', `Detects pure Tamil: "${dTa.name}"`);

    // Hindi
    const dHi = LanguageDetector.detectLanguage('यह कृत्रिम बुद्धिमत्ता के बारे में एक सरल व्याख्या है।');
    assert(dHi.code === 'hi' && dHi.name === 'Hindi', `Detects pure Hindi: "${dHi.name}"`);

    // Telugu
    const dTe = LanguageDetector.detectLanguage('క్లౌడ్ కంప్యూటింగ్ అనేది ఇంటర్నెట్ ద్వారా సేవలను అందించే సాంకేతికత.');
    assert(dTe.code === 'te' && dTe.name === 'Telugu', `Detects pure Telugu: "${dTe.name}"`);

    // Kannada
    const dKn = LanguageDetector.detectLanguage('ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಎನ್ನುವುದು ಕಂಪ್ಯೂಟರ್ ಸಿಸ್ಟಮ್‌ಗಳನ್ನು ರಚಿಸುವ ತಂತ್ರಜ್ಞಾನವಾಗಿದೆ.');
    assert(dKn.code === 'kn' && dKn.name === 'Kannada', `Detects pure Kannada: "${dKn.name}"`);

    // Malayalam
    const dMl = LanguageDetector.detectLanguage('ഇന്റർനെറ്റ് എന്നത് ആഗോള വിവര ശൃംഖലയാണ്.');
    assert(dMl.code === 'ml' && dMl.name === 'Malayalam', `Detects pure Malayalam: "${dMl.name}"`);

    // Bengali
    const dBn = LanguageDetector.detectLanguage('কৃত্রিম বুদ্ধিমত্তা হলো কম্পিউটার বিজ্ঞানের একটি শাখা।');
    assert(dBn.code === 'bn' && dBn.name === 'Bengali', `Detects Bengali: "${dBn.name}"`);

    // Code-switching: Tanglish (SSD என்பது fast storage device ஆகும்)
    const dTanglish = LanguageDetector.detectLanguage('SSD என்பது fast storage device ஆகும்.');
    assert(dTanglish.code === 'ta', `Detects code-switched Tanglish as Tamil: "${dTanglish.name}"`);

    // Spanish
    const dEs = LanguageDetector.detectLanguage('La computación cuántica es un tipo de computación que utiliza principios de la física.');
    assert(dEs.code === 'es', `Detects Spanish: "${dEs.name}"`);

    // English
    const dEn = LanguageDetector.detectLanguage('Quantum computing uses quantum mechanical phenomena to process information.');
    assert(dEn.code === 'en', `Detects English: "${dEn.name}"`);
  }

  // 3. Demo Multilingual Translation Provider
  console.log('\n[3] Testing Multilingual Translation Provider:');
  {
    const translator = new DemoTranslationProvider();

    // English -> Tamil (SSD)
    const tTa = await translator.translate('What is an SSD?', 'en', 'ta');
    assert(tTa.targetLanguage === 'ta', 'Translation target language is ta');
    assert(tTa.translatedText.includes('SSD') && (tTa.translatedText.includes('நினைவக') || tTa.translatedText.includes('சாலிட்')), 'English to Tamil translation preserves SSD and contains Tamil translation');

    // English -> Hindi (Java Polymorphism)
    const tHi = await translator.translate('Explain polymorphism in Java in simple words.', 'en', 'hi');
    assert(tHi.targetLanguage === 'hi', 'Translation target language is hi');
    assert(tHi.translatedText.includes('जावा') || tHi.translatedText.includes('Polymorphism'), 'English to Hindi translation preserves technical words');

    // English -> Telugu (Cloud)
    const tTe = await translator.translate('Explain cloud computing.', 'en', 'te');
    assert(tTe.targetLanguage === 'te', 'Translation target language is te');
    assert(tTe.translatedText.includes('క్లౌడ్') || tTe.translatedText.includes('కంప్యూటింగ్'), 'English to Telugu translation accurate');

    // English -> Kannada (Machine Learning)
    const tKn = await translator.translate('What is machine learning?', 'en', 'kn');
    assert(tKn.targetLanguage === 'kn', 'Translation target language is kn');
    assert(tKn.translatedText.includes('ಮೆಷಿನ್') || tKn.translatedText.includes('ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ'), 'English to Kannada translation accurate');

    // English -> Malayalam (Internet)
    const tMl = await translator.translate('Explain the internet.', 'en', 'ml');
    assert(tMl.targetLanguage === 'ml', 'Translation target language is ml');
    assert(tMl.translatedText.includes('ഇന്റർനെറ്റ്') || tMl.translatedText.includes('ശൃംഖല'), 'English to Malayalam translation accurate');

    // English -> Spanish (Quantum)
    const tEs = await translator.translate('Explain quantum computing.', 'en', 'es');
    assert(tEs.targetLanguage === 'es', 'Translation target language is es');
    assert(tEs.translatedText.includes('computación cuántica'), 'English to Spanish translation accurate');

    // Same language (no translation)
    const same = await translator.translate('Simple text', 'en', 'en');
    assert(same.translatedText === 'Simple text', 'Same language source and target returns original text directly');
  }

  // 4. Text Cleaner & Normalizer
  console.log('\n[4] Testing Speech Text Cleaner:');
  {
    const raw = '# Overview\nHere is a list:\n* Point 1\n* Point 2\nCheck [link](https://example.com) and citation [1].\n```javascript\nconsole.log("hello");\n```';
    const cleaned = TextCleaner.cleanForSpeech(raw, { readCodeBlocks: false });
    assert(!cleaned.includes('```'), 'Strips code block fences');
    assert(!cleaned.includes('[1]'), 'Strips citation markers');
    assert(!cleaned.includes('https://example.com'), 'Normalizes bare markdown links');
    assert(cleaned.includes('Overview.'), 'Converts markdown heading to paused sentence');
  }

  // 5. Multilingual Audio Filenames
  console.log('\n[5] Testing Multilingual Audio Filenames:');
  {
    const fn1 = generateAudioFilename('What is an SSD?', 'ta', 'mp3');
    assert(fn1.startsWith('what-is-an-ssd-ta-') && fn1.endsWith('.mp3'), `Filename format [topic]-[lang]-[date].[format]: "${fn1}"`);

    const fn2 = generateAudioFilename('Java Polymorphism', 'hi', 'wav');
    assert(fn2.startsWith('java-polymorphism-hi-') && fn2.endsWith('.wav'), `Filename format: "${fn2}"`);

    const fn3 = generateAudioFilename('Cloud Computing', 'te', 'm4a');
    assert(fn3.startsWith('cloud-computing-te-') && fn3.endsWith('.m4a'), `Filename format: "${fn3}"`);
  }

  // Summary
  console.log('\n====================================================');
  console.log(` Multilingual Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultilingualTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
