import React, { RefObject, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Plus, Sparkles } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useImageSource } from "@/hooks/common/use-image-source";

import { createPortal } from "react-dom";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import PromptInput from "@studio/playground/_components/PromptInput";
import ControlToolbar from "@studio/playground/_components/ControlToolbar";
import { DescribePanel } from "@studio/playground/_components/DescribePanel";
import { OPTIMIZATION_LOADING_MESSAGES } from "@studio/playground/_components/ShortcutPromptComposer";
import SplitText from "@/components/ui/split-text";

import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { UploadedImage } from "@/lib/playground/types";
import type { SelectedLora } from "@/lib/playground/types";
import { GenerationConfig, ImageSize } from '@/types/database';
import { AIModel } from "@studio/playground/_components/hooks/usePromptOptimization";
import { AR_MAP, getAspectRatioPresets, getAspectRatioByDimensions } from "./constants/aspect-ratio";
import {
    type PlaygroundShortcut,
    type ShortcutPromptValues,
} from "@/config/playground-shortcuts";
import type {
    DesignStructuredAnalysis,
    DesignAnalysisSectionKey,
    DesignStructuredPaletteEntry,
    DesignVariantEditScope,
    DesignStructuredVariantId,
} from "@/app/studio/playground/_lib/kv-structured-optimization";
import type { ShortcutEditorDocument } from "@/app/studio/playground/_lib/shortcut-editor-document";

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
    onReorderImages?: (newImages: UploadedImage[]) => void;
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
    activeShortcutName?: string;
    onClearShortcutTemplate?: () => void;
    shortcutTemplate?: {
        shortcut: PlaygroundShortcut;
        values: ShortcutPromptValues;
        removedFieldIds: string[];
        editorDocument?: ShortcutEditorDocument;
        optimizationSession?: {
            originPrompt: string;
            activeVariantId: DesignStructuredVariantId;
            variants: Array<{
                id: DesignStructuredVariantId;
                label: string;
                coreSuggestions: ShortcutPromptValues;
                palette: DesignStructuredPaletteEntry[];
                analysis: DesignStructuredAnalysis;
                promptPreview: string;
                pendingInstruction: string;
                pendingScope: DesignVariantEditScope;
                isModifying: boolean;
            }>;
        } | null;
    } | null;
    onShortcutTemplateFieldChange?: (fieldId: string, value: string) => void;
    onShortcutTemplateFieldRemove?: (fieldId: string) => void;
    onShortcutTemplateDocumentChange?: (nextDocument: ShortcutEditorDocument) => void;
    onExitShortcutTemplate?: () => void;
    onShortcutTemplateOptimize?: () => void;
    onShortcutTemplateVariantSelect?: (variantId: DesignStructuredVariantId) => void;
    onShortcutTemplateRegenerate?: () => void;
    onShortcutTemplateGenerateCurrent?: () => void;
    onShortcutTemplateGenerateAll?: () => void;
    onShortcutTemplateAnalysisSectionChange?: (
        sectionKey: DesignAnalysisSectionKey,
        nextSection: DesignStructuredAnalysis[DesignAnalysisSectionKey]
    ) => void;
    onShortcutTemplatePaletteChange?: (palette: DesignStructuredPaletteEntry[]) => void;
    onShortcutTemplateEditInstructionChange?: (instruction: string) => void;
    onShortcutTemplatePrefillInstruction?: (instruction: string, scope?: DesignVariantEditScope) => void;
    onShortcutTemplateApplyEdit?: (scope: DesignVariantEditScope, instructionOverride?: string) => void;
    onShortcutTemplateRestoreVariant?: () => void;
}

