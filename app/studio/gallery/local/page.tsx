import { resolveGalleryItems } from '@/lib/gallery/resolve-gallery-item';
import { loadTestGalleryFixtureGenerations } from '@/lib/server/test-gallery-fixtures';
import GalleryLocalFixtureShell from './_components/GalleryLocalFixtureShell';

export const dynamic = 'force-dynamic';

export default async function LocalGalleryFixturePage() {
  const generations = await loadTestGalleryFixtureGenerations();
  const items = resolveGalleryItems(generations).filter((item) => item.isImageVisible);

  return <GalleryLocalFixtureShell items={items} />;
}
