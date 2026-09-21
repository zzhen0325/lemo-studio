import { expect, it, vi } from 'vitest';
const connect = vi.hoisted(() => vi.fn(() => { throw new Error('Database must not be accessed'); }));
vi.mock('@/src/storage/database/supabase-client', () => ({ getSupabaseClient: connect }));
import { GET, POST } from '@/app/api/admin/fix-urls/route';
it('retires both public and formerly administrative access without database work', async () => {
  for (const handler of [GET, POST]) {
    const response = await handler();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: 'This URL repair endpoint has been retired' });
  }
  expect(connect).not.toHaveBeenCalled();
});
