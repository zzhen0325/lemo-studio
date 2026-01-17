import React from 'react';
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { formatImageUrl } from '@/lib/api-base';

interface SimpleImagePreviewProps {
    imageUrl: string | null;
    layoutId: string | null;
    onClose: () => void;
}

export default function SimpleImagePreview({
    imageUrl,
    layoutId,
    onClose
}: SimpleImagePreviewProps) {
    return (
        <AnimatePresence>
            {imageUrl && (
                <motion.div
                    initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                    animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
                    exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 cursor-zoom-out"
                    onClick={onClose}
                >
                    <motion.div
                        layoutId={layoutId || undefined}
                        className="relative max-w-[90vw] max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            src={formatImageUrl(imageUrl)}
                            alt="Preview"
                            width={1600}
                            height={1600}
                            className="w-auto h-auto max-w-full max-h-[90vh] rounded-xl shadow-2xl"
                            unoptimized
                        />

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
