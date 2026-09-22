/**
 * VoiceSave AI - Native Spoken Audio Asset Generator for Demo Mode
 * Downloads verified, native spoken audio for preset demo phrases.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const DEMO_DIR = path.resolve('assets/audio/demo');
if (!fs.existsSync(DEMO_DIR)) {
  fs.mkdirSync(DEMO_DIR, { recursive: true });
}

const PHRASES = [
  // SSD
  { topic: 'ssd', lang: 'ta', text: 'SSD என்பது அதிவேக ஃபிளாஷ் நினைவகத்தைப் பயன்படுத்தும் ஒரு நவீன சேமிப்பக சாதனம் ஆகும்.' },
  { topic: 'ssd', lang: 'hi', text: 'SSD एक आधुनिक स्टोरेज डिवाइस है जो फ्लैश मेमोरी का उपयोग करता है।' },
  { topic: 'ssd', lang: 'te', text: 'SSD అనేది హై-స్పీడ్ ఫ్లాష్ మెమరీని ఉపయోగించే ఆధునిక నిల్వ పరికరం.' },
  { topic: 'ssd', lang: 'kn', text: 'SSD ಎನ್ನುವುದು ವೇಗದ ಫ್ಲ್ಯಾಶ್ ಮೆಮೊರಿಯನ್ನು ಬಳಸುವ ಆಧುನಿಕ ಶೇಖರಣಾ ಸಾಧನವಾಗಿದೆ.' },
  { topic: 'ssd', lang: 'ml', text: 'SSD ഫ്ലാഷ് മെമ്മറി ഉപയോഗിക്കുന്ന അതിവേഗ സംഭരണ ഉപകരണമാണ്.' },
  { topic: 'ssd', lang: 'es', text: 'Una unidad SSD es un dispositivo de almacenamiento que utiliza memoria flash.' },
  { topic: 'ssd', lang: 'fr', text: 'Un SSD est un support de stockage moderne utilisant de la mémoire flash.' },
  { topic: 'ssd', lang: 'pt', text: 'Um SSD é um dispositivo de armazenamento moderno que usa memória flash.' },
  { topic: 'ssd', lang: 'en', text: 'An SSD is a high-speed storage device that uses flash memory.' },

  // Polymorphism
  { topic: 'polymorphism', lang: 'ta', text: 'ஜாவாவில் பாலிமார்பிசம் என்பது ஆப்ஜெக்ட்டுகளை நெகிழ்வாக கையாளும் ஒரு முக்கிய கருத்தாகும்.' },
  { topic: 'polymorphism', lang: 'hi', text: 'जावा में बहुरूपता ऑब्जेक्ट्स को उनके पैरेंट क्लास के संदर्भ में उपयोग करने की सुविधा देती है।' },
  { topic: 'polymorphism', lang: 'te', text: 'జావాలో పాలిమార్ఫిజం అనేది ఆబ్జెక్ట్‌లను వాటి పేరెంట్ క్లాస్ రిఫరెన్స్‌గా పరిగణించడానికి అనుమతిస్తుంది.' },
  { topic: 'polymorphism', lang: 'kn', text: 'ಜಾವಾದಲ್ಲಿ ಪಾಲಿಮಾರ್ಫಿಸಂ ಆಬ್ಜೆಕ್ಟ್‌ಗಳನ್ನು ಅವುಗಳ ಪೇರೆಂಟ್ ಕ್ಲಾಸ್‌ನಂತೆ ಬಳಸಲು ಅನುಮತಿಸುತ್ತದೆ.' },
  { topic: 'polymorphism', lang: 'ml', text: 'ജാവയിലെ പോളിമോർഫിസം ഒബ്ജക്റ്റുകളെ പേരന്റ് ക്ലാസ്സ് റഫറൻസിലൂടെ ഉപയോഗിക്കാൻ സഹായിക്കുന്നു.' },
  { topic: 'polymorphism', lang: 'es', text: 'El polimorfismo en Java permite que los objetos sean tratados como instancias de su clase padre.' },
  { topic: 'polymorphism', lang: 'fr', text: 'Le polymorphisme en Java permet de manipuler des objets via la référence de leur classe parente.' },
  { topic: 'polymorphism', lang: 'en', text: 'Polymorphism in Java allows objects to be treated as instances of their parent class.' },

  // Cloud Computing
  { topic: 'cloud', lang: 'ta', text: 'கிளவுட் கம்ப்யூட்டிங் என்பது இணையம் வழியாக சேவையகங்கள் மற்றும் சேமிப்பக சேவைகளை வழங்கும் தொழில்நுட்பமாகும்.' },
  { topic: 'cloud', lang: 'hi', text: 'क्लाउड कंप्यूटिंग इंटरनेट के माध्यम से कंप्यूटिंग सेवाएं प्रदान करने की तकनीक है।' },
  { topic: 'cloud', lang: 'te', text: 'క్లౌడ్ కంప్యూటింగ్ అనేది ఇంటర్నెట్ ద్వారా కంప్యూటింగ్ సేవలను అందించే విధానం.' },
  { topic: 'cloud', lang: 'kn', text: 'ಕ್ಲೌಡ್ ಕಂಪ್ಯೂಟಿಂಗ್ ಎನ್ನುವುದು ಇಂಟರ್ನೆಟ್ ಮೂಲಕ ಕಂಪ್ಯೂಟಿಂಗ್ ಸೇವೆಗಳನ್ನು ಒದಗಿಸುವ ವಿಧಾನವಾಗಿದೆ.' },
  { topic: 'cloud', lang: 'ml', text: 'ക്ലൗഡ് കമ്പ്യൂട്ടിംഗ് ഇന്റർനെറ്റ് വഴി കമ്പ്യൂട്ടിംഗ് സേവനങ്ങൾ ലഭ്യമാക്കുന്ന സാങ്കേതികവിദ്യയാണ്.' },
  { topic: 'cloud', lang: 'en', text: 'Cloud computing is the on-demand delivery of computing services over the internet.' },

  // Machine Learning
  { topic: 'ml', lang: 'ta', text: 'மெஷின் லேர்னிங் என்பது அனுபவத்தின் மூலம் தரவுகளிலிருந்து கற்றுக்கொள்ளும் செயற்கை நுண்ணறிவு துறையாகும்.' },
  { topic: 'ml', lang: 'hi', text: 'मशीन लर्निंग डेटा से सीखने और भविष्यवाणियां करने की तकनीक है।' },
  { topic: 'ml', lang: 'te', text: 'మెషిన్ లెర్నింగ్ అనేది డేటా ఆధారంగా స్వయంచాలకంగా నేర్చుకునే సాంకేతికత.' },
  { topic: 'ml', lang: 'kn', text: 'ಮೆಷಿನ್ ಲರ್ನಿಂಗ್ ಎನ್ನುವುದು ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆಯ ಒಂದು ಪ್ರಮುಖ ವಿಭಾಗವಾಗಿದೆ.' },
  { topic: 'ml', lang: 'ml', text: 'മെഷീൻ ലേണിംഗ് ഡാറ്റയിൽ നിന്നും കാര്യങ്ങൾ സ്വയം പഠിച്ചെടുക്കാൻ കമ്പ്യൂട്ടറുകളെ സഹായിക്കുന്നു.' },
  { topic: 'ml', lang: 'en', text: 'Machine learning is a field of artificial intelligence focused on learning from data.' },

  // Internet
  { topic: 'internet', lang: 'ta', text: 'இணையம் என்பது உலகம் முழுவதும் கோடிக்கணக்கான கணினிகளை இணைக்கும் ஒரு மாபெரும் உலகளாவிய நெட்வொர்க் ஆகும்.' },
  { topic: 'internet', lang: 'hi', text: 'इंटरनेट दुनिया भर के कंप्यूटरों को आपस में जोड़ने वाला एक विशाल नेटवर्क है।' },
  { topic: 'internet', lang: 'te', text: 'ఇంటర్నెట్ అనేది ప్రపంచవ్యాప్తంగా కంప్యూటర్‌లను అనుసంధానించే నెట్‌వర్క్.' },
  { topic: 'internet', lang: 'kn', text: 'ಇಂಟರ್ನೆಟ್ ಎನ್ನುವುದು ಪ್ರಪಂಚದಾದ್ಯಂತ ಕಂಪ್ಯೂಟರ್‌ಗಳನ್ನು ಸಂಪರ್ಕಿಸುವ ಜಾಲವಾಗಿದೆ.' },
  { topic: 'internet', lang: 'ml', text: 'ഇന്റർനെറ്റ് എന്നത് ലോകമെമ്പാടുമുള്ള കമ്പ്യൂട്ടറുകളെ പരസ്പരം ബന്ധിപ്പിക്കുന്ന ശൃംഖലയാണ്.' },
  { topic: 'internet', lang: 'en', text: 'The internet is a global computer network providing a variety of information and communication facilities.' }
];

function fetchAudio(text, lang, targetFile) {
  return new Promise((resolve, reject) => {
    const cleanText = encodeURIComponent(text.slice(0, 180));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanText}&tl=${lang}&client=tw-ob`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode} for ${lang}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(targetFile, buffer);
        console.log(`[OK] Saved ${path.basename(targetFile)} (${buffer.length} bytes)`);
        resolve(buffer.length);
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log(`Generating native spoken audio assets into: ${DEMO_DIR}`);
  for (const item of PHRASES) {
    const filename = `${item.topic}-${item.lang}.mp3`;
    const targetFile = path.join(DEMO_DIR, filename);
    try {
      await fetchAudio(item.text, item.lang, targetFile);
      // Small pause to be polite to server
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`[ERR] Failed for ${filename}:`, err.message);
    }
  }
  console.log('Finished generating demo audio assets.');
}

run();
