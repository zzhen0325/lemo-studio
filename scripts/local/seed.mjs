import sharp from 'sharp';
import { createHash } from 'node:crypto';

const origin = process.env.LOCAL_APP_URL || 'http://127.0.0.1:3001';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Seed requires a loopback app');
const health = await fetch(`${origin}/healthz`).then(r => r.json());
if (health.runtime !== 'local') throw new Error('Start pnpm dev:local before seeding');
let cookie = '';
async function request(path, init = {}) {
  const response = await fetch(`${origin}${path}`, { ...init, headers: { ...init.headers, ...(cookie ? { cookie } : {}) } });
  const nextCookie = response.headers.get('set-cookie');
  if (nextCookie) cookie = nextCookie.split(';')[0];
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(data)}`);
  return data;
}
for (const [index, color] of ['#f2d65c', '#6baaaa', '#e49178'].entries()) {
  const hex = createHash('sha256').update(`studio-local-fixture-${index}`).digest('hex');
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
  const existing = await request(`/api/history?id=${id}`);
  if (existing.item) { console.log(`Fixture ${index + 1} already exists`); continue; }
  const svg = `<svg width="768" height="768" xmlns="http://www.w3.org/2000/svg"><rect width="768" height="768" fill="${color}"/><circle cx="384" cy="330" r="200" fill="#fff" opacity=".35"/><text x="384" y="640" text-anchor="middle" font-family="sans-serif" font-size="30">LOCAL DEMO ${index + 1}</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), `local-demo-${index + 1}.png`);
  const uploaded = await request('/api/upload', { method: 'POST', body: form });
  const image = await fetch(uploaded.url);
  if (!image.ok) throw new Error('Uploaded fixture is not readable');
  await request('/api/history', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status: 'completed', outputUrl: uploaded.storageKey,
      config: { prompt: `Local demo ${index + 1} — test fixture, not AI generated`, model: 'local-demo', width: 768, height: 768, historyRecordType: 'generation' } }),
  });
  const detail = await request(`/api/history?id=${id}`);
  if (!detail.item) throw new Error('History did not persist');
  console.log(`Fixture ${index + 1}: upload, image read and history detail passed`);
}
console.log('Local fixtures ready. Existing records were preserved.');
