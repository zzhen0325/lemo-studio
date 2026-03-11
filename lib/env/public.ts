declare global {
  interface Window {
    __GULUX_RUNTIME_ENV__?: {
      apiBase?: string;
      comfyUrl?: string;
      baseUrl?: string;
      disableImageOptimization?: string;
    };
  }
}

function trimEnv(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getRuntimePublicEnv() {
  if (typeof window !== "undefined" && window.__GULUX_RUNTIME_ENV__) {
    return window.__GULUX_RUNTIME_ENV__;
  }

  return {
    apiBase: trimEnv(process.env.NEXT_PUBLIC_API_BASE || process.env.GULUX_API_BASE),
    comfyUrl: trimEnv(process.env.NEXT_PUBLIC_COMFYUI_URL),
    baseUrl: trimEnv(process.env.NEXT_PUBLIC_BASE_URL),
    disableImageOptimization: trimEnv(process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION),
  };
}

export function getPublicApiBase(): string {
  return trimEnv(getRuntimePublicEnv().apiBase);
}

export function getPublicComfyUrl(): string {
  return trimEnv(getRuntimePublicEnv().comfyUrl);
}

export function getPublicBaseUrl(): string {
  return trimEnv(getRuntimePublicEnv().baseUrl);
}

export function getRuntimePort(): string {
  if (typeof window !== "undefined") {
    if (window.location.port) return window.location.port;
    return window.location.protocol === "https:" ? "443" : "80";
  }

  return trimEnv(process.env.NEXT_PUBLIC_APP_PORT || process.env.PORT);
}

export function isPlaygroundOnlyShell(): boolean {
  const mode = trimEnv(process.env.NEXT_PUBLIC_SIDEBAR_MODE);
  if (mode === "playground-only") return true;
  if (mode === "full") return false;
  return getRuntimePort() === "3000";
}
