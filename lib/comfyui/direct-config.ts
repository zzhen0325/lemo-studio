import { getPublicComfyUrl } from "@/lib/env/public";

function trimValue(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getConfiguredDirectComfyUrl(explicitUrl?: string | null): string {
  return trimValue(explicitUrl) || getPublicComfyUrl();
}

export function shouldUseDirectComfyUi(explicitUrl?: string | null): boolean {
  return getConfiguredDirectComfyUrl(explicitUrl).length > 0;
}

export function getDirectComfyDecision(explicitUrl?: string | null, currentProtocol?: string) {
  const raw = getConfiguredDirectComfyUrl(explicitUrl);
  if (!raw) {
    return {
      enabled: false,
      reason: "Direct ComfyUI URL is not configured.",
      comfyUrl: "",
    };
  }

  try {
    const comfyUrl = resolveDirectComfyUrl(raw);
    if (!comfyUrl) {
      return {
        enabled: false,
        reason: "Direct ComfyUI URL is not configured.",
        comfyUrl: raw,
      };
    }

    assertDirectComfyCompatibility(comfyUrl, currentProtocol);
    return {
      enabled: true,
      reason: "",
      comfyUrl: comfyUrl.toString(),
    };
  } catch (error) {
    return {
      enabled: false,
      reason: error instanceof Error ? error.message : String(error),
      comfyUrl: raw,
    };
  }
}

export function resolveDirectComfyUrl(explicitUrl?: string | null): URL | null {
  const raw = getConfiguredDirectComfyUrl(explicitUrl);
  if (!raw) return null;

  try {
    return new URL(raw.endsWith("/") ? raw : `${raw}/`);
  } catch {
    throw new Error(`Invalid ComfyUI URL: ${raw}`);
  }
}

export function assertDirectComfyCompatibility(comfyUrl: URL, currentProtocol?: string) {
  const pageProtocol = currentProtocol
    || (typeof window !== "undefined" ? window.location.protocol : undefined)
    || "http:";

  if (pageProtocol === "https:" && comfyUrl.protocol === "http:") {
    throw new Error("Browser direct ComfyUI mode is blocked on HTTPS pages when ComfyUI uses HTTP. Put ComfyUI behind an HTTPS reverse proxy, or access this site over HTTP.");
  }
}

export function getDirectComfyEndpoints(explicitUrl?: string | null, currentProtocol?: string) {
  const comfyUrl = resolveDirectComfyUrl(explicitUrl);
  if (!comfyUrl) return null;

  assertDirectComfyCompatibility(comfyUrl, currentProtocol);

  const httpBase = comfyUrl.origin;
  const wsProtocol = comfyUrl.protocol === "https:" ? "wss:" : "ws:";
  const wsBase = `${wsProtocol}//${comfyUrl.host}`;

  return {
    httpBase,
    wsBase,
    baseUrl: comfyUrl,
  };
}
