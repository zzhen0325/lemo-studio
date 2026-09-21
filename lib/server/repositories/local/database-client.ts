import { createClient } from '@supabase/supabase-js';

/** Use the same PostgREST protocol locally; never forward cloud credentials. */
export function getLocalDatabaseClient() {
  const endpoint = new URL(process.env.LOCAL_DATABASE_API_URL || 'http://127.0.0.1:54321');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) || endpoint.protocol !== 'http:') {
    throw new Error('Local database API must use a loopback HTTP address');
  }
  return createClient(endpoint.origin, 'local-development-only', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin !== endpoint.origin || !url.pathname.startsWith('/rest/v1/')) {
          throw new Error('Unsupported local database request');
        }
        url.pathname = url.pathname.slice('/rest/v1'.length);
        const headers = new Headers(init?.headers);
        headers.delete('Authorization');
        headers.delete('apikey');
        return fetch(url, { ...init, headers });
      },
    },
  });
}
