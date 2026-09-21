import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/src/storage/database/supabase-client', () => ({ getSupabaseClient: () => mocks }));
vi.mock('@/lib/server/db/models', () => ({ GenerationModel: {} }));
import { HistoryRepository } from '@/lib/server/repositories/history.repository';

const record = { id: 'record-1', user_id: 'owner-1', output_url: 'original.png' };
let rows: Map<string, typeof record>;
let filters: Record<string, unknown>;
beforeEach(() => {
  rows = new Map(); filters = {};
  mocks.from.mockImplementation(() => {
    let changes: Partial<typeof record> = {};
    const query = {
      insert: async (row: typeof record) => {
        if (rows.has(row.id)) return { error: { code: '23505' } };
        rows.set(row.id, { ...row }); return { error: null };
      },
      update: (value: typeof changes) => { changes = value; return query; },
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      select: () => query,
      maybeSingle: async () => {
        const row = rows.get(String(filters.id));
        if (!row || row.user_id !== filters.user_id) return { data: null, error: null };
        rows.set(row.id, { ...row, ...changes });
        return { data: { id: row.id }, error: null };
      },
    };
    return query;
  });
});

describe('History ownership writes', () => {
  it('creates once and permits retries by the same owner', async () => {
    const repository = new HistoryRepository();
    await expect(repository.upsert(record)).resolves.toEqual({ created: true });
    await expect(repository.upsert({ ...record, output_url: 'new.png' })).resolves.toEqual({ created: false });
    expect(rows.get(record.id)?.output_url).toBe('new.png');
    expect(filters).toEqual({ id: record.id, user_id: record.user_id });
  });
  it('rejects another actor using an existing ID without changing its contents', async () => {
    rows.set(record.id, { ...record });
    await expect(new HistoryRepository().upsert({ ...record, user_id: 'attacker', output_url: 'bad.png' }))
      .rejects.toMatchObject({ status: 409 });
    expect(rows.get(record.id)).toEqual(record);
  });
  it('keeps ownership and ID immutable during owned updates', async () => {
    rows.set(record.id, { ...record });
    await new HistoryRepository().updateOwned(record.id, record.user_id, { id: 'other', user_id: 'other', output_url: 'new.png' });
    expect(rows.get(record.id)).toEqual({ ...record, output_url: 'new.png' });
  });
  it('rejects writes after an ownership change', async () => {
    rows.set(record.id, { ...record, user_id: 'new-owner' });
    await expect(new HistoryRepository().updateOwned(record.id, record.user_id, { output_url: 'bad.png' }))
      .rejects.toMatchObject({ status: 409 });
    expect(rows.get(record.id)?.output_url).toBe('original.png');
  });
  it('does not treat connection errors as record conflicts', async () => {
    mocks.from.mockReturnValue({ insert: async () => ({ error: { code: '08006' } }) });
    await expect(new HistoryRepository().upsert(record)).rejects.toMatchObject({ code: '08006' });
    expect(rows.size).toBe(0);
  });
});
