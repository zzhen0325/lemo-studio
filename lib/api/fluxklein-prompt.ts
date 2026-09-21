type PrepareFluxKleinPromptOptions = {
  signal?: AbortSignal;
  requestId?: string;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function prepareFluxKleinPrompt(
  prompt: string,
  options: PrepareFluxKleinPromptOptions = {},
): Promise<string> {
  const sourcePrompt = typeof prompt === 'string' ? prompt : '';
  if (!sourcePrompt.trim()) {
    return sourcePrompt;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.requestId) {
    headers['x-request-id'] = options.requestId;
  }

  try {
    const response = await fetch('/api/comfy-fluxklein/prompt', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: sourcePrompt }),
      signal: options.signal,
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('[FluxKlein][Prompt] prepare_failed', { status: response.status });
      return sourcePrompt;
    }

    const payload = await response.json().catch(() => null) as { prompt?: unknown } | null;
    const preparedPrompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';
    return preparedPrompt || sourcePrompt;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('[FluxKlein][Prompt] prepare_failed', { reason });
    return sourcePrompt;
  }
}
