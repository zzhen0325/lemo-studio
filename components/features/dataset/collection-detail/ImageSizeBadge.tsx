'use client';

import { useEffect, useState } from 'react';

interface ImageSizeBadgeProps {
  src: string;
}

export function ImageSizeBadge({ src }: ImageSizeBadgeProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
  }, [src]);

  if (!size) {
    return null;
  }

  return (
    <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-md font-mono">
      {size.w}x{size.h}
    </span>
  );
}
