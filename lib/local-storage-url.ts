/** Recover durable keys from local display URLs, including after a port change. */
export function extractLocalStorageKey(value: string): string | null {
  try {
    const url = new URL(value, 'http://127.0.0.1');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    if (url.pathname !== '/api/storage/local' && url.pathname !== '/api/storage/image') return null;
    return url.searchParams.get('key') || null;
  } catch {
    return null;
  }
}
