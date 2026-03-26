'use client';

import React from 'react';
import { Loader2, Pipette, Plus, RefreshCw, Sparkles, X } from 'lucide-react';

import {
  getShortcutRenderableFieldSegments,
  getShortcutRenderablePromptSuffix,
  normalizeShortcutColorValue,
  sanitizeShortcutColorDraft,
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from '@/config/playground-shortcuts';
import {
  DESIGN_ANALYSIS_SECTION_KEYS,
  extractDesignHexMatches,
  formatPaletteWeight,
  normalizeDesignPalette,
  replaceHexColorReferences,
  type DesignVariantEditScope,
  isKvShortcutId,
  type DesignStructuredAnalysis,
  type DesignAnalysisSectionKey,
  type DesignStructuredAnalysisSection,
  type DesignStructuredPaletteEntry,
  type DesignStructuredVariantId,
} from '@/app/studio/playground/_lib/kv-structured-optimization';
import ShinyText from '@/components/ui/ShinyText';
import { cn } from '@/lib/utils';

interface ShortcutPromptComposerProps {
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
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
  onFieldChange: (fieldId: string, value: string) => void;
  onRemoveField: (fieldId: string) => void;
  onExitTemplateMode: () => void;
  onOptimizeTemplate?: () => void;
  onVariantSelect?: (variantId: DesignStructuredVariantId) => void;
  onRegenerateVariants?: () => void;
  onGenerateCurrent?: () => void;
  onGenerateAll?: () => void;
  onAnalysisSectionChange?: (
    sectionKey: DesignAnalysisSectionKey,
    nextSection: DesignStructuredAnalysisSection
  ) => void;
  onPaletteChange?: (palette: DesignStructuredPaletteEntry[]) => void;
  onEditInstructionChange?: (instruction: string) => void;
  onPrefillInstruction?: (instruction: string, scope?: DesignVariantEditScope) => void;
  onApplyEdit?: (scope: DesignVariantEditScope, instructionOverride?: string) => void;
  onRestoreVariant?: () => void;
  isOptimizing?: boolean;
  isGenerating?: boolean;
  isExpanded?: boolean;
  isHomeStructuredMode?: boolean;
}

const ANALYSIS_SECTION_LABELS: Record<DesignAnalysisSectionKey, string> = {
  canvas: '整体风格',
  subject: '主体',
  background: '背景',
  layout: '布局',
  typography: '字体',
};

const QUICK_EDIT_ACTIONS: Array<{ label: string; instruction: string }> = [
  { label: '换主体物', instruction: '请保持主题不变，换一个更有创意、更能表达主题的核心主体物，并让辅助元素围绕它形成故事。' },
  { label: '换场景', instruction: '请保持主题和主体逻辑，但把场景改得更明确、更有空间感，并形成前景、中景、背景关系。' },
  { label: '更有故事', instruction: '请加强主体与辅助元素的互动关系，让画面更有叙事感，不要只是元素罗列。' },
  { label: '减少元素', instruction: '请减少无效元素，保留最关键的主体和辅助元素，让画面更聚焦。' },
  { label: '更强标题', instruction: '请让主标题成为更强的第一视觉重点，并自然带动副标题和时间信息。' },
  { label: '更商业海报', instruction: '请把整体方向调整得更像商业海报，强化主视觉、标题层级和信息抓取效率。' },
  { label: '更生活方式', instruction: '请把整体方向调整得更像生活方式场景，画面更松弛、更真实、更有温度。' },
  { label: '更简洁', instruction: '请保留核心概念，但让构图和元素更简洁，减少噪音，强化重点。' },
];

export const OPTIMIZATION_LOADING_MESSAGES = [
  'Thinking...',
  '正在分析主题...',
  '正在发散创意...',
  '正在构思主体物...',
  'Thinking...',
  '正在加强场景关系...',
  '正在加强叙事性...',
  'Thinking...',
  '正在分析颜色...',
  '正在调整构图...',
  '正在调整字体...',
  'Thinking...',
] as const;

function TokenEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (nextItems: string[]) => void;
}) {
  const normalizedItems = items.length > 0 ? items : [''];

  return (
    <div className="grid grid-cols-2 gap-2">
      {normalizedItems.map((item, index) => {
        const itemHex = extractDesignHexMatches(item)[0];

        return (
          <div
            key={`${label}-${index}`}
            className="inline-flex min-h-7 min-w-[6rem] items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-white"
          >
            {itemHex ? (
              <label className="relative flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center">
                <span
                  className="h-4 w-4 rounded-full border border-white/30"
                  style={{ backgroundColor: normalizeShortcutColorValue(itemHex) || '#1F2937' }}
                />
                <input
                  type="color"
                  tabIndex={-1}
                  value={normalizeShortcutColorValue(itemHex) || '#1F2937'}
                  onChange={(event) => {
                    const nextItems = [...normalizedItems];
                    nextItems[index] = replaceHexColorReferences(
                      nextItems[index],
                      itemHex,
                      event.target.value.toUpperCase(),
                    );
                    onChange(nextItems);
                  }}
                  className="sr-only"
                />
              </label>
            ) : null}
            <input
              value={item}
              onChange={(event) => {
                const nextItems = [...normalizedItems];
                nextItems[index] = event.target.value;
                onChange(nextItems);
              }}
              placeholder="可编辑短语"
              className="min-w-[6rem] flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const nextItems = normalizedItems.filter((_, itemIndex) => itemIndex !== index);
                onChange(nextItems);
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={`删除 ${label} 短语`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SectionColorReferences({
  colors,
  onReplaceColor,
  className,
}: {
  colors: string[];
  onReplaceColor: (previousHex: string, nextHex: string) => void;
  className?: string;
}) {
  if (colors.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {colors.map((hex) => (
        <label
          key={hex}
          className="inline-flex h-7 cursor-pointer items-center gap-2 rounded-md border border-[#E8FFB7]/0 bg-white/10 px-2 text-white transition-colors hover:bg-[#E8FFB7]/12 focus-within:border-[#E8FFB7]/20 focus-within:bg-[#E8FFB7]/18"
        >
          <span className="whitespace-nowrap text-[10px] font-normal text-[#F4FFCE]">
            色值
          </span>
          <span
            className="h-4 w-4 rounded-full border border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            style={{ backgroundColor: normalizeShortcutColorValue(hex) || '#1F2937' }}
          />
          <span className="font-mono text-sm text-white">{hex}</span>
          <input
            type="color"
            tabIndex={-1}
            value={normalizeShortcutColorValue(hex) || '#1F2937'}
            onChange={(event) => onReplaceColor(hex, event.target.value.toUpperCase())}
            className="sr-only"
          />
        </label>
      ))}
    </div>
  );
}

function AnalysisSectionEditor({
  label,
  section,
  onChange,
  onRewrite,
  isRewriting = false,
}: {
  label: string;
  section: DesignStructuredAnalysisSection;
  onChange: (nextSection: DesignStructuredAnalysisSection) => void;
  onRewrite?: () => void;
  isRewriting?: boolean;
}) {
  const sectionColors = React.useMemo(
    () => extractDesignHexMatches([section.detailText, ...section.tokens].join(' ')),
    [section.detailText, section.tokens]
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isRewriting}
            onClick={() => onRewrite?.()}
            className="inline-flex items-center gap-1 rounded-full border border-[#D8FF8E]/20 bg-[#D8FF8E]/10 px-2 py-0.5 text-[10px] text-[#F4FFCE] transition-colors hover:bg-[#D8FF8E]/16 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className={cn('h-3 w-3', isRewriting && 'animate-pulse')} />
            AI重写
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...section, tokens: [...section.tokens, ''] })}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Plus className="h-3 w-3" />
            添加
          </button>
        </div>
      </div>

      <TokenEditor
        label={label}
        items={section.tokens}
        onChange={(nextTokens) => onChange({ ...section, tokens: nextTokens.filter((item, index, array) => item || array.length === 1 || index < array.length - 1) })}
      />

      <div className="mt-2.5">
        <div className="mb-1.5 text-[10px] font-medium text-white/45">
          Detail Text
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-white/78">
          <div className="flex flex-wrap items-start gap-1.5">
            <SectionColorReferences
              colors={sectionColors}
              onReplaceColor={(previousHex, nextHex) => onChange({
                ...section,
                tokens: section.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
                detailText: replaceHexColorReferences(section.detailText, previousHex, nextHex),
              })}
            />
            <textarea
              value={section.detailText}
              onChange={(event) => onChange({ ...section, detailText: event.target.value })}
              placeholder="保留高细节来源分析 prose"
              rows={3}
              className="min-h-[5.5rem] min-w-[14rem] flex-1 resize-y bg-transparent text-xs leading-5 text-white outline-none placeholder:text-white/35"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaletteEditor({
  palette,
  onChange,
}: {
  palette: DesignStructuredPaletteEntry[];
  onChange: (nextPalette: DesignStructuredPaletteEntry[]) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{
    index: number;
    startY: number;
    startWeights: number[];
  } | null>(null);
  const rows = React.useMemo(() => normalizeDesignPalette(palette), [palette]);
  const weightValues = React.useMemo(
    () => rows.map((entry) => Number(entry.weight.replace('%', '')) || 0),
    [rows]
  );

  const updateWeightsAtIndex = React.useCallback((index: number, clientY: number) => {
    const dragState = dragStateRef.current;
    const container = containerRef.current;

    if (!dragState || !container) {
      return;
    }

    const containerHeight = container.getBoundingClientRect().height;
    if (!containerHeight) {
      return;
    }

    const deltaWeight = ((clientY - dragState.startY) / containerHeight) * 100;
    const pairTotal = (dragState.startWeights[index] ?? 0) + (dragState.startWeights[index + 1] ?? 0);
    const minWeight = 6;
    const nextWeights = [...dragState.startWeights];
    const nextFirst = Math.min(
      pairTotal - minWeight,
      Math.max(minWeight, (dragState.startWeights[index] ?? 0) + deltaWeight),
    );

    nextWeights[index] = nextFirst;
    nextWeights[index + 1] = Math.max(minWeight, pairTotal - nextFirst);

    onChange(rows.map((entry, entryIndex) => ({
      hex: entry.hex,
      weight: formatPaletteWeight(nextWeights[entryIndex] ?? 0),
    })));
  }, [onChange, rows]);

  const handleDragStart = React.useCallback((index: number, clientY: number) => {
    dragStateRef.current = {
      index,
      startY: clientY,
      startWeights: weightValues,
    };

    const handlePointerMove = (event: MouseEvent) => {
      updateWeightsAtIndex(index, event.clientY);
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  }, [updateWeightsAtIndex, weightValues]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium  text-white/55">
          色板
        </span>
        <span className="text-[11px] text-white/45">拖动色块分隔线调整比例</span>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-md h-[320px] border border-white/10 bg-black/10"
      >
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/45">
            颜色会从分析文本和 Prompt 中自动提取
          </div>
        ) : null}
        {rows.map((entry, index) => (
          <div
            key={`palette-${index}`}
            className="group relative"
            style={{
              backgroundColor: normalizeShortcutColorValue(entry.hex) || '#1F2937',
              height: `${weightValues[index] || 0}%`,
              minHeight: 44,
            }}
          >
            <div className="absolute left-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-full bg-black/30 px-2 py-1 text-[11px] text-white/90 backdrop-blur-sm">
                {entry.hex}
              </span>
            </div>

            <label className="absolute right-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-black/30 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <Pipette className="h-3.5 w-3.5 text-white/90" />
              <input
                type="color"
                tabIndex={-1}
                value={normalizeShortcutColorValue(entry.hex) || '#1F2937'}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...entry, hex: event.target.value.toUpperCase() };
                  onChange(next);
                }}
                className="sr-only"
              />
            </label>

            {/* <div className="absolute bottom-3 right-3 text-[11px] font-medium text-black/55 mix-blend-multiply opacity-0 transition-opacity group-hover:opacity-100">
              {entry.weight}
            </div> */}

            {index < rows.length - 1 ? (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleDragStart(index, event.clientY);
                }}
                className="absolute inset-x-0 bottom-0 z-20 flex h-3 cursor-row-resize items-center justify-center bg-transparent opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`调整第 ${index + 1} 个色块比例`}
              >
                <span className="h-1 w-16 rounded-full bg-black/60 backdrop-blur-sm" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShortcutPromptComposer({
  shortcut,
  values,
  removedFieldIds,
  optimizationSession,
  onFieldChange,
  onRemoveField,
  onOptimizeTemplate,
  onVariantSelect,
  onRegenerateVariants,
  onGenerateCurrent,
  onAnalysisSectionChange,
  onPaletteChange,
  onEditInstructionChange,
  onPrefillInstruction,
  onApplyEdit,
  onRestoreVariant,
  isOptimizing = false,
  isGenerating = false,
  isExpanded = true,
  isHomeStructuredMode = false,
}: ShortcutPromptComposerProps) {
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const colorPickerRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusFieldIdRef = React.useRef<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = React.useState(0);
  const visibleSegments = React.useMemo(
    () => getShortcutRenderableFieldSegments(shortcut, values, { removedFieldIds }),
    [removedFieldIds, shortcut, values]
  );
  const promptSuffix = React.useMemo(
    () => getShortcutRenderablePromptSuffix(shortcut, values, { removedFieldIds }),
    [removedFieldIds, shortcut, values]
  );
  const visibleFieldIds = React.useMemo(
    () => visibleSegments.map((segment) => segment.field.id),
    [visibleSegments]
  );
  const initialFieldId = React.useMemo(
    () => visibleSegments.find((segment) => segment.field.required)?.field.id || visibleSegments[0]?.field.id || null,
    [visibleSegments]
  );
  const activeVariant = React.useMemo(
    () => optimizationSession?.variants.find((variant) => variant.id === optimizationSession.activeVariantId) || null,
    [optimizationSession]
  );
  const isAnyVariantModifying = React.useMemo(
    () => optimizationSession?.variants.some((variant) => variant.isModifying) || false,
    [optimizationSession]
  );
  const canUseStructuredOptimization = isKvShortcutId(shortcut.id);
  const isStructuredSession = Boolean(optimizationSession);
  const optimizationLoadingMessage =
    OPTIMIZATION_LOADING_MESSAGES[Math.min(loadingMessageIndex, OPTIMIZATION_LOADING_MESSAGES.length - 1)];
  const inlinePromptShinyText = React.useMemo(
    () =>
      `${visibleSegments
        .map(({ field, prefixText }) => {
          const fieldValue = values[field.id] || field.placeholder || '';
          return `${prefixText || ''}${field.type === 'color' ? fieldValue.toUpperCase() : fieldValue}`;
        })
        .join('')}${promptSuffix || ''}`,
    [promptSuffix, values, visibleSegments]
  );

  React.useEffect(() => {
    if (!initialFieldId) {
      return;
    }
    inputRefs.current[initialFieldId]?.focus();
  }, [initialFieldId, shortcut.id]);

  React.useEffect(() => {
    const pendingFocusFieldId = pendingFocusFieldIdRef.current;
    if (!pendingFocusFieldId) {
      return;
    }

    const target = inputRefs.current[pendingFocusFieldId];
    if (target) {
      target.focus();
    }
    pendingFocusFieldIdRef.current = null;
  }, [visibleFieldIds]);

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
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [isOptimizing]);

  const inlinePromptEditor = (
    <div className="relative min-h-[80px]">
      <div
        className={cn(
          'flex min-h-[80px] flex-wrap items-center gap-x-1 gap-y-2 text-sm leading-7 text-white/70 transition-opacity',
          isOptimizing && 'opacity-45'
        )}
      >
        {visibleSegments.length === 0 ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
            所有 inline token 已删除，可继续补充分析内容或直接生成。
          </span>
        ) : (
          visibleSegments.map((segment, index) => {
            const { field, prefixText } = segment;
            const nextFieldId = visibleSegments[index + 1]?.field.id || visibleSegments[index - 1]?.field.id || null;

            return (
              <React.Fragment key={`field-${shortcut.id}-${field.id}-${index}`}>
                {prefixText ? <span className="whitespace-pre-wrap">{prefixText}</span> : null}
                <label
                  className={cn(
                    'inline-flex h-7 items-center gap-2 rounded-md border border-[#E8FFB7]/0 bg-white/10 px-2 text-white transition-colors focus-within:border-[#E8FFB7]/20 focus-within:bg-[#E8FFB7]/18',
                    field.widthClassName
                  )}
                >
                  <span className="whitespace-nowrap text-[10px] font-normal text-[#F4FFCE]">
                    {field.label}
                  </span>
                  {field.type === 'color' ? (
                    <div className="flex flex-1 items-center gap-2">
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => colorPickerRefs.current[field.id]?.click()}
                        className="h-4 w-4 shrink-0 rounded-sm border border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                        style={{ backgroundColor: normalizeShortcutColorValue(values[field.id]) || '#FF6B00' }}
                        aria-label={`选择 ${field.label}`}
                      />
                      <div className="relative flex min-w-[5rem] flex-1 items-center">
                        <input
                          ref={(node) => {
                            inputRefs.current[field.id] = node;
                          }}
                          value={values[field.id] || ''}
                          onChange={(event) => onFieldChange(field.id, sanitizeShortcutColorDraft(event.target.value))}
                          placeholder={field.placeholder}
                          spellCheck={false}
                          autoCapitalize="off"
                          autoCorrect="off"
                          className="absolute inset-0 w-full bg-transparent text-sm uppercase text-white outline-none placeholder:text-white/35"
                        />
                        <span className="invisible whitespace-pre text-sm uppercase">
                          {values[field.id] || field.placeholder || ''}
                        </span>
                      </div>
                      <input
                        ref={(node) => {
                          colorPickerRefs.current[field.id] = node;
                        }}
                        type="color"
                        tabIndex={-1}
                        value={normalizeShortcutColorValue(values[field.id]) || '#FF6B00'}
                        onChange={(event) => onFieldChange(field.id, event.target.value.toUpperCase())}
                        className="sr-only"
                      />
                    </div>
                  ) : (
                    <div className="relative flex min-w-[5rem] flex-1 items-center">
                      <input
                        ref={(node) => {
                          inputRefs.current[field.id] = node;
                        }}
                        value={values[field.id] || ''}
                        onChange={(event) => onFieldChange(field.id, event.target.value)}
                        placeholder={field.placeholder}
                        className="absolute inset-0 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                      />
                      <span className="invisible whitespace-pre text-sm">
                        {values[field.id] || field.placeholder || ''}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      pendingFocusFieldIdRef.current = nextFieldId;
                      onRemoveField(field.id);
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[#F4FFCE]/65 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={`删除 ${field.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </label>
              </React.Fragment>
            );
          })
        )}
        {promptSuffix ? <span className="whitespace-pre-wrap">{promptSuffix}</span> : null}
      </div>
      {isOptimizing && inlinePromptShinyText ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden text-sm leading-7 whitespace-pre-wrap break-words">
          <ShinyText
            text={inlinePromptShinyText}
            color="#ffffff85"
            direction="left"
            shineColor="rgb(255 255 255)"
            speed={2}
            className="whitespace-pre-wrap break-words"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3 p-2 pl-4',
        isStructuredSession
          ? isExpanded
            ? cn(
              'overflow-y-auto pb-2 pr-4',
              isHomeStructuredMode ? 'max-h-[68vh] md:max-h-[72vh]' : 'max-h-[56vh] md:max-h-[62vh]'
            )
            : 'max-h-[96px] overflow-hidden pb-2 pr-4'
          : 'pb-4 pr-10'
      )}
    >
      {optimizationSession ? (
        <div className="relative rounded-2xl border border-white/10 bg-transparent p-3">
          {inlinePromptEditor}
          <button
            type="button"
            disabled={isOptimizing || isAnyVariantModifying}
            onClick={() => onRegenerateVariants?.()}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/30  px-3 py-1 text-[12px] text-white transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', isOptimizing && 'animate-spin')} />
            重新请求
          </button>
        </div>
      ) : null}

      {optimizationSession ? (
        <div className="flex flex-col mt-4 gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {optimizationSession.variants.map((variant) => {
              const isActive = variant.id === optimizationSession.activeVariantId;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={isAnyVariantModifying}
                  onClick={() => onVariantSelect?.(variant.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    isActive
                      ? 'border-[#D8FF8E]/20 bg-white/10 text-[#F4FFCE]'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {variant.id.toUpperCase()} {variant.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={isGenerating || isAnyVariantModifying}
            onClick={() => onGenerateCurrent?.()}
            className="inline-flex items-center justify-center gap-1 self-start rounded-md border border-[#D8FF8E]/25 bg-[#D8FF8E]/10 px-3 py-1 text-[11px] text-[#F4FFCE] transition-colors hover:bg-[#D8FF8E]/16 disabled:cursor-not-allowed disabled:opacity-50 md:self-auto"
          >
            生成当前方案
          </button>
        </div>
      ) : null}

      {!optimizationSession ? inlinePromptEditor : null}

      {activeVariant ? (
        <details className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/78" open>
          <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
            最终 Prompt 预览
          </summary>
          <div className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-white/82 pr-2">
            {activeVariant.promptPreview}
          </div>
        </details>
      ) : null}

      {/* 快捷入口 */}
      {/* {activeVariant ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
              快捷修改
            </span>
            <button
              type="button"
              disabled={isAnyVariantModifying}
              onClick={() => onRestoreVariant?.()}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              恢复原版
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_EDIT_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onPrefillInstruction?.(action.instruction, 'variant')}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {action.label}
              </button>
            ))}
          </div>

          <textarea
            value={activeVariant.pendingInstruction}
            onChange={(event) => onEditInstructionChange?.(event.target.value)}
            placeholder="例如：把主体改成超大账本，背景更像真实桌面，标题更突出"
            rows={3}
            className="w-full resize-y rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/35"
          />

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={activeVariant.isModifying || !activeVariant.pendingInstruction.trim()}
              onClick={() => onApplyEdit?.(activeVariant.pendingScope)}
              className="inline-flex items-center gap-1 rounded-full border border-[#D8FF8E]/25 bg-[#D8FF8E]/10 px-3 py-1 text-[11px] text-[#F4FFCE] transition-colors hover:bg-[#D8FF8E]/16 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className={cn('h-3 w-3', activeVariant.isModifying && 'animate-pulse')} />
              {activeVariant.isModifying ? '修改中...' : '应用修改'}
            </button>
          </div>
        </div>
      ) : null} */}

      {activeVariant ? (
        <div className="grid gap-2.5 md:grid-cols-2">
          <PaletteEditor
            palette={activeVariant.palette}
            onChange={(nextPalette) => onPaletteChange?.(nextPalette.filter((entry) => entry.hex || entry.weight))}
          />
          {DESIGN_ANALYSIS_SECTION_KEYS.map((sectionKey) => (
            <AnalysisSectionEditor
              key={sectionKey}
              label={ANALYSIS_SECTION_LABELS[sectionKey]}
              section={activeVariant.analysis[sectionKey]}
              onChange={(nextSection) => onAnalysisSectionChange?.(sectionKey, nextSection)}
              onRewrite={() => onApplyEdit?.(sectionKey, activeVariant.pendingInstruction.trim() || undefined)}
              isRewriting={activeVariant.isModifying}
            />
          ))}
        </div>
      ) : null}

      {!optimizationSession && canUseStructuredOptimization ? (
        <div className="z-300 flex flex-wrap items-center justify-start gap-2">
          <button
            type="button"
            onClick={() => onOptimizeTemplate?.()}
            disabled={isOptimizing}
            className="inline-flex items-center gap-1 rounded-md border font-bold border-[#D8FF8E]/25 bg-white px-3 py-1 text-[12px] text-black transition-colors hover:bg-[#D8FF8E]/16 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isOptimizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {isOptimizing ? (
              <ShinyText
                text="优化中..."
                speed={1.8}
                color="#111111"
                shineColor="#8FC8FF"
                spread={135}
                className="leading-none"
              />
            ) : (
              'AI自动优化'
            )}
          </button>
          {isOptimizing ? (
            <span aria-live="polite" className="text-[12px] font-medium text-[#D8FF8E]">
              {optimizationLoadingMessage}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
