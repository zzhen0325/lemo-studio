import { describe, expect, it, vi } from 'vitest';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import GalleryPage from '@/app/studio/gallery/page';

describe('Gallery route redirect', () => {
  it('redirects the legacy standalone gallery route to playground', () => {
    GalleryPage();

    expect(redirectMock).toHaveBeenCalledWith('/studio/playground');
  });
});
