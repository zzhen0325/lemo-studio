import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';

export interface TranslateRequestBody {
  text?: string;
  texts?: string[];
  target?: string;
  model?: string;
  systemPrompt?: string;
}

export interface TranslateResult {
  translatedText?: string;
  translatedTexts?: string[];
}

type TargetLang = 'zh' | 'en';
type DoubaoResponseContentItem = { type?: string; text?: string };
type DoubaoResponseOutputItem = {
  type?: string;
  content?: DoubaoResponseContentItem[];
};
type DoubaoResponse = {
  output?: DoubaoResponseOutputItem[];
  output_text?: string | string[];
  error?: { message?: string };
};

const DEFAULT_TRANSLATE_MODEL = 'doubao-seed-2-0-lite-260215';
const DEFAULT_DOUBAO_BASE_URL = (process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
const SUPPORTED_TARGET_LANGS = new Set<TargetLang>(['zh', 'en']);
const TRANSLATE_CONCURRENCY = 5;
const DEFAULT_TRANSLATE_SYSTEM_PROMPT = [
  'You are a professional prompt translation engine for text-to-image workflows.',
  'Translate only. Do not explain, annotate, or add extra content.',
  'Output language must strictly match the target language requested by user.',
  'Preserve original meaning, tone, structure, and detail density.',
  'Keep comma-separated tag style if the source uses tags.',
  'Keep placeholders, symbols, model params, lora tags, and proper nouns unchanged when appropriate.',
  'Do not censor or soften visual details unless they are clearly harmful instructions.',
  'Keep punctuation and list separators consistent with the source prompt style.',
  'Return plain translated text only, without quotes or markdown.',
].join('\n');

function extractDoubaoOutputText(data: DoubaoResponse): string {
  const outputs = Array.isArray(data.output) ? data.output : [];
  const messageOutput = outputs.find((item) => item?.type === 'message');
  const messageText = messageOutput?.content?.find(
    (content) => content?.type === 'output_text' && typeof content.text === 'string',
  )?.text;
  if (messageText) return messageText;

  for (const output of outputs) {
    const text = output?.content?.find(
      (content) => content?.type === 'output_text' && typeof content.text === 'string',
    )?.text;
    if (text) return text;
  }

  if (typeof data.output_text === 'string') return data.output_text;
  if (Array.isArray(data.output_text)) return data.output_text.join('');
  return '';
}

function normalizeTranslationText(raw: string): string {
  let text = raw.trim();

  if (text.startsWith('```') && text.endsWith('```')) {
    text = text.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\'') && text.endsWith('\''))) {
    text = text.slice(1, -1).trim();
  }

  text = text.replace(/^translation\s*[:：]\s*/i, '').trim();
  return text;
}

function getTargetLabel(target: TargetLang): string {
  return target === 'zh' ? 'Simplified Chinese' : 'English';
}

function buildTranslationPrompt(sourceText: string, target: TargetLang): string {
  return [
    `Translate the following content into ${getTargetLabel(target)}.`,
    'Output only the translated text.',
    '',
    sourceText,
  ].join('\n');
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const result = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      result[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return result;
}

@Injectable()
export class TranslateService {
  private getApiKey(): string {
    const apiKey = process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'Missing DOUBAO_API_KEY');
    }
    return apiKey;
  }

  private async translateOne(
    sourceText: string,
    target: TargetLang,
    model: string,
    systemPrompt: string,
  ): Promise<string> {
    const apiKey = this.getApiKey();
    const response = await fetch(`${DEFAULT_DOUBAO_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: buildTranslationPrompt(sourceText, target) },
          ],
        }],
      }),
    });

    const data = (await response.json().catch(() => ({}))) as DoubaoResponse;
    if (!response.ok) {
      const errorMsg = data.error?.message || `Translation failed (${response.status})`;
      throw new HttpError(response.status, errorMsg);
    }

    const output = normalizeTranslationText(extractDoubaoOutputText(data));
    if (!output) {
      throw new HttpError(502, 'Model returned empty translation');
    }

    return output;
  }

  public async translate(body: TranslateRequestBody): Promise<TranslateResult> {
    const { text, texts, target = 'en', model, systemPrompt } = body;
    const normalizedTexts = Array.isArray(texts)
      ? texts.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText && normalizedTexts.length === 0) {
      throw new HttpError(400, 'Text is required');
    }

    const normalizedTarget = String(target).toLowerCase() as TargetLang;
    if (!SUPPORTED_TARGET_LANGS.has(normalizedTarget)) {
      throw new HttpError(400, `Unsupported target language: ${target}`);
    }

    const sourceTexts = normalizedTexts.length > 0 ? normalizedTexts : [normalizedText];
    const resolvedModel = typeof model === 'string' && model.trim()
      ? model.trim()
      : DEFAULT_TRANSLATE_MODEL;
    const resolvedSystemPrompt = typeof systemPrompt === 'string' && systemPrompt.trim()
      ? systemPrompt.trim()
      : DEFAULT_TRANSLATE_SYSTEM_PROMPT;

    const translatedTexts = await mapWithConcurrency(
      sourceTexts,
      TRANSLATE_CONCURRENCY,
      async (source) => this.translateOne(source, normalizedTarget, resolvedModel, resolvedSystemPrompt),
    );

    if (normalizedTexts.length > 0) {
      return { translatedTexts };
    }

    const translated = translatedTexts[0];
    if (!translated) {
      throw new HttpError(500, 'No translation returned');
    }

    return { translatedText: translated };
  }
}
