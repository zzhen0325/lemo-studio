'use client';

import React, { useState } from 'react';
import NextImage from 'next/image';
import { motion } from 'framer-motion';
import { Sparkles, PanelsTopLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type PlaygroundShortcut } from '@/config/playground-shortcuts';

interface ShortcutStackCardProps {
  shortcut: PlaygroundShortcut;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
  onViewDetail: (shortcut: PlaygroundShortcut) => void;
  size?: 'sm' | 'md' | 'responsive';
}

export function ShortcutStackCard({
  shortcut,
  onQuickApply,
  onViewDetail,
  size = 'responsive',
}: ShortcutStackCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayImages = shortcut.imagePaths.slice(-3).reverse();

  // 响应式尺寸：使用 clamp() 实现平滑缩放
  // 卡片图片高度：最小 100px，最大 200px，基准为 14vw
  // 图片宽度：最小 80px，最大 160px，基准为 11vw
  const isResponsive = size === 'responsive';
  const isSmall = size === 'sm';

  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-2 rounded-[2rem] p-2 transition-all sm:gap-3 sm:p-3 md:gap-4 md:p-4"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={() => onViewDetail(shortcut)}
    >
      {/* 悬浮操作按钮 */}
      <div className="absolute -top-10 left-1/2 z-[30] flex -translate-x-1/2 gap-1.5 opacity-0 transition-all duration-300 group-hover:-translate-y-2 group-hover:opacity-100 sm:gap-2 sm:-top-12">
        <Button
          size="sm"
          className="h-7 rounded-full border border-[#E8FFB7]/30 bg-[#0D0F11]/92 px-2.5 text-xs text-white shadow-2xl transition-all hover:bg-[#15181C] hover:border-[#E8FFB7]/50 sm:h-9 sm:px-4 sm:text-sm"
          onClick={(event) => {
            event.stopPropagation();
            onQuickApply(shortcut);
          }}
        >
          <Sparkles size={12} className="mr-1 text-[#E8FFB7] sm:size-3.5" />
          快速生成
        </Button>
        <Button
          size="sm"
          className="h-7 rounded-full border border-white/10 bg-neutral-900/90 px-2.5 text-xs text-white shadow-2xl transition-all hover:border-white/20 hover:bg-neutral-800 sm:h-9 sm:px-4 sm:text-sm"
          onClick={(event) => {
            event.stopPropagation();
            onViewDetail(shortcut);
          }}
        >
          <PanelsTopLeft size={12} className="mr-1 text-white/70 sm:size-3.5" />
          查看详情
        </Button>
      </div>

      {/* 图片堆叠区域 - 自适应高度 */}
      <div
        className={cn(
          'relative flex w-full items-center justify-center perspective-1000',
          // 响应式高度：使用 clamp 实现平滑缩放
          isResponsive
            ? 'h-[clamp(100px,14vw,200px)]'
            : isSmall
              ? 'h-[140px] min-w-[140px]'
              : 'h-[200px]'
        )}
      >
        {displayImages.map((imagePath, index) => (
          <motion.div
            key={`${shortcut.id}-${imagePath}-${index}`}
            className={cn(
              'absolute overflow-hidden rounded-xl border border-white/20 bg-neutral-900 shadow-xl sm:rounded-2xl',
              // 响应式尺寸
              isResponsive
                ? 'h-[clamp(100px,14vw,200px)] w-[clamp(80px,11vw,160px)]'
                : isSmall
                  ? 'h-[140px] w-28'
                  : 'h-[200px] w-40'
            )}
            initial={false}
            animate={{
              // 响应式位移：基于视口宽度的百分比
              x: isExpanded
                ? (index - (displayImages.length - 1) / 2) * (isResponsive ? 12 : isSmall ? 100 : 160)
                : (index - (displayImages.length - 1) / 2) * (isResponsive ? 4 : isSmall ? 30 : 50),
              y: isExpanded
                ? (isResponsive ? -2 : isSmall ? -10 : -20)
                : index * -4,
              rotate: isExpanded
                ? (index - (displayImages.length - 1) / 2) * 10
                : (index - (displayImages.length - 1) / 2) * 5,
              zIndex: 10 - index,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
              mass: 1.2,
            }}
          >
            <NextImage
              src={imagePath}
              alt={`${shortcut.name} cover ${index + 1}`}
              fill
              sizes={isResponsive ? 'clamp(160px, 22vw, 320px)' : isSmall ? '160px' : '220px'}
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          </motion.div>
        ))}
      </div>

      {/* 文字信息区域 */}
      <div className="flex flex-col gap-0.5 sm:gap-1">
        <div className="flex flex-col items-center justify-center">
          <h3
            className={cn(
              'w-full truncate text-center font-semibold text-white transition-all duration-300',
              isResponsive
                ? 'text-[clamp(12px,1.5vw,18px)]'
                : isSmall
                  ? 'text-base'
                  : 'text-lg'
            )}
          >
            {shortcut.name}
          </h3>
          <p
            className={cn(
              'mt-0.5 w-full text-center text-white/48 transition-all duration-300 sm:mt-1',
              isResponsive
                ? 'line-clamp-2 text-[clamp(9px,1vw,14px)] min-h-[1.5rem] sm:min-h-[2rem]'
                : isSmall
                  ? 'line-clamp-2 text-[10px] min-h-[1.5rem]'
                  : 'min-h-[2.5rem] text-sm'
            )}
          >
            {shortcut.description}
          </p>
          <span
            className={cn(
              'mt-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/55 sm:mt-2 sm:px-3 sm:py-1',
              isResponsive
                ? 'text-[clamp(9px,0.9vw,11px)]'
                : 'text-[11px]'
            )}
          >
            {shortcut.modelLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
