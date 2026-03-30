import { HttpError } from '../utils/http-error';
import { ApiConfigService } from './api-config.service';
import { validateModelUsage } from '../../model-center';
import type { APIProviderConfig } from '../../api-config/types';

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

type GoogleTranslateResponse = {
  data?: {
    translations?: Array<{ translatedText?: string }>;
  };
  error?: {
    message?: string;
  };
};

const DEFAULT_TRANSLATE_MODEL = 'doubao-seed-2-0-lite-260215';
const DEFAULT_DOUBAO_BASE_URL = (process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
const DEFAULT_GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'');
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

export class TranslateService {
  constructor(private readonly apiConfigService: ApiConfigService) {}

  private getProviderForModel(modelId: string, providers: APIProviderConfig[]): APIProviderConfig {
    const provider = providers
      .find((item) => item.isEnabled && (item.models || []).some((model) => model.modelId === modelId));
    if (!provider) {
      throw new HttpError(400, 'TRANSLATE_MODEL_NOT_FOUND', {
        code: 'TRANSLATE_MODEL_NOT_FOUND',
        message: `translate model not found or provider disabled: ${modelId}`,
      });
    }
    return provider;
  }

  private getApiKeyForDoubao(provider: APIProviderConfig): string {
    const apiKey = provider.apiKey || process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'Missing DOUBAO_API_KEY');
    }
    return apiKey;
  }

  private getApiKeyForGoogleTranslate(provider: APIProviderConfig): string {
    const apiKey = provider.apiKey
      || process.env.GOOGLE_TRANSLATE_API_KEY
      || process.env.GOOGLE_API_KEY
      || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'Missing GOOGLE_TRANSLATE_API_KEY');
    }
    return apiKey;
  }

  private resolveGoogleTranslateEndpoint(baseURL?: string): string {
    const normalized = (baseURL || '').trim().replace(/\/$/, '');
    if (!normalized) return DEFAULT_GOOGLE_TRANSLATE_ENDPOINT;
    if (/\/language\/translate\/v2$/i.test(normalized)) {
      return normalized;
    }
    return `${normalized}/language/translate/v2`;
  }

  private async translateOne(
    sourceText: string,
    target: TargetLang,
    model: string,
    systemPrompt: string,
    apiKey: string,
  ): Promise<string> {
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

  private async translateOneViaGoogle(
    sourceText: string,
    target: TargetLang,
    apiKey: string,
    baseURL?: string,
  ): Promise<string> {
    const endpoint = this.resolveGoogleTranslateEndpoint(baseURL);
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: sourceText,
        target,
        format: 'text',
      }),
    });

    const data = (await response.json().catch(() => ({}))) as GoogleTranslateResponse;
    if (!response.ok) {
      const errorMsg = data.error?.message || `Translation failed (${response.status})`;
      throw new HttpError(response.status, errorMsg);
    }

    const translated = data.data?.translations?.[0]?.translatedText || '';
    const output = normalizeTranslationText(decodeHtmlEntities(translated));
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
    const config = await this.apiConfigService.getAll();
    const translateServiceConfig = config.settings?.services?.translate;
    const configuredModel = translateServiceConfig?.binding?.modelId;
    const configuredSystemPrompt = translateServiceConfig?.systemPrompt;
    const resolvedModel = typeof model === 'string' && model.trim()
      ? model.trim()
      : (configuredModel || DEFAULT_TRANSLATE_MODEL);
    const resolvedSystemPrompt = typeof systemPrompt === 'string' && systemPrompt.trim()
      ? systemPrompt.trim()
      : (configuredSystemPrompt || DEFAULT_TRANSLATE_SYSTEM_PROMPT);

    const runtimeProviders = await this.apiConfigService.getRuntimeProviders();
    const validation = validateModelUsage({
      providers: runtimeProviders,
      modelId: resolvedModel,
      requiredTask: 'text',
    });
    if (!validation.valid) {
      throw new HttpError(400, 'MODEL_VALIDATION_FAILED', { code: 'MODEL_VALIDATION_FAILED', errors: validation.errors });
    }

    const translateProvider = this.getProviderForModel(resolvedModel, runtimeProviders);
    const isGoogleTranslate = translateProvider.providerType === 'google-translate';
    const isDoubao = resolvedModel.includes('doubao');
    if (!isGoogleTranslate && !isDoubao) {
      throw new HttpError(400, 'TRANSLATE_MODEL_UNSUPPORTED', {
        code: 'TRANSLATE_MODEL_UNSUPPORTED',
        message: `translate service supports google-translate provider or doubao model, received ${resolvedModel}`,
      });
    }
    const translatedTexts = await mapWithConcurrency(
      sourceTexts,
      TRANSLATE_CONCURRENCY,
      async (source) => {
        if (isGoogleTranslate) {
          const googleApiKey = this.getApiKeyForGoogleTranslate(translateProvider);
          return this.translateOneViaGoogle(source, normalizedTarget, googleApiKey, translateProvider.baseURL);
        }
        const doubaoApiKey = this.getApiKeyForDoubao(translateProvider);
        return this.translateOne(source, normalizedTarget, resolvedModel, resolvedSystemPrompt, doubaoApiKey);
      },
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
