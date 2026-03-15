export class HttpError extends Error {
  public readonly status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly details?: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(status: number, message: string, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
