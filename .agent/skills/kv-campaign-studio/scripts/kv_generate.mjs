#!/usr/bin/env node
import crypto from 'node:crypto';

const DEFAULT_SEED_RUN_URL = 'https://2q3rqt6rnh.coze.site/run';
const DEFAULT_AFR_BASE_URL = 'https://lv-api-lf.ulikecam.com';
const DEFAULT_AFR_AID = '6834';
const DEFAULT_AFR_APP_KEY = 'a89de09e9bca4723943e8830a642464d';
const DEFAULT_AFR_APP_SECRET = '8505d553a24c485fb7d9bb336a3651a8';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeSize(width, height, imageSize) {
  const w = Number(width);
  const h = Number(height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return `${Math.round(w)}x${Math.round(h)}`;
  }
  const normalized = String(imageSize || '').trim().toUpperCase();
  if (normalized === '1K') return '1024x1024';
  if (normalized === '2K') return '2048x2048';
  if (normalized === '4K') return '4096x4096';
  if (/^\d+\s*x\s*\d+$/i.test(normalized)) return normalized.replace(/\s+/g, '');
  return '1024x1024';
}

function isLikelyBase64(value) {
  if (!value || value.length < 24) return false;
  const sanitized = value.replace(/\s+/g, '');
  return /^[A-Za-z0-9+/=]+$/.test(sanitized);
}

function pushUnique(images, candidate) {
  const value = String(candidate || '').trim();
  if (!value || images.includes(value)) return;
  images.push(value);
}

function extractImageUrlsFromString(input) {
  const images = [];
  const value = String(input || '').trim();
  if (!value) return images;

  if (value.startsWith('data:image/')) {
    pushUnique(images, value);
  } else if (/^https?:\/\/[^\s"'<>]+$/i.test(value)) {
    pushUnique(images, value);
  } else if (isLikelyBase64(value)) {
    pushUnique(images, `data:image/png;base64,${value.replace(/\s+/g, '')}`);
  }

  const cozeRegex = /https?:\/\/[st]\.coze\.cn\/t\/[a-zA-Z0-9_-]+\//gi;
  let match;
  while ((match = cozeRegex.exec(value)) !== null) {
    pushUnique(images, match[0]);
  }

  const fileRegex = /https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^\s"'<>]*)?(?:#[^\s"'<>]*)?/gi;
  while ((match = fileRegex.exec(value)) !== null) {
    pushUnique(images, match[0]);
  }

  return images;
}

function extractCozeWorkflowImageUrls(payload) {
  const images = [];
  const queue = [payload];
  const visited = new Set();
  const preferredKeys = [
    'url',
    'image',
    'image_url',
    'imageUrl',
    'images',
    'generated_image_urls',
    'output',
    'result',
    'data',
    'content',
    'message',
    'response',
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === 'string') {
      for (const c of extractImageUrlsFromString(current)) pushUnique(images, c);
      continue;
    }

    if (typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    const record = current;
    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === 'string') {
        for (const c of extractImageUrlsFromString(value)) pushUnique(images, c);
      } else if (value !== undefined) {
        queue.push(value);
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'string' || typeof value === 'object') queue.push(value);
    }
  }

  return images;
}

function sha1(message) {
  return crypto.createHash('sha1').update(message).digest('hex');
}

function generateSign(nonce, timestamp, secretKey) {
  const stringList = [nonce, timestamp, secretKey].sort();
  return sha1(stringList.join(''));
}

function generateNonce() {
  return Math.floor(Math.random() * 2147483647).toString();
}

function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithSeedream(args) {
  const runUrl = (args['seed-run-url'] || process.env.LEMO_COZE_SEED_RUN_URL || DEFAULT_SEED_RUN_URL).trim();
  const apiToken = (args['seed-api-token'] || process.env.LEMO_COZE_SEED_API_TOKEN || '').trim();
  if (!apiToken) {
    throw new Error('Missing LEMO_COZE_SEED_API_TOKEN (or --seed-api-token).');
  }

  const prompt = String(args.prompt || '').trim();
  const size = normalizeSize(args.width, args.height, args.imageSize || '2K');
  const refImages = [];
  if (args.reference) {
    refImages.push(String(args.reference).trim());
  }

  const body = {
    prompt,
    reference_images: refImages,
    size,
    watermark: false,
  };

  const resp = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error(`Coze Seed workflow API Error (${resp.status}): ${raw.slice(0, 500)}`);
  }

  let parsed = raw;
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  const images = extractCozeWorkflowImageUrls(parsed);
  if (!images.length) {
    throw new Error(`Coze Seed workflow returned no images: ${raw.slice(0, 500)}`);
  }

  return {
    model: 'coze_seedream4_5',
    size,
    images,
  };
}

