import { getSupabaseClient } from '@/src/storage/database/supabase-client';
import { HttpError } from '../utils/http-error';

type ConfigRow = { id: string; config: Record<string, unknown> };

function replaceReference(config: Record<string, unknown>, localId: string, storageKey: string) {
  const ids = config.localSourceIds;
  const urls = config.sourceImageUrls;
  if (!Array.isArray(ids) || !Array.isArray(urls)) return null;
  let changed = false;
  const nextUrls = urls.map((url, index) => {
    if (ids[index] !== localId || url === storageKey) return url;
    changed = true;
    return storageKey;
  });
  return changed ? { ...config, sourceImageUrls: nextUrls } : null;
}

/** Patch references without overwriting concurrent config edits or crossing owners. */
export async function syncOwnedHistoryImage(ownerId: string, localId: string, storageKey: string): Promise<void> {
  const client = getSupabaseClient();
  let cursor: string | undefined;
  while (true) {
    let query = client.from('generations').select('id,config')
      .eq('user_id', ownerId).contains('config', { localSourceIds: [localId] })
      .order('id', { ascending: true }).limit(100);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as ConfigRow[];
    for (const initial of rows) {
      let current: ConfigRow | null = initial;
      for (let attempt = 0; current; attempt++) {
        const next = replaceReference(current.config, localId, storageKey);
        if (!next) break;
        if (attempt >= 5) throw new HttpError(409, 'History changed during image synchronization; retry the upload sync');
        const result = await client.rpc('update_owned_history_config', {
          p_id: current.id,
          p_owner_id: ownerId,
          p_expected_config: current.config,
          p_config: next,
        }).maybeSingle();
        if (result.error) throw result.error;
        if (result.data) break;
        // A concurrent edit won: reload and merge into its latest config.
        const fresh = await client.from('generations').select('id,config')
          .eq('id', current.id).eq('user_id', ownerId).maybeSingle();
        if (fresh.error) throw fresh.error;
        current = fresh.data as ConfigRow | null;
      }
    }
    if (rows.length < 100) return;
    cursor = rows[rows.length - 1].id;
  }
}
