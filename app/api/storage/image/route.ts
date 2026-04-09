/**
 * 图片代理接口 - 用于访问对象存储中的图片
 * GET /api/storage/image?key=<storage_key>
 * 
 * 返回重定向到预签名 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getFileUrl } from '@/src/storage/object-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORAGE_KEY_PREFIX = 'ljhwZthlaukjlkulzlp/';
const MAX_PREVIEW_WIDTH = 1024;
const DEFAULT_PREVIEW_QUALITY = 72;

function parsePreviewWidth(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const width = Number(value);
  if (!Number.isFinite(width)) {
    return null;
  }

  return Math.min(Math.max(Math.round(width), 64), MAX_PREVIEW_WIDTH);
}

function parsePreviewQuality(value: string | null): number {
  if (!value) {
    return DEFAULT_PREVIEW_QUALITY;
  }

  const quality = Number(value);
  if (!Number.isFinite(quality)) {
    return DEFAULT_PREVIEW_QUALITY;
  }

  return Math.min(Math.max(Math.round(quality), 30), 90);
}

function resolvePreviewFormat(value: string | null): 'webp' | 'jpeg' | 'png' {
  if (value === 'jpeg' || value === 'png') {
    return value;
  }

  return 'webp';
}

function canResizeImage(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  return /^image\/(avif|heic|jpeg|jpg|png|tiff|webp)$/i.test(contentType);
}

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key');
    const previewWidth = parsePreviewWidth(request.nextUrl.searchParams.get('w'));
    const previewQuality = parsePreviewQuality(request.nextUrl.searchParams.get('q'));
    const previewFormat = resolvePreviewFormat(request.nextUrl.searchParams.get('format'));

    if (!key) {
      return NextResponse.json(
        { error: 'Missing "key" parameter' },
        { status: 400 }
      );
    }

    // 只处理 storage key 格式
    if (!key.startsWith(STORAGE_KEY_PREFIX)) {
      return NextResponse.json(
        { error: 'Invalid storage key format' },
        { status: 400 }
      );
    }

    // 生成预签名 URL（有效期 1 小时）
    const presignedUrl = await getFileUrl(key, 3600);

    const upstream = await fetch(presignedUrl, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Failed to fetch image from storage', status: upstream.status },
        { status: 502 }
      );
    }

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');

    if (!previewWidth || !canResizeImage(contentType)) {
      return new NextResponse(upstream.body, { headers });
    }

    const originalBuffer = Buffer.from(await upstream.arrayBuffer());

    try {
      const previewBuffer = await sharp(originalBuffer, { limitInputPixels: false })
        .rotate()
        .resize({
          width: previewWidth,
          withoutEnlargement: true,
          fit: 'inside',
        })
        [previewFormat](previewFormat === 'png'
          ? { quality: previewQuality, compressionLevel: 9 }
          : previewFormat === 'jpeg'
            ? { quality: previewQuality, mozjpeg: true }
            : { quality: previewQuality, effort: 4 })
        .toBuffer();

      headers.set(
        'Content-Type',
        previewFormat === 'png'
          ? 'image/png'
          : previewFormat === 'jpeg'
            ? 'image/jpeg'
            : 'image/webp',
      );
      headers.set('Content-Length', String(previewBuffer.byteLength));

      return new NextResponse(new Uint8Array(previewBuffer), { headers });
    } catch (error) {
      console.warn('Failed to generate preview image, falling back to original asset:', error);
      headers.set('Content-Length', String(originalBuffer.byteLength));
      return new NextResponse(new Uint8Array(originalBuffer), { headers });
    }
  } catch (error) {
    console.error('Failed to get image from storage:', error);
    return NextResponse.json(
      { error: 'Failed to get image', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
