import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrlForStorageKey } from '@/lib/server/utils/cdn';
import { ImageAssetModel } from '@/lib/server/db/models';
import { getServerServices } from '@/lib/server/container';

/**
 * GET /api/image-url
 * 获取图片的预签名 URL
 * 
 * Query params:
 * - id: 图片 ID（数据库中的 id）
 * - storageKey: 对象存储的 key（URI）
 * - expireTime: URL 过期时间（秒，默认 1 天）
 * 
 * 返回预签名 URL，用于访问存储在对象存储中的图片
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const storageKey = searchParams.get('storageKey');
    const expireTime = parseInt(searchParams.get('expireTime') || '86400', 10);

    let actualStorageKey = storageKey;

    // 如果提供了 ID，从数据库获取 storageKey
    if (id && !storageKey) {
      const asset = await ImageAssetModel.findById(id);
      if (!asset) {
        return NextResponse.json(
          { error: 'Image not found' },
          { status: 404 }
        );
      }
      actualStorageKey = asset.storage_key;
      
      // 如果没有 storageKey，但有 url，直接返回 url（向后兼容）
      if (!actualStorageKey && asset.url) {
        return NextResponse.json({ url: asset.url });
      }
    }

    if (!actualStorageKey) {
      return NextResponse.json(
        { error: 'storageKey is required' },
        { status: 400 }
      );
    }

    // 生成预签名 URL
    const url = await getSignedUrlForStorageKey(actualStorageKey, expireTime);

    return NextResponse.json({ 
      url,
      storageKey: actualStorageKey,
      expireTime,
    });
  } catch (error) {
    console.error('[API] image-url error:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/image-url
 * 批量获取多个图片的预签名 URL
 * 
 * Body:
 * - ids: 图片 ID 数组
 * - expireTime: URL 过期时间（秒，默认 1 天）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, expireTime = 86400 } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required' },
        { status: 400 }
      );
    }

    const results: Record<string, { url?: string; storageKey?: string; error?: string }> = {};

    for (const id of ids) {
      try {
        const asset = await ImageAssetModel.findById(id);
        if (!asset) {
          results[id] = { error: 'Not found' };
          continue;
        }

        // 如果没有 storageKey，但有 url，直接返回 url（向后兼容）
        if (!asset.storage_key && asset.url) {
          results[id] = { url: asset.url };
          continue;
        }

        if (asset.storage_key) {
          const url = await getSignedUrlForStorageKey(asset.storage_key, expireTime);
          results[id] = { url, storageKey: asset.storage_key };
        } else {
          results[id] = { error: 'No storageKey or url available' };
        }
      } catch (err) {
        results[id] = { error: String(err) };
      }
    }

    return NextResponse.json({ results, expireTime });
  } catch (error) {
    console.error('[API] image-url batch error:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URLs' },
      { status: 500 }
    );
  }
}
