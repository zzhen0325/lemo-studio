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
    <span className="text-[9px] text-muted-foreground/40 bg-muted/30 px-1 py-px rounded border border-white/5 font-mono">
      {size.w}x{size.h}
    </span>
  );
}
