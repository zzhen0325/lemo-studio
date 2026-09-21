import type { SupabaseClient } from '@supabase/supabase-js';
import { camelToSnake, normalizeDbKey } from './fields';

interface QueryBuilder<T = unknown> {
  _resultType?: T;
  _filter: Record<string, unknown>;
  _sort: Record<string, 1 | -1>;
  _skip?: number;
  _limit?: number;
  _select?: string;
  _table: string;
  _client: SupabaseClient;
  _single: boolean;
}

export function createQuery<T>(table: string, client: SupabaseClient): QueryBuilder<T> {
  return {
    _filter: {},
    _sort: {},
    _table: table,
    _client: client,
    _single: false,
  };
}

async function executeQuery<T>(qb: QueryBuilder<T>): Promise<T[]> {
  let query = qb._client.from(qb._table).select(qb._select || '*');

  // Apply filters with camelCase to snake_case conversion
  for (const [key, value] of Object.entries(qb._filter)) {
    if (value !== undefined && value !== null) {
      const dbKey = normalizeDbKey(key);
      query = query.eq(dbKey, value);
    }
  }

  // Apply sort with camelCase to snake_case conversion
  for (const [field, order] of Object.entries(qb._sort)) {
    const dbField = camelToSnake(field);
    query = query.order(dbField, { ascending: order === 1 });
  }

  // Apply pagination
  if (qb._skip !== undefined && qb._limit !== undefined) {
    query = query.range(qb._skip, qb._skip + qb._limit - 1);
  } else if (qb._limit !== undefined) {
    query = query.limit(qb._limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as T[]) || [];
}

async function executeSingle<T>(qb: QueryBuilder<T>): Promise<T | null> {
  let query = qb._client.from(qb._table).select(qb._select || '*');

  for (const [key, value] of Object.entries(qb._filter)) {
    if (value !== undefined && value !== null) {
      const dbKey = normalizeDbKey(key);
      query = query.eq(dbKey, value);
    }
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data as T | null;
}

// Build lazily; await/then/catch/finally/exec share one execution promise.
export function createQueryable<T>(qb: QueryBuilder<T>) {
  let execution: Promise<T[] | T | null> | undefined;
  const execute = () => execution ??= qb._single ? executeSingle(qb) : executeQuery(qb);
  const chain = {
    then: <A = T[] | T | null, B = never>(
      fulfilled?: ((value: T[] | T | null) => A | PromiseLike<A>) | null,
      rejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ) => execute().then(fulfilled, rejected),
    catch: <B = never>(rejected?: ((reason: unknown) => B | PromiseLike<B>) | null) => execute().catch(rejected),
    finally: (callback?: (() => void) | null) => execute().finally(callback),
    lean: () => chain,
    sort: (sort: Record<string, 1 | -1>) => { Object.assign(qb._sort, sort); return chain; },
    select: (fields: string) => { qb._select = fields; return chain; },
    skip: (n: number) => { qb._skip = n; return chain; },
    limit: (n: number) => { qb._limit = n; return chain; },
    exec: execute,
  };
  return chain;
}
