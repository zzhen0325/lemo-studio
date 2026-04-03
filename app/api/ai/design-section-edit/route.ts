import {
  DESIGN_SECTION_EDIT_SYSTEM_PROMPT,
  buildDesignSectionEditUserInput,
  parseDesignSectionEditResponse,
} from '@/app/studio/playground/_lib/kv-structured-optimization';
import { DesignSectionEditRequestSchema } from '@/lib/schemas/ai';
import { callCozeRunApi } from '@/lib/server/ai/coze-run';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJsonBody<unknown>(request);
    const parsed = DesignSectionEditRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid design section edit payload', parsed.error.flatten());
    }

    const runUrl = process.env.LEMO_COZE_EDIT_RUN_URL?.trim();
    const apiToken = process.env.LEMO_COZE_EDIT_API_TOKEN?.trim();

    if (!runUrl) {
      throw new HttpError(500, 'LEMO_COZE_EDIT_RUN_URL is not set');
    }
    if (!apiToken) {
      throw new HttpError(500, 'LEMO_COZE_EDIT_API_TOKEN is not set');
    }

    const userInput = buildDesignSectionEditUserInput({
      variantId: parsed.data.variantId,
      sectionKey: parsed.data.sectionKey,
      instruction: parsed.data.instruction,
      currentSectionText: parsed.data.currentSectionText,
      fullAnalysisContext: parsed.data.fullAnalysisContext,
      shortcutContext: {
        shortcutId: parsed.data.shortcutContext.shortcutId,
        shortcutPrompt: parsed.data.shortcutContext.shortcutPrompt,
        market: parsed.data.shortcutContext.market,
      },
    });

    console.info('design_section_edit_request_received', {
      sectionKey: parsed.data.sectionKey,
      shortcutId: parsed.data.shortcutContext.shortcutId,
      variantId: parsed.data.variantId,
      instructionLength: parsed.data.instruction.length,
      runUrl,
    });

    const rawText = await callCozeRunApi({
      runUrl,
      apiToken,
      userInput,
      systemPrompt: DESIGN_SECTION_EDIT_SYSTEM_PROMPT,
    });

    console.info('design_section_edit_response_body', {
      sectionKey: parsed.data.sectionKey,
      shortcutId: parsed.data.shortcutContext.shortcutId,
      variantId: parsed.data.variantId,
      text: rawText,
    });

    return parseDesignSectionEditResponse(rawText);
  });
}
