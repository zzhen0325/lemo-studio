import { z } from 'zod';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TranslateRequestSchema = z.object({
  text: z.string().optional(),
  texts: z.array(z.string()).optional(),
  target: z.string().optional(),
  systemPrompt: z.string().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { translateService } = await getServerServices();
    const body = await readJsonBody<unknown>(request);
    const parsed = TranslateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }

    const text = typeof parsed.data.text === 'string' ? parsed.data.text.trim() : '';
    const texts = Array.isArray(parsed.data.texts)
      ? parsed.data.texts.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const sourceTexts = texts.length > 0 ? texts : (text ? [text] : []);
    if (sourceTexts.length === 0) {
      throw new HttpError(400, 'Text is required');
    }

    const translatedTexts = await translateService.translateTexts({
      texts: sourceTexts,
      target: parsed.data.target || 'en',
      systemPrompt: parsed.data.systemPrompt,
      task: 'dataset_prompt_translation',
    });

    if (texts.length > 0) {
      return { translatedTexts };
    }
    return { translatedText: translatedTexts[0] || '' };
  });
}
