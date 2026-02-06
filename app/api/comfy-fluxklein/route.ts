import { type NextRequest, NextResponse } from "next/server";
import { ErrorResponseFactory } from "@/app/models/errors";
import { ComfyUIService } from "@/lib/api/comfyui-service";
import { buildFluxKleinWorkflow } from "@/lib/api/fluxklein-workflow";
import type { IViewComfy } from "@/types/comfy-input";

const errorResponseFactory = new ErrorResponseFactory();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const width = Number(body?.width) || 1024;
    const height = Number(body?.height) || 1024;
    const seed = typeof body?.seed === "number" ? body.seed : undefined;
    const batchSize = typeof body?.batchSize === "number" ? body.batchSize : undefined;
    const referenceImages = Array.isArray(body?.referenceImages) ? body.referenceImages : [];
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey : undefined;
    const comfyUrl = typeof body?.comfyUrl === "string" ? body.comfyUrl : undefined;

    const { workflow, viewComfyInputs } = await buildFluxKleinWorkflow({
      prompt,
      width,
      height,
      seed,
      batchSize,
      referenceImages,
    });

    const viewComfy: IViewComfy = {
      inputs: viewComfyInputs,
      textOutputEnabled: false,
    };

    const comfyUIService = new ComfyUIService({ apiKey, comfyUrl });
    const stream = await comfyUIService.runWorkflow({ workflow, viewComfy });
    return new NextResponse<ReadableStream<Uint8Array>>(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="generated_images.bin"',
      },
    });
  } catch (error: unknown) {
    const responseError = errorResponseFactory.getErrorResponse(error);
    return NextResponse.json(responseError, { status: 500 });
  }
}
