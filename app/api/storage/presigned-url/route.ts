/**
 * 获取对象存储文件的预签名 URL
 * POST /api/storage/presigned-url
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFileUrl } from '@/src/storage/object-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "key" parameter' },
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

    const url = await getFileUrl(key, 3600); // 1 小时有效期

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
