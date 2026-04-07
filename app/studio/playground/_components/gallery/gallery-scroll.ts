const GALLERY_SCROLL_OVERFLOW_MARGIN = 32;
const GALLERY_AUTO_FILL_MIN_GAP = 120;
const GALLERY_LOAD_MORE_MIN_THRESHOLD = 240;
const GALLERY_LOAD_MORE_MAX_THRESHOLD = 480;

export function hasGalleryOverflow(scrollHeight: number, clientHeight: number) {
  return scrollHeight > clientHeight + GALLERY_SCROLL_OVERFLOW_MARGIN;
}

export function shouldAutoFillGallery(scrollHeight: number, clientHeight: number) {
  if (clientHeight <= 0) {
    return false;
  }

  return scrollHeight <= clientHeight + Math.max(GALLERY_AUTO_FILL_MIN_GAP, Math.round(clientHeight * 0.1));
}

export function getGalleryLoadMoreThreshold(clientHeight: number) {
  return Math.min(
    Math.max(Math.round(clientHeight * 0.35), GALLERY_LOAD_MORE_MIN_THRESHOLD),
    GALLERY_LOAD_MORE_MAX_THRESHOLD,
  );
}

export function shouldLoadMoreGallery({
  scrollHeight,
  scrollTop,
  clientHeight,
  hasUserScrolled,
}: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  hasUserScrolled: boolean;
}) {
  if (clientHeight <= 0) {
    return false;
  }

  if (shouldAutoFillGallery(scrollHeight, clientHeight)) {
    return true;
  }

  if (!hasUserScrolled) {
    return false;
  }

  const remaining = scrollHeight - scrollTop - clientHeight;
  return remaining <= getGalleryLoadMoreThreshold(clientHeight);
}

export function shouldShowGalleryEndIndicator({
  hasMoreGallery,
  itemsLength,
  hasOverflowingContent,
  hasUserScrolled,
}: {
  hasMoreGallery: boolean;
  itemsLength: number;
  hasOverflowingContent: boolean;
  hasUserScrolled: boolean;
}) {
  return !hasMoreGallery && itemsLength > 0 && (hasOverflowingContent || hasUserScrolled);
}
