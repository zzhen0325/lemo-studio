

export function getRequestHost(input: string): string {
  try {
    return new URL(input).host;
  } catch {
    return "";
  }
}

export function countRelativeImageInputs(inputs: string[]): number {
  return inputs.filter((item) => typeof item === "string" && item.startsWith("/")).length;
}

export function logProviderEvent(provider: string, event: string, payload: Record<string, unknown>) {
  if (process.env.DEBUG_AI_PROVIDER === "1") {
    console.info(`[AIProvider][${provider}] ${event}`, payload);
  }
}
