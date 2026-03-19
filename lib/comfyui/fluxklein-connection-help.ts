const FLUX_KLEIN_CONNECTION_HELP_CODE = "FLUX_KLEIN_COMFY_BROWSER_TRUST_REQUIRED";

const CONNECTION_HELP_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /certificate/i,
  /\bcert\b/i,
  /\bssl\b/i,
  /cannot open comfyui websocket/i,
  /websocket connection failed/i,
  /网络不可达/,
  /证书错误/,
];

export type FluxKleinConnectionHelp = {
  title: string;
  message: string;
  comfyUrl: string;
  technicalReason?: string;
};

export type FluxKleinConnectionHelpError = Error & {
  code?: string;
  comfyUrl?: string;
  technicalReason?: string;
};

function extractUrl(value: string): string {
  const match = value.match(/https?:\/\/[^\s"'`)<>\]\u3002\uff0c\uff1b\uff1a]+/i);
  return match?.[0] || "";
}

function buildHelp(comfyUrl: string, technicalReason?: string): FluxKleinConnectionHelp {
  return {
    title: "需要先在浏览器中放行 ComfyUI 连接",
    message: `FluxKlein 需要由浏览器直接访问运行在你个人电脑上的 ComfyUI。请先单独打开 ${comfyUrl}，在浏览器提示页里点击“高级”，再点击“继续前往”，然后回到这里重新点击生成。`,
    comfyUrl,
    technicalReason,
  };
}

export function shouldShowFluxKleinConnectionHelp(reason: string): boolean {
  const normalized = reason.trim();
  if (!normalized) return false;
  return CONNECTION_HELP_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function createFluxKleinConnectionHelpError(args: {
  comfyUrl: string;
  technicalReason?: string;
}): FluxKleinConnectionHelpError {
  const help = buildHelp(args.comfyUrl, args.technicalReason);
  const error = new Error(help.message) as FluxKleinConnectionHelpError;
  error.name = "FluxKleinConnectionHelpError";
  error.code = FLUX_KLEIN_CONNECTION_HELP_CODE;
  error.comfyUrl = help.comfyUrl;
  error.technicalReason = help.technicalReason;
  return error;
}

export function getFluxKleinConnectionHelp(error: unknown): FluxKleinConnectionHelp | null {
  if (error instanceof Error) {
    const enrichedError = error as FluxKleinConnectionHelpError;
    const technicalReason = enrichedError.technicalReason || error.message;
    const comfyUrl = enrichedError.comfyUrl || extractUrl(error.message);

    if (enrichedError.code === FLUX_KLEIN_CONNECTION_HELP_CODE && comfyUrl) {
      return buildHelp(comfyUrl, technicalReason);
    }

    if (comfyUrl && shouldShowFluxKleinConnectionHelp(technicalReason)) {
      return buildHelp(comfyUrl, technicalReason);
    }
  }

  if (typeof error === "string") {
    const comfyUrl = extractUrl(error);
    if (comfyUrl && shouldShowFluxKleinConnectionHelp(error)) {
      return buildHelp(comfyUrl, error);
    }
  }

  return null;
}
