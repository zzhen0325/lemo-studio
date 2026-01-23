import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Undo2,
    Redo2,
    Type,
    MousePointer2,
    Pencil,
    Square,
    Circle as CircleIcon,
    ArrowRight,
    X,
    LucideIcon,
    ImagePlus,
    MessageSquarePlus,
    Upload,
    Save,
    Plus,
    ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { useImageEditor } from '@/hooks/features/PlaygroundV2/useImageEditor';
import { AVAILABLE_MODELS } from '@/hooks/features/PlaygroundV2/useGenerationService';
import { cn } from '@/lib/utils';
import { useImageUpload } from '@/hooks/common/use-image-upload';
import { useGenerationService } from '@/hooks/features/PlaygroundV2/useGenerationService';
import { usePlaygroundStore } from '@/lib/store/playground-store';

import { PresetManagerDialog } from './PresetManagerDialog';
import { EditPresetConfig } from '../types';
import { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';
import { AnnotationInfo, Generation } from '@/types/database';
import { EditorState } from '@/hooks/features/PlaygroundV2/useImageEditor';

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean, editConfig?: EditPresetConfig) => void;
    initialState?: EditPresetConfig;
    workflows: IViewComfy[];
    inputSectionProps?: PlaygroundInputSectionProps;
}

export default function ImageEditorModal({ isOpen, onClose, imageUrl, onSave, initialState, workflows, inputSectionProps }: ImageEditorModalProps) {
    const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
    const [currentEditConfig, setCurrentEditConfig] = useState<EditPresetConfig | undefined>(undefined);
    const [mounted, setMounted] = useState(false);
    const [inlineGenResult, setInlineGenResult] = useState<string | null>(null);
    const [inlineGenId, setInlineGenId] = useState<string | null>(null);
    const [showComparison, setShowComparison] = useState(false);

    const { handleGenerate, isGenerating: isGeneratingService } = useGenerationService();

    // Resizable Right Panel State




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
        exportImage,
        deleteSelected,
        addImage,
        addReferenceImage,
        removeReferenceImage,
        getAnnotationsInfo,
        getCanvasState,
        loadCanvasState,
        setEditorState,
        isInitialized,
        initCanvas,
        initCanvasWithImage,
        setZoomEnabled,
        resetState,
        confirmAnnotation,
        cancelAnnotation
    } = useImageEditor(imageUrl);

    // preset manager zoom sync
    useEffect(() => {
        // Disable canvas zoom when preset manager is open to prevent scroll interference
        if (setZoomEnabled) {
            setZoomEnabled(!isPresetManagerOpen);
        }
    }, [isPresetManagerOpen, setZoomEnabled]);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasLoadedInitialState = useRef(false);

    // 恢复初始状态
    useEffect(() => {
        if (isOpen && isInitialized && initialState && !hasLoadedInitialState.current) {
            console.log("Restoring initial state from editConfig", initialState);
            if (initialState.canvasJson) {
                loadCanvasState(initialState.canvasJson);
            }

            // 同步其他状态
            setEditorState(prev => ({
                ...prev,
                referenceImages: initialState.referenceImages || [],
                backgroundColor: initialState.backgroundColor || prev.backgroundColor,
                canvasWidth: initialState.canvasSize?.width || prev.canvasWidth,
                canvasHeight: initialState.canvasSize?.height || prev.canvasHeight,
            }));

            hasLoadedInitialState.current = true;
        }
    }, [isOpen, isInitialized, initialState, loadCanvasState, setEditorState]);

    // 当 Modal 关闭或 imageUrl 变化时重置加载标志
    useEffect(() => {
        if (!isOpen) {
            hasLoadedInitialState.current = false;
            // 显式清理 hook 内部状态，防止闪烁旧内容
            resetState();
        }
    }, [isOpen, resetState]);

    const { galleryItems } = usePlaygroundStore();
    useEffect(() => {
        if (inlineGenId) {
            const found = galleryItems.find((g: Generation) => g.config?.taskId === inlineGenId);
            if (found && found.outputUrl && found.status === 'completed') {
                setInlineGenResult(found.outputUrl);
            }
        }
    }, [galleryItems, inlineGenId]);

    // 自动初始化逻辑：处理 Canvas 环境开启
    useEffect(() => {
        if (isOpen && !isInitialized) {
            if (initialState) {
                // 如果有初始状态，使用其尺寸初始化一个空画布，以便 loadCanvasState 运行
                console.log("Initializing canvas for state restoration with size:", initialState.canvasSize);
                const { width = 1024, height = 1024 } = initialState.canvasSize || {};
                const timer = setTimeout(() => {
                    initCanvas(width, height);
                }, 100);
                return () => clearTimeout(timer);
            } else if (imageUrl) {
                // 如果没有初始状态但有 URL，加载该图
                console.log("Auto-initializing canvas with imageUrl:", imageUrl);
                const timer = setTimeout(() => {
                    initCanvasWithImage(imageUrl);
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [isOpen, imageUrl, initialState, isInitialized, initCanvasWithImage, initCanvas]);

    // 处理 imageUrl 变化时的重置
    useEffect(() => {
        if (isOpen && imageUrl) {
            // 如果 imageUrl 变化，且不是因为恢复初始状态引起的，则重置
            // 注意：这里需要谨慎处理，避免与 loadCanvasState 冲突
            // 目前采用闭包或特定标志来区分
        }
    }, [imageUrl, isOpen]);



    const { uploadFile } = useImageUpload();

    const refImageInputRef = useRef<HTMLInputElement>(null);

    const handleRefInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
        for (const file of uploads) {
            await uploadFile(file, {
                onLocalPreview: (image) => {
                    addReferenceImage(image.previewUrl);
                    // Automatically append the new badge to prompt
                    const newIndex = editorState.referenceImages.length + 1;
                    inputSectionProps?.setConfig(prev => ({
                        ...prev,
                        prompt: (prev.prompt || '') + ` [Image ${newIndex}] `
                    }));
                },
                onSuccess: (tempId, path) => {
                    setEditorState(prev => ({
                        ...prev,
                        referenceImages: prev.referenceImages.map(imgUrl =>
                            imgUrl.dataUrl.startsWith('data:') && imgUrl.dataUrl === tempId ? { ...imgUrl, dataUrl: path } : imgUrl
                        )
                    }));
                }
            });
        }
        e.target.value = '';
    }, [uploadFile, addReferenceImage, editorState.referenceImages.length, inputSectionProps, setEditorState]);



    // 处理文件上传
    const handleFileUpload = useCallback(async (files: FileList | null) => {
        console.log("handleFileUpload called", files?.length);
        if (!files || files.length === 0) return;

        const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
        for (let i = 0; i < uploads.length; i++) {
            const file = uploads[i];
            const index = i;

            await uploadFile(file, {
                onLocalPreview: (image) => {
                    const dataUrl = image.previewUrl;
                    if (!isInitialized && index === 0) {
                        console.log("Initializing canvas with first uploaded image");
                        initCanvasWithImage(dataUrl);
                    } else {
                        console.log("Adding image to existing canvas");
                        addImage(dataUrl);
                    }
                },
                onSuccess: (tempId, path) => {
                    // 对于画布内的图片，目前主要使用本地 DataURL 进行编辑
                    // 上传成功后可以在这里做些记录，或者如果 fabric.js 支持替换源
                    console.log("Canvas image uploaded to CDN:", path);
                }
            });
        }
    }, [uploadFile, addImage, isInitialized, initCanvasWithImage]);

    // Consolidate editing text synchronization and focus
    useEffect(() => {
        if (editorState.pendingAnnotation) {

        }
    }, [editorState.pendingAnnotation]);

    // 拖放事件处理
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // setIsDragging(false);
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

    // prompt sync effect removed - using global prompt in inputSectionProps directly


    const handleSave = (e?: React.MouseEvent | boolean) => {
        const shouldGenerate = typeof e === 'boolean' ? e : false;
        const dataUrl = exportImage();
        if (dataUrl) {
            // 获取标注信息
            const annotations = getAnnotationsInfo();
            const referenceImages = editorState.referenceImages;

            // Use the global prompt directly from inputSectionProps
            let finalPrompt = inputSectionProps?.config.prompt || "";

            // 追加标注对应的指令
            if (annotations.length > 0) {
                const annotationPrompts = annotations
                    .filter(ann => ann.description && ann.description.trim() !== "")
                    .map(ann => `[${ann.label}]: ${ann.description}`)
                    .join("\n");

                if (annotationPrompts) {
                    finalPrompt = finalPrompt ? `${finalPrompt}\n\nRegion Instructions:\n${annotationPrompts}` : annotationPrompts;
                }
            }


            // 提取参考图的 dataUrl 列表
            const refImageUrls = referenceImages.map((img: { dataUrl: string }) => img.dataUrl);

            // 构建完整的编辑配置
            const editConfig: EditPresetConfig = {
                canvasJson: getCanvasState() || {},
                referenceImages,
                originalImageUrl: imageUrl,
                annotations,
                backgroundColor: editorState.backgroundColor,
                canvasSize: { width: editorState.canvasWidth, height: editorState.canvasHeight }
            };

            if (shouldGenerate) {
                // 如果是生成模式，不调用外部 onSave 关闭，而是触发内部生成
                setShowComparison(true);
                setInlineGenResult(null);
                const gId = `gen-${Date.now()}`;
                setInlineGenId(gId);

                handleGenerate({
                    configOverride: {
                        prompt: finalPrompt,
                        editConfig,
                        isEdit: true,
                        width: editorState.canvasWidth,
                        height: editorState.canvasHeight,
                        model: inputSectionProps?.config.model || AVAILABLE_MODELS[0].id
                    },
                    taskId: gId
                }).then(() => {
                    // Result handled by useEffect on galleryItems
                });
            } else {
                onSave(dataUrl, finalPrompt || undefined, refImageUrls.length > 0 ? refImageUrls : undefined, false, editConfig);
            }
        }
    };




    const handleSavePreset = () => {
        const canvasJson = getCanvasState();
        if (!canvasJson) return;

        // Use the current exported image as a preview cover
        // const currentPreview = exportImage();

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

    // 已移除冗余的状态恢复逻辑，统一放在上方的 useEffect 中

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
                    onDragStart={(e) => e.stopPropagation()}
                    onDragOver={(e) => e.stopPropagation()}
                    onDragEnter={(e) => e.stopPropagation()}
                    onDragLeave={(e) => e.stopPropagation()}
                    onDrop={(e) => e.stopPropagation()}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-[#E5E5E5]" />

                    {/* Content */}
                    <div className="relative flex flex-row h-full z-10">
                        {/* Floating Exit Button */}
                        <div className="absolute top-6 left-6 z-[60]">
                            <Button
                                variant="default"
                                size="sm"
                                className="h-8 px-3 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-black/70 transition-colors"
                                onClick={onClose}
                            >
                                <X className="w-4 h-4 mr-1.5" />
                                Exit
                            </Button>
                        </div>


                        {/* Main Content Area */}
                        <div className="relative h-full flex-1 flex overflow-hidden">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />

                            <div className="flex-1 flex flex-row h-full overflow-hidden bg-[#5a4b4b]">
                                {/* Left Side: Canvas Area */}
                                <motion.div
                                    className="h-full relative flex flex-col overflow-hidden border-r border-black/[0.03]"
                                    animate={{ width: showComparison ? '50%' : '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                >
                                    <div
                                        className="flex-1 flex items-center justify-center relative overflow-hidden"
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {/* 拖放指示器 */}
                                        {/* isDragging && ( ... ) - Removed drag overlay for now or restore state if needed */}\
                                        {false && (
                                            <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-50 flex items-center justify-center">
                                                <div className="text-primary text-lg font-medium flex items-center gap-2">
                                                    <ImagePlus className="w-6 h-6" />
                                                    拖放图片到此处添加
                                                </div>
                                            </div>
                                        )}

                                        {/* Floating Action Controls (Top Right) - Re-positioned into canvas area */}
                                        <div className="absolute top-6 right-6 z-[60] flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full p-1 border border-white/10">
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
                                            <div className="w-px h-4 bg-white/10 mx-1" />
                                            <span className="text-[11px] text-white/40 font-mono min-w-[3rem] text-center">
                                                {Math.round(editorState.zoom * 100)}%
                                            </span>
                                        </div>

                                        {/* Floating Toolbar (Top) */}
                                        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 p-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/5  scale-80 transition-all duration-200 hover:bg-black/90">
                                            <ToolButton
                                                icon={MousePointer2}
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

                                            <div className="w-px h-6 bg-white/10 mx-1" />



                                            <ToolButton
                                                icon={Square}
                                                active={editorState.activeTool === 'rect'}
                                                onClick={() => setTool('rect')}
                                                label="Rectangle"
                                            />
                                            <ToolButton
                                                icon={CircleIcon}
                                                active={editorState.activeTool === 'circle'}
                                                onClick={() => setTool('circle')}
                                                label="Circle"
                                            />
                                            <ToolButton
                                                icon={ArrowRight}
                                                active={editorState.activeTool === 'arrow'}
                                                onClick={() => setTool('arrow')}
                                                label="Arrow"
                                            />

                                            {/* <div className="w-px h-6 bg-white/10 mx-1" />

                                        <ToolButton
                                            icon={RotateCcw}
                                            onClick={() => rotateCanvas(-90)}
                                            label="Rotate Left"
                                        />
                                        <ToolButton
                                            icon={RotateCw}
                                            onClick={() => rotateCanvas(90)}
                                            label="Rotate Right"
                                        /> */}

                                            <div className="w-px h-6 bg-white/10 mx-1" />

                                            <ToolButton
                                                icon={ImagePlus}
                                                onClick={() => fileInputRef.current?.click()}
                                                label="Add Image"
                                            />

                                            {/* <ToolButton
                                            icon={Trash2}
                                            onClick={deleteSelected}
                                            label="Delete (Del)"
                                        /> */}
                                        </div>
                                        <div
                                            className="w-full h-full flex items-center justify-center relative"
                                            ref={canvasContainerRef}
                                        >
                                            {/* 参考图展示区域 - 始终渲染容器避免 DOM 插入冲突 */}
                                            {/* Combined Container for Ref Images and Modification Panel */}
                                            <div className="absolute top-20 left-8 z-[100] flex flex-row items-start gap-4 pointer-events-none">
                                                {/* Reference Images List */}
                                                <div
                                                    className="flex flex-col gap-2 pointer-events-auto"
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
                                                                onClick={() => {
                                                                    inputSectionProps?.setConfig(prev => ({
                                                                        ...prev,
                                                                        prompt: (prev.prompt || '') + ` [${img.label}] `
                                                                    }));
                                                                }}
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

                                                {/* Modification Panel (Moved here) */}
                                                <AnimatePresence mode="wait">
                                                    {(editorState.activeTool !== 'select' || true) && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -20 }}
                                                            className="w-[320px] h-[80vh] bg-white/80 backdrop-blur-2xl p-4 rounded-3xl flex flex-col shrink-0 overflow-hidden pointer-events-auto border border-white/20 shadow-2xl shadow-black/5"
                                                        >
                                                            {/* Scrollable Content Area */}
                                                            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                                                                <div className="flex flex-col gap-6 pb-4">
                                                                    {/* Command Center */}
                                                                    <div className="flex flex-col gap-3 p-1">
                                                                        <div className="text-sm font-semibold text-gray-900">Modification</div>

                                                                        {/* Prompt Input Area */}
                                                                        <div className="relative">
                                                                            <Textarea
                                                                                value={inputSectionProps?.config.prompt || ''}
                                                                                onChange={(e) => inputSectionProps?.setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                                                                placeholder="Describe how to modify the image..."
                                                                                className="min-h-[100px] w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-400 resize-none"
                                                                            />

                                                                            {/* Badge Helpers */}
                                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                                {editorState.referenceImages.map((_, i) => (
                                                                                    <button
                                                                                        key={`ref-${i}`}
                                                                                        onClick={() => inputSectionProps?.setConfig(prev => ({ ...prev, prompt: (prev.prompt || '') + ` [Image ${i + 1}] ` }))}
                                                                                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                                                                                    >
                                                                                        + [Image {i + 1}]
                                                                                    </button>
                                                                                ))}
                                                                                <button
                                                                                    onClick={() => refImageInputRef.current?.click()}
                                                                                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                                                                                >
                                                                                    <Upload className="w-3 h-3 mr-1" /> Add Ref
                                                                                </button>
                                                                            </div>
                                                                            <input
                                                                                type="file"
                                                                                ref={refImageInputRef}
                                                                                className="hidden"
                                                                                accept="image/*"
                                                                                multiple
                                                                                onChange={handleRefInputChange}
                                                                            />
                                                                        </div>

                                                                        {/* Annotations Specific Instructions */}
                                                                        {editorState.annotations.length > 0 && (
                                                                            <div className="flex flex-col gap-4 mt-2">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Region Instructions</div>
                                                                                    <div className="text-[10px] text-gray-400">{editorState.annotations.length} regions</div>
                                                                                </div>
                                                                                <div className="space-y-3">
                                                                                    {editorState.annotations.map((ann: AnnotationInfo) => (
                                                                                        <div key={ann.id} className="space-y-1.5 p-2.5 rounded-xl bg-gray-50/50 border border-gray-100 transition-all hover:bg-gray-50 hover:border-gray-200">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ann.color }} />
                                                                                                <span className="text-[11px] font-medium text-gray-600">{ann.label}</span>
                                                                                            </div>
                                                                                            <Textarea
                                                                                                value={ann.description || ''}
                                                                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                                                                                    const newDescription = e.target.value;
                                                                                                    setEditorState((prev: EditorState) => ({
                                                                                                        ...prev,
                                                                                                        annotations: prev.annotations.map((a: AnnotationInfo) =>
                                                                                                            a.id === ann.id ? { ...a, description: newDescription } : a
                                                                                                        )
                                                                                                    }));
                                                                                                }}
                                                                                                placeholder={`Instructions for this area...`}
                                                                                                className="min-h-[60px] text-xs text-gray-500 bg-white border-gray-200 rounded-lg resize-none focus-visible:ring-1"
                                                                                            />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Model & Size Selectors */}
                                                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                                                            <div className="space-y-1.5">
                                                                                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Model</div>
                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <Button variant="outline" className="w-full h-9 justify-start px-2 bg-white border-gray-200 text-gray-700 text-xs hover:bg-gray-50">
                                                                                            <span className="truncate flex-1 text-left">
                                                                                                {AVAILABLE_MODELS.find(m => m.id === inputSectionProps?.config.model)?.displayName || 'Select Model'}
                                                                                            </span>
                                                                                            <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                                                                                        </Button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent className="w-[180px] bg-white border-gray-200">
                                                                                        {AVAILABLE_MODELS.filter(m => !m.id.includes('workflow') || true).map(m => (
                                                                                            <DropdownMenuItem
                                                                                                key={m.id}
                                                                                                onClick={() => inputSectionProps?.setConfig(prev => ({ ...prev, model: m.id }))}
                                                                                                className="text-gray-700 hover:bg-gray-100 text-xs"
                                                                                            >
                                                                                                {m.displayName}
                                                                                            </DropdownMenuItem>
                                                                                        ))}
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                            </div>
                                                                            <div className="space-y-1.5">
                                                                                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Size</div>
                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <Button variant="outline" className="w-full h-9 justify-start px-2 bg-white border-gray-200 text-gray-700 text-xs hover:bg-gray-50">
                                                                                            <span className="truncate flex-1 text-left">
                                                                                                {inputSectionProps?.config.imageSize || 'Default'}
                                                                                            </span>
                                                                                            <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                                                                                        </Button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent className="w-[120px] bg-white border-gray-200">
                                                                                        {['1K', '2K', '4K'].map(s => (
                                                                                            <DropdownMenuItem
                                                                                                key={s}
                                                                                                onClick={() => inputSectionProps?.setConfig(prev => ({ ...prev, imageSize: s as "1K" | "2K" | "4K" }))}
                                                                                                className="text-gray-700 hover:bg-gray-100 text-xs"
                                                                                            >
                                                                                                {s}
                                                                                            </DropdownMenuItem>
                                                                                        ))}
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Static Bottom Actions */}
                                                            <div className="flex flex-col gap-3 pt-4 mt-auto border-t border-gray-100/50">
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-9 px-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 bg-white border border-gray-200 text-xs transition-colors"
                                                                        onClick={handleSavePreset}
                                                                    >
                                                                        <Save className="w-3.5 h-3.5 mr-2" />
                                                                        Save as Preset
                                                                    </Button>
                                                                </div>
                                                                <Button
                                                                    className="w-full h-11 bg-black hover:bg-black/90 text-white rounded-xl font-semibold shadow-lg shadow-black/5 transition-all active:scale-[0.98]"
                                                                    onClick={() => handleSave(true)}
                                                                >
                                                                    Generate Modification
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            <canvas ref={canvasRef} className={cn("max-w-full max-h-full transition-all duration-300", !isInitialized && "opacity-0")} />

                                            {/* Empty or Loading State Overlay */}
                                            {!isInitialized && (
                                                <div className="absolute inset-0 -mt-20 flex flex-col items-center justify-center z-50 pointer-events-auto">
                                                    {imageUrl ? (
                                                        // 如果有 imageUrl，显示加载中，而不是“开始编辑”
                                                        <div className="flex flex-col items-center gap-4">
                                                            <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                                            <span className="text-white/40 text-sm font-medium">Loading Image...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-black/0 p-12 rounded-[40px] flex flex-col items-center gap-8 pointer-events-auto">
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
                                                                    className="h-12 w-full rounded-2xl gap-2 text-base font-medium shadow-[0_0_20px_oklch(var(--primary)/0.2)] pointer-events-auto"
                                                                    onClick={(e) => {
                                                                        console.log("Upload button clicked");
                                                                        e.stopPropagation();
                                                                        fileInputRef.current?.click();
                                                                    }}
                                                                >
                                                                    <Upload className="w-5 h-5" />
                                                                    上传图片
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    className="h-12 w-full rounded-2xl gap-2 text-base font-medium bg-white/5 border border-white/5 hover:bg-white/10 text-white/80 pointer-events-auto"
                                                                    onClick={(e) => {
                                                                        console.log("New canvas button clicked");
                                                                        e.stopPropagation();
                                                                        initCanvas(1024, 1024);
                                                                    }}
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
                                                    )}
                                                </div>
                                            )}

                                            {/* Annotation Input Overlay */}
                                            <AnimatePresence>
                                                {editorState.pendingAnnotation && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                                        className="absolute z-[110] bg-white rounded-2xl shadow-2xl p-4 border border-gray-100 flex flex-col gap-3 w-64"
                                                        style={{
                                                            left: editorState.pendingAnnotation.bounds.left,
                                                            top: editorState.pendingAnnotation.bounds.top - 120, // offset above
                                                        }}
                                                    >
                                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Region Label / Instruction</div>
                                                        <input
                                                            autoFocus
                                                            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                            placeholder="e.g. Red Shirt"
                                                            defaultValue=""
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    confirmAnnotation((e.target as HTMLInputElement).value);
                                                                } else if (e.key === 'Escape') {
                                                                    cancelAnnotation();
                                                                }
                                                            }}
                                                            id="pending-annotation-input"
                                                        />
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="act"
                                                                size="sm"
                                                                className="flex-1 h-8 text-xs bg-black text-white hover:bg-black/90"
                                                                onClick={() => {
                                                                    const input = document.getElementById('pending-annotation-input') as HTMLInputElement;
                                                                    confirmAnnotation(input.value || "New Region");
                                                                }}
                                                            >
                                                                Confirm
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="px-3 h-8 text-xs text-gray-400 hover:text-gray-600"
                                                                onClick={cancelAnnotation}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Right Side: Comparison Result Area */}
                                <AnimatePresence>
                                    {showComparison && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="h-full flex-1 relative bg-[#F4F4F4] flex flex-col overflow-hidden"
                                        >
                                            <div className="h-14 flex items-center justify-between px-6 border-b border-black/5 shrink-0 bg-white/40 backdrop-blur-sm">
                                                <div className="text-xs font-mono uppercase tracking-widest text-black/40 font-semibold">Result Comparison</div>
                                                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-black/30 hover:text-black hover:bg-black/5" onClick={() => setShowComparison(false)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="flex-1 relative m-6 rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden flex items-center justify-center">
                                                {isGeneratingService && !inlineGenResult ? (
                                                    <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center gap-4">
                                                        <div className="absolute inset-0 bg-[#F9F9FB]">
                                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.03] to-transparent animate-[shimmer_2s_infinite] -skew-x-12 translate-x-[-100%]" style={{ width: '200%' }} />
                                                            <div className="flex flex-col items-center gap-3 relative z-10">
                                                                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                                                <p className="text-[10px] text-black/20 font-mono tracking-wider uppercase">Generating Result...</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : inlineGenResult ? (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full relative p-4 flex flex-col items-center justify-center">
                                                        <img src={inlineGenResult} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Result" />
                                                        <div className="absolute bottom-6 flex gap-3">
                                                            <Button
                                                                className="rounded-full bg-black text-white px-6 h-10 shadow-xl"
                                                                onClick={() => onSave(inlineGenResult, "", [], false)}
                                                            >
                                                                Apply Result
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                className="rounded-full bg-white/80 border border-black/5 text-black px-6 h-10"
                                                                onClick={() => handleSave(true)}
                                                            >
                                                                Regenerate
                                                            </Button>
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <div className="opacity-10 flex flex-col items-center gap-3">
                                                        <ImagePlus className="w-12 h-12" />
                                                        <span className="text-[10px] uppercase font-mono tracking-widest">Awaiting Generation</span>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Right Properties Panel */}

                        </div>





                    </div>


                </motion.div >
            </AnimatePresence >
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
                "p-2 rounded-xl transition-all duration-200 group relative",
                active
                    ? "bg-primary text-black"
                    : "text-white/50 hover:text-white hover:bg-white/10"
            )}
            title={label}
        >
            <Icon className="w-5 h-5" />
            {!active && (
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity pointer-events-none">
                    {label}
                </span>
            )}
        </button>
    );
}
