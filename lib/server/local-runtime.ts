/** Explicit opt-in: cloud deployments keep their existing storage and credentials. */
export function isLocalRuntime(): boolean {
  return process.env.STUDIO_RUNTIME === 'local';
}

export function localAppOrigin(): string {
  return `http://127.0.0.1:${process.env.APP_PORT || process.env.NEXT_PUBLIC_APP_PORT || '3001'}`;
}
