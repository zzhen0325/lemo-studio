/**
 * 图片代理接口 - 用于访问对象存储中的图片
 * GET /api/storage/image?key=<storage_key>
 * 
 * 返回重定向到预签名 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFileUrl } from '@/src/storage/object-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Missing "key" parameter' },
        { status: 400 }
      );
    }

    // 只处理 storage key 格式
    if (!key.startsWith('ljhwZthlaukjlkulzlp/')) {
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

    return new NextResponse(upstream.body, { headers });
  } catch (error) {
    console.error('Failed to get image from storage:', error);
    return NextResponse.json(
      { error: 'Failed to get image', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
