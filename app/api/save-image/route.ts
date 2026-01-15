import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { uploadToCDN } from '@/lib/server/cdn-upload';
import { insertImage } from '@/lib/db';

const BodySchema = z.object({
  imageBase64: z.string().min(1),
  ext: z.enum(['png', 'jpg', 'jpeg', 'webp', 'gif']).optional().default('png'),
  subdir: z.enum(['outputs', 'upload']).optional().default('outputs'),
  metadata: z.record(z.any()).optional(),
});

function extractBase64(data: string): { base64: string; mime?: string } {
  const match = data.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return { base64: match[2], mime: match[1] };
  }
  return { base64: data };
}

function isUseLocalStorage() {
  return process.env.USE_LOCAL_STORAGE === 'true';
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { imageBase64, subdir, metadata } = parsed.data;
    let { ext } = parsed.data;

    let imageBuffer: Buffer;
    if (imageBase64.startsWith('http')) {
      // Download remote image
      const imgResp = await fetch(imageBase64);
      if (!imgResp.ok) throw new Error(`Failed to download image from ${imageBase64}`);
      const contentType = imgResp.headers.get('content-type');
      if (contentType) {
        if (contentType.includes('jpeg')) ext = 'jpg';
        else if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';
      }
      const arrayBuffer = await imgResp.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      const { base64, mime } = extractBase64(imageBase64);
      if (mime) {
        if (mime.includes('jpeg')) ext = 'jpg';
        else if (mime.includes('png')) ext = 'png';
        else if (mime.includes('webp')) ext = 'webp';
      }
      imageBuffer = Buffer.from(base64, 'base64');
    }

    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `img_${stamp}_${rand}.${ext}`;

    if (isUseLocalStorage()) {
      // 原有本地写入逻辑，作为兼容回退路径
      const publicDir = path.join(process.cwd(), 'public');
      const targetDir = path.join(publicDir, subdir);
      await fs.mkdir(targetDir, { recursive: true });

      const filePath = path.join(targetDir, filename);
      await fs.writeFile(filePath, imageBuffer);

      if (metadata) {
        const metadataPath = path.join(targetDir, `${filename.split('.')[0]}.json`);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }

      const pathForClient = `/${subdir}/${filename}`;
      return NextResponse.json({ path: pathForClient, url: pathForClient });
    }

    // 新路径：上传到 CDN
    const cdnUrl = await uploadToCDN(imageBuffer, filename);

    // 如果带有 metadata，则写入 images 表，方便后续检索
    if (metadata) {
      const createdAt = (metadata as { createdAt?: string | Date }).createdAt;
      const projectId = (metadata as { projectId?: string }).projectId;

      try {
        await insertImage({
          id: filename.split('.')[0],
          url: cdnUrl,
          sourceType: subdir,
          projectId: projectId ?? null,
          createdAt: createdAt ?? undefined,
          metadata,
        });
      } catch (err) {
        // 数据库失败不应影响上传结果，打印日志即可
        console.error('Failed to insert image metadata into database:', err);
      }
    }

    return NextResponse.json({ url: cdnUrl, path: cdnUrl });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save image', details: String(error) }, { status: 500 });
  }
}
