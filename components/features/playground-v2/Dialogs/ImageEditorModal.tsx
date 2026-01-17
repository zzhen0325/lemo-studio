import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
    MessageSquarePlus,
    Upload,
    Save,
    Plus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import { useImageEditor, EDITOR_COLORS, EditorColor } from '@/hooks/features/PlaygroundV2/useImageEditor';
import { cn } from '@/lib/utils';

import { PresetManagerDialog } from './PresetManagerDialog';
import { EditPresetConfig } from '../types';
import { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { PlaygroundInputSection, PlaygroundInputSectionProps } from '../PlaygroundInputSection';

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean) => void;
    initialState?: EditPresetConfig;
    workflows: IViewComfy[];
    inputSectionProps?: PlaygroundInputSectionProps;
}

export default function ImageEditorModal({ isOpen, onClose, imageUrl, onSave, initialState, workflows, inputSectionProps }: ImageEditorModalProps) {
    const [showProperties, setShowProperties] = useState(true);
    const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
    const [currentEditConfig, setCurrentEditConfig] = useState<EditPresetConfig | undefined>(undefined);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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
        addReferenceImage,
        removeReferenceImage,
        getAnnotationsInfo,
        updateCanvasBackground,
        updateCanvasSize,
        getCanvasState,
        loadCanvasState,
        setEditorState,
        isInitialized,
        initCanvas,
        initCanvasWithImage
    } = useImageEditor(imageUrl);

    const [annotationText, setAnnotationText] = useState("");
    const annotInputRef = useRef<HTMLTextAreaElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    // 渲染带有徽章的标注文本（用于输入框预览）
    const renderAnnotTextWithBadges = useCallback((text: string) => {
        if (!text) return null;
        const parts = text.split(/(\[Image \d+\])/g);
        return parts.map((part, i) => {
            const match = part.match(/^\[(Image \d+)\]$/);
            if (match) {
                const label = match[1];
                return (
                    <span key={i} className="inline-flex items-center h-[18px] px-1 bg-primary/20 border border-primary/30 rounded text-[9px] text-primary font-bold mx-0.5 align-middle leading-none">
                        {label}
                    </span>
                );
            }
            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        });
    }, []);

    // 在光标位置插入参考图标记
    const insertRefImageTag = useCallback((label: string) => {
        const input = annotInputRef.current;
        if (!input) {
            setAnnotationText(prev => prev + ` [${label}]`);
            return;
        }

        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const text = input.value;
        const newText = text.substring(0, start) + `[${label}]` + text.substring(end);

        setAnnotationText(newText);

        setTimeout(() => {
            input.focus();
            const newPos = start + label.length + 2;
            input.setSelectionRange(newPos, newPos);
        }, 0);
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const refImageInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // 处理参考图上传 - 上传后自动在光标处插入标记
    const handleRefImageUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file, index) => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (dataUrl) {
                    addReferenceImage(dataUrl);
                    // 生成新标签并插入
                    const newLabel = `Image ${editorState.referenceImages.length + index + 1}`;
                    insertRefImageTag(newLabel);
                }
            };
            reader.readAsDataURL(file);
        });
    }, [addReferenceImage, editorState.referenceImages.length, insertRefImageTag]);

    // 处理文字选择，实现“原子化”标记：防止光标落入 [Image X] 内部
    const handleTextSelect = useCallback(() => {
        const input = annotInputRef.current;
        if (!input) return;

        const start = input.selectionStart || 0;
        const text = input.value;

        // 正则查找所有标记的位置
        const regex = /\[Image \d+\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;

            // 如果光标在标记中间（不包括边界），则将其移出
            if (start > matchStart && start < matchEnd) {
                // 距离哪头近就移到哪头
                const newPos = (start - matchStart) < (matchEnd - start) ? matchStart : matchEnd;
                input.setSelectionRange(newPos, newPos);
                break;
            }
            // 处理范围选择穿过标记的情况（可选：这里简化为只处理单点光标）
        }
    }, []);

    // 处理文件上传
    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file, index) => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (dataUrl) {
                    if (!isInitialized && index === 0) {
                        initCanvasWithImage(dataUrl);
                    } else {
                        addImage(dataUrl);
                    }
                }
            };
            reader.readAsDataURL(file);
        });
    }, [addImage, isInitialized, initCanvasWithImage]);

    // 同步编辑状态的文字
    useEffect(() => {
        if (editorState.pendingAnnotation) {
            setAnnotationText(editorState.pendingAnnotation.existingText || "");
            // 自动聚焦
            setTimeout(() => annotInputRef.current?.focus(), 100);
        } else {
            setAnnotationText("");
        }
    }, [editorState.pendingAnnotation]);

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

    // 实时同步标注信息到下方 Prompt 输入框
    useEffect(() => {
        if (!inputSectionProps?.setConfig) return;

        const annotations = getAnnotationsInfo();
        const pendingText = annotationText.trim();
        const pendingAnnotation = editorState.pendingAnnotation;

        // 过滤掉正在编辑的那个标注（如果有的话），避免重复
        const filteredAnnotations = annotations.filter(ann => {
            if (pendingAnnotation?.existingLabel) {
                // @ts-expect-error - annotationMeta is a custom property added to the label
                return pendingAnnotation.existingLabel.annotationMeta !== ann;
            }
            return true;
        });

        const descriptions = filteredAnnotations.map(ann => `${ann.colorName} annotation: ${ann.text}`);

        // 如果有正在编辑的标注且有文字内容，也加入实时同步
        if (pendingText && pendingAnnotation) {
            const colorName = EDITOR_COLORS.find(c => c.hex === pendingAnnotation.color)?.name || 'Red';
            descriptions.push(`${colorName} annotation: ${pendingText}`);
        }

        if (descriptions.length > 0) {
            const finalPrompt = `根据图中的彩色标注修改图片，并移除所有标注。\n标注说明：\n${descriptions.join('\n')}`;

            // 避免在没有变化时频繁触发更新
            if (inputSectionProps.config.prompt !== finalPrompt) {
                inputSectionProps.setConfig(prev => ({
                    ...prev,
                    prompt: finalPrompt
                }));
            }
        } else if (inputSectionProps.config.prompt && inputSectionProps.config.prompt.startsWith('根据图中的彩色标注修改图片')) {
            // 如果所有标注都被清空了，且当前的 prompt 是由标注生成的，则清空它
            inputSectionProps.setConfig(prev => ({
                ...prev,
                prompt: ''
            }));
        }
    }, [editorState, annotationText, getAnnotationsInfo, inputSectionProps]);

    const handleSave = (e?: React.MouseEvent | boolean) => {
        const shouldGenerate = typeof e === 'boolean' ? e : false;
        const dataUrl = exportImage();
        if (dataUrl) {
            // 获取标注信息
            const annotations = getAnnotationsInfo();
            const referenceImages = editorState.referenceImages;

            let finalPrompt = "";

            if (annotations.length > 0) {
                // 构建详细的提示词，包含颜色标注信息
                const annotationDescriptions = annotations.map(ann => {
                    return `${ann.colorName} annotation: ${ann.text}`;
                });

                finalPrompt = `根据图中的彩色标注修改图片，并移除所有标注。\n标注说明：\n${annotationDescriptions.join('\n')}`;
            }

            // 提取参考图的 dataUrl 列表
            const refImageUrls = referenceImages.map(img => img.dataUrl);

            onSave(dataUrl, finalPrompt || undefined, refImageUrls.length > 0 ? refImageUrls : undefined, shouldGenerate);
        }
    };

    const handleModalGenerate = () => {
        handleSave(true);
    };

    // Auto-focus input when it appears
    useEffect(() => {
        if (editorState.pendingAnnotation && annotInputRef.current) {
            annotInputRef.current.focus();
            // 编辑模式：填充已有的标注信息
            if (editorState.pendingAnnotation.existingText) {
                setAnnotationText(editorState.pendingAnnotation.existingText);
            } else {
                setAnnotationText("");
            }
        }
    }, [editorState.pendingAnnotation]);

    const handleSavePreset = () => {
        const canvasJson = getCanvasState();
        if (!canvasJson) return;

        // Use the current exported image as a preview cover
        const currentPreview = exportImage();

        const annotations = getAnnotationsInfo();
        const referenceImages = editorState.referenceImages;

        const config: EditPresetConfig = {
            canvasJson,
            referenceImages,
            originalImageUrl: imageUrl,
            annotations,
            backgroundColor: editorState.backgroundColor,
            canvasSize: { width: editorState.canvasWidth, height: editorState.canvasHeight }
        };

        setCurrentEditConfig(config);
        setIsPresetManagerOpen(true);
    };

    useEffect(() => {
        if (isOpen && initialState) {
            const timer = setTimeout(() => {
                if (initialState.canvasJson) {
                    loadCanvasState(initialState.canvasJson);
                }
                setEditorState(prev => ({
                    ...prev,
                    referenceImages: initialState.referenceImages || [],
                    backgroundColor: initialState.backgroundColor || '#eeeeee',
                    canvasWidth: initialState.canvasSize?.width || 1024,
                    canvasHeight: initialState.canvasSize?.height || 1024,
                    zoom: 1
                }));
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen, initialState, loadCanvasState, setEditorState]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <>
            <PresetManagerDialog
                open={isPresetManagerOpen}
                onOpenChange={setIsPresetManagerOpen}
                workflows={workflows}
                currentEditConfig={currentEditConfig}
            />
            <AnimatePresence>
                <motion.div
                    className="fixed inset-0 z-[9999] flex flex-col overflow-hidden pointer-events-auto"
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
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="h-8 px-3 rounded-full bg-white/20 text-white/60 hover:text-white hover:bg-white/10"
                                    onClick={onClose}
                                >
                                    <X className="w-4 h-4 " />
                                    Exit
                                </Button>
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
                                    onClick={handleSavePreset}
                                >
                                    <Save className="w-4 h-4 mr-1.5" />
                                    Save as Preset
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
                            <div className="flex-1 flex flex-col bg-[#0F0F15] relative overflow-hidden">
                                <div
                                    className="flex-1 flex items-center justify-center relative overflow-hidden"
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
                                        {/* 参考图展示区域 - 始终渲染容器避免 DOM 插入冲突 */}
                                        <div
                                            className="absolute top-4 left-4 z-[100] flex flex-col gap-2"
                                            style={{ display: editorState.referenceImages.length > 0 ? 'flex' : 'none' }}
                                        >
                                            <div className="text-white/40 text-[10px] uppercase font-mono tracking-wider mb-1">
                                                Reference Images
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-w-[300px]">
                                                {editorState.referenceImages.map((img) => (
                                                    <div
                                                        key={img.id}
                                                        className="relative group cursor-pointer"
                                                        onClick={() => insertRefImageTag(img.label)}
                                                        title={`点击插入光标位置: [${img.label}]`}
                                                    >
                                                        <div className="w-36 h-36 rounded-lg overflow-hidden border border-white/20 bg-black/40 group-hover:border-primary/50 transition-colors">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={img.dataUrl}
                                                                alt={img.label}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[12px] text-white/80 whitespace-nowrap group-hover:text-primary transition-colors">
                                                            {img.label}
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeReferenceImage(img.id);
                                                            }}
                                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                        >
                                                            <X className="w-2.5 h-2.5 text-white" />
                                                        </button>
                                                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors rounded-lg flex items-center justify-center">
                                                            <MessageSquarePlus className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <canvas ref={canvasRef} className={cn("max-w-full max-h-full transition-all duration-300", !isInitialized && "opacity-0")} />

                                        {/* Empty State Overlay */}
                                        {!isInitialized && (
                                            <div className="absolute inset-0 -mt-20 flex flex-col items-center justify-center z-50">
                                                <div className="bg-black/0   p-12 rounded-[40px] flex flex-col items-center gap-8 ">
                                                    <div className="flex flex-col items-center gap-3 text-center">
                                                        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-2">
                                                            <ImagePlus className="w-8 h-8 text-primary" />
                                                        </div>
                                                        <h3 className="text-xl font-medium text-white">开始编辑</h3>
                                                        <p className="text-sm text-white/40 max-w-[240px]">
                                                            上传一张图片开始，或者创建一个空白画框进行自由创作
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-col w-full gap-3">
                                                        <Button
                                                            variant="act"
                                                            className="h-12 w-full rounded-2xl gap-2 text-base font-medium shadow-[0_0_20px_oklch(var(--primary)/0.2)]"
                                                            onClick={() => fileInputRef.current?.click()}
                                                        >
                                                            <Upload className="w-5 h-5" />
                                                            上传图片
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            className="h-12 w-full rounded-2xl gap-2 text-base font-medium bg-white/5 border border-white/5 hover:bg-white/10 text-white/80"
                                                            onClick={() => initCanvas(1024, 1024)}
                                                        >
                                                            <Plus className="w-5 h-5" />
                                                            新建空白画框
                                                        </Button>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-[11px] text-white/20 uppercase font-mono tracking-widest">
                                                        <div className="w-8 h-px bg-white/5" />
                                                        或者直接拖拽图片到此处
                                                        <div className="w-8 h-px bg-white/5" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Annotation Input Overlay */}
                                        {editorState.pendingAnnotation && (
                                            <div
                                                className="absolute z-[120] flex flex-col gap-1 p-2 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl min-w-[300px]"
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
                                                {/* 输入框区域 - 包含视觉徽章映射 */}
                                                <div className="relative flex flex-col gap-2 min-h-[60px] p-3 bg-white/5 border border-white/10 rounded-lg focus-within:border-primary/50 transition-colors">
                                                    <div className="relative flex-1 min-h-[60px]">
                                                        {/* 视觉层：解析并展示 [Image X] 为 Badge */}
                                                        <div className="absolute inset-0 p-1 text-sm font-sans text-white/90 whitespace-pre-wrap pointer-events-none overflow-hidden leading-6">
                                                            {renderAnnotTextWithBadges(annotationText)}
                                                        </div>
                                                        <Textarea
                                                            ref={annotInputRef}
                                                            value={annotationText}
                                                            onChange={(e) => setAnnotationText(e.target.value)}
                                                            onSelect={handleTextSelect}
                                                            placeholder={annotationText ? "" : "在此输入修改说明..."}
                                                            className="absolute inset-0 w-full h-full bg-transparent border-none text-sm font-sans focus-visible:ring-0 focus-visible:ring-offset-0 p-1 z-10 selection:bg-primary/20 caret-white resize-none leading-6"
                                                            style={{
                                                                color: 'transparent',
                                                                textShadow: 'none'
                                                            }}
                                                            onKeyDown={(e) => {
                                                                // Cmd+Enter 确认
                                                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                                    e.preventDefault();
                                                                    confirmAnnotation(annotationText);
                                                                    return;
                                                                }

                                                                // Backspace 整块删除逻辑
                                                                if (e.key === 'Backspace') {
                                                                    const input = annotInputRef.current;
                                                                    if (!input) return;

                                                                    const start = input.selectionStart || 0;
                                                                    const text = input.value;

                                                                    // 检查光标前是否紧跟 [Image X]
                                                                    const tagBeforeMatch = text.substring(0, start).match(/\[Image \d+\]$/);
                                                                    if (tagBeforeMatch) {
                                                                        e.preventDefault();
                                                                        const tagLen = tagBeforeMatch[0].length;
                                                                        const newText = text.substring(0, start - tagLen) + text.substring(start);
                                                                        setAnnotationText(newText);
                                                                        // 自动重新计算光标位置
                                                                        setTimeout(() => input.setSelectionRange(start - tagLen, start - tagLen), 0);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-end  pt-2">
                                                        <button
                                                            onClick={() => refImageInputRef.current?.click()}
                                                            className="relative z-20 flex items-center gap-1 h-6 px-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] text-white/60 hover:text-white transition-colors shrink-0"
                                                            title="上传并插入参考图"
                                                        >
                                                            <Upload className="w-3 h-3 text-primary" />
                                                            <span>Ref</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* 隐藏的文件上传 input */}
                                                <input
                                                    ref={refImageInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(e) => handleRefImageUpload(e.target.files)}
                                                />

                                                {/* 底部操作区 */}
                                                <div className="flex items-center justify-between gap-3 pt-1 px-1 ">
                                                    <div className="text-[9px] text-white/30 hidden sm:block">
                                                        按 Enter 确认
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-auto">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 px-2 rounded-md text-[10px] text-white/40 hover:text-white hover:bg-white/10"
                                                            onClick={() => cancelAnnotation()}
                                                        >
                                                            取消
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="act"
                                                            className="h-6 px-2 rounded-md text-[10px] gap-1"
                                                            onClick={() => confirmAnnotation(annotationText)}
                                                        >
                                                            <Check className="w-3 h-3" />
                                                            确认
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {inputSectionProps && (
                                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 shadow-2xl shadow-[0px_10px_30px_0px_rgba(0,0,0,0.10)]  bg-[#5d7b9544] rounded-[30px] ">
                                        <PlaygroundInputSection
                                            {...inputSectionProps}
                                            width={inputSectionProps.width || 896}
                                            hideTitle
                                            variant="mini"
                                            handleGenerate={handleModalGenerate}
                                        />
                                    </div>
                                )}
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
                                        {/* Canvas Settings */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase font-mono tracking-wider">
                                                <Square className="w-3 h-3" /> Canvas Settings
                                            </div>

                                            {/* Aspect Ratio Shortcuts */}
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { label: '1:1', w: 1024, h: 1024 },
                                                    { label: '4:3', w: 1024, h: 768 },
                                                    { label: '16:9', w: 1280, h: 720 },
                                                    { label: '9:16', w: 720, h: 1280 }
                                                ].map((ratio) => (
                                                    <Button
                                                        key={ratio.label}
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "h-8 text-[10px] bg-white/5 border border-white/5 hover:bg-white/10",
                                                            editorState.canvasWidth === ratio.w && editorState.canvasHeight === ratio.h && "border-primary/50 text-primary bg-primary/5"
                                                        )}
                                                        onClick={() => updateCanvasSize(ratio.w, ratio.h)}
                                                    >
                                                        {ratio.label} ({ratio.w}x{ratio.h})
                                                    </Button>
                                                ))}
                                            </div>

                                            {/* Manual Size Input */}
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-[10px] text-white/40">Width</Label>
                                                    <Input
                                                        type="number"
                                                        value={editorState.canvasWidth}
                                                        onChange={(e) => updateCanvasSize(parseInt(e.target.value) || 0, editorState.canvasHeight)}
                                                        className="h-8 bg-white/5 border-white/10 text-xs text-white focus-visible:ring-primary/50"
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-[10px] text-white/40">Height</Label>
                                                    <Input
                                                        type="number"
                                                        value={editorState.canvasHeight}
                                                        onChange={(e) => updateCanvasSize(editorState.canvasWidth, parseInt(e.target.value) || 0)}
                                                        className="h-8 bg-white/5 border-white/10 text-xs text-white focus-visible:ring-primary/50"
                                                    />
                                                </div>
                                            </div>

                                            {/* Canvas Background */}
                                            <div className="space-y-2">
                                                <div className="text-white/40 text-[10px]">Background Color</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {[
                                                        { color: '#ffffff', label: 'White' },
                                                        { color: '#000000', label: 'Black' },
                                                        { color: '#f8f9fa', label: 'Light' },
                                                        { color: '#1a1a20', label: 'Dark' },
                                                        { color: 'transparent', label: 'None' },
                                                    ].map((item) => (
                                                        <button
                                                            key={item.color}
                                                            onClick={() => updateCanvasBackground(item.color)}
                                                            className={cn(
                                                                "w-6 h-6 rounded-md border border-white/10 transition-transform active:scale-95",
                                                                editorState.backgroundColor === item.color ? "ring-2 ring-primary ring-offset-2 ring-offset-black" : "hover:border-white/30"
                                                            )}
                                                            style={{ backgroundColor: item.color === 'transparent' ? 'transparent' : item.color }}
                                                            title={item.label}
                                                        >
                                                            {item.color === 'transparent' && (
                                                                <div className="w-full h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACFJREFUGFdjZEADJgY0QCIsDAszMCADmBCIAAnAyMAEpAAZpAILuY7fXAAAAABJRU5ErkJggg==')] rounded-md" />
                                                            )}
                                                        </button>
                                                    ))}
                                                    {/* Custom Color Input Placeholder */}
                                                    <input
                                                        type="color"
                                                        className="w-6 h-6 rounded-md border border-white/10 bg-transparent cursor-pointer"
                                                        value={editorState.backgroundColor}
                                                        onChange={(e) => updateCanvasBackground(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Color Picker */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase font-mono tracking-wider">
                                                <Palette className="w-3 h-3" /> Tool Color
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {EDITOR_COLORS.map(({ hex, name }) => (
                                                    <button
                                                        key={hex}
                                                        className={cn(
                                                            "w-9 h-9 rounded-full border-2 transition-all hover:scale-110",
                                                            editorState.brushColor === hex
                                                                ? "border-white ring-2 ring-white/20"
                                                                : "border-transparent hover:border-white/30"
                                                        )}
                                                        style={{ backgroundColor: hex }}
                                                        onClick={() => updateBrushColor(hex as EditorColor)}
                                                        title={name}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Stroke Settings */}
                                        {['brush', 'rect', 'circle', 'arrow', 'annotate'].includes(editorState.activeTool) && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase font-mono tracking-wider">
                                                        <SlidersHorizontal className="w-3 h-3" /> Stroke Width
                                                    </div>
                                                    <span className="text-white/50 text-xs font-mono">{editorState.brushWidth}px</span>
                                                </div>
                                                <Slider
                                                    value={[editorState.brushWidth]}
                                                    min={1}
                                                    max={20}
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
                                            <p className="text-white/40 text-[10px] font-mono opacity-60">
                                                {editorState.canvasWidth} x {editorState.canvasHeight} px
                                            </p>
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
        </>,
        document.body
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
                    ? "bg-primary text-black"
                    : "text-white/50 hover:text-white hover:bg-white/10"
            )}
            title={label}
        >
            <Icon className="w-5 h-5" />
            {!active && (
                <span className="absolute  bg-black/90  border border-white/10 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity pointer-events-none">
                    {label}
                </span>
            )}
        </button>
    );
}
