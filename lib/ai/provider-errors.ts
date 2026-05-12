export class AIProviderError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly provider?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      provider?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "AIProviderError";
    this.status = options.status;
    this.code = options.code;
    this.provider = options.provider;
    this.details = options.details;
  }
}

export function isAIProviderError(error: unknown): error is AIProviderError {
  return error instanceof AIProviderError;
}
