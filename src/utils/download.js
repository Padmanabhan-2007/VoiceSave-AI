/**
 * VoiceSave AI - Cross-Context Audio Downloader
 * Converts audio Blobs to Data URLs to bypass Chrome origin-isolation in Manifest V3,
 * brokers downloads through background service worker (chrome.downloads),
 * and provides direct DOM anchor download.
 */

export async function downloadBlob(blob, filename) {
  if (!blob) {
    throw new Error('No audio blob provided for download');
  }

  // 1. Convert Blob to Data URL (universally transferable across origins and service workers)
  let dataUrl;
  if (typeof FileReader !== 'undefined') {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else if (typeof Buffer !== 'undefined') {
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mime = blob.type || 'audio/mpeg';
    dataUrl = `data:${mime};base64,${base64}`;
  }

  let blobUrl;
  if (typeof URL !== 'undefined' && URL.createObjectURL) {
    try {
      blobUrl = URL.createObjectURL(blob);
    } catch (e) {}
  }

  const targetUrl = dataUrl || blobUrl;

  // 2. Direct chrome.downloads if available in current context (popup, options page)
  if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: targetUrl,
          filename: filename,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.warn('Direct chrome.downloads error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
            resolve(downloadId);
          }
        });
      });
    } catch (e) {
      console.warn('VoiceSave AI: direct download failed, trying broker or DOM:', e);
    }
  }

  // 3. Broker download via background service worker (for content scripts)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'DOWNLOAD_AUDIO',
          dataUrl: dataUrl,
          url: targetUrl,
          filename: filename,
          mimeType: blob.type
        }, (response) => resolve(response));
      });

      if (res && res.success) {
        if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        return res.downloadId;
      }
    } catch (err) {
      console.warn('VoiceSave AI: background download broker failed, falling back to anchor:', err);
    }
  }

  // 4. Direct DOM Anchor fallback (works in web simulator, sandbox, and local web pages)
  if (typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = targetUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }, 15000);
    return true;
  }

  return true;
}
