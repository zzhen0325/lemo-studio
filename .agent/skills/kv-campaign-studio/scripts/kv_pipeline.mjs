#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const TARGET_SIZES = [
  [1125, 600],
  [1125, 672],
  [1054, 720],
  [1125, 450],
  [1080, 1080],
  [1080, 1440],
];

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    env: process.env,
  });
}

function parseGenerateOutput(stdout) {
  const lines = stdout.trim().split('\n').map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1] || '';
}

async function main() {
  const args = parseArgs(process.argv);
  const intent = String(args.intent || '').trim();
  if (!intent) {
    throw new Error('Missing intent. Use --intent "帮我做一个春季活动KV官号"');
  }

  const preferLemo = args.model === 'seed4_0407_lemo' || /\blemo\b|乐么|lemo seed/i.test(intent);
  const model = preferLemo ? 'seed4_0407_lemo' : 'coze_seedream4_5';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const optimizeScript = path.resolve(__dirname, './kv_optimize.mjs');
  const generateScript = path.resolve(__dirname, './kv_generate.mjs');

  const optimizeArgs = [
    '--input', intent,
    ...(args['run-url'] ? ['--run-url', args['run-url']] : []),
    ...(args['api-token'] ? ['--api-token', args['api-token']] : []),
  ];

  const optimizeResult = runNodeScript(optimizeScript, optimizeArgs);
  if (optimizeResult.status !== 0) {
    throw new Error(optimizeResult.stderr || optimizeResult.stdout || 'Optimization failed');
  }

  const optimizedPrompt = optimizeResult.stdout.trim();
  if (!optimizedPrompt) {
    throw new Error('Optimization returned empty prompt');
  }

  const generateCommonArgs = [
    '--model', model,
    ...(args['seed-run-url'] ? ['--seed-run-url', args['seed-run-url']] : []),
    ...(args['seed-api-token'] ? ['--seed-api-token', args['seed-api-token']] : []),
    ...(args['afr-base-url'] ? ['--afr-base-url', args['afr-base-url']] : []),
    ...(args['afr-aid'] ? ['--afr-aid', args['afr-aid']] : []),
    ...(args['afr-app-key'] ? ['--afr-app-key', args['afr-app-key']] : []),
    ...(args['afr-app-secret'] ? ['--afr-app-secret', args['afr-app-secret']] : []),
  ];

  const masterResult = runNodeScript(generateScript, [
    '--prompt', optimizedPrompt,
    '--width', '1080',
    '--height', '1440',
    ...generateCommonArgs,
  ]);

  if (masterResult.status !== 0) {
    throw new Error(masterResult.stderr || masterResult.stdout || 'Master generation failed');
  }

  const masterImageUrl = parseGenerateOutput(masterResult.stdout);
  if (!masterImageUrl) {
    throw new Error('Master image missing');
  }

  const lines = [];
  lines.push(`summary: market=US model=${model} mode=upstream status=ok`);
  lines.push('fieldRecap: auto-completed by optimizer; user can refine in next turn');

  for (const [w, h] of TARGET_SIZES) {
    if (model === 'seed4_0407_lemo' && (w < 1024 || h < 1024)) {
      lines.push(`${w}x${h} | fallback_adapted | ${masterImageUrl}`);
      continue;
    }

    const run = runNodeScript(generateScript, [
      '--prompt', optimizedPrompt,
      '--width', String(w),
      '--height', String(h),
      ...generateCommonArgs,
    ]);

    if (run.status === 0) {
      const imageUrl = parseGenerateOutput(run.stdout);
      lines.push(`${w}x${h} | regenerated | ${imageUrl}`);
    } else {
      lines.push(`${w}x${h} | fallback_adapted | ${masterImageUrl}`);
    }
  }

  lines.push('next: 继续告诉我你要改主体、版式还是文案，我会按当前结果精修。');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  console.error(`[kv_pipeline] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
