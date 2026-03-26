"use client";


import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import NextImage from "next/image";
import { useToast } from "@/hooks/common/use-toast";

import { usePromptOptimization, AIModel } from "@studio/playground/_components/hooks/usePromptOptimization";
import { useGenerationService, type GenerateOptions } from "@studio/playground/_components/hooks/useGenerationService";
import { useResultModalState } from "@studio/playground/_components/containers/hooks/useResultModalState";
import { useHistory } from "@studio/playground/_components/hooks/useHistory";
import { useHistoryDragTransfer } from "@studio/playground/_components/hooks/useHistoryDragTransfer";
import { useAIService as useAIServiceV1 } from "@/hooks/ai/useAIService";

import { GoogleApiStatus } from "@studio/playground/_components/GoogleApiStatus";
import SimpleImagePreview from "@studio/playground/_components/SimpleImagePreview";
import HistoryList from "@studio/playground/_components/HistoryList";
import ImagePreviewModal from "@studio/playground/_components/Dialogs/ImagePreviewModal";
import FluxKleinConnectionHelpDialog from "@studio/playground/_components/Dialogs/FluxKleinConnectionHelpDialog";
import WorkflowSelectorDialog from "@studio/playground/_components/Dialogs/WorkflowSelectorDialog";
import BaseModelSelectorDialog from "@studio/playground/_components/Dialogs/BaseModelSelectorDialog";
import LoraSelectorDialog from "@studio/playground/_components/Dialogs/LoraSelectorDialog";
import { PresetManagerDialog } from "@studio/playground/_components/Dialogs/PresetManagerDialog";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import type { UIComponent } from "@/types/features/mapping-editor";
import {
  VISION_DESCRIBE_SYSTEM_PROMPT,
  type GenerationConfig,
  type UploadedImage,
  type PresetExtended,
  type EditPresetConfig,
  type SelectedLora,
} from "@/lib/playground/types";
import type { Generation } from "@/types/database";
import { downloadImage } from '@/lib/utils/download';
import { ImageEditDialog, type ImageEditConfirmPayload, type ImageEditorSessionSnapshot } from '@/components/image-editor';

import { cn } from "@/lib/utils";
import { getApiBase, formatImageUrl } from "@/lib/api-base";
import { MODEL_ID_FLUX_KLEIN, MODEL_ID_WORKFLOW } from "@/lib/constants/models";
import { isWorkflowModel } from "@/lib/utils/model-utils";
import { Image as ImageIcon, Palette } from "lucide-react";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { useAPIConfigStore } from "@/lib/store/api-config-store";
import { useMediaQuery } from "@/hooks/common/use-media-query";
import { PresetGridOverlay } from "@studio/playground/_components/PresetGridOverlay";
import { PlaygroundBackground } from "@studio/playground/_components/PlaygroundBackground";
import { PlaygroundInputSection } from "@studio/playground/_components/PlaygroundInputSection";
import { AR_MAP } from "@studio/playground/_components/constants/aspect-ratio";
import { StylesMarquee } from "@studio/playground/_components/StylesMarquee";
import { PlaygroundDockSidebar } from "@studio/playground/_components/containers/components/PlaygroundDockSidebar";
import { PlaygroundHomeActions } from "@studio/playground/_components/containers/components/PlaygroundHomeActions";
import { PlaygroundDockPanels } from "@studio/playground/_components/containers/components/PlaygroundDockPanels";
import { v4 as uuidv4 } from 'uuid';
import {
  buildShortcutPrompt,
  createShortcutPromptValues,
  getShortcutMissingFields,
  getShortcutMoodboardId,
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from "@/config/playground-shortcuts";
import {
  assembleDesignStructuredShortcutPrompt,
  buildDesignSectionDetailSyncInstruction,
  buildKvStructuredOptimizationInput,
  DESIGN_VARIANT_EDIT_MODE,
  derivePaletteFromVariantContent,
  getKvShortcutMarket,
  KV_CORE_FIELD_IDS,
  KV_STRUCTURED_VARIANT_IDS,
  normalizeDesignPalette,
  isKvShortcutId,
  parseDesignStructuredOptimizationResponse,
  parseDesignStructuredVariantEditResponse,
  replaceHexColorReferences,
  replacePaletteWeightReferences,
  type DesignStructuredAnalysis,
  type DesignAnalysisSectionKey,
  type DesignStructuredPaletteEntry,
  type DesignStructuredSourceType,
  type DesignVariantEditScope,
  type KvCoreFieldId,
  type KvStructuredVariantId,
} from "@/app/studio/playground/_lib/kv-structured-optimization";


import gsap from "gsap";
import { Flip } from "gsap/all";
import { useGSAP } from "@gsap/react";
import { observer } from "mobx-react-lite";
import { userStore } from "@/lib/store/user-store";
import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

gsap.registerPlugin(Flip, useGSAP);

export interface PlaygroundV2PageProps {
  onEditMapping?: (workflow: IViewComfy) => void;
  onGenerate?: () => void;
  onHistoryChange?: (history: Generation[]) => void;

}

interface BannerSessionHistoryItem {
  id: string;
  outputUrl: string;
  createdAt: string;
  templateId: string;
}

interface ShortcutOptimizationVariantBaseline {
  label: string;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  coreSuggestions: ShortcutPromptValues;
  palette: DesignStructuredPaletteEntry[];
  analysis: DesignStructuredAnalysis;
  promptPreview: string;
}

interface ShortcutOptimizationVariantDraft {
  id: KvStructuredVariantId;
  label: string;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  coreSuggestions: ShortcutPromptValues;
  palette: DesignStructuredPaletteEntry[];
  analysis: DesignStructuredAnalysis;
  promptPreview: string;
  baseline: ShortcutOptimizationVariantBaseline;
  pendingInstruction: string;
  pendingScope: DesignVariantEditScope;
  isModifying: boolean;
}

interface ShortcutOptimizationSession {
  sourceType: DesignStructuredSourceType;
  originValues: ShortcutPromptValues;
  originRemovedFieldIds: string[];
  activeVariantId: KvStructuredVariantId;
  variants: ShortcutOptimizationVariantDraft[];
  lastRawResponse: string;
}

interface ActiveShortcutTemplate {
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  appliedPrompt: string;
  optimizationSession?: ShortcutOptimizationSession;
}

function cloneShortcutValues(values: ShortcutPromptValues): ShortcutPromptValues {
  return { ...values };
}

function cloneDesignPalette(palette: DesignStructuredPaletteEntry[]) {
  return palette.map((entry) => ({ ...entry }));
}

function cloneDesignAnalysis(analysis: DesignStructuredAnalysis): DesignStructuredAnalysis {
  return {
    canvas: { tokens: [...analysis.canvas.tokens], detailText: analysis.canvas.detailText },
    subject: { tokens: [...analysis.subject.tokens], detailText: analysis.subject.detailText },
    background: { tokens: [...analysis.background.tokens], detailText: analysis.background.detailText },
    layout: { tokens: [...analysis.layout.tokens], detailText: analysis.layout.detailText },
    typography: { tokens: [...analysis.typography.tokens], detailText: analysis.typography.detailText },
  };
}

function createEmptyCoreSuggestionValues(): ShortcutPromptValues {
  return KV_CORE_FIELD_IDS.reduce<ShortcutPromptValues>((acc, fieldId) => {
    acc[fieldId] = "";
    return acc;
  }, {});
}

function cloneVariantBaseline(baseline: ShortcutOptimizationVariantBaseline): ShortcutOptimizationVariantBaseline {
  return {
    label: baseline.label,
    values: cloneShortcutValues(baseline.values),
    removedFieldIds: [...baseline.removedFieldIds],
    coreSuggestions: cloneShortcutValues(baseline.coreSuggestions),
    palette: cloneDesignPalette(baseline.palette),
    analysis: cloneDesignAnalysis(baseline.analysis),
    promptPreview: baseline.promptPreview,
  };
}

function mergeLockedKvValues(
  baseValues: ShortcutPromptValues,
  candidateValues: Partial<Record<KvCoreFieldId, string>>,
): ShortcutPromptValues {
  const nextValues = cloneShortcutValues(baseValues);

  KV_CORE_FIELD_IDS.forEach((fieldId) => {
    const currentValue = (baseValues[fieldId] || "").trim();
    const candidateValue = (candidateValues[fieldId] || "").trim();
    nextValues[fieldId] = currentValue || candidateValue || "";
  });

  return nextValues;
}

function findShortcutVariant(
  session: ShortcutOptimizationSession,
  variantId: KvStructuredVariantId,
) {
  return session.variants.find((variant) => variant.id === variantId);
}

function buildKvVariantPromptPreview(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  removedFieldIds: string[],
  analysis: DesignStructuredAnalysis,
  palette: DesignStructuredPaletteEntry[],
) {
  return assembleDesignStructuredShortcutPrompt(shortcut, values, removedFieldIds, analysis, palette);
}

function deriveVariantPalette(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  removedFieldIds: string[],
  analysis: DesignStructuredAnalysis,
  existingPalette: DesignStructuredPaletteEntry[],
  promptPreview?: string,
) {
  return derivePaletteFromVariantContent({
    analysis,
    promptPreview,
    basePrompt: buildShortcutPrompt(shortcut, values, {
      removedFieldIds,
      usePlaceholder: false,
    }),
    existingPalette,
  });
}

function replaceColorInShortcutValues(
  values: ShortcutPromptValues,
  previousHex: string,
  nextHex: string,
) {
  return Object.fromEntries(
    Object.entries(values).map(([fieldId, value]) => [
      fieldId,
      replaceHexColorReferences(value, previousHex, nextHex),
    ]),
  );
}

function replaceColorInAnalysis(
  analysis: DesignStructuredAnalysis,
  previousHex: string,
  nextHex: string,
) {
  return {
    canvas: {
      tokens: analysis.canvas.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.canvas.detailText, previousHex, nextHex),
    },
    subject: {
      tokens: analysis.subject.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.subject.detailText, previousHex, nextHex),
    },
    background: {
      tokens: analysis.background.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.background.detailText, previousHex, nextHex),
    },
    layout: {
      tokens: analysis.layout.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.layout.detailText, previousHex, nextHex),
    },
    typography: {
      tokens: analysis.typography.tokens.map((token) => replaceHexColorReferences(token, previousHex, nextHex)),
      detailText: replaceHexColorReferences(analysis.typography.detailText, previousHex, nextHex),
    },
  };
}

function replacePaletteWeightsInAnalysis(
  analysis: DesignStructuredAnalysis,
  hex: string,
  previousWeight: string,
  nextWeight: string,
) {
  return {
    canvas: {
      tokens: analysis.canvas.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.canvas.detailText, hex, previousWeight, nextWeight),
    },
    subject: {
      tokens: analysis.subject.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.subject.detailText, hex, previousWeight, nextWeight),
    },
    background: {
      tokens: analysis.background.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.background.detailText, hex, previousWeight, nextWeight),
    },
    layout: {
      tokens: analysis.layout.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.layout.detailText, hex, previousWeight, nextWeight),
    },
    typography: {
      tokens: analysis.typography.tokens.map((token) => replacePaletteWeightReferences(token, hex, previousWeight, nextWeight)),
      detailText: replacePaletteWeightReferences(analysis.typography.detailText, hex, previousWeight, nextWeight),
    },
  };
}

function buildStructuredVariantPayload(variant: ShortcutOptimizationVariantDraft) {
  return {
    id: variant.id,
    label: variant.label,
    coreFields: {
      mainTitle: variant.values.mainTitle || "",
      subTitle: variant.values.subTitle || "",
      eventTime: variant.values.eventTime || "",
      style: variant.values.style || "",
      primaryColor: variant.values.primaryColor || "",
    },
    coreSuggestions: {
      mainTitle: variant.coreSuggestions.mainTitle || "",
      subTitle: variant.coreSuggestions.subTitle || "",
      eventTime: variant.coreSuggestions.eventTime || "",
      style: variant.coreSuggestions.style || "",
      primaryColor: variant.coreSuggestions.primaryColor || "",
    },
    analysis: cloneDesignAnalysis(variant.analysis),
    promptPreview: variant.promptPreview,
  };
}

function createShortcutOptimizationVariants(
  shortcut: PlaygroundShortcut,
  baseValues: ShortcutPromptValues,
  removedFieldIds: string[],
  rawText: string,
): ShortcutOptimizationVariantDraft[] {
  const parsed = parseDesignStructuredOptimizationResponse(rawText);

  return KV_STRUCTURED_VARIANT_IDS.map((variantId, index) => {
    const variant = parsed.variants.find((item) => item.id === variantId);
    if (!variant) {
      throw new Error(`缺少优化版本 ${variantId}`);
    }

    const nextValues = mergeLockedKvValues(baseValues, variant.coreFields);
    const nextAnalysis = cloneDesignAnalysis(variant.analysis);
    const nextPalette = deriveVariantPalette(
      shortcut,
      nextValues,
      removedFieldIds,
      nextAnalysis,
      variant.palette,
      variant.promptPreview,
    );
    const promptPreview = buildKvVariantPromptPreview(shortcut, nextValues, removedFieldIds, nextAnalysis, nextPalette);

    return {
      id: variant.id,
      label: variant.label || `版本 ${index + 1}`,
      values: nextValues,
      removedFieldIds: [...removedFieldIds],
      coreSuggestions: {
        ...createEmptyCoreSuggestionValues(),
        ...variant.coreSuggestions,
      },
      palette: nextPalette,
      analysis: nextAnalysis,
      promptPreview,
      baseline: {
        label: variant.label || `版本 ${index + 1}`,
        values: cloneShortcutValues(nextValues),
        removedFieldIds: [...removedFieldIds],
        coreSuggestions: {
          ...createEmptyCoreSuggestionValues(),
          ...variant.coreSuggestions,
        },
        palette: cloneDesignPalette(nextPalette),
        analysis: cloneDesignAnalysis(nextAnalysis),
        promptPreview,
      },
      pendingInstruction: "",
      pendingScope: "variant",
      isModifying: false,
    };
  });
}


