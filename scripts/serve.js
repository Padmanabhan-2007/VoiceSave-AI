import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // Root redirect to interactive demo simulator
  if (reqPath === '/' || reqPath === '') {
    res.writeHead(302, { Location: '/src/demo/demo.html' });
    res.end();
    return;
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(rootDir, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  const demoUrl = `http://localhost:${PORT}/src/demo/demo.html`;
  const popupUrl = `http://localhost:${PORT}/src/popup/popup.html`;
  const optionsUrl = `http://localhost:${PORT}/src/options/options.html`;

  console.log(`========================================================`);
  console.log(` VoiceSave AI — Development & Interactive Server Ready`);
  console.log(`========================================================`);
  console.log(`  ➤ Demo Simulator: ${demoUrl}`);
  console.log(`  ➤ Extension Popup: ${popupUrl}`);
  console.log(`  ➤ Settings Page:  ${optionsUrl}`);
  console.log(`========================================================`);

  // Open default browser on Windows
  if (process.platform === 'win32') {
    exec(`start "" "${demoUrl}"`);
  }
});
