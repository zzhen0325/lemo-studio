import React from 'react';
import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { AIModel } from "@studio/playground/_components/hooks/usePromptOptimization";
import { UploadedImage } from '@/lib/playground/types';
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ui/ShinyText";
import {
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from '@/config/moodboard-cards';
import type {
  DesignStructuredAnalysis,
  DesignAnalysisSectionKey,
  DesignStructuredPaletteEntry,
  DesignVariantEditScope,
  DesignStructuredVariantId,
} from '@/app/studio/playground/_lib/kv-structured-optimization';
import type { ShortcutEditorDocument } from '@/app/studio/playground/_lib/shortcut-editor-document';
import {
  ShortcutPromptComposer,
} from '@studio/playground/_components/ShortcutPromptComposer';
import { ShortcutSlateEditor } from '@studio/playground/_components/ShortcutSlateEditor';
import { useDebounce } from '@/hooks/common/use-debounce';


interface PromptInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  uploadedImages: UploadedImage[];
  onRemoveImage: (index: number) => void;
  isOptimizing: boolean;
  onOptimize: () => void;
  selectedAIModel: AIModel;
  onAIModelChange: (model: AIModel) => void;
  onAddImages: (files: File[] | FileList) => void;
  isPresetGridOpen?: boolean;
  onTogglePresetGrid?: () => void;
  onFocusChange?: (focused: boolean) => void;
  onStructuredExpandedChange?: (expanded: boolean) => void;
  isDraggingOver?: boolean;
  onDraggingOverChange?: (isDragging: boolean) => void;
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
  isGenerating?: boolean;
  isHomeStructuredMode?: boolean;
}

