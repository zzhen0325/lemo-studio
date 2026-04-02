import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const STYLE_TABLE = 'style_stacks';
const SHORTCUT_PREFIX = 'shortcut-';
const APPLY_FLAG = '--apply';

function getCredentials() {
  const url = process.env.COZE_SUPABASE_URL;
  const key = process.env.COZE_SUPABASE_ANON_KEY || process.env.DB_PASSWORD;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL is not set');
  }

  if (!key) {
    throw new Error('COZE_SUPABASE_ANON_KEY or DB_PASSWORD is not set');
  }

  return { url, key };
}

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const { url, key } = getCredentials();
  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      timeout: 60000,
    },
  });

  const { data, error } = await supabase
    .from(STYLE_TABLE)
    .select('id')
    .like('id', `${SHORTCUT_PREFIX}%`);

  if (error) {
    throw error;
  }

  const ids = Array.isArray(data)
    ? data
      .map((item) => (typeof item.id === 'string' ? item.id : ''))
      .filter(Boolean)
    : [];

  console.log(`[cleanup-shortcut-style-overlays] matched=${ids.length}`);
  if (ids.length > 0) {
    console.log('[cleanup-shortcut-style-overlays] sample ids:', ids.slice(0, 10));
  }

  if (!apply) {
    console.log(`[cleanup-shortcut-style-overlays] dry-run only. Re-run with ${APPLY_FLAG} to delete.`);
    return;
  }

  if (ids.length === 0) {
    console.log('[cleanup-shortcut-style-overlays] nothing to delete.');
    return;
  }

  const { data: deleted, error: deleteError } = await supabase
    .from(STYLE_TABLE)
    .delete()
    .like('id', `${SHORTCUT_PREFIX}%`)
    .select('id');

  if (deleteError) {
    throw deleteError;
  }

  const deletedCount = Array.isArray(deleted) ? deleted.length : 0;
  console.log(`[cleanup-shortcut-style-overlays] deleted=${deletedCount}`);
}

main().catch((error) => {
  console.error('[cleanup-shortcut-style-overlays] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
