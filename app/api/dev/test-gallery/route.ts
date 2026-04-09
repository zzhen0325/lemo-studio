import { NextResponse } from 'next/server';
import { readTestGalleryFixtureFile } from '@/lib/server/test-gallery-fixtures';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('file');

  if (!fileName) {
    return NextResponse.json({ error: 'Missing fixture file name' }, { status: 400 });
  }

  try {
    const fixture = await readTestGalleryFixtureFile(fileName);

    return new NextResponse(fixture.buffer, {
      headers: {
        'Content-Type': fixture.contentType,
        // Local fixture file names are content-stable, so cache them aggressively to
        // avoid remount-driven refetch flicker while validating masonry behavior.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fixture.fileName)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  }
}
