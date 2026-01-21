"use client";

import React, { RefObject } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Plus, Sparkles } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useImageSource } from "@/hooks/common/use-image-source";

import PromptInput from "@/components/features/playground-v2/PromptInput";
import ControlToolbar from "@/components/features/playground-v2/ControlToolbar";
import { DescribePanel } from "@/components/features/playground-v2/DescribePanel";
import SplitText from "@/components/ui/split-text";

import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { UploadedImage } from "@/components/features/playground-v2/types";
import type { SelectedLora } from "@/components/features/playground-v2/Dialogs/LoraSelectorDialog";
import { GenerationConfig, ImageSize } from '@/types/database';
import { AIModel } from "@/hooks/features/PlaygroundV2/usePromptOptimization";
import { AR_MAP, getAspectRatioPresets, getAspectRatioByDimensions } from "./constants/aspect-ratio";

export interface PlaygroundInputSectionProps {
    // 状态
    showHistory: boolean;
    config: GenerationConfig;
    uploadedImages: UploadedImage[];
    describeImages: UploadedImage[];
    isStackHovered: boolean;
    isInputFocused: boolean;
    isOptimizing: boolean;
    isGenerating: boolean;
    isDescribing: boolean;
    isDescribeMode: boolean;
    isDraggingOver: boolean;
    isDraggingOverPanel: boolean;
    isPresetGridOpen: boolean;
    isAspectRatioLocked: boolean;
    isSelectorExpanded: boolean;
    batchSize: number;
    selectedModel: string;
    selectedAIModel: AIModel;
    selectedLoras: SelectedLora[];
    selectedPresetName: string | undefined;
    selectedWorkflowConfig?: IViewComfy;
    workflows: IViewComfy[];

    // Refs
    fileInputRef: RefObject<HTMLInputElement | null>;
    describePanelRef: RefObject<HTMLDivElement>;