export function PlaygroundInputSection({
    showHistory,
    hideTitle,
    config,
    uploadedImages,
    describeImages,
    isStackHovered,
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
    onReorderImages,
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
    activeShortcutName,
    onClearShortcutTemplate,
    shortcutTemplate,
    onShortcutTemplateFieldChange,
    onShortcutTemplateFieldRemove,
    onShortcutTemplateDocumentChange,
    onExitShortcutTemplate,
    onShortcutTemplateOptimize,
    onShortcutTemplateVariantSelect,
    onShortcutTemplateRegenerate,
    onShortcutTemplateGenerateCurrent,
    onShortcutTemplateGenerateAll,
    onShortcutTemplateAnalysisSectionChange,
    onShortcutTemplatePaletteChange,
    onShortcutTemplateEditInstructionChange,
    onShortcutTemplatePrefillInstruction,
    onShortcutTemplateApplyEdit,
    onShortcutTemplateRestoreVariant,
}: PlaygroundInputSectionProps) {
    const aspectRatioPresets = getAspectRatioPresets();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Avoid accidental drags
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const hasStructuredShortcutSession = Boolean(shortcutTemplate?.optimizationSession);
    const isHomeStructuredMode = hasStructuredShortcutSession && !showHistory;
    const handlePrimaryGenerate = hasStructuredShortcutSession
        ? (onShortcutTemplateGenerateAll || handleGenerate)
        : handleGenerate;
    const optimizeButtonLabel = isOptimizing ? "AI自动优化中" : "AI自动优化";
    const canOptimizeShortcutTemplate = !shortcutTemplate || Boolean(onShortcutTemplateOptimize);
    const isOptimizeButtonDisabled = isOptimizing || !canOptimizeShortcutTemplate;
    const optimizationLoadingMessage =
        OPTIMIZATION_LOADING_MESSAGES[Math.min(loadingMessageIndex, OPTIMIZATION_LOADING_MESSAGES.length - 1)];

    const handleOptimizeButtonClick = () => {
        if (isOptimizeButtonDisabled) return;

        if (shortcutTemplate) {
            onShortcutTemplateOptimize?.();
            return;
        }

        handleOptimizePrompt();
    };

    React.useEffect(() => {
        if (!isOptimizing) {
            setLoadingMessageIndex(0);
            return;
        }

        setLoadingMessageIndex(0);

        const intervalId = window.setInterval(() => {
            setLoadingMessageIndex((currentIndex) =>
                currentIndex < OPTIMIZATION_LOADING_MESSAGES.length - 1 ? currentIndex + 1 : currentIndex
            );
        }, shortcutTemplate ? 1400 : 4500);

        return () => window.clearInterval(intervalId);
    }, [isOptimizing, shortcutTemplate]);

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

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setIsStackHovered(true); // Force stack expand when dragging
    };

    // Helper function to get consistent ID for an image
    const getItemId = (img: UploadedImage, index: number) => img.id || img.localId || String(index);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && onReorderImages) {
            // Use consistent ID matching with getItemId
            const oldIndex = uploadedImages.findIndex((item, idx) => getItemId(item, idx) === active.id);
            const newIndex = uploadedImages.findIndex((item, idx) => getItemId(item, idx) === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(uploadedImages, oldIndex, newIndex);
                onReorderImages(newOrder);
            }
        }

        setActiveId(null);
        // We generally leave the stack hovered or let mouse events handle it,
        // but if we dragged out, it might be stuck.
        // Let's rely on standard onMouseLeave to close it if the cursor is not over it.
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const items = uploadedImages.map((img, idx) => getItemId(img, idx));

    return (
        <div className={cn(
            "flex flex-col items-center w-full pointer-events-auto",
            isDescribeMode && showHistory && "h-full"
        )}>
            {!showHistory && !hideTitle && (
                <div className="font-serif">
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
                    "relative z-10 flex items-center bg-black/40 justify-center w-full text-white flex-col rounded-[30px] backdrop-blur-md border border-white/20  p-2 transition-colors duration-100",
                    showHistory ? " bg-gradient-to-br from-[#0F0F15] via-[#0F0F15] to-[#1d2025]  border-[#343434]" : "bg-black/40"
                )}>
                    <div className="flex items-start gap-0 bg-black/60 border border-white/10 rounded-3xl w-full pl-4 relative overflow-visible">
                        {variant !== 'edit' && (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragCancel={handleDragCancel}
                                modifiers={[restrictToWindowEdges]}
                            >
                                <div
                                    className="flex items-center shrink-0 ml-1 h-14 self-start mt-4 mb-4"
                                    onMouseEnter={() => setIsStackHovered(true)}
                                    // Only allow leaving if not currently dragging an item from this list.
                                    // activeId ensures we keep it open while dragging.
                                    onMouseLeave={() => !activeId && setIsStackHovered(false)}
                                >
                                    <SortableContext
                                        items={items}
                                        strategy={horizontalListSortingStrategy}
                                    >
                                        <AnimatePresence initial={false}>
                                            {uploadedImages.map((image, index) => {
                                                const id = getItemId(image, index);
                                                return (
                                                    <SortableStackImage
                                                        key={id}
                                                        id={id}
                                                        image={image}
                                                        index={index}
                                                        isStackHovered={isStackHovered || !!activeId}
                                                        uploadedImagesCount={uploadedImages.length}
                                                        onPreview={setPreviewImage}
                                                        onRemove={removeImage}
                                                        isActive={activeId === id}
                                                        isDraggingAnything={!!activeId}
                                                    />
                                                );
                                            })}
                                        </AnimatePresence>
                                    </SortableContext>

                                    {/* Upload Button - keeps its position logic */}
                                    {!disableImageUpload && (
                                        <motion.button
                                            onClick={() => fileInputRef.current?.click()}
                                            initial={false}
                                            animate={{
                                                rotate: activeId ? 0 : 3,
                                                marginLeft: uploadedImages.length > 0 ? ((isStackHovered || !!activeId) ? 8 : -36) : 0,
                                                scale: 1
                                            }}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            transition={activeId ? { duration: 0 } : { type: "tween", duration: 0.2 }}
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

                                {/* Portal DragOverlay to body to avoid transform pollution from parent containers */}
                                {typeof document !== 'undefined' && createPortal(
                                    <DragOverlay
                                        dropAnimation={{
                                            sideEffects: defaultDropAnimationSideEffects({
                                                styles: {
                                                    active: { opacity: '0.5' },
                                                },
                                            }),
                                        }}
                                    >
                                        {activeId ? (
                                            (() => {
                                                const image = uploadedImages.find((img, idx) => getItemId(img, idx) === activeId);
                                                return image ? <StackImageOverlay image={image} /> : null;
                                            })()
                                        ) : null}
                                    </DragOverlay>,
                                    document.body
                                )}

                            </DndContext>
                        )}

                        <div className={cn(
                            "flex-1 mt-1 flex justify-start gap-2 items-start",
                            hasStructuredShortcutSession ? "overflow-visible py-3 pr-2" : "overflow-hidden"
                        )}>
                            <div className="flex-1 flex flex-col items-start w-full">
                                {variant !== 'edit' && (
                                    <motion.div
                                        className={cn(
                                            "z-10 flex h-6 w-fit min-w-10 max-w-[calc(100%-24px)] items-center justify-center rounded-full",
                                            isOptimizing
                                                ? "relative self-start mb-0 mt-3 ml-2 origin-left px-1"
                                                : "absolute right-3 top-3 origin-right "
                                        )}
                                        initial={false}
                                        layout
                                        animate={{ opacity: 1 }}
                                        transition={{
                                            layout: {
                                                type: "spring",
                                                bounce: 0.4,
                                                duration: 0.6
                                            },
                                            opacity: {
                                                duration: 1,
                                                ease: "easeInOut"
                                            }
                                        }}
                                    >
                                        <Button
                                            type="button"
                                            variant="light"
                                            size="sm"
                                            aria-label={optimizeButtonLabel}
                                            title={optimizeButtonLabel}
                                            className={cn("h-6 w-fit justify-center rounded-full px-0 disabled:opacity-100", isOptimizing && "text-white")}
                                            disabled={isOptimizeButtonDisabled}
                                            onClick={handleOptimizeButtonClick}
                                        >
                                            <motion.div
                                                initial={false}
                                                animate={isOptimizing ? {
                                                    opacity: [1, 0.8, 0.8, 1],
                                                    filter: [
                                                        "drop-shadow(0 0 4px rgba(255, 255, 255, 0.4))",
                                                        "drop-shadow(0 0 18px rgba(255, 255, 255, 0.95))",
                                                        "drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))",
                                                        "drop-shadow(0 0 14px rgba(255, 255, 255, 0.9))",
                                                        "drop-shadow(0 0 4px rgba(255, 255, 255, 0.4))"
                                                    ]
                                                } : {
                                                    opacity: 1,
                                                    filter: "drop-shadow(0 0 6px rgba(255, 255, 255, 0.22))"
                                                }}
                                                transition={isOptimizing ? {
                                                    duration: 1.1,
                                                    repeat: Infinity,
                                                    ease: "easeInOut"
                                                } : {
                                                    duration: 2,
                                                    ease: "easeOut"
                                                }}
                                                className={cn("flex w-auto min-w-8 shrink-0 items-center justify-center overflow-hidden", isOptimizing ? "gap-1.5 px-1.5" : "gap-1 px-2")}
                                            >
                                                <Sparkles className="h-1.5 w-1.5 shrink-0 hover:drop-shadow-[0_0_18px_#ffffff]" />
                                                <span className="shrink-0 text-[14px]">AI</span>
                                                <AnimatePresence initial={false} mode="wait">
                                                    {isOptimizing ? (
                                                        <motion.span
                                                            key={optimizationLoadingMessage}
                                                            aria-live="polite"
                                                            initial="hidden"
                                                            animate="visible"
                                                            exit={{ opacity: 0, x: -6, filter: "blur(4px)", transition: { duration: 0.18, ease: "easeIn" } }}
                                                            variants={{
                                                                hidden: {},
                                                                visible: { transition: { staggerChildren: 0.035 } }
                                                            }}
                                                            className="flex truncate text-[14px] font-medium leading-none text-white/95"
                                                        >
                                                            {optimizationLoadingMessage.split("").map((char, i) => (
                                                                <motion.span
                                                                    key={i}
                                                                    variants={{
                                                                        hidden: { opacity: 0, x: -4, filter: "blur(3px)" },
                                                                        visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.2, ease: "easeOut" } }
                                                                    }}
                                                                >
                                                                    {char === " " ? "\u00A0" : char}
                                                                </motion.span>
                                                            ))}
                                                        </motion.span>
                                                    ) : null}
                                                </AnimatePresence>
                                            </motion.div>
                                        </Button>
                                    </motion.div>
                                )}
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
                                    shortcutTemplate={shortcutTemplate}
                                    onShortcutTemplateFieldChange={onShortcutTemplateFieldChange}
                                    onShortcutTemplateFieldRemove={onShortcutTemplateFieldRemove}
                                    onShortcutTemplateDocumentChange={onShortcutTemplateDocumentChange}
                                    onExitShortcutTemplate={onExitShortcutTemplate}
                                    onShortcutTemplateOptimize={onShortcutTemplateOptimize}
                                    onShortcutTemplateVariantSelect={onShortcutTemplateVariantSelect}
                                    onShortcutTemplateRegenerate={onShortcutTemplateRegenerate}
                                    onShortcutTemplateGenerateCurrent={onShortcutTemplateGenerateCurrent}
                                    onShortcutTemplateGenerateAll={onShortcutTemplateGenerateAll}
                                    onShortcutTemplateAnalysisSectionChange={onShortcutTemplateAnalysisSectionChange}
                                    onShortcutTemplatePaletteChange={onShortcutTemplatePaletteChange}
                                    onShortcutTemplateEditInstructionChange={onShortcutTemplateEditInstructionChange}
                                    onShortcutTemplatePrefillInstruction={onShortcutTemplatePrefillInstruction}
                                    onShortcutTemplateApplyEdit={onShortcutTemplateApplyEdit}
                                    onShortcutTemplateRestoreVariant={onShortcutTemplateRestoreVariant}
                                    isGenerating={isGenerating}
                                    isHomeStructuredMode={isHomeStructuredMode}
                                />
                            </div>
                        </div>

                        {/* 底部模糊遮罩 */}
                        {/* <div
                            className={cn(
                                "absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 rounded-b-3xl z-10",
                                (!hasStructuredShortcutSession && !isInputFocused && config.prompt?.length > 0) ? "opacity-40" : "opacity-0"
                            )}  /> */}

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
                        onGenerate={handlePrimaryGenerate}
                        isGenerating={isGenerating}
                        loadingText="Thinking..."
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
                        activeShortcutName={activeShortcutName}
                        onClearShortcutTemplate={onClearShortcutTemplate}
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

function SortableStackImage(props: {
    id: string;
    image: UploadedImage;
    index: number;
    isStackHovered: boolean;
    uploadedImagesCount: number;
    onPreview: (url: string, id: string) => void;
    onRemove: (index: number) => void;
    isActive: boolean;
    isDraggingAnything: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1, // Hide original when dragging
        zIndex: isDragging ? 999 : (props.uploadedImagesCount - props.index) + 100, // Keep zIndex logic for non-dragging
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="outline-none">
            <StackImage {...props} />
        </div>
    );
}

function StackImage({
    image,
    index,
    isStackHovered,
    onPreview,
    onRemove,
    isDraggingAnything
}: {
    image: UploadedImage;
    index: number;
    isStackHovered: boolean;
    uploadedImagesCount: number;
    onPreview: (url: string, id: string) => void;
    onRemove: (index: number) => void;
    isActive?: boolean;
    isDraggingAnything: boolean;
}) {
    // Use previewUrl (signed URL) as primary source for display
    // path contains storageKey which is not directly accessible
    const finalSrc = image.previewUrl || image.path;
    const rotations = [-6, 4, -2, 3];

    return (
        <motion.div
            initial={false}
            animate={{
                marginLeft: index === 0 ? 0 : (isStackHovered ? 8 : -36),
                rotate: (isDraggingAnything || isStackHovered) ? 0 : rotations[index % rotations.length],
                scale: 1,
            }}
            transition={isDraggingAnything ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
        >
            <div className="relative group cursor-pointer" onClick={() => !image.isUploading && finalSrc && onPreview(finalSrc, `stack-img-${image.id || image.localId}`)}>
                {/* Removed layoutId to prevent flash during reorder */}
                <div className="relative">
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
                            draggable={false} // Prevent native drag
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10" />
                    )}
                    {image.isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <LoadingSpinner size={16} className="text-white" />
                        </div>
                    )}
                </div>
                {!image.isUploading && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                        // Add onPointerDown to stop propagation so DnD doesn't start when clicking remove
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute -top-1 -right-1 bg-white text-black border border-white/40 rounded-full w-4 h-4 flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-100 hover:bg-red-500"
                    >
                        <X className="w-2 h-2" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// Overlay component for dragging look
function StackImageOverlay({ image }: { image: UploadedImage }) {
    return <StackImageOverlayInner image={image} />;
}

function StackImageOverlayInner({ image }: { image: UploadedImage }) {
    const src = useImageSource(image?.path || image?.previewUrl);
    const finalSrc = src || image?.previewUrl;

    if (!image || !finalSrc) return null;

    return (
        <div className="relative">
            <Image
                src={finalSrc}
                alt="Dragging"
                width={56}
                height={56}
                className="w-14 h-14 object-cover rounded-2xl bg-black border border-primary shadow-2xl scale-110 cursor-grabbing"
                unoptimized
            />
        </div>
    );
}
