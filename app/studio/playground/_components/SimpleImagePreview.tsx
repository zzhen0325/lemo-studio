import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { formatImageUrl } from '@/lib/api-base';

interface SimpleImagePreviewProps {
    imageUrl: string | null;
    layoutId: string | null;
    onClose: () => void;
}

// 优先使用 useLayoutEffect 来避免布局抖动
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function SimpleImagePreview({
    imageUrl,
    layoutId,
    onClose
}: SimpleImagePreviewProps) {
    const [mounted, setMounted] = useState(false);
    // 用 ref 来存储当 imageUrl 变为有效值时的 layoutId，确保动画期间 layoutId 保持稳定
    const stableLayoutIdRef = useRef<string | null>(null);

    // 当 imageUrl 从 null 变为有效值时，捕获此时的 layoutId
    useIsomorphicLayoutEffect(() => {
        if (imageUrl && layoutId) {
            stableLayoutIdRef.current = layoutId;
        } else if (!imageUrl) {
            // 关闭时清除，准备下一次打开
            stableLayoutIdRef.current = null;
        }
    }, [imageUrl, layoutId]);

    useIsomorphicLayoutEffect(() => {
        setMounted(true);
    }, []);

    useIsomorphicLayoutEffect(() => {
        if (imageUrl) {
            // 记录原始 overflow
            const originalOverflow = document.body.style.overflow;
            // 记录原始 paddingRight 以防万一
            const originalPaddingRight = document.body.style.paddingRight;

            // 计算滚动条宽度以防抖动
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            document.body.style.overflow = 'hidden';
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }

            return () => {
                document.body.style.overflow = originalOverflow;
                document.body.style.paddingRight = originalPaddingRight;
            };
        }
    }, [imageUrl]);

    if (!mounted) return null;

    // 使用稳定的 layoutId：优先使用 ref 中存储的值，否则使用当前 prop
    const effectiveLayoutId = stableLayoutIdRef.current || layoutId;

    return createPortal(
        <AnimatePresence>
            {imageUrl && (
                <motion.div
                    key="preview-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-layer-lightbox flex items-center justify-center cursor-zoom-out"
                    onClick={onClose}
                >
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
                    />

                    <motion.div
                        layout
                        layoutId={effectiveLayoutId || undefined}
                        className="relative z-10 max-w-[95vw] max-h-[95vh] rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border border-white/10 origin-center"
                        onClick={(e) => e.stopPropagation()}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 35,
                            mass: 1
                        }}
                    >
                        <Image
                            src={formatImageUrl(imageUrl)}
                            alt="Preview"
                            width={1920}
                            height={1080}
                            className="w-auto h-auto max-w-full max-h-[95vh] object-contain"
                            unoptimized
                            priority
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
