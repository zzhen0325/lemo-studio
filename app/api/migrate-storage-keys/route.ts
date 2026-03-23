import { NextResponse } from 'next/server';
import { getServerServices } from '@/lib/server/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Extract storage key from a presigned URL
 * 
 * Example URL:
 * https://coze-coding-project.tos.coze.site/coze_storage_7617306962664947731/ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/outputs/img_xxx.png?sign=xxx
 * 
 * Storage key would be:
 * ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/outputs/img_xxx.png
 */
function extractStorageKeyFromUrl(url: string): string | null {
  try {
    // If it's not a URL, assume it's already a storage key
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }
    
    const parsed = new URL(url);
    
    // Check if it's a TOS URL
    if (!parsed.hostname.includes('tos.coze.site') && !parsed.hostname.includes('tiktokcdn.com')) {
      return null;
    }
    
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    // Skip the bucket name (first part like coze_storage_xxx)
    if (pathParts.length < 2) {
      return null;
    }
    
    let keyStartIndex = 0;
    if (pathParts[0].startsWith('coze_storage_')) {
      keyStartIndex = 1;
    }
    
    if (keyStartIndex >= pathParts.length) {
      return null;
    }
    
    return pathParts.slice(keyStartIndex).join('/') || null;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a presigned URL (has sign parameter)
 */
function isPresignedUrl(url: string): boolean {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
    const parsed = new URL(url);
    return parsed.searchParams.has('sign');
  } catch {
    return false;
  }
}

/**
 * POST /api/migrate-storage-keys
 * 
 * Migrate existing presigned URLs to storage keys in the database.
 * This is a one-time migration script.
 * 
 * Body: { confirm: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { confirm } = body as { confirm?: boolean };
    
    if (!confirm) {
      return NextResponse.json({
        message: 'Set confirm: true to run the migration',
        dryRun: true,
      });
    }
    
    const { historyService } = await getServerServices();
    
    // Get all history records
    const allHistory = await historyService.getHistory({ page: 1, limit: 10000 });
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    const results: Array<{ id: string; oldUrl: string; newKey: string | null }> = [];
    
    for (const item of allHistory.history) {
      const outputUrl = item.outputUrl;
      
      // Skip if not a presigned URL
      if (!outputUrl || !isPresignedUrl(outputUrl)) {
        skippedCount++;
        continue;
      }
      
      // Extract storage key
      const storageKey = extractStorageKeyFromUrl(outputUrl);
      
      if (!storageKey) {
        errorCount++;
        console.warn('[migration] Failed to extract storage key from:', outputUrl.slice(0, 100));
        continue;
      }
      
      results.push({ id: item.id, oldUrl: outputUrl, newKey: storageKey });
      migratedCount++;
      
      // Note: The actual update will happen in normalizeGenerationUrls
      // when the record is accessed next time. This is a safer approach.
    }
    
    return NextResponse.json({
      success: true,
      message: 'Migration analysis complete. Records will be updated on next access.',
      stats: {
        totalRecords: allHistory.history.length,
        migratedCount,
        skippedCount,
        errorCount,
      },
      sampleResults: results.slice(0, 10),
    });
  } catch (error) {
    console.error('[migration] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
