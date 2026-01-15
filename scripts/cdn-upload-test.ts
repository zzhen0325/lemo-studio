/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import process from 'process';

const LOG_FILE = path.join(__dirname, 'cdn-upload-test.log');

function timestamp(): string {
  const date = new Date();
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
  const line = `[${timestamp()}] [NODE] [${level}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
  process.stdout.write(line);
}

const CDN_BASE_URL = process.env.CDN_BASE_URL ?? 'https://ife-cdn.byteintl.net';
const CDN_REGION = process.env.CDN_REGION ?? 'SG';
const CDN_DIR = process.env.CDN_DIR ?? 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design';
const CDN_EMAIL = process.env.CDN_EMAIL ?? 'zzhen.0325@bytedance.com';
const CDN_TOKEN = process.env.CDN_TOKEN ?? '';

async function chooseTestFile(): Promise<string> {
  const repoRoot = path.resolve(__dirname, '..');
  const logoPath = path.join(repoRoot, 'public', 'images', 'logos', 'logo.png');
  if (fs.existsSync(logoPath)) {
    return logoPath;
  }

  const dir1 = path.join(repoRoot, 'public', '1');
  if (!fs.existsSync(dir1)) {
    throw new Error('No test image found: public/images/logos/logo.png or public/1/*.png');
  }

  const files = fs.readdirSync(dir1).filter((f) => f.toLowerCase().endsWith('.png'));
  if (files.length === 0) {
    throw new Error('No PNG files found in public/1 for fallback');
  }

  return path.join(dir1, files[0]);
}

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

async function main() {
  log('INFO', '===== CDN upload test (Node version) start =====');
  log('INFO', `CDN_BASE_URL=${CDN_BASE_URL}`);
  log('INFO', `CDN_REGION=${CDN_REGION} CDN_DIR=${CDN_DIR} CDN_EMAIL=${CDN_EMAIL}`);
  if (CDN_TOKEN) {
    log('INFO', 'Using x-cdn-token header from CDN_TOKEN env');
  }

  let testFile: string;
  try {
    testFile = await chooseTestFile();
  } catch (err) {
    log('ERROR', (err as Error).message);
    process.exitCode = 1;
    return;
  }

  log('INFO', `Using test file: ${testFile}`);

  const uploadUrl = `${CDN_BASE_URL.replace(/\/$/, '')}/cdn/upload`;
  log('INFO', `Upload URL: ${uploadUrl}`);

  const buffer = await fs.promises.readFile(testFile);
  const mime = guessMime(testFile);
  const blob = new Blob([buffer], { type: mime });

  const form = new FormData();
  form.append('region', CDN_REGION);
  form.append('dir', CDN_DIR);
  form.append('email', CDN_EMAIL);
  form.append('file', blob, path.basename(testFile));

  const headers: Record<string, string> = {};
  if (CDN_TOKEN) {
    headers['x-cdn-token'] = CDN_TOKEN;
  }

  let resp: Response;
  try {
    resp = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: form,
    });
  } catch (error) {
    log('ERROR', `Fetch failed (可能为网络访问受限): ${(error as Error).message}`);
    log('ERROR', 'Classification: NETWORK_RESTRICTED');
    process.exitCode = 1;
    return;
  }

  const text = await resp.text();
  log('INFO', `HTTP status: ${resp.status}`);
  log('INFO', `Raw response body: ${text}`);

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (error) {
    log('ERROR', `Response is not valid JSON: ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const code = json.code;
  const cdnUrl = json.cdnUrl as string | undefined;
  const message = (json.message as string | undefined) ?? '';

  if (resp.ok && code === 0) {
    log('INFO', 'Upload SUCCESS (code=0).');
    if (cdnUrl) {
      log('INFO', `CDN URL: ${cdnUrl}`);
      log('INFO', `CDN_URL_MARKER ${cdnUrl}`);
    } else {
      log('WARN', 'code=0 but cdnUrl is empty.');
    }
    return;
  }

  let classification = 'UNKNOWN_ERROR';
  if (message.includes('该团队空间已被加密') || message.includes('加密') || /token/i.test(message)) {
    classification = 'TEAM_SPACE_ENCRYPTED_NEED_TOKEN';
  } else if (!resp.ok || resp.status >= 500) {
    classification = 'NETWORK_OR_SERVER_ERROR';
  }

  log('ERROR', `Upload FAILED with code=${code} message=${message}`);
  log('ERROR', `Classification: ${classification}`);
  process.exitCode = 1;
}

main().catch((err) => {
  log('ERROR', `Unexpected error: ${(err as Error).stack ?? String(err)}`);
  process.exitCode = 1;
});
