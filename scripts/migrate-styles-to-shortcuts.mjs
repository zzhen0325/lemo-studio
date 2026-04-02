import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

import {
  buildBaseShortcutCodeFromStyleId,
  buildShortcutPayloadFromStyle,
  resolveSourceStyleIdFromPromptConfig,
  resolveStyleId,
  resolveUniqueCode,
} from './lib/migrate-styles-to-shortcuts-utils.mjs';

dotenv.config({ path: '.env.local' });
dotenv.config();

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

async function loadStyles(client) {
  const { data, error } = await client
    .from('style_stacks')
    .select('*')
    .not('id', 'like', 'shortcut-%');

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function loadShortcuts(client) {
  const { data, error } = await client
    .from('playground_shortcuts')
    .select('id, code, sort_order, prompt_config')
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const { url, key } = getCredentials();
  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      timeout: 60000,
    },
  });

  const styles = await loadStyles(client);
  const existingShortcuts = await loadShortcuts(client);

  const existingByCode = new Map();
  const existingBySourceStyleId = new Map();
  const usedCodes = new Set();

  let maxSortOrder = -1;
  existingShortcuts.forEach((shortcut) => {
    const code = typeof shortcut.code === 'string' ? shortcut.code.trim() : '';
    if (code) {
      existingByCode.set(code, shortcut);
      usedCodes.add(code);
    }

    const sortOrder = typeof shortcut.sort_order === 'number' ? shortcut.sort_order : null;
    if (sortOrder !== null) {
      maxSortOrder = Math.max(maxSortOrder, sortOrder);
    }

    const sourceStyleId = resolveSourceStyleIdFromPromptConfig(shortcut.prompt_config);
    if (sourceStyleId) {
      existingBySourceStyleId.set(sourceStyleId, shortcut);
    }
  });

  const stats = {
    totalStyles: styles.length,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
  };

  const failures = [];
  const preview = [];

  for (let index = 0; index < styles.length; index += 1) {
    const style = styles[index];
    const sourceStyleId = resolveStyleId(style);

    if (!sourceStyleId) {
      stats.skipped += 1;
      preview.push({
        action: 'skip',
        reason: 'missing_style_id',
      });
      continue;
    }

    let existing = existingBySourceStyleId.get(sourceStyleId) || null;

    let code;
    if (existing && typeof existing.code === 'string' && existing.code.trim()) {
      code = existing.code.trim();
      usedCodes.add(code);
    } else {
      const baseCode = buildBaseShortcutCodeFromStyleId(sourceStyleId);
      code = resolveUniqueCode(baseCode, usedCodes);

      const existingByCodeRecord = existingByCode.get(code);
      if (existingByCodeRecord) {
        existing = existingByCodeRecord;
      }
    }

    const sortOrder = existing && typeof existing.sort_order === 'number'
      ? existing.sort_order
      : maxSortOrder + 1;

    if (!existing || typeof existing.sort_order !== 'number') {
      maxSortOrder = Math.max(maxSortOrder, sortOrder);
    }

    const payload = buildShortcutPayloadFromStyle({
      style,
      code,
      sortOrder,
      index: index + 1,
    });

    preview.push({
      action: existing ? 'update' : 'create',
      sourceStyleId,
      code,
      sortOrder,
      imageCount: Array.isArray(payload.gallery_order) ? payload.gallery_order.length : 0,
    });

    if (!apply) {
      continue;
    }

    try {
      if (existing?.id) {
        const { error: updateError } = await client
          .from('playground_shortcuts')
          .update(payload)
          .eq('id', existing.id);
        if (updateError) {
          throw updateError;
        }
        stats.updated += 1;
      } else {
        const { data: createdRows, error: createError } = await client
          .from('playground_shortcuts')
          .insert({ id: randomUUID(), ...payload })
          .select('id, code, sort_order, prompt_config')
          .single();
        if (createError) {
          throw createError;
        }
        stats.created += 1;

        if (createdRows && typeof createdRows === 'object') {
          existingByCode.set(code, createdRows);
          existingBySourceStyleId.set(sourceStyleId, createdRows);
        }
      }

      const { error: deleteError } = await client
        .from('style_stacks')
        .delete()
        .eq('id', sourceStyleId);
      if (deleteError) {
        throw deleteError;
      }

      stats.deleted += 1;
    } catch (error) {
      stats.failed += 1;
      failures.push({
        sourceStyleId,
        code,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('[migrate-styles-to-shortcuts] mode:', apply ? 'apply' : 'dry-run');
  console.log('[migrate-styles-to-shortcuts] stats:', stats);
  console.log('[migrate-styles-to-shortcuts] preview:', preview.slice(0, 20));
  if (failures.length > 0) {
    console.log('[migrate-styles-to-shortcuts] failures:', failures.slice(0, 20));
  }
}

main().catch((error) => {
  console.error('[migrate-styles-to-shortcuts] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