export default function PromptInput({
  prompt,
  onPromptChange,
  onAddImages,
  onFocusChange,
  onStructuredExpandedChange,
  isDraggingOver,
  onDraggingOverChange,
  isOptimizing,
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
  isGenerating = false,
  isHomeStructuredMode = false,
}: PromptInputProps) {
  const [localPrompt, setLocalPrompt] = React.useState(prompt);
  const debouncedPrompt = useDebounce(localPrompt, 100);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isStructuredExpanded, setIsStructuredExpanded] = React.useState(false);
  const lastSyncPrompt = React.useRef(prompt);
  const hadStructuredSessionRef = React.useRef(false);
  const wasGeneratingRef = React.useRef(false);
  const isFocusWithinRef = React.useRef(false);
  const deferredBlurTimerRef = React.useRef<number | null>(null);
  const hasStructuredSession = Boolean(shortcutTemplate?.optimizationSession);
  const useSlateShortcutEditor = Boolean(
    shortcutTemplate
    && !hasStructuredSession
    && shortcutTemplate.shortcut.promptComposerLayout !== 'grid'
    && shortcutTemplate.editorDocument,
  );
  const shouldClampStructuredCollapsedHeight = hasStructuredSession && !isFocused;
  const setStructuredExpanded = React.useCallback((expanded: boolean) => {
    setIsStructuredExpanded(expanded);
    onStructuredExpandedChange?.(expanded);
  }, [onStructuredExpandedChange]);

  // 当外部 prompt 变更时（例如 AI 优化），如果不是我们自己发出的变更，则同步到本地
  React.useEffect(() => {
    if (prompt !== lastSyncPrompt.current) {
      setLocalPrompt(prompt);
      lastSyncPrompt.current = prompt;
    }
  }, [prompt]);

  // 当防抖后的本地状态变更时，回传给父组件并更新同步记录
  React.useEffect(() => {
    if (debouncedPrompt !== lastSyncPrompt.current) {
      lastSyncPrompt.current = debouncedPrompt;
      onPromptChange(debouncedPrompt);
    }
  }, [debouncedPrompt, onPromptChange]);

  React.useEffect(() => {
    if (hasStructuredSession && !hadStructuredSessionRef.current) {
      setStructuredExpanded(false);
      setIsFocused(true);
      isFocusWithinRef.current = true;
      onFocusChange?.(true);
    }

    if (!hasStructuredSession && hadStructuredSessionRef.current) {
      setStructuredExpanded(false);
      setIsFocused(false);
      isFocusWithinRef.current = false;
      onFocusChange?.(false);
    }

    hadStructuredSessionRef.current = hasStructuredSession;
  }, [hasStructuredSession, onFocusChange, setStructuredExpanded]);

  React.useEffect(() => {
    if (hasStructuredSession && isGenerating && !wasGeneratingRef.current) {
      setStructuredExpanded(false);
      setIsFocused(false);
      isFocusWithinRef.current = false;
      onFocusChange?.(false);
    }

    wasGeneratingRef.current = isGenerating;
  }, [hasStructuredSession, isGenerating, onFocusChange, setStructuredExpanded]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalPrompt(val);
    // Remove immediate onPromptChange to fix input lag caused by parent re-renders
    // onPromptChange(val); 
  };

  const handleBlur = () => {
    setIsFocused(false);
    // 强制进行一次最终同步
    if (localPrompt !== prompt) {
      onPromptChange(localPrompt);
      lastSyncPrompt.current = localPrompt;
    }
  };

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const clearDeferredBlurTimer = React.useCallback(() => {
    if (deferredBlurTimerRef.current !== null) {
      window.clearTimeout(deferredBlurTimerRef.current);
      deferredBlurTimerRef.current = null;
    }
  }, []);

  const handleWrapperFocusCapture = React.useCallback(() => {
    clearDeferredBlurTimer();
    setIsFocused(true);

    if (isFocusWithinRef.current) {
      return;
    }

    isFocusWithinRef.current = true;
    onFocusChange?.(true);
  }, [clearDeferredBlurTimer, onFocusChange]);

  const handleWrapperMouseDownCapture = React.useCallback(() => {
    clearDeferredBlurTimer();

    if (!hasStructuredSession) {
      return;
    }

    setIsFocused(true);

    if (!isFocusWithinRef.current) {
      isFocusWithinRef.current = true;
      onFocusChange?.(true);
    }
  }, [clearDeferredBlurTimer, hasStructuredSession, onFocusChange]);

  const handleWrapperBlurCapture = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocusedNode = event.relatedTarget as Node | null;
    if (nextFocusedNode && wrapperRef.current?.contains(nextFocusedNode)) {
      return;
    }

    isFocusWithinRef.current = false;
    if (hasStructuredSession) {
      clearDeferredBlurTimer();
      deferredBlurTimerRef.current = window.setTimeout(() => {
        deferredBlurTimerRef.current = null;
        setIsFocused(false);
        onFocusChange?.(false);
      }, 0);
      return;
    }

    setIsFocused(false);
    onFocusChange?.(false);
  }, [clearDeferredBlurTimer, hasStructuredSession, onFocusChange]);

  React.useEffect(() => {
    if (!hasStructuredSession) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (wrapperRef.current?.contains(target)) {
        return;
      }

      clearDeferredBlurTimer();
      setIsFocused(false);

      if (isFocusWithinRef.current) {
        isFocusWithinRef.current = false;
        onFocusChange?.(false);
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [clearDeferredBlurTimer, hasStructuredSession, onFocusChange]);

  React.useEffect(() => {
    return () => {
      clearDeferredBlurTimer();
    };
  }, [clearDeferredBlurTimer]);

  const handleShortcutSlateFieldChange = React.useCallback((fieldId: string, value: string) => {
    onShortcutTemplateFieldChange?.(fieldId, value);
  }, [onShortcutTemplateFieldChange]);

  const handleShortcutSlateDocumentChange = React.useCallback((nextDocument: ShortcutEditorDocument) => {
    onShortcutTemplateDocumentChange?.(nextDocument);
  }, [onShortcutTemplateDocumentChange]);

  const renderPromptTextarea = ({
    ariaLabel = 'Prompt',
    placeholder = "请描述您想要生成的图像，例如：黄色的lemo圣诞老人，淡蓝色的背景",
    minHeight = 86,
    collapsedMaxHeight = 86,
    className,
  }: {
    ariaLabel?: string;
    placeholder?: string;
    minHeight?: number;
    collapsedMaxHeight?: number;
    className?: string;
  }) => (
    <div className="relative w-full h-full flex flex-col justify-center">
      <AutosizeTextarea
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={localPrompt}
        onFocus={() => {
          setIsFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          handleBlur();
          onFocusChange?.(false);
        }}
        minHeight={minHeight}
        maxHeight={isFocused ? undefined : collapsedMaxHeight}
        onChange={handleChange}
        onPaste={(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          const files: File[] = [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.kind === 'file' && it.type.startsWith('image/')) {
              const f = it.getAsFile();
              if (f) files.push(f);
            }
          }
          if (files.length > 0) {
            // 阻止默认粘贴文本行为，只处理图片
            e.preventDefault();
            onAddImages(files);
          }
        }}
        className={cn(
          "w-full placeholder:text-white/40 bg-transparent max-h-[400px] leading-relaxed   p-2 pl-4 pr-12    break-words border-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none resize-none",
          className,
          isOptimizing ? "text-transparent" : "text-white"
        )}
      />
      {isOptimizing && (
        <div className="pointer-events-none absolute inset-0 p-2 pl-4  pr-4 text-xs leading-relaxed  whitespace-pre-wrap break-words">
          <ShinyText text={localPrompt} color="#FFFFFF7C" direction="left" shineColor="rgb(255 255 255)" speed={2} />
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "w-full h-full relative rounded-2xl flex flex-col justify-center",
        isDraggingOver && ""
      )}
      onMouseDownCapture={handleWrapperMouseDownCapture}
      onFocusCapture={handleWrapperFocusCapture}
      onBlurCapture={handleWrapperBlurCapture}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDraggingOverChange?.(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) onAddImages(files);
      }}
    >
      {useSlateShortcutEditor && shortcutTemplate?.editorDocument ? (
        <ShortcutSlateEditor
          shortcut={shortcutTemplate.shortcut}
          values={shortcutTemplate.values}
          document={shortcutTemplate.editorDocument}
          onFieldChange={handleShortcutSlateFieldChange}
          onDocumentChange={handleShortcutSlateDocumentChange}
          onFocusChange={onFocusChange}
        />
      ) : shortcutTemplate ? (
        <div
          data-testid={hasStructuredSession ? 'structured-prompt-container' : undefined}
          className={cn(
            "relative",
            hasStructuredSession && !isStructuredExpanded && "transition-[max-height] duration-200",
            shouldClampStructuredCollapsedHeight && "max-h-[86px] overflow-hidden",
          )}
        >
          <ShortcutPromptComposer
            shortcut={shortcutTemplate.shortcut}
            values={shortcutTemplate.values}
            removedFieldIds={shortcutTemplate.removedFieldIds}
            optimizationSession={shortcutTemplate.optimizationSession}
            onFieldChange={(fieldId, value) => onShortcutTemplateFieldChange?.(fieldId, value)}
            onRemoveField={(fieldId) => onShortcutTemplateFieldRemove?.(fieldId)}
            onExitTemplateMode={() => onExitShortcutTemplate?.()}
            onOptimizeTemplate={() => onShortcutTemplateOptimize?.()}
            onVariantSelect={(variantId) => onShortcutTemplateVariantSelect?.(variantId)}
            onRegenerateVariants={() => onShortcutTemplateRegenerate?.()}
            onGenerateCurrent={() => onShortcutTemplateGenerateCurrent?.()}
            onGenerateAll={() => onShortcutTemplateGenerateAll?.()}
            onAnalysisSectionChange={(sectionKey, nextSection) => onShortcutTemplateAnalysisSectionChange?.(sectionKey, nextSection)}
            onPaletteChange={(palette) => onShortcutTemplatePaletteChange?.(palette)}
            onEditInstructionChange={(instruction) => onShortcutTemplateEditInstructionChange?.(instruction)}
            onPrefillInstruction={(instruction, scope) => onShortcutTemplatePrefillInstruction?.(instruction, scope)}
            onApplyEdit={(scope, instructionOverride) => onShortcutTemplateApplyEdit?.(scope, instructionOverride)}
            onRestoreVariant={() => onShortcutTemplateRestoreVariant?.()}
            isOptimizing={isOptimizing}
            isGenerating={isGenerating}
            isExpanded={!hasStructuredSession || isStructuredExpanded}
            isHomeStructuredMode={isHomeStructuredMode}
            onRequestExpand={() => {
              setStructuredExpanded(true);
              onFocusChange?.(true);
            }}
            onRequestCollapse={() => {
              setStructuredExpanded(false);
              onFocusChange?.(false);
            }}
          />
        </div>
      ) : (
        renderPromptTextarea({})
      )}
    </div>
  );
}
