import { RefObject, useLayoutEffect, useState } from 'react';

function readElementWidth(element: HTMLElement | null) {
  if (!element) return 0;
  return Math.max(0, Math.floor(element.getBoundingClientRect().width));
}

export function getGalleryColumnsCount(containerWidth: number) {
  if (containerWidth >= 1536) return 8;
  if (containerWidth >= 1280) return 7;
  if (containerWidth >= 1024) return 6;
  if (containerWidth >= 768) return 5;
  if (containerWidth >= 640) return 3;
  return 1;
}

export function useGalleryContainerWidth(containerRef: RefObject<HTMLElement>) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setWidth((currentWidth) => {
        const nextWidth = readElementWidth(element);
        return currentWidth === nextWidth ? currentWidth : nextWidth;
      });
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [containerRef]);

  return {
    width,
    columnsCount: getGalleryColumnsCount(width),
  };
}
