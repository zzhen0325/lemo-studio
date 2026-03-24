/**
 * 图片代理接口 - 用于访问对象存储中的图片
 * GET /api/storage/image?key=<storage_key>
 * 
 * 返回重定向到预签名 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFileUrl } from '@/src/storage/object-storage';

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

    // 重定向到预签名 URL
    return NextResponse.redirect(presignedUrl);
  } catch (error) {
    console.error('Failed to get image from storage:', error);
    return NextResponse.json(
      { error: 'Failed to get image', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
