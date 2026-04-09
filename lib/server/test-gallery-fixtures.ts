import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import type { Generation } from '@/types/database';

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DEFAULT_IMAGE_SIZE = {
  width: 1024,
  height: 1024,
};

export const TEST_GALLERY_DIR = path.join(process.cwd(), 'test gallery');

function isSupportedImageFile(fileName: string) {
  return SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function sanitizeFixtureFileName(fileName: string) {
  const normalized = fileName.trim();
  if (!normalized || path.basename(normalized) !== normalized) {
    throw new Error('Invalid test gallery fixture file name');
  }
  return normalized;
}

function getContentType(fileName: string) {
  switch (path.extname(fileName).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function parsePngDimensions(buffer: Buffer) {
  if (buffer.length < 24) {
    return null;
  }

  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerOffset = offset + 1;
    while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) {
      markerOffset += 1;
    }

    if (markerOffset >= buffer.length) {
      return null;
    }

    const marker = buffer[markerOffset];
    offset = markerOffset + 1;

    if (
      marker === 0xd8
      || marker === 0xd9
      || marker === 0x01
      || (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (offset + 1 >= buffer.length) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

function getImageDimensions(buffer: Buffer, fileName: string) {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === '.png') {
    return parsePngDimensions(buffer);
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    return parseJpegDimensions(buffer);
  }

  if (ext === '.webp') {
    return parseWebpDimensions(buffer);
  }

  return null;
}

function createFixtureId(fileName: string, index: number) {
  const normalized = fileName
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `test-gallery-${index + 1}-${normalized || `item-${index + 1}`}`;
}

export async function listTestGalleryFixtureFileNames(limit = 48) {
  const entries = await fs.readdir(TEST_GALLERY_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && isSupportedImageFile(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'))
    .slice(0, limit);
}

export async function loadTestGalleryFixtureGenerations(limit = 48): Promise<Generation[]> {
  const fileNames = await listTestGalleryFixtureFileNames(limit);

  return Promise.all(fileNames.map(async (fileName, index) => {
    const safeFileName = sanitizeFixtureFileName(fileName);
    const filePath = path.join(TEST_GALLERY_DIR, safeFileName);
    const buffer = await fs.readFile(filePath);
    const dimensions = getImageDimensions(buffer, safeFileName) ?? DEFAULT_IMAGE_SIZE;

    return {
      id: createFixtureId(safeFileName, index),
      userId: 'local-gallery-fixture',
      projectId: 'local-gallery-fixture',
      outputUrl: `/api/dev/test-gallery?file=${encodeURIComponent(safeFileName)}`,
      status: 'completed',
      createdAt: new Date(Date.now() - index * 60_000).toISOString(),
      config: {
        prompt: safeFileName,
        width: dimensions.width,
        height: dimensions.height,
        model: 'local_gallery_fixture',
      },
    };
  }));
}

export async function readTestGalleryFixtureFile(fileName: string) {
  const safeFileName = sanitizeFixtureFileName(fileName);
  const filePath = path.join(TEST_GALLERY_DIR, safeFileName);
  const stat = await fs.stat(filePath);

  if (!stat.isFile() || !isSupportedImageFile(safeFileName)) {
    throw new Error('Unsupported test gallery fixture file');
  }

  const buffer = await fs.readFile(filePath);

  return {
    buffer,
    fileName: safeFileName,
    contentType: getContentType(safeFileName),
  };
}
