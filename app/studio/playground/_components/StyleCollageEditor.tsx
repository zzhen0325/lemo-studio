'use client';

import React, { useState, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { StyleStack } from './types';
import { Button } from '@/components/ui/button';
import { X, Grid2X2, RefreshCw, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { formatImageUrl, getApiBase } from '@/lib/api-base';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/common/use-toast';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface StyleCollageEditorProps {
    style: StyleStack;
    onSave: (collageUrl: string, config: Record<string, unknown>) => Promise<void>;
    onClose: () => void;
}

const CANVAS_SIZE = 2048;

export const StyleCollageEditor: React.FC<StyleCollageEditorProps> = ({
    style,
    onSave,
    onClose
}) => {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const collageRef = useRef<HTMLDivElement>(null);

    const [orderedPaths, setOrderedPaths] = useState<string[]>(() => {
        const paths = style.imagePaths.slice(0, 6);
        while (paths.length < 6 && style.imagePaths.length > 0) paths.push(style.imagePaths[0]);
        return paths;
    });

    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    const swapPaths = useCallback((indexA: number, indexB: number) => {
        setOrderedPaths(prev => {
            const next = [...prev];
            [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
            return next;
        });
    }, []);

    const handleSave = async () => {
        if (!collageRef.current) return;
        setIsSaving(true);

        // 确保 React 完成由于 isSaving 状态变化引起的重新渲染（如果有）
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_SIZE;
            canvas.height = CANVAS_SIZE;
            canvas.style.width = `${CANVAS_SIZE / 2}px`;
            canvas.style.height = `${CANVAS_SIZE / 2}px`;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('CTX_FAIL');

            // 1. 深灰底色
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            const containerRect = collageRef.current.getBoundingClientRect();
            if (containerRect.width === 0) throw new Error('Visibility Error');
            const scale = CANVAS_SIZE / containerRect.width;

            // 关键修复：在任何 await 之前，立即捕获所有 Slot 的 DOM 位置和路径数据
            // 避免在异步循环内访问可能失效或重排的 DOM 节点
            const slotNodes = Array.from(collageRef.current.querySelectorAll('[data-slot-index]'));
            const tasks = slotNodes.map(slot => {
                const index = parseInt(slot.getAttribute('data-slot-index') || '-1');
                const path = orderedPaths[index];
                const rect = slot.getBoundingClientRect();
                return { index, path, rect };
            }).filter(t => t.index !== -1 && t.path && t.rect.width > 0.5 && t.rect.height > 0.5);

            let drawnCount = 0;

            for (const task of tasks) {
                const { index, path, rect } = task;
                const dw = rect.width * scale;
                const dh = rect.height * scale;
                const dx = (rect.left - containerRect.left) * scale;
                const dy = (rect.top - containerRect.top) * scale;

                const rawUrl = formatImageUrl(path);
                const isLocalOrData = rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('local:');

                try {
                    const img = new Image();
                    img.crossOrigin = "anonymous";

                    const loadPromise = new Promise((resolve) => {
                        const onDone = () => {
                            img.onload = null;
                            img.onerror = null;
                            resolve(true);
                        };

                        img.onload = onDone;
                        img.onerror = () => {
                            // 针对远程图，如果 CORS 失败则尝试非 anonymous 模式（可能会导致 Canvas 污染，但能画出来）
                            if (!isLocalOrData && img.crossOrigin) {
                                img.crossOrigin = null;
                                img.src = rawUrl;
                                // 重新绑定事件
                                img.onload = onDone;
                                img.onerror = onDone;
                            } else {
                                onDone();
                            }
                        };

                        // 超时容错
                        setTimeout(onDone, 8000);
                    });

                    // 启动加载
                    if (isLocalOrData) {
                        img.src = rawUrl;
                    } else {
                        // 避免对带参数的 URL 错误拼接，且加上时间戳防止缓存导致的 CORS 冲突
                        const separator = rawUrl.includes('?') ? '&' : '?';
                        img.src = `${rawUrl}${separator}ts=${Date.now()}_${index}`;
                    }

                    await loadPromise;

                    if (img.complete && img.naturalWidth > 0) {
                        const iW = img.naturalWidth;
                        const iH = img.naturalHeight;
                        const sRatio = dw / dh;
                        const iRatio = iW / iH;

                        let sx, sy, sw, sh;
                        if (iRatio > sRatio) {
                            sh = iH; sw = sh * sRatio; sx = (iW - sw) / 2; sy = 0;
                        } else {
                            sw = iW; sh = sw / sRatio; sx = 0; sy = (iH - sh) / 2;
                        }

                        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
                        drawnCount++;
                    }
                } catch (e) {
                    console.error(`Draw failed for slot ${index}`, e);
                }
            }

            if (drawnCount === 0) throw new Error('No images rendered');

            const blob = await new Promise<Blob | null>(resolve => {
                try {
                    canvas.toBlob(resolve, 'image/jpeg', 0.95);
                } catch (e) {
                    console.error('Canvas toBlob failed', e);
                    resolve(null);
                }
            });

            if (!blob) throw new Error('Tainted Canvas or Export Fail');

            const formData = new FormData();
            formData.append('file', blob, `collage-${style.id}.jpg`);

            const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: formData });
            if (!resp.ok) throw new Error(`Upload failed: ${resp.statusText}`);
            const data = await resp.json();

            await onSave(data.path, { drawnCount, collageSize: CANVAS_SIZE });
            toast({
                title: "合成成功",
                description: <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{`已合并 ${drawnCount} 个图层`}</div>
            });
            onClose();

        } catch (error) {
            console.error('Collage Error:', error);
            toast({ title: "合成中断", description: String(error), variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const CollageSlot = ({ index }: { index: number }) => {
        const path = orderedPaths[index];
        return (
            <div className="relative w-full h-full group bg-neutral-900 border-[0.5px] border-white/5 overflow-hidden" data-slot-index={index}>
                <motion.div
                    drag
                    dragSnapToOrigin
                    dragElastic={0.05}
                    onDragStart={() => setDraggingIndex(index)}
                    onDragEnd={(e, info) => {
                        setDraggingIndex(null);
                        const element = document.elementFromPoint(info.point.x, info.point.y);
                        const slot = element?.closest('[data-slot-index]');
                        if (slot) {
                            const targetIndex = parseInt(slot.getAttribute('data-slot-index') || '-1');
                            if (targetIndex !== -1 && targetIndex !== index) swapPaths(index, targetIndex);
                        }
                    }}
                    whileDrag={{ scale: 0.9, zIndex: 100, opacity: 0.8 }}
                    className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                    <NextImage
                        src={formatImageUrl(path)}
                        alt=""
                        fill
                        className="object-cover pointer-events-none"
                        draggable={false}
                        unoptimized
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowLeftRight className="text-white drop-shadow-md opacity-80" size={28} />
                    </div>
                </motion.div>
                <AnimatePresence>
                    {draggingIndex !== null && draggingIndex !== index && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-primary/20 pointer-events-none z-10 border-2 border-primary"
                        />
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-layer-lightbox flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full flex flex-col max-w-[1240px] max-h-[850px] border border-white/10 rounded-2xl bg-[#0a0a0a] overflow-hidden shadow-2xl"
            >
                <div className="px-8 py-5 flex items-center justify-between border-b border-white/5 bg-[#111]">
                    <div className="flex items-center gap-4">
                        <Grid2X2 className="text-white/80 w-5 h-5" />
                        <div>
                            <h2 className="text-lg font-bold text-white/90">拼图编辑器</h2>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full text-white/40 hover:text-white" onClick={onClose}><X size={20} /></Button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex items-center justify-center p-8 bg-[#050505]">
                        <div ref={collageRef} className="relative w-full aspect-square max-w-[600px] shadow-lg ring-1 ring-white/10">
                            {/* 核心修复点：给所有 Panel 和 Group 显式加上 h-full w-full，确保嵌套高度不塌陷 */}
                            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                                <ResizablePanel defaultSize={50} minSize={20} className="h-full w-full"><CollageSlot index={0} /></ResizablePanel>
                                <ResizableHandle className="bg-white/10 hover:bg-primary/50 transition-all w-px z-50 cursor-col-resize" />
                                <ResizablePanel defaultSize={50} className="h-full w-full">
                                    <ResizablePanelGroup direction="vertical" className="h-full w-full">
                                        {/* 之前漏掉的 h-full w-full */}
                                        <ResizablePanel defaultSize={50} className="h-full w-full">
                                            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                                                <ResizablePanel className="h-full w-full"><CollageSlot index={1} /></ResizablePanel>
                                                <ResizableHandle className="bg-white/10 hover:bg-primary/50 transition-all w-px z-50 cursor-col-resize" />
                                                <ResizablePanel className="h-full w-full"><CollageSlot index={2} /></ResizablePanel>
                                            </ResizablePanelGroup>
                                        </ResizablePanel>
                                        <ResizableHandle className="bg-white/10 hover:bg-primary/50 transition-all h-px w-full z-50 cursor-row-resize" />
                                        {/* 之前漏掉的 h-full w-full */}
                                        <ResizablePanel defaultSize={50} className="h-full w-full">
                                            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                                                <ResizablePanel className="h-full w-full"><CollageSlot index={3} /></ResizablePanel>
                                                <ResizableHandle className="bg-white/10 hover:bg-primary/50 transition-all w-px z-50 cursor-col-resize" />
                                                <ResizablePanel className="h-full w-full">
                                                    <ResizablePanelGroup direction="vertical" className="h-full w-full">
                                                        <ResizablePanel className="h-full w-full"><CollageSlot index={4} /></ResizablePanel>
                                                        <ResizableHandle className="bg-white/10 hover:bg-primary/50 transition-all h-px w-full z-50 cursor-row-resize" />
                                                        <ResizablePanel className="h-full w-full"><CollageSlot index={5} /></ResizablePanel>
                                                    </ResizablePanelGroup>
                                                </ResizablePanel>
                                            </ResizablePanelGroup>
                                        </ResizablePanel>
                                    </ResizablePanelGroup>
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </div>
                    </div>

                    <div className="w-[300px] border-l border-white/5 p-6 flex flex-col bg-[#0a0a0a]">
                        <div className="flex-1 space-y-4">
                            <h3 className="text-xs font-bold text-white/30 uppercase">使用说明</h3>
                            <p className="text-xs text-white/50 leading-relaxed">
                                长按图片并拖动以交换位置。
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button
                                className="w-full h-12 rounded-xl bg-white text-black hover:bg-white/90 font-bold"
                                onClick={handleSave} disabled={isSaving}
                            >
                                {isSaving ? <RefreshCw className="animate-spin mr-2 w-4 h-4" /> : null}
                                {isSaving ? "处理中..." : "保存高清拼图"}
                            </Button>
                            <Button variant="ghost" className="w-full h-12 rounded-xl text-white/30 hover:text-white" onClick={onClose}>取消</Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
