import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/src/storage/database/supabase-client', () => ({ getSupabaseClient: () => mocks }));
import { syncOwnedHistoryImage } from '@/lib/server/repositories/history-image-sync.repository';
import { saveHistoryRecord } from '@/lib/server/service/history-write.service';

const original = { prompt: 'preserve me', localSourceIds: ['local', 'other', 'local'], sourceImageUrls: ['data:old', 'other.png', 'data:old'], nested: { untouched: true } };
let replies: Array<{ data: unknown; error: unknown }>;
let calls: Array<{ filters: unknown[][]; patch?: unknown }>;
beforeEach(() => {
  calls = []; replies = [];
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation((_name, params) => {
    calls.push({ filters: [['user_id', params.p_owner_id], ['config', JSON.stringify(params.p_expected_config)]], patch: { config: params.p_config } });
    return { maybeSingle: async () => replies.shift() };
  });
  mocks.from.mockImplementation(() => {
    const call: typeof calls[number] = { filters: [] }; calls.push(call);
    const query = {
      select: () => query, order: () => query, limit: () => query,
      eq: (...args: unknown[]) => { call.filters.push(args); return query; },
      contains: (...args: unknown[]) => { call.filters.push(args); return query; },
      gt: (...args: unknown[]) => { call.filters.push(args); return query; },
      update: (patch: unknown) => { call.patch = patch; return query; },
      maybeSingle: () => query,
      then: (resolve: (value: unknown) => void) => Promise.resolve(replies.shift()).then(resolve),
    };
    return query;
  });
});
it('updates all matching positions, preserving unrelated config with owner and snapshot filters', async () => {
  replies.push({ data: [{ id: 'row', config: original }], error: null }, { data: { id: 'row' }, error: null });
  await syncOwnedHistoryImage('owner', 'local', 'stable.png');
  expect(calls[1].patch).toEqual({ config: { ...original, sourceImageUrls: ['stable.png', 'other.png', 'stable.png'] } });
  expect(calls.every(call => call.filters.some(([key, value]) => key === 'user_id' && value === 'owner'))).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith('update_owned_history_config', expect.objectContaining({ p_id: 'row', p_owner_id: 'owner', p_expected_config: original }));
});
it('reloads concurrent config changes before retrying rather than overwriting them', async () => {
  const edited = { ...original, prompt: 'concurrent edit' };
  replies.push({ data: [{ id: 'row', config: original }], error: null }, { data: null, error: null },
    { data: { id: 'row', config: edited }, error: null }, { data: { id: 'row' }, error: null });
  await syncOwnedHistoryImage('owner', 'local', 'stable.png');
  expect(calls[3].patch).toMatchObject({ config: { prompt: 'concurrent edit' } });
  expect(calls[3].filters).toContainEqual(['config', JSON.stringify(edited)]);
});
it('does not write on an idempotent retry', async () => {
  replies.push({ data: [{ id: 'row', config: { ...original, sourceImageUrls: ['stable.png', 'other.png', 'stable.png'] } }], error: null });
  await syncOwnedHistoryImage('owner', 'local', 'stable.png');
  expect(calls).toHaveLength(1);
});
it('propagates storage failures rather than reporting success', async () => {
  const error = new Error('offline');
  replies.push({ data: null, error });
  await expect(syncOwnedHistoryImage('owner', 'local', 'stable.png')).rejects.toBe(error);
});
it('validates sync requests and delegates with the server actor only', async () => {
  const repository = { syncImageReference: vi.fn().mockResolvedValue(undefined), upsert: vi.fn() };
  await expect(saveHistoryRecord(repository as never, { action: 'sync-image', localId: 'local' }, 'owner')).rejects.toMatchObject({ status: 400 });
  await saveHistoryRecord(repository as never, { action: 'sync-image', localId: 'local', path: 'stable.png', userId: 'other' }, 'owner');
  expect(repository.syncImageReference).toHaveBeenCalledWith('owner', 'local', 'stable.png');
  expect(repository.upsert).not.toHaveBeenCalled();
});
it('continues past a full page using a stable ID cursor', async () => {
  const config = { ...original, sourceImageUrls: ['stable.png', 'other.png', 'stable.png'] };
  replies.push({ data: Array.from({ length: 100 }, (_, i) => ({ id: String(i).padStart(3, '0'), config })), error: null }, { data: [], error: null });
  await syncOwnedHistoryImage('owner', 'local', 'stable.png');
  expect(calls).toHaveLength(2);
  expect(calls[1].filters).toContainEqual(['id', '099']);
});
it('reports continuous write conflicts instead of silently losing the sync', async () => {
  replies.push({ data: [{ id: 'row', config: original }], error: null });
  for (let i = 0; i < 5; i++) {
    replies.push({ data: null, error: null }, { data: { id: 'row', config: { ...original, prompt: String(i) } }, error: null });
  }
  await expect(syncOwnedHistoryImage('owner', 'local', 'stable.png')).rejects.toMatchObject({ status: 409 });
});
