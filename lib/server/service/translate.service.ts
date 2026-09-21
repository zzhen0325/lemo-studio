import { DEFAULT_TRANSLATE_SYSTEM_PROMPT } from '@/lib/api-config/core';
import { callCozeRunApi } from '@/lib/server/ai/coze-run';
import { HttpError } from '../utils/http-error';
import type { ApiConfigService } from './api-config.service';

export type TargetLang = 'zh' | 'en';

export type TranslateTask = 'dataset_prompt_translation' | 'flux_klein_prompt_translation';

const SUPPORTED_TARGETS = new Set<TargetLang>(['zh', 'en']);
const TRANSLATE_SYSTEM_KEYWORDS = [
  'translate_only',
  'plain_text_output',
  'preserve_placeholders',
  'preserve_lora_tags',
  'keep_comma_separated_tag_style',
];

function stripCodeFence(text: string): string {
  const value = text.trim();
  if (!value.startsWith('```') || !value.endsWith('```')) {
    return value;
  }
  return value.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim();
}

function normalizeText(text: string): string {
  let value = stripCodeFence(text).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    value = value.slice(1, -1).trim();
  }
  return value.replace(/^translation\s*[:：]\s*/i, '').trim();
}

function parseJsonPayload(text: string): unknown {
  const normalized = stripCodeFence(text);
  try {
    return JSON.parse(normalized);
  } catch {
    const match = normalized.match(/\{[\s\S]*\}$/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function normalizeTranslatedTexts(rawText: string, expectedCount: number): string[] {
  const parsed = parseJsonPayload(rawText);
  if (parsed && typeof parsed === 'object') {
    const payload = parsed as {
      translatedText?: unknown;
      translatedTexts?: unknown;
    };
    if (Array.isArray(payload.translatedTexts)) {
      const values = payload.translatedTexts
        .map((item) => (typeof item === 'string' ? normalizeText(item) : ''))
        .filter((item) => item.length > 0);
      if (values.length === expectedCount) return values;
    }
    if (typeof payload.translatedText === 'string') {
      const value = normalizeText(payload.translatedText);
      if (value) return [value];
    }
  }

  if (expectedCount === 1) {
    const value = normalizeText(rawText);
    if (value) return [value];
  }

  const lines = stripCodeFence(rawText)
    .split('\n')
    .map((line) => normalizeText(line.replace(/^\d+[.)]\s*/, '').replace(/^[-*]\s*/, '')))
    .filter(Boolean);
  if (lines.length === expectedCount) return lines;

  throw new HttpError(502, 'No translation returned');
}

function getTargetLabel(target: TargetLang): string {
  return target === 'zh' ? 'Simplified Chinese' : 'English';
}

function buildTranslateUserInput(sourceTexts: string[], target: TargetLang, task: TranslateTask): string {
  const constraints = [
    'Output must be JSON only',
    'Keep placeholders, symbols, model params and LoRA tags unchanged when needed',
    'Preserve comma-separated tag style',
  ];

  if (task === 'flux_klein_prompt_translation') {
    constraints.push(
      'Translate the prompt for Flux Klein text-to-image generation',
      'Preserve visual intent, subject details, style words, weights, and reference-image instructions',
    );
  }

  return JSON.stringify({
    task,
    targetLanguage: getTargetLabel(target),
    sourceTexts,
    outputFormat: {
      translatedTexts: 'string[]',
      constraints: 'same length and order as sourceTexts',
    },
    constraints,
  });
}

function injectTranslateKeywords(systemPrompt: string): string {
  return `${systemPrompt.trim()}\n\nSystem keywords: ${TRANSLATE_SYSTEM_KEYWORDS.join(', ')}`;
}

export class TranslateService {
  constructor(private readonly apiConfigService: ApiConfigService) {}

  public async translateTexts(params: {
    texts: string[];
    target?: string;
    systemPrompt?: string;
    task?: TranslateTask;
  }): Promise<string[]> {
    const sourceTexts = params.texts
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (sourceTexts.length === 0) {
      throw new HttpError(400, 'Text is required');
    }

    const rawTarget = String(params.target || 'en').toLowerCase();
    if (!SUPPORTED_TARGETS.has(rawTarget as TargetLang)) {
      throw new HttpError(400, `Unsupported target language: ${params.target}`);
    }
    const target = rawTarget as TargetLang;

    const config = await this.apiConfigService.getAll();
    const configuredSystemPrompt = config.settings?.services?.translate?.systemPrompt;
    const requestSystemPrompt = params.systemPrompt?.trim();
    const resolvedSystemPrompt = injectTranslateKeywords(
      requestSystemPrompt || configuredSystemPrompt || DEFAULT_TRANSLATE_SYSTEM_PROMPT,
    );

    const runUrl = process.env.LEMO_COZE_EDIT_RUN_URL?.trim();
    const apiToken = process.env.LEMO_COZE_EDIT_API_TOKEN?.trim();
    if (!runUrl) {
      throw new HttpError(500, 'LEMO_COZE_EDIT_RUN_URL is not set');
    }
    if (!apiToken) {
      throw new HttpError(500, 'LEMO_COZE_EDIT_API_TOKEN is not set');
    }

    const raw = await callCozeRunApi({
      runUrl,
      apiToken,
      systemPrompt: resolvedSystemPrompt,
      userInput: buildTranslateUserInput(sourceTexts, target, params.task || 'dataset_prompt_translation'),
    });

    return normalizeTranslatedTexts(raw, sourceTexts.length);
  }
}
