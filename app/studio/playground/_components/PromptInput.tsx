import React from 'react';
import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { AIModel } from "@studio/playground/_components/hooks/usePromptOptimization";
import { UploadedImage } from '@/lib/playground/types';
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ui/ShinyText";
import {
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from '@/config/playground-shortcuts';
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
  const hasStructuredSession = Boolean(shortcutTemplate?.optimizationSession);
  const useSlateShortcutEditor = Boolean(
    shortcutTemplate
    && !hasStructuredSession
    && shortcutTemplate.shortcut.promptComposerLayout !== 'grid'
    && shortcutTemplate.editorDocument,
  );

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
      setIsStructuredExpanded(true);
      onFocusChange?.(true);
    }

    if (!hasStructuredSession && hadStructuredSessionRef.current) {
      setIsStructuredExpanded(false);
      onFocusChange?.(false);
    }

    hadStructuredSessionRef.current = hasStructuredSession;
  }, [hasStructuredSession, onFocusChange]);

  React.useEffect(() => {
    if (hasStructuredSession && isGenerating && !wasGeneratingRef.current) {
      setIsStructuredExpanded(false);
      onFocusChange?.(false);
    }

    wasGeneratingRef.current = isGenerating;
  }, [hasStructuredSession, isGenerating, onFocusChange]);

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

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isStructuredExpanded &&
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsStructuredExpanded(false);
        onFocusChange?.(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isStructuredExpanded, onFocusChange]);

  const handleStructuredExpand = React.useCallback(() => {
    if (!hasStructuredSession || isStructuredExpanded) {
      return;
    }

    setIsStructuredExpanded(true);
    onFocusChange?.(true);
  }, [hasStructuredSession, isStructuredExpanded, onFocusChange]);

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
    <div className="relative">
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
          "w-full placeholder:text-white/40 bg-transparent max-h-[400px] leading-relaxed tracking-wide p-2 pl-4 pr-16 border-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none resize-none",
          className,
          isOptimizing ? "text-transparent" : "text-white"
        )}
      />
      {isOptimizing && (
        <div className="pointer-events-none absolute inset-0 p-2 pl-4 pr-16 text-sm leading-relaxed tracking-wide whitespace-pre-wrap break-words md:pr-28">
          <ShinyText text={localPrompt} color="#ffffff9b" direction="left" shineColor="rgb(255 255 255)" speed={2} />
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "w-full relative rounded-2xl",
        isDraggingOver && ""
      )}
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
        <div className="relative">
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
          />
          {hasStructuredSession && !isStructuredExpanded ? (
            <>
              {/* <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-2xl bg-gradient-to-t from-[#0d0f13] via-[#0d0f13]/75 to-transparent" /> */}
              <button
                type="button"
                onClick={handleStructuredExpand}
                className="absolute inset-0 z-10 rounded-2xl"
                aria-label="展开结构化输入内容"
              />
            </>
          ) : null}
        </div>
      ) : (
        renderPromptTextarea({})
      )}
    </div>
  );
}
