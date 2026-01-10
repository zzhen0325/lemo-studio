import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as fabric from 'fabric';
import {
    Undo2,
    Redo2,
    Type,
    Move,
    Pencil,
    Square,
    Circle as CircleIcon,
    ArrowRight,
    RotateCcw,
    RotateCw,
    Check,
    Palette,
    Layers,
    SlidersHorizontal,
    X,
    LucideIcon,
    Trash2,
    ImagePlus,
    MessageSquarePlus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useImageEditor } from '@/hooks/features/PlaygroundV2/useImageEditor';
import { cn } from '@/lib/utils';

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string) => void;
}

const COLORS = [
    '#40cf8f', // Theme Emerald / Primary
    '#ffffff',
    '#000000',
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316'  // Orange
];

export default function ImageEditorModal({ isOpen, onClose, imageUrl, onSave }: ImageEditorModalProps) {
    const [showProperties, setShowProperties] = useState(true);

    const {
        canvasRef,
        editorState,
        setTool,
        addText,
        undo,
        redo,
        rotateCanvas,
        applyFilter,
        exportImage,
        updateBrushColor,
        updateBrushWidth,
        deleteSelected,
        addImage,
        confirmAnnotation,
        cancelAnnotation,
        fabricCanvasRef,
    } = useImageEditor(imageUrl);

    const [annotationText, setAnnotationText] = useState("");
    const annotInputRef = useRef<HTMLInputElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // 处理文件上传
    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (dataUrl) {
                    addImage(dataUrl);
                }
            };
            reader.readAsDataURL(file);
        });
    }, [addImage]);

    // 拖放事件处理
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    }, [handleFileUpload]);

    // 键盘快捷键支持
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Delete 或 Backspace 删除选中对象
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // 避免在输入框中误触发
                if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                    return;
                }
                e.preventDefault();
                deleteSelected();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, deleteSelected]);

    const handleSave = () => {
        const dataUrl = exportImage();
        if (dataUrl) {
            const canvas = fabricCanvasRef.current;
            let finalPrompt = "";

            if (canvas) {
                const objects = canvas.getObjects();
                const hasAnnotations = objects.some((obj) =>
                    (obj.type === 'rect' && (obj as fabric.Rect).stroke === '#ef4444' && (obj as fabric.Rect).strokeDashArray) ||
                    (obj.type === 'i-text' && (obj as fabric.IText).fill === '#ef4444')
                );

                if (hasAnnotations) {
                    const labels = objects
                        .filter((obj) => obj.type === 'i-text' && (obj as fabric.IText).fill === '#ef4444')
                        .map((obj) => (obj as fabric.IText).text)
                        .join(", ");

                    finalPrompt = "根据图中标注修改图片，并移除标注";
                    if (labels) {
                        finalPrompt += `。标注内容：${labels}`;
                    }
                }
            }

            onSave(dataUrl, finalPrompt || undefined);
        }
    };

    // Auto-focus input when it appears
    useEffect(() => {
        if (editorState.pendingAnnotation && annotInputRef.current) {
            annotInputRef.current.focus();
            setAnnotationText("");
        }
    }, [editorState.pendingAnnotation]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[100] flex flex-col overflow-hidden pointer-events-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-[#0F0F15] " />

                {/* Content */}
                <div className="relative flex flex-col h-full z-10">
                    {/* Header */}
                    <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 bg-black/60 backdrop-blur-2xl shrink-0">
                        <div className="flex items-center gap-4">
                            <h2
                                className="text-lg text-white"
                                style={{ fontFamily: "'InstrumentSerif', serif" }}
                            >
                                Image Editor
                            </h2>
                            <div className="flex items-center gap-1 ml-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                                    onClick={undo}
                                    disabled={!editorState.canUndo}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <Undo2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                                    onClick={redo}
                                    disabled={!editorState.canRedo}
                                    title="Redo (Ctrl+Y)"
                                >
                                    <Redo2 className="w-4 h-4" />
                                </Button>
                                <div className="w-px h-4 bg-white/10 mx-2" />
                                <span className="text-[11px] text-white/40 font-mono min-w-[3rem]">
                                    {Math.round(editorState.zoom * 100)}%
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                                onClick={onClose}
                            >
                                <X className="w-4 h-4 mr-1.5" />
                                Cancel
                            </Button>
                            <Button
                                variant="act"
                                size="sm"
                                className="h-8 px-4 rounded-full gap-1.5 font-medium"
                                onClick={handleSave}
                            >
                                <Check className="w-3.5 h-3.5" />
                                Apply
                            </Button>
                            <button
                                onClick={() => setShowProperties(!showProperties)}
                                className="lg:hidden p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="relative flex-1 flex overflow-hidden">
                        {/* Left Toolbar */}
                        <div className="w-16 border-r border-white/10 flex flex-col items-center py-4 gap-2 bg-black/40 shrink-0">
                            <ToolButton
                                icon={Move}
                                active={editorState.activeTool === 'select'}
                                onClick={() => setTool('select')}
                                label="Select"
                            />
                            <ToolButton
                                icon={Pencil}
                                active={editorState.activeTool === 'brush'}
                                onClick={() => setTool('brush')}
                                label="Brush"
                            />
                            <ToolButton
                                icon={MessageSquarePlus}
                                active={editorState.activeTool === 'annotate'}
                                onClick={() => setTool('annotate')}
                                label="Label"
                            />
                            <ToolButton
                                icon={Type}
                                active={editorState.activeTool === 'text'}
                                onClick={() => addText()}
                                label="Text"
                            />

                            <div className="w-8 h-px bg-white/10 my-1" />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className={cn(
                                        "p-2 rounded-full transition-colors",
                                        ['rect', 'circle', 'arrow'].includes(editorState.activeTool)
                                            ? "text-primary bg-primary/10"
                                            : "text-white/50 hover:text-white hover:bg-white/10"
                                    )}>
                                        <Square className="w-5 h-5" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    side="right"
                                    className="bg-black/90 backdrop-blur-xl border-white/10 text-white p-2 min-w-[120px] rounded-xl z-[110]"
                                >
                                    <DropdownMenuItem onClick={() => setTool('rect')} className="gap-2 rounded-lg focus:bg-white/10">
                                        <Square className="w-4 h-4" /> Rectangle
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTool('circle')} className="gap-2 rounded-lg focus:bg-white/10">
                                        <CircleIcon className="w-4 h-4" /> Circle
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTool('arrow')} className="gap-2 rounded-lg focus:bg-white/10">
                                        <ArrowRight className="w-4 h-4" /> Arrow
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="w-8 h-px bg-white/10 my-1" />

                            <ToolButton
                                icon={RotateCcw}
                                onClick={() => rotateCanvas(-90)}
                                label="Rotate Left"
                            />
                            <ToolButton
                                icon={RotateCw}
                                onClick={() => rotateCanvas(90)}
                                label="Rotate Right"
                            />

                            <div className="w-8 h-px bg-white/10 my-1" />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                                        <SlidersHorizontal className="w-5 h-5" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    side="right"
                                    className="bg-black/90 backdrop-blur-xl border-white/10 text-white p-2 min-w-[140px] rounded-xl z-[110]"
                                >
                                    <DropdownMenuItem onClick={() => applyFilter('grayscale')} className="rounded-lg focus:bg-white/10">Grayscale</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => applyFilter('sepia')} className="rounded-lg focus:bg-white/10">Sepia</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => applyFilter('invert')} className="rounded-lg focus:bg-white/10">Invert</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="w-8 h-px bg-white/10 my-1" />

                            <ToolButton
                                icon={ImagePlus}
                                onClick={() => fileInputRef.current?.click()}
                                label="Add Image"
                            />

                            <ToolButton
                                icon={Trash2}
                                onClick={deleteSelected}
                                label="Delete (Del)"
                            />
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileUpload(e.target.files)}
                        />

                        {/* Canvas Area - 核心自适应逻辑已移入 hook，此处仅需占满空间并支持溢出滚动 */}
                        <div
                            className="flex-1 bg-[#0F0F15] flex items-center justify-center relative overflow-hidden"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            {/* 拖放指示器 */}
                            {isDragging && (
                                <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-50 flex items-center justify-center">
                                    <div className="text-primary text-lg font-medium flex items-center gap-2">
                                        <ImagePlus className="w-6 h-6" />
                                        拖放图片到此处添加
                                    </div>
                                </div>
                            )}
                            <div
                                className="w-full h-full flex items-center justify-center relative"
                                ref={canvasContainerRef}
                            >
                                <canvas ref={canvasRef} className="max-w-full max-h-full transition-all duration-300 shadow-2xl" />

                                {/* Annotation Input Overlay */}
                                {editorState.pendingAnnotation && (
                                    <div
                                        className="absolute z-[120] flex flex-col gap-2 p-2 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl min-w-[200px]"
                                        style={(() => {
                                            const bounds = editorState.pendingAnnotation.bounds;
                                            const container = canvasContainerRef.current;
                                            if (!container) return { left: bounds.left, top: bounds.bottom + 10, transform: 'translate(-50%, 0)' };

                                            const containerRect = container.getBoundingClientRect();
                                            const inputHeight = 85;
                                            const inputWidth = 200;
                                            const padding = 10;

                                            let top = bounds.bottom + padding;

                                            // 如果下方空间不足，尝试放上方
                                            if (top + inputHeight > containerRect.height) {
                                                top = bounds.top - inputHeight - padding;
                                            }

                                            // 确保 top 不会超出顶部边界
                                            top = Math.max(padding, Math.min(top, containerRect.height - inputHeight - padding));

                                            // 水平居中并限制边界
                                            let left = bounds.left + bounds.width / 2;
                                            left = Math.max(inputWidth / 2 + padding, Math.min(left, containerRect.width - inputWidth / 2 - padding));

                                            return {
                                                left: left,
                                                top: top,
                                                transform: 'translate(-50%, 0)',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                            };
                                        })()}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Input
                                            ref={annotInputRef}
                                            value={annotationText}
                                            onChange={(e) => setAnnotationText(e.target.value)}
                                            placeholder="输入修改说明..."
                                            className="h-8 bg-white/5 border-white/10 text-white text-xs"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') confirmAnnotation(annotationText);
                                                if (e.key === 'Escape') cancelAnnotation();
                                            }}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-[10px] text-white/50 hover:text-white"
                                                onClick={cancelAnnotation}
                                            >
                                                取消
                                            </Button>
                                            <Button
                                                variant="act"
                                                size="sm"
                                                className="h-7 px-3 text-[10px]"
                                                onClick={() => confirmAnnotation(annotationText)}
                                            >
                                                应用标注
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Properties Panel */}
                        <AnimatePresence>
                            {(editorState.activeTool !== 'select' || true) && showProperties && (
                                <motion.div
                                    initial={{ x: 200, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 200, opacity: 0 }}
                                    className="w-64 border-l border-white/10 bg-black/60 backdrop-blur-2xl p-4 flex flex-col gap-6 shrink-0 overflow-y-auto"
                                >
                                    {/* Color Picker */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase font-mono tracking-wider">
                                            <Palette className="w-3 h-3" /> Color
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    className={cn(
                                                        "w-9 h-9 rounded-full border-2 transition-all hover:scale-110",
                                                        editorState.brushColor === color
                                                            ? "border-white ring-2 ring-white/20"
                                                            : "border-transparent hover:border-white/30"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => updateBrushColor(color)}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Brush Settings */}
                                    {editorState.activeTool === 'brush' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase font-mono tracking-wider">
                                                    <SlidersHorizontal className="w-3 h-3" /> Size
                                                </div>
                                                <span className="text-white/50 text-xs font-mono">{editorState.brushWidth}px</span>
                                            </div>
                                            <Slider
                                                value={[editorState.brushWidth]}
                                                min={1}
                                                max={50}
                                                step={1}
                                                onValueChange={(val) => updateBrushWidth(val[0])}
                                                className="py-2"
                                            />
                                        </div>
                                    )}

                                    {/* History Info */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase font-mono tracking-wider">
                                            <Layers className="w-3 h-3" /> History
                                        </div>
                                        <p className="text-white/40 text-xs leading-relaxed">
                                            Use Ctrl+Z / Ctrl+Y to undo/redo changes.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

interface ToolButtonProps {
    icon: LucideIcon;
    active?: boolean;
    onClick: () => void;
    label: string;
}

function ToolButton({ icon: Icon, active, onClick, label }: ToolButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "p-2 rounded-full transition-all duration-200 group relative",
                active
                    ? "bg-primary text-black shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
                    : "text-white/50 hover:text-white hover:bg-white/10"
            )}
            title={label}
        >
            <Icon className="w-5 h-5" />
            {!active && (
                <span className="absolute left-12 bg-black/90 backdrop-blur-xl border border-white/10 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity pointer-events-none">
                    {label}
                </span>
            )}
        </button>
    );
}