export const PlaygroundV2Page = observer(function PlaygroundV2Page({
  onEditMapping,
}: PlaygroundV2PageProps) {
  const { toast } = useToast();
  const isDesktop = useMediaQuery("(min-width: 1440px)");
  const config = usePlaygroundStore(s => s.config);
  const updateConfig = usePlaygroundStore(s => s.updateConfig);
  const uploadedImages = usePlaygroundStore(s => s.uploadedImages);
  const setUploadedImages = usePlaygroundStore(s => s.setUploadedImages);
  const describeImages = usePlaygroundStore(s => s.describeImages);
  const setDescribeImages = usePlaygroundStore(s => s.setDescribeImages);
  const selectedModel = usePlaygroundStore(s => s.selectedModel);
  const setSelectedModel = usePlaygroundStore(s => s.setSelectedModel);
  const selectedWorkflowConfig = usePlaygroundStore(s => s.selectedWorkflowConfig);
  const setSelectedWorkflowConfig = usePlaygroundStore(s => s.setSelectedWorkflowConfig);
  const selectedLoras = usePlaygroundStore(s => s.selectedLoras);
  const setSelectedLoras = usePlaygroundStore(s => s.setSelectedLoras);
  const generationHistory = usePlaygroundStore(s => s.generationHistory);
  const setGenerationHistory = usePlaygroundStore(s => s.setGenerationHistory);
  // const fetchHistory = usePlaygroundStore(s => s.fetchHistory); // Deprecated in favor of useHistory
  const fetchGallery = usePlaygroundStore(s => s.fetchGallery);
  const initPresets = usePlaygroundStore(s => s.initPresets);
  const applyModel = usePlaygroundStore(s => s.applyModel);
  const addStyle = usePlaygroundStore(s => s.addStyle);
  const styles = usePlaygroundStore(s => s.styles);
  const updateUploadedImage = usePlaygroundStore(s => s.updateUploadedImage);
  const updateDescribeImage = usePlaygroundStore(s => s.updateDescribeImage);
  const syncLocalImageToHistory = usePlaygroundStore(s => s.syncLocalImageToHistory);
  const visitorId = usePlaygroundStore(s => s.visitorId);
  const initVisitorId = usePlaygroundStore(s => s.initVisitorId);
  const currentUserId = userStore.currentUser?.id;
  const sessionUserId = typeof window !== "undefined" ? localStorage.getItem("CURRENT_USER_ID") : null;
  const effectiveUserId = currentUserId || sessionUserId || visitorId || "anonymous";
  const isHistoryDebug =
    typeof window !== "undefined" &&
    (process.env.NEXT_PUBLIC_HISTORY_DEBUG === "1" || window.localStorage.getItem("__DEBUG_HISTORY__") === "1");


  const setConfig = React.useCallback((val: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => {
    const currentConfig = usePlaygroundStore.getState().config;
    if (typeof val === 'function') {
      updateConfig(val(currentConfig));
    } else {
      updateConfig(val);
    }
  }, [updateConfig]);

  // const hasGenerated = usePlaygroundStore(s => s.hasGenerated);
  const setHasGenerated = usePlaygroundStore(s => s.setHasGenerated);
  // const remix = usePlaygroundStore(s => s.remix);
  const isAspectRatioLocked = usePlaygroundStore(s => s.isAspectRatioLocked);
  const setIsAspectRatioLocked = usePlaygroundStore(s => s.setAspectRatioLocked);
  const isSelectorExpanded = usePlaygroundStore(s => s.isSelectorExpanded);
  const setIsSelectorExpanded = usePlaygroundStore(s => s.setSelectorExpanded);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const describePanelRef = useRef<HTMLDivElement>(null);

  // Use SWR hook for history
  const { history: swrHistory, size, setSize, isLoading: isHistoryLoading, hasMore: hasMoreHistory, mutate: mutateHistory } = useHistory();
  const syncHistoryWithSWR = usePlaygroundStore(s => s.syncHistoryWithSWR);
  const migrationInFlightRef = useRef<Set<string>>(new Set());

  // Sync SWR data to store whenever it changes
  useEffect(() => {
    if (swrHistory) {
      syncHistoryWithSWR(swrHistory);
    }
  }, [swrHistory, syncHistoryWithSWR]);

  useEffect(() => {
    // 预加载图库 (之前图库只有在切换到图库标签且组件挂载后才加载)
    fetchGallery(1);
  }, [fetchGallery]);

  const filteredHistory = useMemo(() => generationHistory, [generationHistory]);

  const [selectedAIModel, setSelectedAIModel] = useState<AIModel>('auto'); // 默认使用settings中的配置
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isBaseModelDialogOpen, setIsBaseModelDialogOpen] = useState(false);
  const [isLoraDialogOpen, setIsLoraDialogOpen] = useState(false);
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  // const [isDescribeMode, setIsDescribeMode] = useState(false); // Refactored to viewMode
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverPanel, setIsDraggingOverPanel] = useState(false);
  const [historyLayoutMode, setHistoryLayoutMode] = useState<'grid' | 'list'>('list');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [batchSize, setBatchSize] = useState(4); // Default batch size
  const [pendingPresetEditConfig, setPendingPresetEditConfig] = useState<EditPresetConfig | undefined>(undefined);
  const [bannerSessionHistory, setBannerSessionHistory] = useState<BannerSessionHistoryItem[]>([]);
  const [activeShortcutTemplate, setActiveShortcutTemplate] = useState<ActiveShortcutTemplate | null>(null);
  const [shortcutPreviewResults, setShortcutPreviewResults] = useState<Generation[]>([]);
  const [selectedShortcutPreviewResult, setSelectedShortcutPreviewResult] = useState<Generation | undefined>(undefined);
  const activeShortcutTemplateRef = useRef<ActiveShortcutTemplate | null>(null);


  const {
    showHistory,
    setShowHistory,
    selectedPresetName,
    setSelectedPresetName,
    viewMode,
    setViewMode,
    activeTab,
    setActiveTab,
    previewImageUrl,
    previewLayoutId,
    setPreviewImage,
    selectedHistoryIds
  } = usePlaygroundStore();
  const apiConfigSettings = useAPIConfigStore(s => s.settings);
  const enterBannerMode = usePlaygroundStore(s => s.enterBannerMode);
  const defaultImageModelId = apiConfigSettings.services?.imageGeneration?.binding?.modelId
    || apiConfigSettings.defaults?.image?.textToImage?.binding?.modelId
    || "gemini-3-pro-image-preview";

  useEffect(() => {
    activeShortcutTemplateRef.current = activeShortcutTemplate;
  }, [activeShortcutTemplate]);

  useEffect(() => {
    if (!isHistoryDebug) return;
    console.info("[HistoryDebug][Front] page_state", {
      currentUserId: currentUserId || null,
      sessionUserId: sessionUserId || null,
      visitorId: visitorId || null,
      effectiveUserId,
      swrHistoryCount: swrHistory?.length || 0,
      storeHistoryCount: generationHistory.length,
      activeTab,
      viewMode,
      isHistoryLoading,
      hasMoreHistory,
    });
  }, [
    isHistoryDebug,
    currentUserId,
    sessionUserId,
    visitorId,
    effectiveUserId,
    swrHistory,
    generationHistory.length,
    activeTab,
    viewMode,
    isHistoryLoading,
    hasMoreHistory,
  ]);

  const {
    sensors,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
  } = useHistoryDragTransfer();

  useEffect(() => {
    if (activeTab !== 'banner') {
      setBannerSessionHistory([]);
    }
  }, [activeTab]);

  useEffect(() => {
    if (bannerSessionHistory.length === 0) {
      return;
    }

    const bannerHistoryMap = new Map(
      generationHistory
        .filter((item) => item.config?.generationMode === 'banner' && Boolean(item.outputUrl))
        .map((item) => [item.id, item])
    );

    setBannerSessionHistory((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const matched = bannerHistoryMap.get(item.id);
        if (!matched?.outputUrl || matched.outputUrl === item.outputUrl) {
          return item;
        }
        changed = true;
        return {
          ...item,
          outputUrl: matched.outputUrl,
          createdAt: matched.createdAt || item.createdAt,
        };
      });
      return changed ? next : prev;
    });
  }, [bannerSessionHistory.length, generationHistory]);

  // Sync showHistory with viewMode for side effects (like project sidebar)
  useEffect(() => {
    if (viewMode === 'dock') {
      if (!showHistory) setShowHistory(true);
    } else {
      if (showHistory) setShowHistory(false);
    }
  }, [viewMode, setShowHistory, showHistory]);

  useEffect(() => {
    if (isWorkflowModel(selectedModel) && config.presetName && !selectedWorkflowConfig) {
      const wf = workflows.find(w => w.viewComfyJSON.title === config.presetName);
      if (wf) {
        setSelectedWorkflowConfig(wf);
      }
    }
  }, [config.presetName, selectedModel, workflows, selectedWorkflowConfig, setSelectedWorkflowConfig]);

  // Removed click outside listener for Describe panel as it is now a persistent tab in Dock Mode.

  const promptWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initPresets();
  }, [initPresets]);

  // Helper: save history using unified fields
  const saveHistoryToBackend = React.useCallback(async (item: import('@/types/database').Generation) => {
    try {
      const gen = {
        id: item.id,
        userId: item.userId || effectiveUserId,
        projectId: item.projectId || 'default',
        outputUrl: item.outputUrl || '',
        config: item.config,
        status: item.status || 'completed',
        createdAt: item.createdAt || new Date().toISOString(),
      };
      await fetch(`${getApiBase()}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gen),
      });
    } catch (error) {
      console.error('Failed to save history:', error);
      // Optional: Add toast notification if needed, but avoiding it to keep behavior identical to before
    }
  }, [effectiveUserId]);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const res = await fetch(`${getApiBase()}/view-comfy`);
        if (res.ok) {
          const data = await res.json();
          setWorkflows(data.viewComfys || []);
        }
      } catch (error) {
        console.error("Failed to fetch workflows", error);
      }
    };
    fetchWorkflows();
  }, []);

  useEffect(() => {
    initVisitorId();
  }, [initVisitorId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentUserId || !visitorId || currentUserId === visitorId) return;

    const migrationKey = `HISTORY_MIGRATED_${currentUserId}_${visitorId}`;
    if (localStorage.getItem(migrationKey) === "1") return;
    if (migrationInFlightRef.current.has(migrationKey)) return;

    migrationInFlightRef.current.add(migrationKey);

    void (async () => {
      try {
        const res = await fetch(`${getApiBase()}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "migrate-user-history",
            fromUserId: visitorId,
            toUserId: currentUserId,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const migrationResult = await res.json().catch(() => ({}));
        if (isHistoryDebug) {
          console.info("[HistoryDebug][Front] migrate_user_history", {
            fromUserId: visitorId,
            toUserId: currentUserId,
            migrationResult,
          });
        }

        localStorage.setItem(migrationKey, "1");
        await mutateHistory();
      } catch (error) {
        console.error("Failed to migrate visitor history:", error);
      } finally {
        migrationInFlightRef.current.delete(migrationKey);
      }
    })();
  }, [currentUserId, visitorId, mutateHistory, isHistoryDebug]);

  useEffect(() => {
    const path = uploadedImages[0]?.path;
    updateConfig({ sourceImageUrls: path ? [path] : [] });
  }, [uploadedImages, updateConfig]);


  const updateHistorySourceUrl = usePlaygroundStore(s => s.updateHistorySourceUrl);

  const applyWorkflowDefaults = React.useCallback((workflow: IViewComfy) => {
    const mappingConfig = workflow.viewComfyJSON.mappingConfig as { components: UIComponent[] } | undefined;
    const newLoras: SelectedLora[] = [];

    // 我们不再在外部创建 newConfig = { ...config }，而是通过 setConfig(prev => ...) 来构造
    setConfig(prev => {
      const nextConfig = { ...prev };
      if (mappingConfig?.components && Array.isArray(mappingConfig.components) && mappingConfig.components.length > 0) {
        const components = mappingConfig.components;
        const workflowApiJSON = workflow.workflowApiJSON as WorkflowApiJSON | undefined;
        components.forEach((comp: UIComponent) => {
          const paramName = comp.properties?.paramName;
          const defaultValue = comp.properties?.defaultValue;
          const workflowPath = comp.mapping?.workflowPath;
          if (!paramName) return;
          const getActualValue = () => {
            if (workflowApiJSON && Array.isArray(workflowPath) && workflowPath.length >= 3) {
              const [nodeId, section, key] = workflowPath;
              if (section === "inputs") {
                return workflowApiJSON[nodeId]?.inputs?.[key];
              }
            }
            return undefined;
          };
          const actualValue = getActualValue();
          if (paramName === 'prompt') {
            if (actualValue && typeof actualValue === 'string') nextConfig.prompt = actualValue;
            else if (defaultValue) nextConfig.prompt = defaultValue;
          } else if (paramName === 'width') {
            if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) nextConfig.width = Number(actualValue);
            else if (defaultValue) nextConfig.width = Number(defaultValue);
          } else if (paramName === 'height') {
            if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) nextConfig.height = Number(actualValue);
            else if (defaultValue) nextConfig.height = Number(defaultValue);
          } else if (paramName === 'model' || paramName === 'base_model') {
            if (actualValue && typeof actualValue === 'string') nextConfig.model = actualValue;
            else if (defaultValue) nextConfig.model = defaultValue;
          } else if (['lora', 'lora1', 'lora2', 'lora3'].includes(paramName)) {
            const val = (actualValue && typeof actualValue === 'string') ? actualValue : defaultValue;
            if (val && typeof val === 'string') {
              newLoras.push({ model_name: val, strength: 1.0 });
            }
          }
        });
      } else {
        const allInputs = [
          ...(workflow.viewComfyJSON.inputs || []),
          ...(workflow.viewComfyJSON.advancedInputs || [])
        ].flatMap(group => group.inputs);
        allInputs.forEach(input => {
          const title = (input.title || "").toLowerCase();
          const val = input.value;
          if (title.includes("prompt") || title.includes("文本") || title.includes("提示")) {
            if (typeof val === "string") nextConfig.prompt = val;
          } else if (title === "width" || title.includes("width")) {
            if (typeof val === "number" || typeof val === "string") nextConfig.width = Number(val);
          } else if (title === "height" || title.includes("height")) {
            if (typeof val === "number" || typeof val === "string") nextConfig.height = Number(val);
          } else if (title.includes("model") || title.includes("模型")) {
            if (!title.includes("lora")) {
              if (typeof val === "string") nextConfig.model = val;
            }
          }
          if (title.includes("lora")) {
            if (typeof val === "string" && val) {
              newLoras.push({ model_name: val, strength: 1.0 });
            }
          }
        });
      }

      // 这里直接返回修改后的配置，同时也更新 Loras
      return {
        ...nextConfig,
        loras: newLoras,
        presetName: usePlaygroundStore.getState().selectedPresetName || nextConfig.presetName
      };
    });

    if (!isWorkflowModel(selectedModel)) setSelectedModel(MODEL_ID_WORKFLOW);
    setSelectedLoras(newLoras);
  }, [setConfig, selectedModel, setSelectedModel, setSelectedLoras]);

  const [imageEditState, setImageEditState] = useState<{
    open: boolean;
    imageUrl: string;
    initialPrompt: string;
    initialSession?: ImageEditorSessionSnapshot;
    legacySnapshot?: Record<string, unknown>;
    parentId?: string;
  }>({
    open: false,
    imageUrl: '',
    initialPrompt: '',
    initialSession: undefined,
    legacySnapshot: undefined,
    parentId: undefined,
  });

  // States for other dialogs
  const [isPresetGridOpen, setIsPresetGridOpen] = useState(false);
  const {
    handleGenerate: singleGenerate,
    executeGeneration,
    syncHistoryConfig,
    fluxKleinConnectionHelp,
    dismissFluxKleinConnectionHelp,
    isGenerating,
  } = useGenerationService();
  const {
    isImageModalOpen,
    selectedResult,
    isHydratingSelectedResult,
    openImageModal,
    closeImageModal,
    previewableHistory,
    currentIndex,
    jumpToResult,
    handleNextImage,
    handlePrevImage,
    hasPrev,
    hasNext,
  } = useResultModalState({
    filteredHistory,
    viewMode,
    ensureDockMode: () => {
      setViewMode('dock');
      setActiveTab('history');
    },
  });
  const selectedResultPreviewKey = useMemo(() => {
    if (!selectedResult) return 'preview-none';
    const identity =
      selectedResult.id?.trim() ||
      selectedResult.outputUrl?.trim() ||
      selectedResult.createdAt?.trim() ||
      'unknown';
    return `preview-${identity}`;
  }, [selectedResult]);
  const selectedShortcutPreviewKey = useMemo(() => {
    if (!selectedShortcutPreviewResult) return 'shortcut-preview-none';
    const identity =
      selectedShortcutPreviewResult.id?.trim()
      || selectedShortcutPreviewResult.outputUrl?.trim()
      || 'unknown';
    return `shortcut-preview-${identity}`;
  }, [selectedShortcutPreviewResult]);
  const shortcutPreviewCurrentIndex = useMemo(() => (
    selectedShortcutPreviewResult
      ? shortcutPreviewResults.findIndex((result) => result.id === selectedShortcutPreviewResult.id)
      : -1
  ), [selectedShortcutPreviewResult, shortcutPreviewResults]);
  const shortcutPreviewHasPrev = shortcutPreviewCurrentIndex > 0;
  const shortcutPreviewHasNext =
    shortcutPreviewCurrentIndex !== -1 && shortcutPreviewCurrentIndex < shortcutPreviewResults.length - 1;
  const hasStructuredShortcutSession = Boolean(activeShortcutTemplate?.optimizationSession);

  // Wrapper for batch generation
  const handleGenerate = React.useCallback(async (options: GenerateOptions = {}) => {
    const { configOverride, batchSizeOverride } = options;
    const storeState = usePlaygroundStore.getState();
    const isBannerModeGenerate = storeState.activeTab === 'banner' && Boolean(storeState.activeBannerData);

    if (isBannerModeGenerate) {
      const startTime = new Date().toISOString();
      const batchTaskId = options.taskId || configOverride?.taskId || (Date.now().toString() + Math.random().toString(36).substring(2, 7));
      const currentConfig = usePlaygroundStore.getState().config;
      const sourceImageUrls = options.sourceImageUrls && options.sourceImageUrls.length > 0
        ? options.sourceImageUrls
        : (currentConfig.sourceImageUrls || []);

      const bannerConfig: GenerationConfig = {
        ...currentConfig,
        ...(configOverride || {}),
        taskId: batchTaskId,
        isEdit: true,
      };

      const uniqueId = await singleGenerate({
        configOverride: bannerConfig,
        fixedCreatedAt: startTime,
        isBackground: true,
        editConfig: undefined,
        taskId: batchTaskId,
        sourceImageUrls
      });

      if (typeof uniqueId === 'string') {
        const generated = await executeGeneration(uniqueId, batchTaskId, bannerConfig, startTime, sourceImageUrls);
        if (generated?.outputUrl) {
          const templateId = storeState.activeBannerData?.templateId || generated.config?.bannerTemplateId || 'banner-unknown';
          setBannerSessionHistory((prev) => [
            {
              id: generated.id,
              outputUrl: generated.outputUrl,
              createdAt: generated.createdAt || startTime,
              templateId,
            },
            ...prev.filter((item) => item.id !== generated.id),
          ]);
        }
      }
      return;
    }

    // Switch to Dock Mode and History Tab
    setViewMode('dock');
    setActiveTab('history');
    setShowHistory(true); // Explicitly set for immediate effect

    // Create a unified timestamp and taskId for the entire batch to ensure grouping
    const startTime = new Date().toISOString();
    const batchTaskId = options.taskId || configOverride?.taskId || (Date.now().toString() + Math.random().toString(36).substring(2, 7));

    // Determine the effective batch size: 4 if overriding config (e.g. regenerate/rerun), otherwise current batchSize
    const normalizedBatchSizeOverride =
      typeof batchSizeOverride === 'number' && Number.isFinite(batchSizeOverride)
        ? Math.max(1, Math.floor(batchSizeOverride))
        : undefined;
    const effectiveBatchSize = normalizedBatchSizeOverride ?? (configOverride ? 4 : batchSize);

    const modelForBatch = String(
      (configOverride as Partial<GenerationConfig> | undefined)?.model
      || usePlaygroundStore.getState().config.model
      || usePlaygroundStore.getState().selectedModel
      || ''
    );
    const shouldSequentialExecute =
      modelForBatch === MODEL_ID_FLUX_KLEIN
      || isWorkflowModel(modelForBatch, Boolean(usePlaygroundStore.getState().selectedWorkflowConfig))
      // Gemini 模型生成时间约 30s，图片体积大（2K=7MB），并发会导致代理内存溢出；改为串行逐张显示
      || modelForBatch.startsWith('gemini-');


    // Launch generation tasks
    // Always create pending cards immediately, then schedule real execution.
    // ComfyUI-backed tasks are executed sequentially to avoid large-image queue timeout/failure.
    type PendingExecution = {
      uniqueId?: string;
      finalConfig: GenerationConfig;
      sourceImageUrls: string[];
    };
    const pendingExecutions: Promise<PendingExecution>[] = [];
    for (let i = 0; i < effectiveBatchSize; i++) {
      // Create history item immediately to show all cards at once
      const currentConfig = usePlaygroundStore.getState().config;
      const currentLoras = usePlaygroundStore.getState().selectedLoras;
      const finalConfig = {
        ...currentConfig,
        ...(configOverride && typeof configOverride === 'object' ? configOverride : {}),
        loras: currentLoras,
        taskId: batchTaskId,
        isPreset: !!(currentConfig.presetName || (configOverride as GenerationConfig)?.presetName)
      };
      // 优先使用显式传入的 sourceImageUrls（例如 rerun 场景），否则从当前 store 读取
      const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
      const sourceImageUrls = options.sourceImageUrls && options.sourceImageUrls.length > 0
        ? options.sourceImageUrls
        : currentUploadedImages.map(img => img.path || img.previewUrl);

      // 1. Immediately create and show the pending card
      // 关键修复：普通生成显式禁用 isEdit，逻辑上它不是编辑。
      // 使用显式合并逻辑，并保证 prompt 不为空
      const displayConfigOverride: GenerationConfig = {
        ...currentConfig,
        ...(configOverride || {}),
        prompt: (configOverride as Partial<GenerationConfig>)?.prompt || currentConfig.prompt || '',
        isEdit: false
      };

      const pendingExecution = singleGenerate({
        configOverride: displayConfigOverride,
        fixedCreatedAt: startTime,
        isBackground: true,
        editConfig: undefined,
        taskId: batchTaskId,
        sourceImageUrls
      });
      pendingExecutions.push(
        pendingExecution.then((uniqueId) => ({
          uniqueId: typeof uniqueId === 'string' ? uniqueId : undefined,
          finalConfig: { ...finalConfig, isEdit: false },
          sourceImageUrls,
        }))
      );
    }

    const resolvedExecutions = await Promise.all(pendingExecutions);
    if (shouldSequentialExecute) {
      for (const execution of resolvedExecutions) {
        if (!execution.uniqueId) continue;
        await executeGeneration(
          execution.uniqueId,
          batchTaskId,
          execution.finalConfig,
          startTime,
          execution.sourceImageUrls
        );
      }
      return;
    }

    resolvedExecutions.forEach((execution, index) => {
      if (!execution.uniqueId) return;
      setTimeout(() => {
        void executeGeneration(
          execution.uniqueId as string,
          batchTaskId,
          execution.finalConfig,
          startTime,
          execution.sourceImageUrls
        );
      }, index * 1100);
    });
  }, [batchSize, singleGenerate, executeGeneration, setViewMode, setActiveTab, setShowHistory]);

  const { optimizePrompt, isOptimizing } = usePromptOptimization();
  const { callVision, getServiceConfig } = useAIServiceV1();

  const requestDesignVariantEdit = useCallback(async (params: {
    instruction: string;
    scope: DesignVariantEditScope;
    variant: ShortcutOptimizationVariantDraft;
    shortcut: PlaygroundShortcut;
    values: ShortcutPromptValues;
    removedFieldIds: string[];
  }) => {
    const market = isKvShortcutId(params.shortcut.id)
      ? getKvShortcutMarket(params.shortcut.id)
      : undefined;
    const shortcutPrompt = buildShortcutPrompt(params.shortcut, params.values, {
      removedFieldIds: params.removedFieldIds,
      usePlaceholder: false,
    });

    const response = await fetch(`${getApiBase()}/ai/design-variant-edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instruction: params.instruction,
        scope: params.scope,
        variant: buildStructuredVariantPayload(params.variant),
        context: {
          shortcutId: params.shortcut.id,
          shortcutPrompt,
          market,
        },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      let errorMessage = raw || `HTTP ${response.status}`;
      try {
        const errorPayload = JSON.parse(raw) as { error?: string };
        errorMessage = errorPayload.error || errorMessage;
      } catch {
        // Ignore parse errors and fall back to raw text.
      }
      throw new Error(errorMessage);
    }

    const parsed = parseDesignStructuredVariantEditResponse(raw);
    if (parsed.mode !== DESIGN_VARIANT_EDIT_MODE) {
      throw new Error('Unexpected design variant edit response mode');
    }

    return parsed.variant;
  }, []);

  const handleFilesUpload = React.useCallback(async (files: File[] | FileList, target: 'reference' | 'describe' = 'reference') => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    const setImages = target === 'describe' ? setDescribeImages : setUploadedImages;
    const updateImage = target === 'describe' ? updateDescribeImage : updateUploadedImage;

    for (const file of uploads) {
      const tempId = uuidv4(); // Use uuid for better ID management

      // 1. Generate local preview and base64 immediately
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.split(',')[1];

      // 2. Get image dimensions
      const dimensions: { width: number; height: number } = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = dataUrl;
      });


      // 4. Add to UI immediately (prepend to show on top)
      setImages((prev: UploadedImage[]) => [{
        id: tempId,
        localId: tempId,
        file,
        base64: base64Data,
        previewUrl: dataUrl,
        isUploading: true,
        width: dimensions.width,
        height: dimensions.height
      }, ...prev]);

      // 5. Update config for 'auto' mode if it's the first image in reference
      if (target === 'reference' && usePlaygroundStore.getState().config.aspectRatio === 'auto') {
        let { width, height } = dimensions;
        const minSide = Math.min(width, height);
        if (minSide < 1024) {
          const scale = 1024 / minSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        updateConfig({ width, height });
      }

      // 6. Start background upload (NO await)
      (async () => {
        const form = new FormData();
        form.append('file', file);

        const originalUrl = dataUrl; // Keep track of the local URL

        try {
          const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: form });
          const json = await resp.ok ? await resp.json() : null;
          const path = json?.path ? String(json.path) : undefined;
          const url = json?.url ? String(json.url) : undefined; // 预签名 URL

          // Update the specific image with its CDN path (storageKey) and preview URL (signed URL)
          updateImage(tempId, { 
            path, // storageKey 用于持久化标识
            previewUrl: url || path, // 优先使用预签名 URL 显示，如果没有则使用 path
            isUploading: false 
          });

          // Also update history records that were using this local URL or localId
          if (path) {
            updateHistorySourceUrl(originalUrl, url || path);
            await syncLocalImageToHistory(tempId, path);
          }
        } catch (err) {
          console.error("Upload failed in background", err);
          updateImage(tempId, { isUploading: false });
        }
      })();
    }
  }, [setDescribeImages, setUploadedImages, updateDescribeImage, updateUploadedImage, updateHistorySourceUrl, updateConfig, syncLocalImageToHistory]);
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    // 默认通过 input 上传的归为参考图，除非有特殊逻辑
    await handleFilesUpload(files, activeTab === 'describe' ? 'describe' : 'reference');
  };
  const removeImage = React.useCallback((index: number) => { setUploadedImages(prev => prev.filter((_, i) => i !== index)); }, [setUploadedImages]);

  const handleStyleUpload = async (files: File[] | FileList) => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (uploads.length === 0) return;

    toast({ title: "正在上传图片", description: `正在为新情绪板处理 ${uploads.length} 张图片...` });

    try {
      const uploadPromises = uploads.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: formData });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        return data.path;
      });

      const imagePaths = await Promise.all(uploadPromises);

      const newStyle = {
        id: uuidv4(),
        name: `新情绪板 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        prompt: '',
        imagePaths,
        updatedAt: new Date().toISOString()
      };

      await addStyle(newStyle);
      toast({ title: "情绪板创建成功", description: `已成功创建新情绪板并包含 ${uploads.length} 张图片` });
    } catch (error) {
      console.error("Failed to upload images for new style", error);
      toast({
        title: "创建失败",
        description: "上传图片过程中出现错误，请重试",
        variant: "destructive"
      });
    }
  };




  const handleShortcutQuickApply = useCallback((shortcut: PlaygroundShortcut) => {
    const values = createShortcutPromptValues(shortcut);
    const prompt = buildShortcutPrompt(shortcut, values);
    const dimensions = AR_MAP[shortcut.aspectRatio]?.[shortcut.imageSize] || {
      w: config.width || 1024,
      h: config.height || 1024,
    };

    setSelectedPresetName(undefined);
    setSelectedWorkflowConfig(undefined);
    setActiveShortcutTemplate({
      shortcut,
      values,
      removedFieldIds: [],
      appliedPrompt: prompt,
    });

    applyModel(shortcut.model, {
      prompt,
      model: shortcut.model,
      baseModel: shortcut.model,
      width: dimensions.w,
      height: dimensions.h,
      imageSize: shortcut.imageSize,
      aspectRatio: shortcut.aspectRatio,
      loras: [],
      presetName: undefined,
      workflowName: undefined,
      isPreset: false,
      isEdit: false,
      editConfig: undefined,
      generationMode: 'playground',
    });

    // if (promptWrapperRef.current) {
    //   window.requestAnimationFrame(() => {
    //     promptWrapperRef.current?.scrollIntoView({
    //       behavior: 'smooth',
    //       block: 'center',
    //     });
    //   });
    // }

    toast({
      title: `已应用 ${shortcut.name}`,
      description: `模型已切换到 ${shortcut.modelLabel}，请补全高亮字段后再生成。`,
    });
  }, [applyModel, config.height, config.width, setSelectedPresetName, setSelectedWorkflowConfig, toast]);

  const buildShortcutPreviewResults = useCallback((shortcut: PlaygroundShortcut): Generation[] => {
    const shortcutMoodboard = styles.find((style) => style.id === getShortcutMoodboardId(shortcut.id));
    const values = createShortcutPromptValues(shortcut);
    const prompt = shortcutMoodboard?.prompt || buildShortcutPrompt(shortcut, values);
    const previewImages = shortcutMoodboard?.imagePaths?.length ? shortcutMoodboard.imagePaths : shortcut.imagePaths;
    const dimensions = AR_MAP[shortcut.aspectRatio]?.[shortcut.imageSize] || {
      w: config.width || 1024,
      h: config.height || 1024,
    };

    return previewImages.map((imagePath, index) => ({
      id: `shortcut-preview-${shortcut.id}-${index}`,
      userId: effectiveUserId,
      projectId: 'shortcut-preview',
      outputUrl: imagePath,
      config: {
        prompt,
        model: shortcut.model,
        baseModel: shortcut.model,
        width: dimensions.w,
        height: dimensions.h,
        imageSize: shortcut.imageSize,
        aspectRatio: shortcut.aspectRatio,
        loras: [],
        presetName: undefined,
        workflowName: shortcutMoodboard?.name || shortcut.name,
        isPreset: false,
        isEdit: false,
        editConfig: undefined,
        generationMode: 'playground',
      },
      status: 'completed',
      createdAt: shortcutMoodboard?.updatedAt || '',
    }));
  }, [config.height, config.width, effectiveUserId, styles]);

  const handleShortcutPreviewOpen = useCallback((shortcut: PlaygroundShortcut, imageIndex: number) => {
    const previewResults = buildShortcutPreviewResults(shortcut);
    setShortcutPreviewResults(previewResults);
    setSelectedShortcutPreviewResult(previewResults[imageIndex] || previewResults[0]);
  }, [buildShortcutPreviewResults]);

  const handleShortcutPreviewClose = useCallback(() => {
    setSelectedShortcutPreviewResult(undefined);
  }, []);

  const handleShortcutPreviewNext = useCallback(() => {
    if (!shortcutPreviewHasNext) return;
    setSelectedShortcutPreviewResult(shortcutPreviewResults[shortcutPreviewCurrentIndex + 1]);
  }, [shortcutPreviewCurrentIndex, shortcutPreviewHasNext, shortcutPreviewResults]);

  const handleShortcutPreviewPrev = useCallback(() => {
    if (!shortcutPreviewHasPrev) return;
    setSelectedShortcutPreviewResult(shortcutPreviewResults[shortcutPreviewCurrentIndex - 1]);
  }, [shortcutPreviewCurrentIndex, shortcutPreviewHasPrev, shortcutPreviewResults]);

  const handleShortcutPreviewSelect = useCallback((result: Generation) => {
    setSelectedShortcutPreviewResult(result);
  }, []);

  const handleShortcutTemplateFieldChange = useCallback((fieldId: string, value: string) => {
    const current = activeShortcutTemplateRef.current;
    if (!current) {
      return;
    }

    const nextValues = {
      ...current.values,
      [fieldId]: value,
    };
    const activeVariant = current.optimizationSession
      ? findShortcutVariant(current.optimizationSession, current.optimizationSession.activeVariantId)
      : null;
    const nextPalette = activeVariant
      ? deriveVariantPalette(
        current.shortcut,
        nextValues,
        current.removedFieldIds,
        activeVariant.analysis,
        activeVariant.palette,
      )
      : null;
    const nextPrompt = activeVariant
      ? buildKvVariantPromptPreview(
        current.shortcut,
        nextValues,
        current.removedFieldIds,
        activeVariant.analysis,
        nextPalette || activeVariant.palette,
      )
      : buildShortcutPrompt(current.shortcut, nextValues, {
        removedFieldIds: current.removedFieldIds,
      });

    const nextOptimizationSession = current.optimizationSession
      ? {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === current.optimizationSession?.activeVariantId
            ? {
              ...variant,
              values: nextValues,
              palette: nextPalette ? cloneDesignPalette(nextPalette) : variant.palette,
              promptPreview: nextPrompt,
            }
            : variant
        )),
      }
      : undefined;

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: nextValues,
      removedFieldIds: current.removedFieldIds,
      appliedPrompt: nextPrompt,
      optimizationSession: nextOptimizationSession,
    });
    updateConfig({ prompt: nextPrompt });
  }, [updateConfig]);

  const handleShortcutTemplateFieldRemove = useCallback((fieldId: string) => {
    const current = activeShortcutTemplateRef.current;
    if (!current || current.removedFieldIds.includes(fieldId)) {
      return;
    }

    const nextRemovedFieldIds = [...current.removedFieldIds, fieldId];
    const activeVariant = current.optimizationSession
      ? findShortcutVariant(current.optimizationSession, current.optimizationSession.activeVariantId)
      : null;
    const nextPalette = activeVariant
      ? deriveVariantPalette(
        current.shortcut,
        current.values,
        nextRemovedFieldIds,
        activeVariant.analysis,
        activeVariant.palette,
      )
      : null;
    const nextPrompt = activeVariant
      ? buildKvVariantPromptPreview(
        current.shortcut,
        current.values,
        nextRemovedFieldIds,
        activeVariant.analysis,
        nextPalette || activeVariant.palette,
      )
      : buildShortcutPrompt(current.shortcut, current.values, {
        removedFieldIds: nextRemovedFieldIds,
      });

    const nextOptimizationSession = current.optimizationSession
      ? {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === current.optimizationSession?.activeVariantId
            ? {
              ...variant,
              removedFieldIds: nextRemovedFieldIds,
              palette: nextPalette ? cloneDesignPalette(nextPalette) : variant.palette,
              promptPreview: nextPrompt,
            }
            : variant
        )),
      }
      : undefined;

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: current.values,
      removedFieldIds: nextRemovedFieldIds,
      appliedPrompt: nextPrompt,
      optimizationSession: nextOptimizationSession,
    });
    updateConfig({ prompt: nextPrompt });
  }, [updateConfig]);

  const handleShortcutOptimizationVariantSelect = useCallback((variantId: KvStructuredVariantId) => {
    const current = activeShortcutTemplateRef.current;
    if (!current?.optimizationSession) {
      return;
    }

    const nextVariant = findShortcutVariant(current.optimizationSession, variantId);
    if (!nextVariant) {
      return;
    }

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: cloneShortcutValues(nextVariant.values),
      removedFieldIds: [...nextVariant.removedFieldIds],
      appliedPrompt: nextVariant.promptPreview,
      optimizationSession: {
        ...current.optimizationSession,
        activeVariantId: variantId,
      },
    });
    updateConfig({ prompt: nextVariant.promptPreview });
  }, [updateConfig]);

  const handleShortcutOptimizationAnalysisSectionChange = useCallback((
    sectionKey: DesignAnalysisSectionKey,
    nextSection: DesignStructuredAnalysis[DesignAnalysisSectionKey],
  ) => {
    const current = activeShortcutTemplateRef.current;
    if (!current?.optimizationSession) {
      return;
    }

    const activeVariantId = current.optimizationSession.activeVariantId;
    const activeVariant = findShortcutVariant(current.optimizationSession, activeVariantId);
    if (!activeVariant) {
      return;
    }

    const nextAnalysis = {
      ...activeVariant.analysis,
      [sectionKey]: {
        tokens: [...nextSection.tokens],
        detailText: nextSection.detailText,
      },
    };
    const nextPalette = deriveVariantPalette(
      current.shortcut,
      current.values,
      current.removedFieldIds,
      nextAnalysis,
      activeVariant.palette,
    );
    const nextPrompt = buildKvVariantPromptPreview(
      current.shortcut,
      current.values,
      current.removedFieldIds,
      nextAnalysis,
      nextPalette,
    );

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: current.values,
      removedFieldIds: current.removedFieldIds,
      appliedPrompt: nextPrompt,
      optimizationSession: {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === activeVariantId
            ? {
              ...variant,
              analysis: nextAnalysis,
              palette: cloneDesignPalette(nextPalette),
              promptPreview: nextPrompt,
            }
            : variant
        )),
      },
    });
    updateConfig({ prompt: nextPrompt });
  }, [updateConfig]);

  const handleShortcutOptimizationPaletteChange = useCallback((
    nextPalette: DesignStructuredPaletteEntry[],
  ) => {
    const current = activeShortcutTemplateRef.current;
    if (!current?.optimizationSession) {
      return;
    }

    const activeVariantId = current.optimizationSession.activeVariantId;
    const activeVariant = findShortcutVariant(current.optimizationSession, activeVariantId);
    if (!activeVariant) {
      return;
    }

    const previousPalette = normalizeDesignPalette(activeVariant.palette);
    let nextValues = cloneShortcutValues(current.values);
    let nextAnalysis = cloneDesignAnalysis(activeVariant.analysis);
    const normalizedPalette = normalizeDesignPalette(nextPalette);

    previousPalette.forEach((previousEntry, index) => {
      const nextEntry = normalizedPalette[index];
      if (!nextEntry) {
        return;
      }

      if (previousEntry.hex !== nextEntry.hex) {
        nextValues = replaceColorInShortcutValues(nextValues, previousEntry.hex, nextEntry.hex);
        nextAnalysis = replaceColorInAnalysis(nextAnalysis, previousEntry.hex, nextEntry.hex);
      }

      if (previousEntry.weight !== nextEntry.weight) {
        nextAnalysis = replacePaletteWeightsInAnalysis(
          nextAnalysis,
          nextEntry.hex,
          previousEntry.weight,
          nextEntry.weight,
        );
      }
    });

    const syncedPalette = deriveVariantPalette(
      current.shortcut,
      nextValues,
      current.removedFieldIds,
      nextAnalysis,
      normalizedPalette,
    );
    const nextPrompt = buildKvVariantPromptPreview(
      current.shortcut,
      nextValues,
      current.removedFieldIds,
      nextAnalysis,
      syncedPalette,
    );

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: nextValues,
      removedFieldIds: current.removedFieldIds,
      appliedPrompt: nextPrompt,
      optimizationSession: {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === activeVariantId
            ? {
              ...variant,
              values: cloneShortcutValues(nextValues),
              analysis: nextAnalysis,
              palette: syncedPalette,
              promptPreview: nextPrompt,
            }
            : variant
        )),
      },
    });
    updateConfig({ prompt: nextPrompt });
  }, [updateConfig]);

  const handleShortcutOptimizationEditInstructionChange = useCallback((instruction: string) => {
    const current = activeShortcutTemplateRef.current;
    if (!current?.optimizationSession) {
      return;
    }

    const activeVariantId = current.optimizationSession.activeVariantId;
    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: current.values,
      removedFieldIds: current.removedFieldIds,
      appliedPrompt: current.appliedPrompt,
      optimizationSession: {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === activeVariantId
            ? {
              ...variant,
              pendingInstruction: instruction,
              pendingScope: 'variant',
            }
            : variant
        )),
      },
    });
  }, []);

  const handleShortcutOptimizationPrefillInstruction = useCallback((
    instruction: string,
    scope: DesignVariantEditScope = 'variant',
  ) => {
    const current = activeShortcutTemplateRef.current;
    if (!current?.optimizationSession) {
      return;
    }

    const activeVariantId = current.optimizationSession.activeVariantId;
    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: current.values,
      removedFieldIds: current.removedFieldIds,
      appliedPrompt: current.appliedPrompt,
      optimizationSession: {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === activeVariantId
            ? {
              ...variant,
              pendingInstruction: instruction,
              pendingScope: scope,
            }
            : variant
        )),
      },
    });
  }, []);

  const handleShortcutOptimizationRestoreVariant = useCallback(() => {
    const current = activeShortcutTemplateRef.current;
    if (!current?.optimizationSession) {
      return;
    }

    const activeVariantId = current.optimizationSession.activeVariantId;
    const activeVariant = findShortcutVariant(current.optimizationSession, activeVariantId);
    if (!activeVariant) {
      return;
    }

    const baseline = cloneVariantBaseline(activeVariant.baseline);
    const restoredVariant: ShortcutOptimizationVariantDraft = {
      ...activeVariant,
      label: baseline.label,
      values: cloneShortcutValues(baseline.values),
      removedFieldIds: [...baseline.removedFieldIds],
      coreSuggestions: cloneShortcutValues(baseline.coreSuggestions),
      palette: cloneDesignPalette(baseline.palette),
      analysis: cloneDesignAnalysis(baseline.analysis),
      promptPreview: baseline.promptPreview,
      pendingInstruction: "",
      pendingScope: 'variant',
      isModifying: false,
      baseline,
    };

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: cloneShortcutValues(restoredVariant.values),
      removedFieldIds: [...restoredVariant.removedFieldIds],
      appliedPrompt: restoredVariant.promptPreview,
      optimizationSession: {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === activeVariantId ? restoredVariant : variant
        )),
      },
    });
    updateConfig({ prompt: restoredVariant.promptPreview });
  }, [updateConfig]);

  const handleShortcutOptimizationApplyEdit = useCallback(async (
    scope: DesignVariantEditScope,
    instructionOverride?: string,
  ) => {
    const current = activeShortcutTemplateRef.current;
    if (!current?.optimizationSession) {
      return;
    }

    const activeVariantId = current.optimizationSession.activeVariantId;
    const activeVariant = findShortcutVariant(current.optimizationSession, activeVariantId);
    if (!activeVariant) {
      return;
    }

    const rawInstruction = (instructionOverride ?? activeVariant.pendingInstruction).trim();
    const shouldSyncSectionDetailText = scope !== 'variant' && !rawInstruction;
    const sectionKey = scope as DesignAnalysisSectionKey;
    const currentSection = shouldSyncSectionDetailText
      ? activeVariant.analysis[sectionKey]
      : null;
    const normalizedTokens = currentSection
      ? currentSection.tokens.map((token) => token.trim()).filter(Boolean)
      : [];
    if (shouldSyncSectionDetailText && normalizedTokens.length === 0) {
      toast({
        title: '请先补充 Token',
        description: '至少保留一个 token，AI 才能根据 token 更新 Detail Text。',
        variant: 'destructive',
      });
      return;
    }

    const instruction = shouldSyncSectionDetailText
      ? buildDesignSectionDetailSyncInstruction({
        sectionKey,
        section: {
          tokens: normalizedTokens,
          detailText: currentSection?.detailText || '',
        },
      })
      : rawInstruction;
    if (!instruction) {
      toast({
        title: '请输入修改要求',
        description: '可以点击快捷修改，或输入一句自然语言描述你想调整的方向。',
        variant: 'destructive',
      });
      return;
    }

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: current.values,
      removedFieldIds: current.removedFieldIds,
      appliedPrompt: current.appliedPrompt,
      optimizationSession: {
        ...current.optimizationSession,
        variants: current.optimizationSession.variants.map((variant) => (
          variant.id === activeVariantId
            ? {
              ...variant,
              pendingInstruction: rawInstruction,
              pendingScope: scope,
              isModifying: true,
            }
            : variant
        )),
      },
    });

    try {
      const nextVariant = await requestDesignVariantEdit({
        instruction,
        scope,
        variant: activeVariant,
        shortcut: current.shortcut,
        values: current.values,
        removedFieldIds: current.removedFieldIds,
      });

      const nextValues = mergeLockedKvValues(current.values, nextVariant.coreFields);
      const nextPalette = deriveVariantPalette(
        current.shortcut,
        nextValues,
        current.removedFieldIds,
        nextVariant.analysis,
        nextVariant.palette,
        nextVariant.promptPreview,
      );
      const nextPrompt = buildKvVariantPromptPreview(
        current.shortcut,
        nextValues,
        current.removedFieldIds,
        nextVariant.analysis,
        nextPalette,
      );

      const latest = activeShortcutTemplateRef.current;
      if (!latest?.optimizationSession) {
        return;
      }
      const shouldSyncActiveView = latest.optimizationSession.activeVariantId === activeVariantId;

      if (shouldSyncSectionDetailText) {
        const latestVariant = findShortcutVariant(latest.optimizationSession, activeVariantId);
        if (!latestVariant) {
          return;
        }

        const latestSection = latestVariant.analysis[sectionKey];
        const nextAnalysis: DesignStructuredAnalysis = {
          ...cloneDesignAnalysis(latestVariant.analysis),
          [sectionKey]: {
            tokens: [...latestSection.tokens],
            detailText: nextVariant.analysis[sectionKey].detailText.trim() || latestSection.detailText,
          },
        };
        const nextPalette = deriveVariantPalette(
          latest.shortcut,
          latestVariant.values,
          latestVariant.removedFieldIds,
          nextAnalysis,
          latestVariant.palette,
        );
        const nextPrompt = buildKvVariantPromptPreview(
          latest.shortcut,
          latestVariant.values,
          latestVariant.removedFieldIds,
          nextAnalysis,
          nextPalette,
        );

        setActiveShortcutTemplate({
          shortcut: latest.shortcut,
          values: shouldSyncActiveView ? cloneShortcutValues(latestVariant.values) : latest.values,
          removedFieldIds: shouldSyncActiveView ? [...latestVariant.removedFieldIds] : latest.removedFieldIds,
          appliedPrompt: shouldSyncActiveView ? nextPrompt : latest.appliedPrompt,
          optimizationSession: {
            ...latest.optimizationSession,
            variants: latest.optimizationSession.variants.map((variant) => (
              variant.id === activeVariantId
                ? {
                  ...variant,
                  analysis: nextAnalysis,
                  palette: cloneDesignPalette(nextPalette),
                  promptPreview: nextPrompt,
                  pendingInstruction: '',
                  pendingScope: 'variant',
                  isModifying: false,
                }
                : variant
            )),
          },
        });
        if (shouldSyncActiveView) {
          updateConfig({ prompt: nextPrompt });
        }
        return;
      }

      setActiveShortcutTemplate({
        shortcut: latest.shortcut,
        values: shouldSyncActiveView ? cloneShortcutValues(nextValues) : latest.values,
        removedFieldIds: shouldSyncActiveView ? current.removedFieldIds : latest.removedFieldIds,
        appliedPrompt: shouldSyncActiveView ? nextPrompt : latest.appliedPrompt,
        optimizationSession: {
          ...latest.optimizationSession,
          variants: latest.optimizationSession.variants.map((variant) => (
            variant.id === activeVariantId
              ? {
                ...variant,
                label: nextVariant.label,
                values: cloneShortcutValues(nextValues),
                removedFieldIds: [...current.removedFieldIds],
                coreSuggestions: {
                  ...createEmptyCoreSuggestionValues(),
                  ...nextVariant.coreSuggestions,
                },
                palette: cloneDesignPalette(nextPalette),
                analysis: cloneDesignAnalysis(nextVariant.analysis),
                promptPreview: nextPrompt,
                pendingInstruction: '',
                pendingScope: 'variant',
                isModifying: false,
              }
              : variant
          )),
        },
      });
      if (shouldSyncActiveView) {
        updateConfig({ prompt: nextPrompt });
      }
    } catch (error) {
      console.error('Failed to edit structured variant', error);
      const latest = activeShortcutTemplateRef.current;
      if (!latest?.optimizationSession) {
        return;
      }
      setActiveShortcutTemplate({
        shortcut: latest.shortcut,
        values: latest.values,
        removedFieldIds: latest.removedFieldIds,
        appliedPrompt: latest.appliedPrompt,
        optimizationSession: {
          ...latest.optimizationSession,
          variants: latest.optimizationSession.variants.map((variant) => (
            variant.id === activeVariantId
              ? {
                ...variant,
                pendingInstruction: rawInstruction,
                pendingScope: scope,
                isModifying: false,
              }
              : variant
          )),
        },
      });
      toast({
        title: shouldSyncSectionDetailText ? 'AI 更新 Detail Text 失败' : 'AI 微调失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  }, [requestDesignVariantEdit, toast, updateConfig]);

  const handleExitShortcutTemplate = useCallback(() => {
    setActiveShortcutTemplate(null);
  }, []);

  const handleClearShortcutTemplate = useCallback(() => {
    setActiveShortcutTemplate(null);
    setSelectedPresetName(undefined);
    setSelectedWorkflowConfig(undefined);
    applyModel(defaultImageModelId, {
      prompt: "",
      model: defaultImageModelId,
      baseModel: defaultImageModelId,
      width: config.width,
      height: config.height,
      loras: [],
      presetName: undefined,
      workflowName: undefined,
      isPreset: false,
      isEdit: false,
      editConfig: undefined,
      generationMode: "playground",
    });
  }, [applyModel, config.height, config.width, defaultImageModelId, setSelectedPresetName, setSelectedWorkflowConfig]);

  const handlePromptGenerate = useCallback(() => {
    const current = activeShortcutTemplateRef.current;
    if (current) {
      const missingFields = getShortcutMissingFields(current.shortcut, current.values, {
        removedFieldIds: current.removedFieldIds,
      });
      if (missingFields.length > 0) {
        toast({
          title: "请先补全模板信息",
          description: `还缺少：${missingFields.slice(0, 3).map((field) => field.label).join('、')}`,
          variant: "destructive",
        });
        return;
      }
    }

    void handleGenerate({});
  }, [handleGenerate, toast]);

  const handleGenerateAllShortcutVariants = useCallback(async () => {
    const current = activeShortcutTemplateRef.current;
    const optimizationSession = current?.optimizationSession;

    if (!current || !optimizationSession) {
      handlePromptGenerate();
      return;
    }

    const readyVariants: ShortcutOptimizationVariantDraft[] = [];
    const skippedVariantIds: string[] = [];

    optimizationSession.variants.forEach((variant) => {
      const missingFields = getShortcutMissingFields(current.shortcut, variant.values, {
        removedFieldIds: variant.removedFieldIds,
      });

      if (missingFields.length > 0) {
        skippedVariantIds.push(variant.id.toUpperCase());
        return;
      }

      readyVariants.push(variant);
    });

    if (readyVariants.length === 0) {
      toast({
        title: "没有可生成的版本",
        description: "请先补全至少一个版本中的必填字段。",
        variant: "destructive",
      });
      return;
    }

    if (skippedVariantIds.length > 0) {
      toast({
        title: "已跳过未完成版本",
        description: `${skippedVariantIds.join('、')} 还有必填字段未补全，其余版本会继续生成。`,
      });
    }

    for (const variant of readyVariants) {
      const currentConfig = usePlaygroundStore.getState().config;
      const variantTaskId = `${Date.now()}-${variant.id}-${Math.random().toString(36).substring(2, 7)}`;
      await handleGenerate({
        configOverride: {
          ...currentConfig,
          prompt: variant.promptPreview,
          taskId: undefined,
        },
        taskId: variantTaskId,
        batchSizeOverride: 4,
      });
    }
  }, [handleGenerate, handlePromptGenerate, toast]);

  const handlePresetSelect = (p: PresetExtended) => {
    const preset = p as PresetExtended;
    const effectiveConfig = (preset.config as GenerationConfig) || (preset as unknown as GenerationConfig);
    const workflowId = (preset as PresetExtended & { workflow_id?: string }).workflow_id || effectiveConfig.presetName;
    const presetName = (preset as PresetExtended & { title?: string; name?: string }).title || (preset as PresetExtended & { title?: string; name?: string }).name || effectiveConfig.presetName || 'Preset';
    setActiveShortcutTemplate(null);

    if (preset.editConfig) {
      const legacySnapshot = (preset.editConfig.tldrawSnapshot || effectiveConfig.tldrawSnapshot) as Record<string, unknown> | undefined;
      const initialSession =
        (preset.editConfig.imageEditorSession as ImageEditorSessionSnapshot | undefined)
        || (effectiveConfig.imageEditorSession as ImageEditorSessionSnapshot | undefined);

      setImageEditState({
        open: true,
        imageUrl: formatImageUrl(preset.editConfig.originalImageUrl, true),
        initialPrompt: effectiveConfig.prompt || '',
        initialSession,
        legacySnapshot,
        parentId: undefined,
      });
      setSelectedPresetName(undefined);
    } else {
      setImageEditState((previous) => ({ ...previous, open: false }));
    }

    // If it's a workflow preset, find and select the workflow first
    if (workflowId) {
      const workflow = workflows.find(w => w.viewComfyJSON.id === workflowId);
      if (workflow) {
        setSelectedWorkflowConfig(workflow, presetName);
        setSelectedModel(MODEL_ID_WORKFLOW);

        // 比例和尺寸处理
        const resSize = effectiveConfig.imageSize || '1K';
        const arName = effectiveConfig.aspectRatio || '1:1';
        const dims = AR_MAP[arName]?.[resSize] || { w: effectiveConfig.width || 1024, h: effectiveConfig.height || 1024 };

        // Apply fixed config from preset
        setConfig(prev => ({
          ...prev,
          prompt: effectiveConfig.prompt || '',
          width: dims.w,
          height: dims.h,
          model: effectiveConfig.model || MODEL_ID_WORKFLOW,
          imageSize: resSize,
          aspectRatio: arName as GenerationConfig['aspectRatio'],
          presetName: preset.editConfig ? undefined : presetName,
          isPreset: !preset.editConfig,
          isEdit: !!preset.editConfig
        }));
        // Then apply remaining defaults from workflow (loras, etc)
        applyWorkflowDefaults(workflow);
      }
    } else {
      // Regular preset
      const modelToSet = effectiveConfig.model || 'Nano banana';
      const resSize = effectiveConfig.imageSize || '1K';
      const arName = effectiveConfig.aspectRatio || '1:1';
      const dims = AR_MAP[arName]?.[resSize] || { w: effectiveConfig.width || 1024, h: effectiveConfig.height || 1024 };

      setConfig(prev => ({
        ...prev,
        ...effectiveConfig,
        presetName: preset.editConfig ? undefined : presetName,
        loras: effectiveConfig.loras || [],
        model: modelToSet,
        width: dims.w,
        height: dims.h,
        imageSize: resSize,
        aspectRatio: arName as GenerationConfig['aspectRatio'],
        isPreset: !preset.editConfig,
        isEdit: !!preset.editConfig
      }));
      setSelectedWorkflowConfig(undefined, undefined);
      if (modelToSet !== config.model) {
        setSelectedModel(modelToSet);
      }
    }

    if (!preset.editConfig) {
      setSelectedPresetName(presetName);
    }
    setIsPresetGridOpen(false);
  };
  const runKvStructuredOptimization = React.useCallback(async (templateSnapshot?: ActiveShortcutTemplate | null) => {
    const current = templateSnapshot || activeShortcutTemplateRef.current;
    if (!current || !isKvShortcutId(current.shortcut.id)) {
      return false;
    }

    const sourceValues = cloneShortcutValues(current.optimizationSession?.originValues || current.values);
    const sourceRemovedFieldIds = [...(current.optimizationSession?.originRemovedFieldIds || current.removedFieldIds)];
    const optimizationInput = buildKvStructuredOptimizationInput(
      current.shortcut,
      sourceValues,
      sourceRemovedFieldIds,
    );

    const optimizedText = await optimizePrompt(optimizationInput, selectedAIModel);
    console.info("[KV structured optimization] raw_response", optimizedText);

    if (!optimizedText) {
      return true;
    }

    try {
      const parsedResponse = parseDesignStructuredOptimizationResponse(optimizedText);
      const variants = createShortcutOptimizationVariants(
        current.shortcut,
        sourceValues,
        sourceRemovedFieldIds,
        optimizedText,
      );
      const activeVariant = variants[0];

      setActiveShortcutTemplate({
        shortcut: current.shortcut,
        values: cloneShortcutValues(activeVariant.values),
        removedFieldIds: [...activeVariant.removedFieldIds],
        appliedPrompt: activeVariant.promptPreview,
        optimizationSession: {
          sourceType: parsedResponse.sourceType,
          originValues: sourceValues,
          originRemovedFieldIds: sourceRemovedFieldIds,
          activeVariantId: activeVariant.id,
          variants,
          lastRawResponse: optimizedText,
        },
      });
      updateConfig({ prompt: activeVariant.promptPreview });
      toast({
        title: "AI 已生成 2 个版本",
        description: "可在输入区直接切换版本并继续编辑。",
      });
    } catch (error) {
      console.error("Failed to parse KV structured optimization response", error);
      toast({
        title: "AI 优化结果解析失败",
        description: "返回结果已尝试自动修复，但仍然无法解析，请重新请求一次。",
        variant: "destructive",
      });
    }

    return true;
  }, [optimizePrompt, selectedAIModel, toast, updateConfig]);

  const handleShortcutOptimizationRegenerate = React.useCallback(async () => {
    await runKvStructuredOptimization();
  }, [runKvStructuredOptimization]);

  const handleOptimizePrompt = React.useCallback(async () => {
    const shortcutTemplateSnapshot = activeShortcutTemplateRef.current;

    if (shortcutTemplateSnapshot) {
      setActiveShortcutTemplate(null);
    }

    const handledByKvFlow = await runKvStructuredOptimization(shortcutTemplateSnapshot);
    if (handledByKvFlow) {
      return;
    }

    const optimizedText = await optimizePrompt(config.prompt, selectedAIModel);
    if (optimizedText) setConfig(prev => ({ ...prev, prompt: optimizedText }));
  }, [config.prompt, optimizePrompt, runKvStructuredOptimization, selectedAIModel, setConfig]);

  const handleDescribe = React.useCallback(async (mode: 'short' | 'json' = 'short') => {
    if (describeImages.length === 0) {
      toast({ title: "错误", description: "请先上传图片", variant: "destructive" });
      return;
    }

    setIsDescribing(true);
    setHasGenerated(true); // Trigger split layout immediately like generate
    setViewMode('dock');
    setActiveTab('history');
    setShowHistory(true); // Auto-expand history panel

    const startTime = new Date().toISOString();
    // Create a unified taskId for the entire batch to ensure grouping
    const batchTaskId = Date.now().toString() + Math.random().toString(36).substring(2, 7);

    // Create a temporary loading card
    const loadingId = `describe-loading-${Date.now()}`;
    const image = describeImages[0];
    const imageUrl = image.path || image.previewUrl;

    const loadingCard: import('@/types/database').Generation = {
      id: loadingId,
      userId: effectiveUserId,
      projectId: 'default',
      outputUrl: imageUrl,
      config: {
        prompt: "Analyzing image...",
        width: config.width,
        height: config.height,
        model: config.model,
        loras: config.loras,
        isEdit: false,
        taskId: batchTaskId,
        sourceImageUrls: [imageUrl],
      },
      status: 'pending',
      createdAt: startTime,
    };

    // Insert loading card
    setGenerationHistory((prev: import('@/types/database').Generation[]) => [loadingCard, ...prev]);

    try {
      // 1. Convert the first image to base64 if needed, or use existing base64
      let base64 = describeImages[0].base64;
      if (!base64 && describeImages[0].previewUrl.startsWith('data:')) {
        base64 = describeImages[0].previewUrl.split(',')[1];
      }

      if (!base64 && imageUrl.startsWith('data:')) {
        base64 = imageUrl.split(',')[1];
      }

      if (!base64) {
        throw new Error("无法获取图片数据");
      }

      // 2. Call unified Vision service
      const describeServiceModelId = getServiceConfig('describe').modelId;
      const modelId = mode === 'json' ? 'coze-professional-describe' : (describeServiceModelId || 'gemini-3-pro-image-preview');
      const systemPrompt = mode === 'json' ? "" : VISION_DESCRIBE_SYSTEM_PROMPT;

      const result = await callVision({
        image: `data:image/png;base64,${base64}`,
        model: modelId,
        systemPrompt: systemPrompt
      });

      const text = result?.text || "";
      let results: string[] = [];

      if (mode === 'json') {
        try {
          const parsed = parseDesignStructuredOptimizationResponse(text);
          results = parsed.variants
            .map((variant) => variant.promptPreview.trim())
            .filter(Boolean);
        } catch (parseError) {
          console.warn("[Describe][json] failed to parse structured response, falling back to raw text", parseError);
          results = [text.trim()].filter(Boolean);
        }
      } else {
        results = text.split('|||').map((s: string) => s.trim()).filter(Boolean);
      }

      if (results.length > 0) {
        // Create history cards for each description result
        const newHistoryItems: import('@/types/database').Generation[] = results.map((desc: string, index: number) => ({
          id: `describe-${Date.now()}-${index}`,
          userId: effectiveUserId,
          projectId: 'default',
          outputUrl: imageUrl,
          config: {
            prompt: desc,
            width: config.width || 1024,
            height: config.height || 1024,
            model: modelId,
            loras: config.loras,
            taskId: batchTaskId,
            sourceImageUrls: [imageUrl],
          },
          status: 'completed',
          createdAt: startTime,
        }));

        // Remove loading card and add real results
        setGenerationHistory((prev: import('@/types/database').Generation[]) => [...newHistoryItems, ...prev.filter(item => item.id !== loadingId)]);

        // Also save each description to backend and sync to gallery
        newHistoryItems.forEach(item => {
          saveHistoryToBackend(item);
          usePlaygroundStore.getState().addGalleryItem(item);
        });

        toast({ title: "描述成功", description: `已生成 ${results.length} 组描述卡片` });
      } else {
        throw new Error("解析描述结果失败");
      }
    } catch (error) {
      console.error("Describe Error:", error);
      // Remove loading card on error
      setGenerationHistory((prev: import('@/types/database').Generation[]) => prev.filter(item => item.id !== loadingId));
      toast({ title: "描述失败", description: error instanceof Error ? error.message : "未知错误", variant: "destructive" });
    } finally {
      setIsDescribing(false);
    }
  }, [describeImages, setHasGenerated, setViewMode, setActiveTab, setShowHistory, config, setGenerationHistory, callVision, getServiceConfig, toast, effectiveUserId, saveHistoryToBackend]);

  const handleBatchUse = async (results: Generation[]) => {
    if (!results || results.length === 0) return;
    toast({ title: "批量生成中", description: `即将开始 ${results.length} 个生成任务...` });
    for (const result of results) {
      const newConfig = { ...config, prompt: result.config?.prompt || "" };
      await handleGenerate({ configOverride: newConfig });
      await new Promise(r => setTimeout(r, 200));
    }
  };


  const handleRegenerate = async (result: Generation) => {
    // 1. 从原始记录配置中提取参数，显式排除 taskId，确保 rerun 产生新分组
    const originalRecordConfig = { ...(result.config || {}) };
    delete originalRecordConfig.taskId;

    // 2. 从当前状态中提取通用配置，同样显式排除可能存在的陈旧 taskId
    const currentStoreConfig = { ...usePlaygroundStore.getState().config };
    delete currentStoreConfig.taskId;

    // 3. 构建完整的 rerun 配置，以原始记录的参数为准
    const fullConfig: GenerationConfig = {
      ...currentStoreConfig,
      ...originalRecordConfig,
      // 显式确保这些字段保持原始记录的状态
      prompt: originalRecordConfig.prompt || '',
      width: originalRecordConfig.width || 1024,
      height: originalRecordConfig.height || 1024,
      model: originalRecordConfig.model || currentStoreConfig.model,
      baseModel: originalRecordConfig.baseModel || currentStoreConfig.baseModel,
      loras: originalRecordConfig.loras || [],
      isEdit: originalRecordConfig.isEdit || false,
      editConfig: originalRecordConfig.editConfig,
      parentId: originalRecordConfig.parentId,
      // 显式让 taskId 为空，让 handleGenerate 生成一个全新的 ID
      taskId: undefined,
    };

    // 4. 计算应该使用的参考图列表
    const sourceImageUrls = originalRecordConfig.sourceImageUrls ||
      (originalRecordConfig.editConfig?.referenceImages?.map(img => img.dataUrl) || []);
    const localSourceIds = originalRecordConfig.localSourceIds || [];

    // 5. 执行生成
    await handleGenerate({
      configOverride: fullConfig,
      sourceImageUrls,
      localSourceIds
    });
  };

  const handleDownload = (imageUrl: string) => {
    downloadImage(imageUrl, `PlaygroundV2-${Date.now()}.png`);
  };

  const handleEditImage = useCallback((historyItem: Generation, isAgain?: boolean) => {
    const getSessionFromGeneration = (item?: Generation): ImageEditorSessionSnapshot | undefined => (
      (item?.config?.imageEditorSession as ImageEditorSessionSnapshot | undefined)
      || (item?.config?.editConfig?.imageEditorSession as ImageEditorSessionSnapshot | undefined)
    );

    const getLegacySnapshotFromGeneration = (item?: Generation): Record<string, unknown> | undefined => (
      (item?.config?.tldrawSnapshot as Record<string, unknown> | undefined)
      || (item?.config?.editConfig?.tldrawSnapshot as Record<string, unknown> | undefined)
    );

    const isEditGeneration = (item?: Generation): boolean => Boolean(
      item?.config?.isEdit
      || item?.config?.imageEditorSession
      || item?.config?.editConfig?.imageEditorSession
      || item?.config?.editConfig?.originalImageUrl
      || item?.config?.tldrawSnapshot
      || item?.config?.editConfig?.tldrawSnapshot
    );

    let initialSession = getSessionFromGeneration(historyItem);
    let legacySnapshot = getLegacySnapshotFromGeneration(historyItem);
    let imageUrl = historyItem.outputUrl;

    if (isAgain) {
      const visited = new Set<string>();
      let cursor: Generation | undefined = historyItem;
      let resolvedOriginalUrl =
        (historyItem.config?.editConfig as EditPresetConfig | undefined)?.originalImageUrl
        || '';

      while (cursor && cursor.id && !visited.has(cursor.id)) {
        visited.add(cursor.id);

        const cursorSession = getSessionFromGeneration(cursor);
        if (cursorSession) {
          initialSession = cursorSession;
        }

        if (!legacySnapshot) {
          legacySnapshot = getLegacySnapshotFromGeneration(cursor);
        }

        const cursorOriginalUrl =
          (cursor.config?.editConfig as EditPresetConfig | undefined)?.originalImageUrl;
        if (cursorOriginalUrl) {
          resolvedOriginalUrl = cursorOriginalUrl;
        }

        const parentRecordId: string | undefined = cursor.config?.parentId as string | undefined;
        if (!parentRecordId) {
          break;
        }

        const parentGeneration: Generation | undefined = generationHistory.find((historyEntry: Generation) => historyEntry.id === parentRecordId);
        if (!parentGeneration) {
          break;
        }

        if (!isEditGeneration(parentGeneration) && parentGeneration.outputUrl) {
          resolvedOriginalUrl = parentGeneration.outputUrl;
          const parentSession = getSessionFromGeneration(parentGeneration);
          if (parentSession) {
            initialSession = parentSession;
          }
          break;
        }

        cursor = parentGeneration;
      }

      imageUrl = resolvedOriginalUrl || historyItem.outputUrl;
    }

    const normalizedImageUrl = formatImageUrl(imageUrl, true);

    setImageEditState({
      open: true,
      imageUrl: normalizedImageUrl,
      initialPrompt: historyItem.config.prompt || '',
      initialSession,
      legacySnapshot,
      parentId: historyItem.id,
    });

    updateConfig({
      isEdit: true,
      parentId: historyItem.id,
      prompt: historyItem.config.prompt,
      loras: [],
      isPreset: false,
      presetName: undefined,
      imageEditorSession: initialSession,
    });
    setSelectedPresetName(undefined);
  }, [generationHistory, setSelectedPresetName, updateConfig]);

  const handleEditUploadedImage = useCallback(() => {
    const imageToEdit = usePlaygroundStore.getState().uploadedImages[0];
    const imageUrl = imageToEdit ? (imageToEdit.path || imageToEdit.previewUrl) : "";
    const currentConfig = usePlaygroundStore.getState().config;

    const normalizedImageUrl = formatImageUrl(imageUrl, true);

    setImageEditState({
      open: true,
      imageUrl: normalizedImageUrl,
      initialPrompt: currentConfig.prompt || config.prompt || '',
      initialSession: currentConfig.imageEditorSession as ImageEditorSessionSnapshot | undefined,
      legacySnapshot: currentConfig.tldrawSnapshot as Record<string, unknown> | undefined,
      parentId: currentConfig.parentId,
    });

    updateConfig({
      isEdit: true,
      prompt: config.prompt,
      loras: [],
      isPreset: false,
      presetName: undefined,
    });
    setSelectedPresetName(undefined);
  }, [config.prompt, setSelectedPresetName, updateConfig]);

  const handleImageEditConfirm = useCallback(async (payload: ImageEditConfirmPayload) => {
    try {
      const response = await fetch(payload.mergedImageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `image-edit-${Date.now()}.png`, { type: 'image/png' });
      const currentEditConfig = usePlaygroundStore.getState().config.editConfig as EditPresetConfig | undefined;
      const nextEditConfig: EditPresetConfig = {
        ...currentEditConfig,
        canvasJson: currentEditConfig?.canvasJson || {},
        referenceImages: currentEditConfig?.referenceImages || [],
        annotations: currentEditConfig?.annotations || [],
        backgroundColor: currentEditConfig?.backgroundColor || 'transparent',
        canvasSize: {
          width: payload.sessionSnapshot.imageWidth,
          height: payload.sessionSnapshot.imageHeight,
        },
        originalImageUrl: imageEditState.imageUrl || currentEditConfig?.originalImageUrl || '',
        imageEditorSession: payload.sessionSnapshot,
      };

      setUploadedImages([]);
      await handleFilesUpload([file], 'reference');

      updateConfig({
        prompt: payload.finalPrompt,
        isEdit: true,
        isPreset: false,
        presetName: undefined,
        loras: [],
        parentId: imageEditState.parentId,
        imageEditorSession: payload.sessionSnapshot,
        editConfig: nextEditConfig,
      });

      if (imageEditState.parentId) {
        syncHistoryConfig({
          id: imageEditState.parentId,
          config: {
            imageEditorSession: payload.sessionSnapshot,
          },
        });
      }

      setSelectedPresetName(undefined);
      setImageEditState((previous) => ({
        ...previous,
        initialSession: payload.sessionSnapshot,
        legacySnapshot: undefined,
      }));

      await handleGenerate();

      toast({
        title: '已开始生成',
        description: '已自动使用编辑结果和编辑指令发起生成。',
      });
    } catch (error) {
      console.error('Failed to confirm image edit', error);
      toast({
        title: '编辑回填失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  }, [handleFilesUpload, handleGenerate, imageEditState.imageUrl, imageEditState.parentId, setSelectedPresetName, setUploadedImages, syncHistoryConfig, toast, updateConfig]);





  // Input UI Helper to avoid duplication
  const inputSectionProps = useMemo(() => ({
    showHistory: viewMode === 'dock', // Map dock mode to showHistory for layout adaptation
    config,
    uploadedImages,
    describeImages,
    isStackHovered,
    isInputFocused,
    isOptimizing,
    isGenerating,
    isDescribing,
    isDescribeMode: activeTab === 'describe', // Map describe tab to isDescribeMode
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
    handleGenerate: handlePromptGenerate,
    handleDescribe,
    setSelectedAIModel,
    setSelectedModel: (model: string) => {
      setActiveShortcutTemplate(null);
      applyModel(model);
    },
    setIsAspectRatioLocked,
    setSelectedWorkflowConfig,
    applyWorkflowDefaults,
    setIsSelectorExpanded,
    setBatchSize,
    setIsLoraDialogOpen,
    setIsPresetGridOpen,
    onClearPreset: () => {
      setSelectedPresetName(undefined);
      setSelectedWorkflowConfig(undefined);
      updateConfig({ presetName: undefined, isPreset: false });
    },
    setIsDescribeMode: (val: boolean) => {
      if (val) {
        setViewMode('dock');
        setActiveTab('describe');
      } else {
        // If attempting to close describe mode, maybe go to history?
        // Or stay in dock mode but change tab?
        // For now, if val is false, switch to history if we were in describe
        if (activeTab === 'describe') setActiveTab('history');
      }
    },
    setDescribeImages,
    setIsDraggingOver,
    setIsDraggingOverPanel,
    onReorderImages: setUploadedImages,
    activeShortcutName: activeShortcutTemplate?.shortcut.name,
    onClearShortcutTemplate: handleClearShortcutTemplate,
    shortcutTemplate: activeShortcutTemplate
      ? {
        shortcut: activeShortcutTemplate.shortcut,
        values: activeShortcutTemplate.values,
        removedFieldIds: activeShortcutTemplate.removedFieldIds,
        optimizationSession: activeShortcutTemplate.optimizationSession
          ? {
            originPrompt: buildShortcutPrompt(
              activeShortcutTemplate.shortcut,
              activeShortcutTemplate.optimizationSession.originValues,
              {
                usePlaceholder: false,
                removedFieldIds: activeShortcutTemplate.optimizationSession.originRemovedFieldIds,
              }
            ),
            activeVariantId: activeShortcutTemplate.optimizationSession.activeVariantId,
            variants: activeShortcutTemplate.optimizationSession.variants.map((variant) => ({
              id: variant.id,
              label: variant.label,
              coreSuggestions: variant.coreSuggestions,
              palette: variant.palette,
              analysis: variant.analysis,
              promptPreview: variant.promptPreview,
              pendingInstruction: variant.pendingInstruction,
              pendingScope: variant.pendingScope,
              isModifying: variant.isModifying,
            })),
          }
          : null,
      }
      : null,
    onShortcutTemplateFieldChange: handleShortcutTemplateFieldChange,
    onShortcutTemplateFieldRemove: handleShortcutTemplateFieldRemove,
    onExitShortcutTemplate: handleExitShortcutTemplate,
    onShortcutTemplateOptimize: handleOptimizePrompt,
    onShortcutTemplateVariantSelect: handleShortcutOptimizationVariantSelect,
    onShortcutTemplateRegenerate: handleShortcutOptimizationRegenerate,
    onShortcutTemplateGenerateCurrent: handlePromptGenerate,
    onShortcutTemplateGenerateAll: handleGenerateAllShortcutVariants,
    onShortcutTemplateAnalysisSectionChange: handleShortcutOptimizationAnalysisSectionChange,
    onShortcutTemplatePaletteChange: handleShortcutOptimizationPaletteChange,
    onShortcutTemplateEditInstructionChange: handleShortcutOptimizationEditInstructionChange,
    onShortcutTemplatePrefillInstruction: handleShortcutOptimizationPrefillInstruction,
    onShortcutTemplateApplyEdit: handleShortcutOptimizationApplyEdit,
    onShortcutTemplateRestoreVariant: handleShortcutOptimizationRestoreVariant,
  }), [
    viewMode, config, uploadedImages, describeImages, isStackHovered, isInputFocused,
    isOptimizing, isGenerating, isDescribing, activeTab, isDraggingOver,
    isDraggingOverPanel, isPresetGridOpen, isAspectRatioLocked,
    isSelectorExpanded, batchSize, selectedModel, selectedAIModel, selectedLoras,
    selectedPresetName, selectedWorkflowConfig, workflows, fileInputRef,
    describePanelRef, setConfig, setIsStackHovered, setIsInputFocused,
    setPreviewImage, removeImage, handleFilesUpload, handleOptimizePrompt,
    handlePromptGenerate, handleDescribe, setSelectedAIModel,
    setIsAspectRatioLocked, setSelectedWorkflowConfig, applyWorkflowDefaults,
    setIsSelectorExpanded, setBatchSize, setIsLoraDialogOpen,
    setIsPresetGridOpen, setDescribeImages, setIsDraggingOver,
    setIsDraggingOverPanel, setViewMode, setSelectedPresetName, setActiveTab, applyModel, updateConfig,
    setUploadedImages, activeShortcutTemplate, handleShortcutTemplateFieldChange,
    handleShortcutTemplateFieldRemove, handleExitShortcutTemplate, handleClearShortcutTemplate,
    handleShortcutOptimizationAnalysisSectionChange, handleShortcutOptimizationPaletteChange,
    handleShortcutOptimizationEditInstructionChange, handleShortcutOptimizationPrefillInstruction,
    handleShortcutOptimizationApplyEdit, handleShortcutOptimizationRestoreVariant,
    handleShortcutOptimizationRegenerate,
    handleShortcutOptimizationVariantSelect, handleGenerateAllShortcutVariants
  ]);
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex-1 relative p-6 pt-16 h-full flex flex-col overflow-hidden"
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();

          // 更严格的判定：只有真正拖入外部文件时才触发
          const hasFiles = e.dataTransfer?.types?.includes('Files');
          const hasItems = e.dataTransfer?.items && e.dataTransfer.items.length > 0;
          const isFileItem = hasItems && Array.from(e.dataTransfer.items).some(
            item => item.kind === 'file'
          );

          // 只有确认是文件拖入才设置拖拽状态和切换到 Describe
          if (hasFiles && isFileItem) {
            setIsDraggingOver(true);
            // 只有在非 Style Tab 下才自动切换到 Describe Tab
            if (activeTab !== 'describe' && activeTab !== 'style' && activeTab !== 'banner') {
              setViewMode('dock');
              setActiveTab('describe');
            }
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // 与 onDragEnter 保持一致的文件判定
          const hasFiles = e.dataTransfer?.types?.includes('Files');
          if (hasFiles && !isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Check if we are really leaving the window
          if (e.relatedTarget === null || (e.relatedTarget as Node).nodeName === 'HTML') {
            setIsDraggingOver(false);
            setIsDraggingOverPanel(false);
            // 如果退出且没有图片，自动收起 (Optional: Switch back to history?)
            // For persistent dock, we might want to stay in Describe
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          setIsDraggingOverPanel(false);

          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            if (activeTab === 'banner') {
              return;
            }
            const dropY = e.clientY;
            const windowHeight = window.innerHeight;

            // 如果是在 Style Tab 下，执行风格上传逻辑
            if (activeTab === 'style') {
              handleStyleUpload(files);
            } else if (activeTab === 'describe' || dropY < windowHeight * 0.4) {
              // 如果是在 Describe 面板区域附近（或当前面板已展开），上传到 Describe
              handleFilesUpload(files, 'describe');
            } else {
              toast({ title: "已添加参考图", description: "图片已上传至当前生成配置中" });
              handleFilesUpload(files, 'reference');
            }
          }
        }}
      >

        <div className="flex-1 bg-transparent border border-white/20 rounded-[2rem] overflow-hidden relative flex flex-col">
          <main className="relative h-full flex bg-transparent overflow-hidden">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
            />

            <div className="relative w-full h-full flex flex-col items-center">
              <PlaygroundBackground />

              {/* Dock Sidebar - Persistent in Dock Mode */}
              {viewMode === 'dock' && (
                <PlaygroundDockSidebar
                  activeTab={activeTab}
                  isDesktop={isDesktop}
                  uploadedImagesCount={uploadedImages.length}
                  onDescribeToggle={() => activeTab === 'describe' ? setActiveTab('history') : setActiveTab('describe')}
                  onEdit={handleEditUploadedImage}
                  onBannerToggle={() => {
                    if (activeTab === 'banner') {
                      setActiveTab('history');
                      return;
                    }
                    enterBannerMode();
                  }}
                  onHistory={() => setActiveTab('history')}
                  onGallery={() => setActiveTab('gallery')}
                  onStyle={() => setActiveTab('style')}
                />
              )}

              {/* 全局底部渐进模糊 - 仅在预设面板展开且历史记录隐藏时显示 */}
              {/* {isPresetGridOpen && viewMode === 'dock' && (
                <GradualBlur
                  position="bottom"
                  height="8rem"
                  strength={5}
                  animated={true}
                  duration="0.4s"
                  className="pointer-events-none z-30"
                />
              )} */}



              {/* 三栏布局 - Dock Mode 为 true 时启用 */}
              <div className={cn(
                "relative z-20 w-full  h-full",
                viewMode === 'dock'
                  ? "flex justify-center"
                  : "flex flex-col items-center justify-center"
              )}>

                {/* 中间内容区 */}
                <div className={cn(
                  "flex flex-col items-center relative z-30 w-full px-4 md:px-6",
                  (activeTab === 'gallery' || activeTab === 'style' || activeTab === 'banner')
                    ? "hidden"
                    : viewMode === 'dock'
                      ? "max-w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] xl:max-w-[1200px] 2xl:max-w-[1200px] mt-10 h-full pt-4 overflow-hidden"
                      : "max-w-full sm:max-w-[540px] md:max-w-[720px] lg:max-w-[800px] xl:max-w-[900px] 2xl:max-w-[1000px]",
                  (viewMode === 'home') && (
                    isPresetGridOpen
                      ? "mt-0"
                      : hasStructuredShortcutSession
                        ? "mt-0 min-h-[calc(100vh-10rem)] justify-center"
                        : "-mt-60"
                  )
                )}>

                  <div className={cn(
                    "flex flex-col w-full items-center relative z-30",
                    (viewMode === 'dock') && "h-full",
                    viewMode === 'home' && hasStructuredShortcutSession && "justify-center"
                  )}>


                    {/* Input UI - Always present but layout changes based on viewMode */}
                    {activeTab !== 'gallery' && activeTab !== 'style' && activeTab !== 'banner' && (
                      <div ref={promptWrapperRef} className={cn(
                        "w-full transition-all duration-300",
                        (viewMode === 'dock' && activeTab === 'describe') ? "h-full flex flex-col" : "h-auto",
                        viewMode === 'home' && hasStructuredShortcutSession && "flex min-h-[70vh] items-center"
                      )}>
                        <div className={cn(
                          "w-full transition-all duration-300",
                          (viewMode === 'dock' && activeTab === 'describe') ? "flex-1 min-h-0" : "",
                          viewMode === 'home' && hasStructuredShortcutSession && "w-full"
                        )}>
                          <PlaygroundInputSection {...inputSectionProps} />
                        </div>
                      </div>
                    )}

                    {/* Capsule Triggers - Only visible in Home Mode */}
                    {viewMode === 'home' && !isPresetGridOpen && !hasStructuredShortcutSession && (
                      <PlaygroundHomeActions
                        onOpenDescribe={() => { setViewMode('dock'); setActiveTab('describe'); }}
                        onEdit={handleEditUploadedImage}
                        onOpenBanner={() => enterBannerMode()}
                        onOpenHistory={() => { setViewMode('dock'); setActiveTab('history'); }}
                        onOpenGallery={() => { setViewMode('dock'); setActiveTab('gallery'); }}
                      />
                    )}

                    {viewMode === 'dock' && activeTab === 'history' && (
                      <div className="mt-2 w-full relative flex-1 overflow-hidden z-30">
                        <HistoryList
                          variant="sidebar"
                          history={filteredHistory}
                          onRegenerate={(res) => {
                            if (res.config) {
                              applyModel(res.config.model, {
                                ...res.config,
                                loras: res.config.loras || [],
                                presetName: res.config.presetName,
                              });
                            }
                            handleRegenerate(res);
                          }}
                          onDownload={handleDownload}
                          onEdit={handleEditImage}
                          onImageClick={openImageModal}
                          onBatchUse={handleBatchUse}
                          layoutMode={historyLayoutMode}
                          onLayoutModeChange={(mode) => setHistoryLayoutMode(mode)}
                          onClose={() => setViewMode('home')}
                          onLoadMore={() => setSize(size + 1)}
                          hasMore={hasMoreHistory}
                          isLoading={isHistoryLoading}
                        />
                      </div>
                    )}

                  </div>
                </div>

                <PlaygroundDockPanels
                  viewMode={viewMode}
                  activeTab={activeTab}
                  onImageClick={openImageModal}
                  isGenerating={isGenerating}
                  onGenerateBanner={(options) => handleGenerate((options as GenerateOptions) || {})}
                  bannerSessionHistory={bannerSessionHistory}
                  isDraggingOver={isDraggingOver}
                />

              </div>

            </div>

            {!isPresetGridOpen && !isPresetManagerOpen && viewMode === 'home' && !hasStructuredShortcutSession && (
              <div className="absolute bottom-0 w-full overflow-visible z-50 pointer-events-none flex flex-col items-center">
                <StylesMarquee
                  onQuickApply={handleShortcutQuickApply}
                  onPreviewImage={handleShortcutPreviewOpen}
                />
                <div className="mt-4 mb-8 pointer-events-auto">
                  <button
                    onClick={() => { setViewMode('dock'); setActiveTab('style'); }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all",
                      "bg-black/10 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Palette className="w-4 h-4" />
                    <span className="text-sm font-medium">ALL moodboard</span>
                  </button>
                </div>
              </div>
            )}

            <GoogleApiStatus className="fixed bottom-10 right-10 z-[60]" />

            <WorkflowSelectorDialog
              open={isWorkflowDialogOpen}
              onOpenChange={setIsWorkflowDialogOpen}
              onSelect={(wf) => {
                applyWorkflowDefaults(wf);
                setSelectedWorkflowConfig(wf);
              }}
              onEdit={onEditMapping}
            />
            <BaseModelSelectorDialog open={isBaseModelDialogOpen} onOpenChange={setIsBaseModelDialogOpen} value={config.model || selectedModel} onConfirm={(m) => updateConfig({ model: m })} />
            <LoraSelectorDialog open={isLoraDialogOpen} onOpenChange={setIsLoraDialogOpen} value={selectedLoras} onConfirm={(list) => setSelectedLoras(list)} />
            <PresetGridOverlay
              open={isPresetGridOpen}
              onOpenChange={setIsPresetGridOpen}
              onOpenManager={() => setIsPresetManagerOpen(true)}
              onSelectPreset={handlePresetSelect}
            />
            <PresetManagerDialog
              open={isPresetManagerOpen}
              onOpenChange={(open) => {
                setIsPresetManagerOpen(open);
                if (!open) {
                  setPendingPresetEditConfig(undefined);
                }
              }}
              workflows={workflows}
              currentConfig={config}
              currentEditConfig={pendingPresetEditConfig}
            />
          </main>
        </div>

        <ImagePreviewModal
          key={selectedResultPreviewKey}
          isOpen={isImageModalOpen}
          onClose={closeImageModal}
          result={selectedResult}
          results={previewableHistory}
          currentIndex={currentIndex}
          isLoadingDetails={isHydratingSelectedResult}
          onSelectResult={jumpToResult}
          onEdit={handleEditImage}
          onNext={handleNextImage}
          onPrev={handlePrevImage}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onRegenerate={handleRegenerate}
        />

        <ImagePreviewModal
          key={selectedShortcutPreviewKey}
          isOpen={Boolean(selectedShortcutPreviewResult)}
          onClose={handleShortcutPreviewClose}
          result={selectedShortcutPreviewResult}
          results={shortcutPreviewResults}
          currentIndex={shortcutPreviewCurrentIndex}
          onSelectResult={handleShortcutPreviewSelect}
          onNext={handleShortcutPreviewNext}
          onPrev={handleShortcutPreviewPrev}
          hasNext={shortcutPreviewHasNext}
          hasPrev={shortcutPreviewHasPrev}
        />

        <ImageEditDialog
          open={imageEditState.open}
          imageUrl={imageEditState.imageUrl}
          initialPrompt={imageEditState.initialPrompt}
          initialSession={imageEditState.initialSession}
          legacyTldrawSnapshot={imageEditState.legacySnapshot}
          onOpenChange={(open) => {
            setImageEditState((previous) => ({
              ...previous,
              open,
            }));
          }}
          onConfirm={handleImageEditConfirm}
        />

        <FluxKleinConnectionHelpDialog
          open={Boolean(fluxKleinConnectionHelp)}
          comfyUrl={fluxKleinConnectionHelp?.comfyUrl}
          technicalReason={fluxKleinConnectionHelp?.technicalReason}
          onOpenChange={(open) => {
            if (!open) {
              dismissFluxKleinConnectionHelp();
            }
          }}
        />

        <SimpleImagePreview
          imageUrl={previewImageUrl}
          layoutId={previewLayoutId}
          onClose={() => setPreviewImage(null)}
        />

        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}
          modifiers={[snapCenterToCursor]}
        >
          {activeDragItem ? (
            <div
              className="flex items-center w-[200px] gap-3 p-3 bg-black/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl pointer-events-none"
            >
              {activeDragItem.outputUrl ? (
                <NextImage
                  src={formatImageUrl(activeDragItem.outputUrl)}
                  alt="dragging"
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 object-cover rounded-lg border border-white/10"
                />
              ) : (
                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                  <ImageIcon className="w-4 h-4 text-white/20" />
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-white">
                  Moving {selectedHistoryIds.size} items
                </span>
                <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider">
                  Release to move
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div >
    </DndContext >
  );
});

export default PlaygroundV2Page;
