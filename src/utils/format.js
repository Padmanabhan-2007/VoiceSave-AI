/**
 * VoiceSave AI - Formatting & Multilingual Filename Utilities
 */

export function slugify(text, maxLength = 30) {
  if (!text) return 'ai-response';
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const slug = clean.substring(0, maxLength);
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `${slug || 'ai-response'}-${dateStr}`;
}

/**
 * Generates clean, language-aware audio filenames:
 * [topic]-[language]-[timestamp].[format]
 * Example: ssd-explanation-ta-20260909.mp3
 */
export function generateAudioFilename(topic, languageCode = 'en', extension = 'mp3') {
  const cleanTopic = (topic || 'response')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 26);

  const lang = (languageCode || 'en').toLowerCase().split('-')[0];
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const ext = (extension || 'mp3').toLowerCase().replace(/^\./, '');

  return `${cleanTopic || 'ai-response'}-${lang}-${dateStr}.${ext}`;
}

export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