    // Callbacks
    setConfig: (val: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => void;
    setIsStackHovered: (val: boolean) => void;
    setIsInputFocused: (val: boolean) => void;
    setPreviewImage: (url: string | null, layoutId?: string) => void;
    removeImage: (index: number) => void;
    handleFilesUpload: (files: File[] | FileList, target?: 'reference' | 'describe') => void;
    handleOptimizePrompt: () => void;
    handleGenerate: () => void;
    handleDescribe: () => void;
    setSelectedAIModel: (model: AIModel) => void;
    setSelectedModel: (model: string) => void;
    setIsAspectRatioLocked: (val: boolean) => void;
    setSelectedWorkflowConfig: (wf: IViewComfy | undefined) => void;
    applyWorkflowDefaults: (wf: IViewComfy) => void;
    setIsSelectorExpanded: (val: boolean) => void;
    setBatchSize: (val: number) => void;
    setIsLoraDialogOpen: (val: boolean) => void;
    setIsPresetGridOpen: (val: boolean) => void;
    onClearPreset: () => void;
    setIsDescribeMode: (val: boolean) => void;
    setDescribeImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
    setIsDraggingOver: (val: boolean) => void;
    setIsDraggingOverPanel: (val: boolean) => void;
    hideTitle?: boolean;
    variant?: 'default' | 'edit';
    width?: string | number;
    customAspectRatioLabel?: string;
    disableImageUpload?: boolean;
    disableModelSelection?: boolean;
}

export function PlaygroundInputSection({
    showHistory,
    hideTitle,
    config,
    uploadedImages,
    describeImages,
    isStackHovered,
    isInputFocused,
    isOptimizing,
    isGenerating,
    isDescribing,
    isDescribeMode,
    isDraggingOver,
    isDraggingOverPanel,
    isPresetGridOpen,
    isAspectRatioLocked,
    isSelectorExpanded,
    batchSize,
    selectedModel,
    selectedAIModel,
    selectedLoras,
    selectedPresetName,
    selectedWorkflowConfig,
    workflows,
    fileInputRef,
    describePanelRef,
    setConfig,
    setIsStackHovered,
    setIsInputFocused,
    setPreviewImage,
    removeImage,
    handleFilesUpload,
    handleOptimizePrompt,
    handleGenerate,
    handleDescribe,
    setSelectedAIModel,
    setSelectedModel,
    setIsAspectRatioLocked,
    setSelectedWorkflowConfig,
    applyWorkflowDefaults,
    setIsSelectorExpanded,
    setBatchSize,
    setIsLoraDialogOpen,
    setIsPresetGridOpen,
    onClearPreset,
    setIsDescribeMode,
    setDescribeImages,
    setIsDraggingOver,
    setIsDraggingOverPanel,
    variant = 'default',
    width,
    customAspectRatioLabel,
    disableImageUpload = false,
    disableModelSelection = false,
}: PlaygroundInputSectionProps) {
    const aspectRatioPresets = getAspectRatioPresets();

    const getCurrentAspectRatio = () => {
        if (config.aspectRatio === 'auto') return 'auto';
        return getAspectRatioByDimensions(config.width, config.height);
    };

    const handleWidthChange = (newWidth: number) => {
        if (isAspectRatioLocked && config.height > 0) {
            const ratio = config.width / config.height;
            const newHeight = Math.round(newWidth / ratio);
            setConfig(prev => ({ ...prev, width: newWidth, height: newHeight }));
        } else {
            setConfig(prev => ({ ...prev, width: newWidth }));
        }
    };

    const handleHeightChange = (newHeight: number) => {
        if (isAspectRatioLocked && config.height > 0) {
            const ratio = config.width / config.height;
            const newWidth = Math.round(newHeight * ratio);
            setConfig(prev => ({ ...prev, height: newHeight, width: newWidth }));
        } else {
            setConfig(prev => ({ ...prev, height: newHeight }));
        }
    };

    return (
        <div className={cn(
            "flex flex-col items-center w-full pointer-events-auto",
            isDescribeMode && showHistory && "h-full"
        )}>
            {!showHistory && !hideTitle && (
                <div style={{ fontFamily: "'InstrumentSerif', serif" }}>
                    <SplitText
                        text="✨Turn any idea into a stunning image"
                        tag="h1"
                        className="text-[2rem] text-white font-medium text-center mb-4 h-auto opacity-100 z-10 whitespace-nowrap"
                        duration={0.5}
                        delay={20}
                        splitType="chars"
                        from={{ opacity: 0, y: 20 }}
                        to={{ opacity: 1, y: 0 }}
                        ease="power3.out"
                        rootMargin="-10px"
                        threshold={0.1}
                    />
                </div>
            )}

            <div
                className={cn(
                    !width && "w-full",
                    isDescribeMode && showHistory ? "h-auto" : ""
                )}
                style={width ? { width: typeof width === 'number' ? `${width}px` : width } : {}}
            >
                <div className={cn(
                    "relative z-10 flex items-center bg-black/40 justify-center w-full text-black flex-col rounded-[30px] backdrop-blur-xl border border-white/20  p-2 transition-colors duration-100",
                    showHistory ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.4)_31.44%,rgba(93, 123, 149, 0.78)_100%)]" : "bg-black/40"
                )}>
                    <div className="flex items-start gap-0 bg-black/40 border border-white/10 rounded-3xl w-full pl-4 relative overflow-hidden">
                        {variant !== 'edit' && (
                            <div
                                className="flex items-center shrink-0 ml-1 h-14 self-start mt-4 mb-4"
                                onMouseEnter={() => setIsStackHovered(true)}
                                onMouseLeave={() => setIsStackHovered(false)}
                            >
                                {/* 图片堆栈 */}
                                {uploadedImages.map((image, index) => (
                                    <StackImage
                                        key={image.id || index}
                                        image={image}
                                        index={index}
                                        isStackHovered={isStackHovered}
                                        uploadedImagesCount={uploadedImages.length}
                                        onPreview={setPreviewImage}
                                        onRemove={removeImage}
                                    />
                                ))}

                                {/* 上传按钮 - 作为堆栈的最后一个元素 */}
                                {!disableImageUpload && (
                                    <motion.button
                                        onClick={() => fileInputRef.current?.click()}
                                        initial={false}
                                        animate={{
                                            rotate: 3,
                                            marginLeft: uploadedImages.length > 0 ? (isStackHovered ? 8 : -36) : 0,
                                            scale: 1
                                        }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        transition={{ type: "tween", duration: 0.05 }}
                                        style={{
                                            zIndex: 0,
                                            position: 'relative'
                                        }}
                                        className={cn(
                                            "w-14 h-14 shrink-0 flex items-center justify-center rounded-2xl text-primary border border-white/20 bg-white/5 hover:border-primary hover:shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all group"
                                        )}
                                    >
                                        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    </motion.button>
                                )}
                            </div>
                        )}

                        <div className="flex-1 mt-1 flex items-center gap-2">
                            <div className="flex-1">
                                <PromptInput
                                    prompt={config.prompt}
                                    onPromptChange={(val) => setConfig(prev => ({ ...prev, prompt: val }))}
                                    uploadedImages={uploadedImages}
                                    onRemoveImage={removeImage}
                                    isOptimizing={isOptimizing}
                                    onOptimize={handleOptimizePrompt}
                                    selectedAIModel={selectedAIModel}
                                    onAIModelChange={setSelectedAIModel}
                                    onAddImages={handleFilesUpload}
                                    onFocusChange={setIsInputFocused}
                                    isDraggingOver={isDraggingOver}
                                    onDraggingOverChange={setIsDraggingOver}
                                />
                            </div>
                            {variant !== 'edit' && (
                                <Button
                                    variant="light"
                                    size="sm"
                                    className="h-4 w-4 absolute right-4 top-4 rounded-2xl disabled:opacity-100"
                                    disabled={isOptimizing}
                                    onClick={() => {
                                        if (!isOptimizing) {
                                            handleOptimizePrompt();
                                        }
                                    }}
                                >
                                    <motion.div
                                        animate={isOptimizing ? {
                                            filter: [
                                                "drop-shadow(0 0 4px rgba(255, 255, 255, 0.6))",
                                                "drop-shadow(0 0 14px rgba(202, 255, 196, 1))",
                                                "drop-shadow(0 0 4px rgba(255, 255, 255, 0.6))"
                                            ]
                                        } : {}}
                                        transition={{
                                            duration: 1,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                        className="flex items-center justify-center"
                                    >
                                        <Sparkles className="w-2 h-2" />
                                    </motion.div>
                                </Button>
                            )}
                        </div>

                        {/* 底部模糊遮罩 */}
                        <div
                            className={cn(
                                "absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 rounded-b-3xl z-10",
                                (!isInputFocused && config.prompt?.length > 0) ? "opacity-40" : "opacity-0"
                            )}
                        />
                    </div>

                    <ControlToolbar
                        selectedModel={selectedModel}
                        onModelChange={setSelectedModel}
                        config={config}
                        onConfigChange={(newConf) => setConfig(prev => ({ ...prev, ...newConf }))}
                        onWidthChange={handleWidthChange}
                        onHeightChange={handleHeightChange}
                        aspectRatioPresets={aspectRatioPresets}
                        currentAspectRatio={getCurrentAspectRatio()}
                        onAspectRatioChange={(ar: string) => {
                            if (ar === 'auto') {
                                let w = config.width;
                                let h = config.height;

                                if (uploadedImages.length > 0) {
                                    const firstImage = uploadedImages[0];
                                    w = firstImage.width || w;
                                    h = firstImage.height || h;
                                }

                                const minSide = Math.min(w, h);
                                if (minSide < 1024) {
                                    const scale = 1024 / minSide;
                                    w = Math.round(w * scale);
                                    h = Math.round(h * scale);
                                }

                                setConfig(prev => ({
                                    ...prev,
                                    aspectRatio: 'auto',
                                    width: w,
                                    height: h
                                }));
                                return;
                            }
                            // Keep the current imageSize setting when changing aspect ratio
                            setConfig(prev => {
                                const currentSize = (prev.imageSize as '1K' | '2K' | '4K') || '1K';
                                const dimensions = AR_MAP[ar]?.[currentSize] || AR_MAP[ar]?.['1K'];
                                if (dimensions) {
                                    return {
                                        ...prev,
                                        width: dimensions.w,
                                        height: dimensions.h,
                                        aspectRatio: ar as GenerationConfig['aspectRatio']
                                    };
                                }
                                return prev;
                            });
                        }}
                        currentImageSize={config.imageSize || '1K'}
                        onImageSizeChange={(size: ImageSize) => {
                            setConfig(prev => {
                                const ar = prev.aspectRatio || getAspectRatioByDimensions(prev.width, prev.height);
                                const dimensions = AR_MAP[ar]?.[size] || AR_MAP[ar]?.['1K'];
                                if (dimensions) {
                                    return {
                                        ...prev,
                                        width: dimensions.w,
                                        height: dimensions.h,
                                        imageSize: size,
                                        aspectRatio: ar as GenerationConfig['aspectRatio']
                                    };
                                }
                                return prev;
                            });
                        }}
                        isAspectRatioLocked={isAspectRatioLocked}
                        onToggleAspectRatioLock={() => setIsAspectRatioLocked(!isAspectRatioLocked)}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        loadingText={selectedModel === "seed4_lemo1230" ? "Seed 4.0 生成中..." : "生成中..."}
                        selectedWorkflowName={selectedWorkflowConfig?.viewComfyJSON.title}
                        selectedBaseModelName={config.model}
                        workflows={workflows}
                        onWorkflowSelect={(wf) => { setSelectedWorkflowConfig(wf); applyWorkflowDefaults(wf); }}
                        isSelectorExpanded={isSelectorExpanded}
                        onSelectorExpandedChange={setIsSelectorExpanded}
                        batchSize={batchSize}
                        onBatchSizeChange={setBatchSize}
                        onOpenLoraSelector={() => setIsLoraDialogOpen(true)}
                        selectedLoras={selectedLoras}
                        selectedPresetName={selectedPresetName ?? undefined}
                        onTogglePresetGrid={() => setIsPresetGridOpen(!isPresetGridOpen)}
                        isPresetGridOpen={isPresetGridOpen}
                        onClearPreset={onClearPreset}
                        variant={variant}
                        customAspectRatioLabel={customAspectRatioLabel}
                        uploadedImages={uploadedImages}
                        disableModelSelection={disableModelSelection}
                    />
                </div>
            </div>

            {variant !== 'edit' && isDescribeMode && (
                <DescribePanel
                    open={isDescribeMode}
                    panelRef={describePanelRef}
                    describeImages={describeImages}
                    isDraggingOverPanel={isDraggingOverPanel}
                    setIsDraggingOverPanel={setIsDraggingOverPanel}
                    setIsDraggingOver={setIsDraggingOver}
                    onUploadClick={() => fileInputRef.current?.click()}
                    onDropFiles={(files) => handleFilesUpload(files, 'describe')}
                    onClose={() => setIsDescribeMode(false)}
                    onRemoveImage={(idx) => setDescribeImages(prev => prev.filter((_, i) => i !== idx))}
                    isDescribing={isDescribing}
                    isGenerating={isGenerating}
                    onDescribe={handleDescribe}
                />
            )}
        </div>
    );
}

function StackImage({
    image,
    index,
    isStackHovered,
    uploadedImagesCount,
    onPreview,
    onRemove
}: {
    image: UploadedImage;
    index: number;
    isStackHovered: boolean;
    uploadedImagesCount: number;
    onPreview: (url: string, id: string) => void;
    onRemove: (index: number) => void;
}) {
    const src = useImageSource(image.path || image.previewUrl, image.localId);
    const rotations = [-6, 4, -2, 3];
    const finalSrc = src || image.previewUrl;

    return (
        <motion.div
            initial={false}
            animate={{
                marginLeft: index === 0 ? 0 : (isStackHovered ? 8 : -36),
                rotate: isStackHovered ? 0 : rotations[index % rotations.length],
                scale: 1
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
                zIndex: (uploadedImagesCount - index) + 100,
                position: 'relative'
            }}
        >
            <div className="relative group cursor-pointer" onClick={() => !image.isUploading && finalSrc && onPreview(finalSrc, `stack-img-${image.id || index}`)}>
                <motion.div layoutId={`stack-img-${image.id || index}`} className="relative">
                    {finalSrc ? (
                        <Image
                            src={finalSrc}
                            alt={`Uploaded ${index + 1}`}
                            width={56}
                            height={56}
                            className={cn(
                                "w-14 h-14 object-cover rounded-2xl bg-black border border-primary shadow-xl",
                                image.isUploading && "opacity-100 "
                            )}
                            unoptimized
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10" />
                    )}
                    {image.isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <LoadingSpinner size={16} className="text-white" />
                        </div>
                    )}
                </motion.div>
                {!image.isUploading && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                        className="absolute -top-1 -right-1 bg-white text-black border border-white/40 rounded-full w-4 h-4 flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-100 hover:bg-red-500"
                    >
                        <X className="w-2 h-2" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}
