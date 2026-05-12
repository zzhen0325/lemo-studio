#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PROMPT_RUN_URL = 'https://m5385m4ryw.coze.site/run';

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

async function loadInput(args) {
  if (args.input) return String(args.input);
  if (args['input-file']) {
    return (await fs.readFile(args['input-file'], 'utf8')).trim();
  }
  return '';
}

function extractPromptTemplate(fullText) {
  const marker = '## Prompt Template';
  const idx = fullText.indexOf(marker);
  if (idx < 0) return fullText.trim();
  return fullText.slice(idx + marker.length).trim();
}

async function loadSystemPrompt(args) {
  if (args['system-prompt']) return String(args['system-prompt']).trim();
  if (args['system-prompt-file']) {
    const full = await fs.readFile(args['system-prompt-file'], 'utf8');
    return extractPromptTemplate(full);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const defaultPromptPath = path.resolve(__dirname, '../references/kv-optimization-system-prompt.md');
  const full = await fs.readFile(defaultPromptPath, 'utf8');
  return extractPromptTemplate(full);
}

function buildTaggedInput(input, useTag) {
  if (!useTag) return input.trim();
  const normalized = input.trim();
  if (!normalized) return '';
  if (normalized.startsWith('[Event kv]')) return normalized;
  return `[Event kv]\n${normalized}`;
}

function buildPromptTextPayload({ input, systemPrompt }) {
  const normalizedInput = input.trim();
  const normalizedSystemPrompt = (systemPrompt || '').trim();
  return normalizedSystemPrompt ? `${normalizedSystemPrompt}\n\n${normalizedInput}` : normalizedInput;
}

function extractCozePromptText(payload) {
  const preferredKeys = [
    'text',
    'output_text',
    'output',
    'result',
    'answer',
    'content',
    'message',
    'response',
    'data',
  ];

  const queue = [payload];
  const visited = new Set();
  let fallbackUrl = '';

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === 'string') {
      const value = current.trim();
      if (!value) continue;
      if (/^https?:\/\//i.test(value) && !fallbackUrl) {
        fallbackUrl = value;
        continue;
      }
      return value;
    }

    if (typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    const record = current;
    const role = typeof record.role === 'string' ? record.role.toLowerCase() : '';
    if (role === 'assistant' && typeof record.content === 'string' && record.content.trim()) {
      return record.content.trim();
    }

    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        if (/^https?:\/\//i.test(value) && !fallbackUrl) {
          fallbackUrl = value.trim();
          continue;
        }
        return value.trim();
      }
    }

    for (const key of preferredKeys) {
      if (record[key] !== undefined) queue.push(record[key]);
    }
    for (const value of Object.values(record)) {
      if (typeof value === 'string' || typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return fallbackUrl;
}

async function main() {
  const args = parseArgs(process.argv);
  const useTag = args['no-tag'] !== 'true';

  const runUrl = (args['run-url'] || process.env.LEMO_COZE_PROMPT_RUN_URL || DEFAULT_PROMPT_RUN_URL).trim();
  const apiToken = (args['api-token'] || process.env.LEMO_COZE_PROMPT_API_TOKEN || process.env.LEMO_COZE_API_TOKEN || '').trim();

  const rawInput = await loadInput(args);
  if (!rawInput.trim()) {
    throw new Error('Missing input. Use --input "..." or --input-file <path>.');
  }

  const input = buildTaggedInput(rawInput, useTag);
  const systemPrompt = await loadSystemPrompt(args);

  const body = {
    text: buildPromptTextPayload({ input, systemPrompt }),
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  const resp = await fetch(runUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error(`Coze Prompt API Error (${resp.status}): ${raw.slice(0, 500)}`);
  }

  let parsed = raw;
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  const optimizedText = extractCozePromptText(parsed).trim();
  if (!optimizedText) {
    throw new Error(`Coze Prompt API returned no usable text: ${raw.slice(0, 500)}`);
  }

  process.stdout.write(`${optimizedText}\n`);
}

main().catch((error) => {
  console.error(`[kv_optimize] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
