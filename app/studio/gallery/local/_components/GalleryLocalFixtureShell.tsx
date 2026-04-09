"use client";

import dynamic from 'next/dynamic';
import type { GalleryItemViewModel } from '@/lib/gallery/types';

const GalleryLocalFixtureClient = dynamic(() => import('./GalleryLocalFixtureClient'), {
  ssr: false,
});

export default function GalleryLocalFixtureShell({
  items,
}: {
  items: GalleryItemViewModel[];
}) {
  return <GalleryLocalFixtureClient items={items} />;
}
