import {
  DESIGN_SECTION_EDIT_SYSTEM_PROMPT,
  DESIGN_VARIANT_EDIT_SYSTEM_PROMPT,
  buildDesignVariantEditUserInput,
  parseDesignStructuredVariantEditResponse,
} from '@/app/studio/playground/_lib/kv-structured-optimization';
import { DesignVariantEditRequestSchema } from '@/lib/schemas/ai';
import { callCozeRunApi } from '@/lib/server/ai/coze-run';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJsonBody<unknown>(request);
    const parsed = DesignVariantEditRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid design variant edit payload', parsed.error.flatten());
    }

    const runUrl = process.env.LEMO_COZE_EDIT_RUN_URL?.trim();
    const apiToken = process.env.LEMO_COZE_EDIT_API_TOKEN?.trim();

    if (!runUrl) {
      throw new HttpError(500, 'LEMO_COZE_EDIT_RUN_URL is not set');
    }
    if (!apiToken) {
      throw new HttpError(500, 'LEMO_COZE_EDIT_API_TOKEN is not set');
    }

    const { instruction, scope, variant, context } = parsed.data;
    const normalizedVariant = parseDesignStructuredVariantEditResponse(JSON.stringify({ variant })).variant;
    const systemPrompt = scope === 'variant'
      ? DESIGN_VARIANT_EDIT_SYSTEM_PROMPT
      : DESIGN_SECTION_EDIT_SYSTEM_PROMPT;

    const userInput = buildDesignVariantEditUserInput({
      instruction,
      scope,
      variant: normalizedVariant,
      context,
    });

    console.info('design_variant_edit_request_received', {
      scope,
      shortcutId: context.shortcutId,
      instructionLength: instruction.length,
      variantId: normalizedVariant.id,
      runUrl,
    });

    const rawText = await callCozeRunApi({
      runUrl,
      apiToken,
      userInput,
      systemPrompt,
    });

    console.info('design_variant_edit_response_body', {
      scope,
      shortcutId: context.shortcutId,
      variantId: normalizedVariant.id,
      text: rawText,
    });

    return parseDesignStructuredVariantEditResponse(rawText);
  });
}