async function generateWithLemo(args) {
  const prompt = String(args.prompt || '').trim();
  const width = Math.round(Number(args.width || 1080));
  const height = Math.round(Number(args.height || 1440));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid width/height for seed4_0407_lemo.');
  }

  const BASE_URL = (args['afr-base-url'] || process.env.GATEWAY_BASE_URL || DEFAULT_AFR_BASE_URL).trim();
  const AID = (args['afr-aid'] || process.env.BYTEDANCE_AID || DEFAULT_AFR_AID).trim();
  const APP_KEY = (args['afr-app-key'] || process.env.BYTEDANCE_APP_KEY || DEFAULT_AFR_APP_KEY).trim();
  const APP_SECRET = (args['afr-app-secret'] || process.env.BYTEDANCE_APP_SECRET || DEFAULT_AFR_APP_SECRET).trim();

  const submitUrl = `${BASE_URL}/media/api/pic/submit_task_v2`;

  const reqJson = {
    width,
    height,
    seed: -1,
    Prompt: prompt,
  };

  const nonce = generateNonce();
  const timestamp = generateTimestamp();
  const sign = generateSign(nonce, timestamp, APP_SECRET);

  const submitForm = new URLSearchParams();
  submitForm.append('aid', AID);
  submitForm.append('app_key', APP_KEY);
  submitForm.append('nonce', nonce);
  submitForm.append('timestamp', timestamp);
  submitForm.append('sign', sign);
  submitForm.append('req_key', 'seed4_0407_lemo');
  submitForm.append('req_json', JSON.stringify(reqJson));
  submitForm.append('img_return_type', 'url');
  submitForm.append('img_return_format', 'png');
  submitForm.append('expired_duration', '600');

  const submitResp = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: submitForm.toString(),
  });

  const submitData = await submitResp.json();
  if (!submitResp.ok || submitData.status_code !== 0) {
    throw new Error(`Submit task failed: ${submitData.message || submitResp.status}`);
  }

  const taskId = submitData?.data?.task_id;
  if (!taskId) {
    throw new Error('No task_id returned from submit_task_v2');
  }

  const pollUrl = `${BASE_URL}/media/api/pic/batch_get_result_v2`;
  const maxAttempts = Number(args['poll-attempts'] || 120);
  const pollIntervalMs = Number(args['poll-interval-ms'] || 1000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pollNonce = generateNonce();
    const pollTimestamp = generateTimestamp();
    const pollSign = generateSign(pollNonce, pollTimestamp, APP_SECRET);

    const pollForm = new URLSearchParams();
    pollForm.append('aid', AID);
    pollForm.append('app_key', APP_KEY);
    pollForm.append('nonce', pollNonce);
    pollForm.append('timestamp', pollTimestamp);
    pollForm.append('sign', pollSign);
    pollForm.append('req_key', 'seed4_0407_lemo');
    pollForm.append('task_ids', taskId);
    pollForm.append('img_return_type', 'url');
    pollForm.append('img_return_format', 'png');

    const pollResp = await fetch(pollUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: pollForm.toString(),
    });

    const pollData = await pollResp.json();
    if (!pollResp.ok || pollData.status_code !== 0) {
      throw new Error(`Poll result failed: ${pollData.message || pollResp.status}`);
    }

    const result = pollData?.data?.results?.[0];
    if (result) {
      const status = result.status;
      const isDone = status === 'done' || status === 'DONE' || status === 1;
      const isFailed = status === 'failed' || status === 'FAILED' || status === 2;

      if (isDone) {
        const images = [];
        if (Array.isArray(result.pic_urls)) {
          for (const item of result.pic_urls) {
            const url = item?.main_url || item?.backup_url;
            if (url) images.push(url);
          }
        }
        if (!images.length && Array.isArray(result.binary_data)) {
          for (const b64 of result.binary_data) {
            images.push(`data:image/png;base64,${b64}`);
          }
        }
        if (!images.length) {
          throw new Error(`Task completed but no image data: ${result.message || 'empty result'}`);
        }
        return {
          model: 'seed4_0407_lemo',
          size: `${width}x${height}`,
          images,
        };
      }

      if (isFailed) {
        throw new Error(`Task failed: ${result.message || 'unknown error'}`);
      }
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  throw new Error(`Poll timeout: task did not complete within ${maxAttempts} attempts`);
}

async function main() {
  const args = parseArgs(process.argv);
  const model = args.model || 'coze_seedream4_5';
  const prompt = String(args.prompt || '').trim();
  if (!prompt) {
    throw new Error('Missing prompt. Use --prompt "..."');
  }

  let result;
  if (model === 'coze_seedream4_5') {
    result = await generateWithSeedream(args);
  } else if (model === 'seed4_0407_lemo') {
    result = await generateWithLemo(args);
  } else {
    throw new Error(`Unsupported model: ${model}. Use coze_seedream4_5 or seed4_0407_lemo.`);
  }

  process.stdout.write(`${result.model} ${result.size}\n${result.images[0]}\n`);
}

main().catch((error) => {
  console.error(`[kv_generate] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
