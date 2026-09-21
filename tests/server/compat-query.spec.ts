import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createQuery, createQueryable } from '@/lib/server/repositories/compat/query';

function setup(single = false, error: unknown = null) {
  const request = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (value: unknown) => void) => Promise.resolve({ data: single ? { id: 'one' } : [{ id: 'one' }], error }).then(resolve)),
  };
  const client = { from: vi.fn(() => request) };
  const builder = createQuery('generations', client as unknown as SupabaseClient);
  builder._single = single;
  builder._filter = { userId: 'owner', _id: 'one' };
  return { request, client, query: createQueryable(builder) };
}

describe('legacy query execution boundary', () => {
  it('does not execute while building and shares one execution across await and exec', async () => {
    const { query, client, request } = setup();
    query.sort({ createdAt: -1 }).select('id').skip(10).limit(5).lean();
    expect(client.from).not.toHaveBeenCalled();
    await Promise.all([query, query.exec(), query]);
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(request.then).toHaveBeenCalledTimes(1);
    expect(request.range).toHaveBeenCalledWith(10, 14);
    expect(request.eq.mock.calls).toEqual([['user_id', 'owner'], ['id', 'one']]);
    expect(request.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(request.select).toHaveBeenCalledWith('id');
  });
  it('retains single-record behavior without repeated lean requests', async () => {
    const { query, request } = setup(true);
    await expect(query.lean().exec()).resolves.toEqual({ id: 'one' });
    await query;
    expect(request.maybeSingle).toHaveBeenCalledTimes(1);
  });
  it('propagates one cached failure through catch, finally and subsequent awaits', async () => {
    const failure = new Error('database unavailable');
    const { query, client } = setup(false, failure);
    await expect(query.exec()).rejects.toBe(failure);
    await expect(query.catch(error => error)).resolves.toBe(failure);
    const finalized = vi.fn();
    await expect(query.finally(finalized)).rejects.toBe(failure);
    expect(finalized).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(1);
  });
});
