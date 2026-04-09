import { resolveGalleryItems } from '@/lib/gallery/resolve-gallery-item';
import { loadTestGalleryFixtureGenerations } from '@/lib/server/test-gallery-fixtures';
import GalleryLocalFixtureClient from './_components/GalleryLocalFixtureClient';

export const dynamic = 'force-dynamic';

export default async function LocalGalleryFixturePage() {
  const generations = await loadTestGalleryFixtureGenerations();
  const items = resolveGalleryItems(generations).filter((item) => item.isImageVisible);

  return <GalleryLocalFixtureClient items={items} />;
}
