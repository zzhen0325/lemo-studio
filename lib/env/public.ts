function trimEnv(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getPublicComfyUrl(): string {
  return trimEnv(process.env.NEXT_PUBLIC_COMFYUI_URL);
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
