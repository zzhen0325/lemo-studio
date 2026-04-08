"use client";


import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/hooks/common/use-toast";

import { usePromptOptimization, AIModel } from "@studio/playground/_components/hooks/usePromptOptimization";
import { useGenerationService, type GenerateOptions } from "@studio/playground/_components/hooks/useGenerationService";
import { useResultModalState } from "@studio/playground/_components/containers/hooks/useResultModalState";
import { useHistory } from "@studio/playground/_components/hooks/useHistory";
import { useHistoryDragTransfer } from "@studio/playground/_components/hooks/useHistoryDragTransfer";
import { describeImage as requestDescribeImage } from "@/lib/ai/client";

import { GoogleApiStatus } from "@studio/playground/_components/GoogleApiStatus";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import type { UIComponent } from "@/types/features/mapping-editor";
import {
  VISION_DESCRIBE_SINGLE_SYSTEM_PROMPT,
  type GenerationConfig,
  type UploadedImage,
  type PresetExtended,
  type EditPresetConfig,
  type SelectedLora,
} from "@/lib/playground/types";
import type { Generation } from "@/types/database";
import { downloadImage } from '@/lib/utils/download';
import type { ImageEditConfirmPayload, ImageEditorSessionSnapshot } from '@/components/image-editor';

import { cn } from "@/lib/utils";
import { getApiBase, formatImageUrl } from "@/lib/api-base";
import { MODEL_ID_FLUX_KLEIN, MODEL_ID_WORKFLOW } from "@/lib/constants/models";
import { isWorkflowModel } from "@/lib/utils/model-utils";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { useAPIConfigStore } from "@/lib/store/api-config-store";
import { useMediaQuery } from "@/hooks/common/use-media-query";
import { PresetGridOverlay } from "@studio/playground/_components/PresetGridOverlay";
import { PlaygroundBackground } from "@studio/playground/_components/PlaygroundBackground";
import { PlaygroundInputSection } from "@studio/playground/_components/PlaygroundInputSection";
import { AR_MAP } from "@studio/playground/_components/constants/aspect-ratio";
import { MoodboardMarquee } from "@studio/playground/_components/MoodboardMarquee";
import { usePlaygroundMoodboards } from "@studio/playground/_components/hooks/usePlaygroundMoodboards";
import { PlaygroundDockSidebar } from "@studio/playground/_components/containers/components/PlaygroundDockSidebar";
import { PlaygroundHistoryPanel } from "@studio/playground/_components/containers/components/PlaygroundHistoryPanel";
import { PlaygroundHomeActions } from "@studio/playground/_components/containers/components/PlaygroundHomeActions";
import { PlaygroundDockPanels } from "@studio/playground/_components/containers/components/PlaygroundDockPanels";
import { PlaygroundModalStack } from "@studio/playground/_components/containers/components/PlaygroundModalStack";
import {
  buildKvVariantPromptPreview,
  buildStructuredOptimizationSourcePayload,
  buildStructuredVariantPayload,
  cloneDesignAnalysis,
  cloneDesignPalette,
  cloneShortcutValues,
  cloneVariantBaseline,
  createShortcutOptimizationVariants,
  createEmptyCoreSuggestionValues,
  deriveVariantPalette,
  findShortcutVariant,
  hydrateShortcutOptimizationSession,
  mergeLockedKvValues,
  replaceColorInAnalysis,
  replaceColorInShortcutValues,
  replacePaletteWeightsInAnalysis,
  serializeShortcutOptimizationSession,
  type ActiveShortcutTemplate,
  type ShortcutOptimizationSession,
  type ShortcutOptimizationVariantDraft,
} from "@studio/playground/_components/containers/shortcut-optimization";
import { v4 as uuidv4 } from 'uuid';
import {
  buildShortcutPrompt,
  createShortcutPromptValues,
  getShortcutById,
  getShortcutMissingFields,
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from "@/config/moodboard-cards";
import {
  buildKvStructuredOptimizationInput,
  DESIGN_STRUCTURED_VARIANT_IDS,
  DESIGN_VARIANT_EDIT_MODE,
  DESIGN_SECTION_EDIT_MODE,
  getKvShortcutMarket,
  normalizeDesignPalette,
  isKvShortcutId,
  parseDesignSectionEditResponse,
  parseDesignStructuredOptimizationResponse,
  parseDesignStructuredVariantEditResponse,
  type DesignStructuredAnalysis,
  type DesignAnalysisSectionKey,
  type DesignStructuredPaletteEntry,
  type DesignVariantEditScope,
  type KvStructuredVariantId,
} from "@/app/studio/playground/_lib/kv-structured-optimization";
import {
  buildPromptOptimizationVariantsInput,
  parsePromptOptimizationVariants,
} from "@/app/infinite-canvas/_lib/prompt-optimization";
import {
  createPromptOptimizationHistoryItems,
  getPromptOptimizationSource,
  IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
  PROMPT_OPTIMIZATION_VARIANT_COUNT,
  type PromptOptimizationSourcePayload,
  withPromptOptimizationSource,
  withoutPromptOptimizationSource,
} from "@/app/studio/playground/_lib/prompt-history";
import {
  isHistoryEditGeneration,
  normalizeHistoryConfigForGeneration,
  withMoodboardTemplateMetadata,
} from "@/app/studio/playground/_lib/history-tags";
import {
  buildPromptFromShortcutEditorDocument,
  createShortcutEditorDocumentFromParts,
  createShortcutEditorDocumentFromText,
  getRemovedFieldIdsFromShortcutEditorDocument,
  removeFieldFromShortcutEditorDocument,
  type ShortcutEditorDocument,
} from "@/app/studio/playground/_lib/shortcut-editor-document";
import { upsertMoodboardAsShortcut } from "@/app/studio/playground/_lib/moodboard-card-gallery";
import {
  buildGenerationOutputLookup,
  getMoodboardImageMatchKey,
} from "@/app/studio/playground/_lib/moodboard-image-match";


import gsap from "gsap";
import { Flip } from "gsap/all";
import { useGSAP } from "@gsap/react";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  DndContext,
} from "@dnd-kit/core";

gsap.registerPlugin(Flip, useGSAP);

const WorkflowSelectorDialog = dynamic(
  () => import("@studio/playground/_components/Dialogs/WorkflowSelectorDialog"),
  { ssr: false },
);
const BaseModelSelectorDialog = dynamic(
  () => import("@studio/playground/_components/Dialogs/BaseModelSelectorDialog"),
  { ssr: false },
);
const LoraSelectorDialog = dynamic(
  () => import("@studio/playground/_components/Dialogs/LoraSelectorDialog"),
  { ssr: false },
);
const PresetManagerDialog = dynamic(
  () => import("@studio/playground/_components/Dialogs/PresetManagerDialog").then((module) => module.PresetManagerDialog),
  { ssr: false },
);

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

type PromptOptimizationRequestPrefix = "[Event kv]" | "[Text]";
const KV_STRUCTURED_OPTIMIZATION_PARALLEL_REQUEST_COUNT = 4;
const KV_STRUCTURED_HISTORY_BACKFILL_COUNT = 1;

function prependPromptOptimizationRequestPrefix(
  input: string,
  prefix: PromptOptimizationRequestPrefix,
) {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return "";
  }

  return `${prefix}\n${trimmedInput}`;
}

export const PlaygroundV2Page = function PlaygroundV2Page({
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
  const initPresets = usePlaygroundStore(s => s.initPresets);
  const applyModel = usePlaygroundStore(s => s.applyModel);
  const updateUploadedImage = usePlaygroundStore(s => s.updateUploadedImage);
  const updateDescribeImage = usePlaygroundStore(s => s.updateDescribeImage);
  const syncLocalImageToHistory = usePlaygroundStore(s => s.syncLocalImageToHistory);
  const generationHistory = usePlaygroundStore(s => s.generationHistory);
  const actorId = useAuthStore((state) => state.actorId);
  const currentUser = useAuthStore((state) => state.currentUser);
  const ensureSession = useAuthStore((state) => state.ensureSession);
  const effectiveUserId = actorId || "anonymous";
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
  const {
    moodboardCardEntries,
    moodboardCardByCode,
    refreshMoodboardCards,
  } = usePlaygroundMoodboards();
  const moodboardByCardId = useMemo(() => {
    return new Map(moodboardCardEntries.map((entry) => [entry.shortcut.id, entry.moodboard]));
  }, [moodboardCardEntries]);
  const getNextAutoMoodboardName = useCallback(() => {
    const prefix = '新情绪板';
    let maxIndex = 0;

    moodboardCardEntries.forEach(({ moodboard }) => {
      const name = (moodboard.name || '').trim();
      if (!name) {
        return;
      }

      if (name === prefix) {
        maxIndex = Math.max(maxIndex, 1);
        return;
      }

      const match = name.match(/^新情绪板\s+(\d+)$/);
      if (!match?.[1]) {
        return;
      }

      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        maxIndex = Math.max(maxIndex, parsed);
      }
    });

    return `${prefix} ${Math.max(maxIndex + 1, 1)}`;
  }, [moodboardCardEntries]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const describePanelRef = useRef<HTMLDivElement>(null);

  const {
    history: filteredHistory,
    size,
    setSize,
    isLoading: isHistoryLoading,
    isLoadingMore: isHistoryLoadingMore,
    hasMore: hasMoreHistory,
    setHistory,
    mutate: mutateHistory,
    getHistoryItem,
  } = useHistory();
  const historyController = useMemo(() => ({
    setHistory,
    getHistoryItem,
  }), [getHistoryItem, setHistory]);
  const moodboardImageRecordLookup = useMemo(
    () => buildGenerationOutputLookup([...generationHistory, ...filteredHistory]),
    [filteredHistory, generationHistory],
  );

  const [selectedAIModel, setSelectedAIModel] = useState<AIModel>('auto'); // 默认使用settings中的配置
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isBaseModelDialogOpen, setIsBaseModelDialogOpen] = useState(false);
  const [isLoraDialogOpen, setIsLoraDialogOpen] = useState(false);
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  const [describeOptimisticHistory, setDescribeOptimisticHistory] = useState<Generation[]>([]);
  const [isPersistingDescribeHistory, setIsPersistingDescribeHistory] = useState(false);
  const [describePersistenceFailed, setDescribePersistenceFailed] = useState(false);
  // const [isDescribeMode, setIsDescribeMode] = useState(false); // Refactored to viewMode
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverPanel, setIsDraggingOverPanel] = useState(false);
  const [isFloatingInputVisible, setIsFloatingInputVisible] = useState(false);
  const [floatingInputAnimationKey, setFloatingInputAnimationKey] = useState(0);
  const [historyLayoutMode, setHistoryLayoutMode] = useState<'grid' | 'list'>('list');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [batchSize, setBatchSize] = useState(4); // Default batch size
  const [pendingPresetEditConfig, setPendingPresetEditConfig] = useState<EditPresetConfig | undefined>(undefined);
  const [bannerSessionHistory, setBannerSessionHistory] = useState<BannerSessionHistoryItem[]>([]);
  const [activeShortcutTemplate, setActiveShortcutTemplate] = useState<ActiveShortcutTemplate | null>(null);
  const [shortcutPreviewResults, setShortcutPreviewResults] = useState<Generation[]>([]);
  const [selectedShortcutPreviewResult, setSelectedShortcutPreviewResult] = useState<Generation | undefined>(undefined);
  const activeShortcutTemplateRef = useRef<ActiveShortcutTemplate | null>(null);


  const showHistory = usePlaygroundStore((state) => state.showHistory);
  const setShowHistory = usePlaygroundStore((state) => state.setShowHistory);
  const selectedPresetName = usePlaygroundStore((state) => state.selectedPresetName);
  const setSelectedPresetName = usePlaygroundStore((state) => state.setSelectedPresetName);
  const viewMode = usePlaygroundStore((state) => state.viewMode);
  const setViewMode = usePlaygroundStore((state) => state.setViewMode);
  const activeTab = usePlaygroundStore((state) => state.activeTab);
  const setActiveTab = usePlaygroundStore((state) => state.setActiveTab);
  const previewImageUrl = usePlaygroundStore((state) => state.previewImageUrl);
  const previewLayoutId = usePlaygroundStore((state) => state.previewLayoutId);
  const setPreviewImage = usePlaygroundStore((state) => state.setPreviewImage);
  const selectedHistoryIds = usePlaygroundStore((state) => state.selectedHistoryIds);
  const apiConfigSettings = useAPIConfigStore(s => s.settings);
  const defaultImageModelId = apiConfigSettings.services?.imageGeneration?.binding?.modelId
    || apiConfigSettings.defaults?.image?.textToImage?.binding?.modelId
    || "gemini-3-pro-image-preview";

  useEffect(() => {
    activeShortcutTemplateRef.current = activeShortcutTemplate;
  }, [activeShortcutTemplate]);

  useEffect(() => {
    if (!isHistoryDebug) return;
    console.info("[HistoryDebug][Front] page_state", {
      currentUserId: currentUser?.id || null,
      actorId: actorId || null,
      effectiveUserId,
      historyCount: filteredHistory.length,
      activeTab,
      viewMode,
      isHistoryLoading,
      isHistoryLoadingMore,
      hasMoreHistory,
    });
  }, [
    isHistoryDebug,
    currentUser?.id,
    actorId,
    effectiveUserId,
    filteredHistory.length,
    activeTab,
    viewMode,
    isHistoryLoading,
    isHistoryLoadingMore,
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
      filteredHistory
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
  }, [bannerSessionHistory.length, filteredHistory]);

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
  const triggerFloatingPlaygroundInput = useCallback(() => {
    setIsFloatingInputVisible(true);
    setFloatingInputAnimationKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (activeTab !== 'gallery' && isFloatingInputVisible) {
      setIsFloatingInputVisible(false);
    }
  }, [activeTab, isFloatingInputVisible]);

  useEffect(() => {
    initPresets();
  }, [initPresets]);

  // Helper: save history using unified fields
  const saveHistoryToBackend = React.useCallback(async (item: import('@/types/database').Generation): Promise<boolean> => {
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
      const response = await fetch(`${getApiBase()}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gen),
      });
      if (!response.ok) {
        console.error('Failed to save history: non-ok response', { id: item.id, status: response.status });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to save history:', error);
      // Optional: Add toast notification if needed, but avoiding it to keep behavior identical to before
      return false;
    }
  }, [effectiveUserId]);

  const prependHistoryItems = React.useCallback((items: Generation[]) => {
    if (items.length === 0) {
      return;
    }

    setHistory((prev: Generation[]) => [...items, ...prev]);
    items.forEach((item) => {
      void saveHistoryToBackend(item);
    });
  }, [saveHistoryToBackend, setHistory]);

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
    void ensureSession().catch(() => undefined);
  }, [ensureSession]);

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
    initialModelId?: string;
    initialImageSize?: string;
    initialAspectRatio?: string;
    initialBatchSize?: number;
    parentId?: string;
  }>({
    open: false,
    imageUrl: '',
    initialPrompt: '',
    initialSession: undefined,
    legacySnapshot: undefined,
    initialModelId: undefined,
    initialImageSize: undefined,
    initialAspectRatio: undefined,
    initialBatchSize: 4,
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
  } = useGenerationService(historyController);
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
  const shouldHideHomeEntryCards = hasStructuredShortcutSession;
  const historyForPanel = useMemo(() => {
    if (describeOptimisticHistory.length === 0) {
      return filteredHistory;
    }

    const optimisticIds = new Set(describeOptimisticHistory.map((item) => item.id));
    return [
      ...describeOptimisticHistory,
      ...filteredHistory.filter((item) => !optimisticIds.has(item.id)),
    ];
  }, [describeOptimisticHistory, filteredHistory]);

  useEffect(() => {
    if (describeOptimisticHistory.length === 0) {
      return;
    }

    if (isPersistingDescribeHistory) {
      return;
    }

    if (describePersistenceFailed) {
      return;
    }

    const optimisticIds = new Set(describeOptimisticHistory.map((item) => item.id));
    const persistedCount = filteredHistory.reduce((count, item) => {
      return optimisticIds.has(item.id) ? count + 1 : count;
    }, 0);

    if (persistedCount === optimisticIds.size) {
      setDescribeOptimisticHistory([]);
    }
  }, [describeOptimisticHistory, filteredHistory, isPersistingDescribeHistory, describePersistenceFailed]);

  const normalizeGenerationConfigForHistory = useCallback((rawConfig: GenerationConfig): GenerationConfig => {
    const isBannerGeneration = rawConfig.generationMode === 'banner';
    const activeShortcut = isBannerGeneration ? null : activeShortcutTemplateRef.current?.shortcut;
    const trimmedShortcutName = activeShortcut?.name?.trim();
    const moodboardMetadata = trimmedShortcutName
      ? { id: activeShortcut?.id, name: trimmedShortcutName }
      : null;

    return normalizeHistoryConfigForGeneration(
      withMoodboardTemplateMetadata(rawConfig, moodboardMetadata),
    );
  }, []);

  // Wrapper for batch generation
  const handleGenerate = React.useCallback(async (options: GenerateOptions = {}) => {
    const { configOverride, batchSizeOverride } = options;
    const storeState = usePlaygroundStore.getState();
    const isBannerModeGenerate = storeState.activeTab === 'banner' && Boolean(storeState.activeBannerData);
    const hasExplicitSourceImageUrls = Object.prototype.hasOwnProperty.call(options, 'sourceImageUrls');
    const explicitSourceImageUrls = hasExplicitSourceImageUrls
      ? (options.sourceImageUrls || []).filter((url): url is string => typeof url === 'string' && url.length > 0)
      : undefined;

    if (isBannerModeGenerate) {
      const startTime = new Date().toISOString();
      const batchTaskId = options.taskId || configOverride?.taskId || (Date.now().toString() + Math.random().toString(36).substring(2, 7));
      const currentConfig = usePlaygroundStore.getState().config;
      const sourceImageUrls = explicitSourceImageUrls
        ?? (currentConfig.sourceImageUrls || []).filter((url): url is string => typeof url === 'string' && url.length > 0);

      const bannerConfig: GenerationConfig = {
        ...currentConfig,
        ...(configOverride || {}),
        taskId: batchTaskId,
        isEdit: false,
      };
      const normalizedBannerConfig = normalizeGenerationConfigForHistory(bannerConfig);

      const uniqueId = await singleGenerate({
        configOverride: normalizedBannerConfig,
        fixedCreatedAt: startTime,
        isBackground: true,
        editConfig: undefined,
        taskId: batchTaskId,
        sourceImageUrls
      });

      if (typeof uniqueId === 'string') {
        const generated = await executeGeneration(uniqueId, batchTaskId, normalizedBannerConfig, startTime, sourceImageUrls);
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
    const effectiveBatchSize = normalizedBatchSizeOverride ?? (options.useCurrentBatchSize ? batchSize : (configOverride ? 4 : batchSize));
    const structuredOptimizationSource = !getPromptOptimizationSource(configOverride)
      ? buildStructuredOptimizationSourcePayload(activeShortcutTemplateRef.current, batchTaskId)
      : null;

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
      let finalConfig: GenerationConfig = {
        ...currentConfig,
        ...(configOverride && typeof configOverride === 'object' ? configOverride : {}),
        loras: currentLoras,
        taskId: batchTaskId,
        isPreset: !!(currentConfig.presetName || (configOverride as GenerationConfig)?.presetName)
      };
      const effectiveOptimizationSource = getPromptOptimizationSource(finalConfig) || structuredOptimizationSource;
      finalConfig = effectiveOptimizationSource
        ? withPromptOptimizationSource(finalConfig, effectiveOptimizationSource)
        : withoutPromptOptimizationSource(finalConfig);
      finalConfig = normalizeGenerationConfigForHistory(finalConfig);
      // 优先使用显式传入的 sourceImageUrls（例如 rerun 场景），否则从当前 store 读取
      const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
      const sourceImageUrls = explicitSourceImageUrls
        ?? currentUploadedImages
          .map(img => img.path || img.previewUrl)
          .filter((url): url is string => typeof url === 'string' && url.length > 0);

      const promptForGeneration = (configOverride as Partial<GenerationConfig>)?.prompt
        || finalConfig.prompt
        || currentConfig.prompt
        || '';
      finalConfig = {
        ...finalConfig,
        prompt: promptForGeneration,
      };

      const pendingExecution = singleGenerate({
        configOverride: finalConfig,
        fixedCreatedAt: startTime,
        isBackground: true,
        taskId: batchTaskId,
        sourceImageUrls
      });
      pendingExecutions.push(
        pendingExecution.then((uniqueId) => ({
          uniqueId: typeof uniqueId === 'string' ? uniqueId : undefined,
          finalConfig,
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
  }, [batchSize, executeGeneration, normalizeGenerationConfigForHistory, setActiveTab, setShowHistory, setViewMode, singleGenerate]);

  const { optimizePrompt, isOptimizing } = usePromptOptimization();

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

  const requestDesignSectionEdit = useCallback(async (params: {
    sectionKey: DesignAnalysisSectionKey;
    instruction: string;
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

    const response = await fetch(`${getApiBase()}/ai/design-section-edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variantId: params.variant.id,
        sectionKey: params.sectionKey,
        instruction: params.instruction,
        currentSectionText: params.variant.analysis[params.sectionKey].detailText,
        fullAnalysisContext: params.variant.analysis,
        shortcutContext: {
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

    const parsed = parseDesignSectionEditResponse(raw);
    if (parsed.mode !== DESIGN_SECTION_EDIT_MODE) {
      throw new Error('Unexpected design section edit response mode');
    }

    if (parsed.sectionKey !== params.sectionKey) {
      throw new Error(`Section key mismatch: expected ${params.sectionKey}, received ${parsed.sectionKey}`);
    }

    return parsed;
  }, []);

  const handleFilesUpload = React.useCallback(async (
    files: File[] | FileList,
    target: 'reference' | 'describe' = 'reference',
    options?: { waitForUpload?: boolean },
  ) => {
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

      // 6. Start upload (optional wait for flows that need deterministic completion)
      const uploadTask = async (throwOnError: boolean) => {
        const form = new FormData();
        form.append('file', file);

        const originalUrl = dataUrl; // Keep track of the local URL

        try {
          const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: form });
          if (!resp.ok) {
            const errorText = await resp.text().catch(() => '');
            throw new Error(errorText || `Upload failed with status ${resp.status}`);
          }

          const json = await resp.json();
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
          if (throwOnError) {
            throw err;
          }
        }
      };

      if (options?.waitForUpload) {
        await uploadTask(true);
      } else {
        void uploadTask(false);
      }
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
    const autoMoodboardName = getNextAutoMoodboardName();

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

      await upsertMoodboardAsShortcut({
        name: autoMoodboardName,
        prompt: '',
        imagePaths,
      });
      await refreshMoodboardCards();
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
      editorDocument: createShortcutEditorDocumentFromParts(shortcut.promptParts),
    });

    applyModel(shortcut.model, withoutPromptOptimizationSource({
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
    }));

    // if (promptWrapperRef.current) {
    //   window.requestAnimationFrame(() => {
    //     promptWrapperRef.current?.scrollIntoView({
    //       behavior: 'smooth',
    //       block: 'center',
    //     });
    //   });
    // }

    setViewMode('home');

    toast({
      title: `已应用 ${shortcut.name}`,
      description: `模型已切换到 ${shortcut.modelLabel}，请补全高亮字段后再生成。`,
    });
  }, [applyModel, config.height, config.width, setSelectedPresetName, setSelectedWorkflowConfig, toast, setViewMode]);

  const buildShortcutPreviewResults = useCallback((shortcut: PlaygroundShortcut): Generation[] => {
    const shortcutMoodboard = moodboardByCardId.get(shortcut.id);
    const values = createShortcutPromptValues(shortcut);
    const prompt = buildShortcutPrompt(shortcut, values);
    const previewImages = shortcutMoodboard?.imagePaths ?? shortcut.imagePaths;
    const dimensions = AR_MAP[shortcut.aspectRatio]?.[shortcut.imageSize] || {
      w: config.width || 1024,
      h: config.height || 1024,
    };

    return previewImages.map((imagePath, index) => {
      const matchedRecord = moodboardImageRecordLookup.get(getMoodboardImageMatchKey(imagePath));
      const matchedConfig = matchedRecord?.config;

      return {
        id: `shortcut-preview-${shortcut.id}-${index}`,
        userId: matchedRecord?.userId || effectiveUserId,
        projectId: matchedRecord?.projectId || 'shortcut-preview',
        outputUrl: imagePath,
        config: {
          ...matchedConfig,
          prompt: matchedConfig?.prompt || prompt,
          model: matchedConfig?.model || shortcut.model,
          baseModel: matchedConfig?.baseModel || matchedConfig?.model || shortcut.model,
          width: matchedConfig?.width || dimensions.w,
          height: matchedConfig?.height || dimensions.h,
          imageSize: matchedConfig?.imageSize || shortcut.imageSize,
          aspectRatio: matchedConfig?.aspectRatio || shortcut.aspectRatio,
          loras: matchedConfig?.loras || [],
          presetName: matchedConfig?.presetName || undefined,
          workflowName: matchedConfig?.workflowName || shortcut.name,
          isPreset: matchedConfig?.isPreset || false,
          isEdit: matchedConfig?.isEdit || false,
          generationMode: matchedConfig?.generationMode || 'playground',
        },
        status: matchedRecord?.status || 'completed',
        createdAt: matchedRecord?.createdAt || shortcutMoodboard?.updatedAt || '',
        interactionStats: matchedRecord?.interactionStats,
        viewerState: matchedRecord?.viewerState,
      };
    });
  }, [config.height, config.width, effectiveUserId, moodboardByCardId, moodboardImageRecordLookup]);

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

  const applyPlainHistoryPrompt = useCallback((promptText: string) => {
    setActiveShortcutTemplate(null);
    setConfig((prev) => {
      const sanitizedConfig = withoutPromptOptimizationSource(prev);
      return {
        ...sanitizedConfig,
        prompt: promptText,
        optimizationSource: undefined,
        promptCategory: undefined,
      };
    });
  }, [setConfig]);

  const handleUseHistoryPrompt = useCallback((result: Generation) => {
    const optimizationSource = getPromptOptimizationSource(result.config);

    if (
      optimizationSource?.sourceKind === "kv_structured"
      && optimizationSource.shortcutId
      && optimizationSource.session
    ) {
      const shortcut = moodboardCardByCode.get(optimizationSource.shortcutId as PlaygroundShortcut["id"])
        || getShortcutById(optimizationSource.shortcutId);
      if (!shortcut) {
        applyPlainHistoryPrompt(result.config?.prompt || "");
        return;
      }

      const hydratedSession = hydrateShortcutOptimizationSession(optimizationSource.session);
      const activeVariant = hydratedSession.variants.find(
        (variant) => variant.id === optimizationSource.activeVariantId,
      ) || hydratedSession.variants[0];

      if (!activeVariant) {
        applyPlainHistoryPrompt(result.config?.prompt || "");
        return;
      }

      hydratedSession.activeVariantId = activeVariant.id;

      const restoredPrompt = activeVariant.promptPreview || result.config?.prompt || "";
      const restoredConfig = withPromptOptimizationSource(
        {
          ...withoutPromptOptimizationSource({
            ...usePlaygroundStore.getState().config,
            ...result.config,
            prompt: restoredPrompt,
            model: result.config?.model || shortcut.model,
            baseModel: result.config?.baseModel || result.config?.model || shortcut.model,
            isPreset: false,
            presetName: undefined,
          }),
        },
        {
          ...optimizationSource,
          activeVariantId: activeVariant.id,
          activeVariantLabel: activeVariant.label,
          session: serializeShortcutOptimizationSession(hydratedSession),
        },
      );

      setSelectedPresetName(undefined);
      setSelectedWorkflowConfig(undefined);
      setActiveShortcutTemplate({
        shortcut,
        values: cloneShortcutValues(activeVariant.values),
        removedFieldIds: [...activeVariant.removedFieldIds],
        appliedPrompt: restoredPrompt,
        optimizationSession: hydratedSession,
      });
      applyModel(restoredConfig.model, restoredConfig);

      toast({
        title: "优化方案已回填",
        description: "已恢复为可继续编辑的结构化提示词。",
      });
      return;
    }

    if (
      optimizationSource?.sourceKind === "shortcut_inline"
      && optimizationSource.shortcutId
    ) {
      const shortcut = moodboardCardByCode.get(optimizationSource.shortcutId as PlaygroundShortcut["id"])
        || getShortcutById(optimizationSource.shortcutId);
      if (!shortcut) {
        applyPlainHistoryPrompt(result.config?.prompt || "");
        return;
      }

      const restoredPrompt = result.config?.prompt || "";
      const restoredDocument = createShortcutEditorDocumentFromText(restoredPrompt);
      const restoredConfig = withPromptOptimizationSource(
        {
          ...withoutPromptOptimizationSource(usePlaygroundStore.getState().config),
          prompt: restoredPrompt,
        },
        {
          ...optimizationSource,
          shortcutId: shortcut.id,
        },
      );

      setSelectedPresetName(undefined);
      setSelectedWorkflowConfig(undefined);
      setActiveShortcutTemplate({
        shortcut,
        values: createShortcutPromptValues(shortcut),
        removedFieldIds: getRemovedFieldIdsFromShortcutEditorDocument(shortcut, restoredDocument),
        appliedPrompt: restoredPrompt,
        editorDocument: restoredDocument,
      });
      updateConfig(restoredConfig);

      toast({
        title: "优化方案已回填",
        description: "已恢复为可继续编辑的快捷模版提示词。",
      });
      return;
    }

    applyPlainHistoryPrompt(result.config?.prompt || "");
    toast({
      title: "提示词已应用",
      description: "已将此条提示词填充到输入框",
    });
  }, [applyModel, applyPlainHistoryPrompt, moodboardCardByCode, setSelectedPresetName, setSelectedWorkflowConfig, toast, updateConfig]);

  const handleUseGalleryPrompt = useCallback((result: Generation) => {
    handleUseHistoryPrompt(result);
    triggerFloatingPlaygroundInput();
  }, [handleUseHistoryPrompt, triggerFloatingPlaygroundInput]);

  const handleUseGalleryImage = useCallback(async (result: Generation) => {
    if (!result.outputUrl) return;
    triggerFloatingPlaygroundInput();
    await usePlaygroundStore.getState().applyImage(result.outputUrl);
  }, [triggerFloatingPlaygroundInput]);

  const handleModalApplyPrompt = useCallback((result: Generation) => {
    handleUseHistoryPrompt(result);
    triggerFloatingPlaygroundInput();
  }, [handleUseHistoryPrompt, triggerFloatingPlaygroundInput]);

  const handleModalApplyImage = useCallback(async (result: Generation) => {
    if (!result.outputUrl) return;
    triggerFloatingPlaygroundInput();
    await usePlaygroundStore.getState().applyImage(result.outputUrl);
  }, [triggerFloatingPlaygroundInput]);

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
      : current.editorDocument
        ? buildPromptFromShortcutEditorDocument(
          current.editorDocument,
          current.shortcut,
          nextValues,
          { removedFieldIds: current.removedFieldIds },
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
      editorDocument: current.editorDocument,
      optimizationSession: nextOptimizationSession,
    });
    updateConfig({ prompt: nextPrompt });
  }, [updateConfig]);

  const handleShortcutTemplateDocumentChange = useCallback((nextDocument: ShortcutEditorDocument) => {
    const current = activeShortcutTemplateRef.current;
    if (!current || current.optimizationSession) {
      return;
    }

    const normalizedRemovedFieldIds = getRemovedFieldIdsFromShortcutEditorDocument(
      current.shortcut,
      nextDocument,
    );
    const nextPrompt = buildPromptFromShortcutEditorDocument(
      nextDocument,
      current.shortcut,
      current.values,
      {
        removedFieldIds: normalizedRemovedFieldIds,
      },
    );

    setActiveShortcutTemplate({
      shortcut: current.shortcut,
      values: current.values,
      removedFieldIds: normalizedRemovedFieldIds,
      appliedPrompt: nextPrompt,
      editorDocument: nextDocument,
    });
    updateConfig({ prompt: nextPrompt });
  }, [updateConfig]);

  const handleShortcutTemplateFieldRemove = useCallback((fieldId: string) => {
    const current = activeShortcutTemplateRef.current;
    if (!current || current.removedFieldIds.includes(fieldId)) {
      return;
    }

    const nextDocument = current.editorDocument && !current.optimizationSession
      ? removeFieldFromShortcutEditorDocument(current.editorDocument, fieldId)
      : current.editorDocument;
    const nextRemovedFieldIds = nextDocument && !current.optimizationSession
      ? getRemovedFieldIdsFromShortcutEditorDocument(current.shortcut, nextDocument)
      : [...current.removedFieldIds, fieldId];
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
      : nextDocument
        ? buildPromptFromShortcutEditorDocument(
          nextDocument,
          current.shortcut,
          current.values,
          { removedFieldIds: nextRemovedFieldIds },
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
      editorDocument: nextDocument,
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
    const isSectionScope = scope !== 'variant';
    const sectionKey = scope as DesignAnalysisSectionKey;
    if (!rawInstruction) {
      toast({
        title: '请输入修改要求',
        description: isSectionScope ? '请输入一句自然语言，描述你希望该段如何改写。' : '请输入一句自然语言描述你想调整的方向。',
        variant: 'destructive',
      });
      return;
    }
    if (current.optimizationSession.variants.some((variant) => variant.isModifying)) {
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
      if (isSectionScope) {
        const sectionEdit = await requestDesignSectionEdit({
          sectionKey,
          instruction: rawInstruction,
          variant: activeVariant,
          shortcut: current.shortcut,
          values: current.values,
          removedFieldIds: current.removedFieldIds,
        });

        const latest = activeShortcutTemplateRef.current;
        if (!latest?.optimizationSession) {
          return;
        }
        const latestVariant = findShortcutVariant(latest.optimizationSession, activeVariantId);
        if (!latestVariant) {
          return;
        }

        const nextAnalysis: DesignStructuredAnalysis = {
          ...cloneDesignAnalysis(latestVariant.analysis),
          [sectionKey]: {
            detailText: sectionEdit.detailText.trim(),
          },
        };
        const nextPalette = deriveVariantPalette(
          latest.shortcut,
          latestVariant.values,
          latestVariant.removedFieldIds,
          nextAnalysis,
          latestVariant.palette,
          latestVariant.promptPreview,
        );
        const nextPrompt = buildKvVariantPromptPreview(
          latest.shortcut,
          latestVariant.values,
          latestVariant.removedFieldIds,
          nextAnalysis,
          nextPalette,
        );
        const shouldSyncActiveView = latest.optimizationSession.activeVariantId === activeVariantId;

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

      const nextVariant = await requestDesignVariantEdit({
        instruction: rawInstruction,
        scope,
        variant: activeVariant,
        shortcut: current.shortcut,
        values: current.values,
        removedFieldIds: current.removedFieldIds,
      });

      const latest = activeShortcutTemplateRef.current;
      if (!latest?.optimizationSession) {
        return;
      }
      const shouldSyncActiveView = latest.optimizationSession.activeVariantId === activeVariantId;
      const nextValues = mergeLockedKvValues(current.values, nextVariant.coreFields);
      const nextPalette = deriveVariantPalette(
        latest.shortcut,
        nextValues,
        current.removedFieldIds,
        nextVariant.analysis,
        nextVariant.palette,
        nextVariant.promptPreview,
      );
      const nextPrompt = buildKvVariantPromptPreview(
        latest.shortcut,
        nextValues,
        current.removedFieldIds,
        nextVariant.analysis,
        nextPalette,
      );

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
        title: isSectionScope ? 'AI 更新段落失败' : 'AI 微调失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  }, [requestDesignSectionEdit, requestDesignVariantEdit, toast, updateConfig]);

  const handleExitShortcutTemplate = useCallback(() => {
    setActiveShortcutTemplate(null);
    updateConfig(withoutPromptOptimizationSource(usePlaygroundStore.getState().config));
  }, [updateConfig]);

  const handleClearShortcutTemplate = useCallback(() => {
    setActiveShortcutTemplate(null);
    setSelectedPresetName(undefined);
    setSelectedWorkflowConfig(undefined);
    applyModel(defaultImageModelId, withoutPromptOptimizationSource({
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
    }));
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

    const sourceTaskId = getPromptOptimizationSource(usePlaygroundStore.getState().config)?.taskId
      || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimizationSource = buildStructuredOptimizationSourcePayload(current, sourceTaskId);

    if (optimizationSource && current?.optimizationSession) {
      const activeVariant = findShortcutVariant(
        current.optimizationSession,
        current.optimizationSession.activeVariantId,
      );

      void handleGenerate({
        useCurrentBatchSize: true,
        configOverride: withPromptOptimizationSource(
          {
            ...usePlaygroundStore.getState().config,
            prompt: activeVariant?.promptPreview || current.appliedPrompt,
            taskId: undefined,
          },
          optimizationSource,
        ),
      });
      return;
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
      const sourceTaskId = getPromptOptimizationSource(currentConfig)?.taskId || variantTaskId;
      const optimizationSource = buildStructuredOptimizationSourcePayload(current, sourceTaskId, variant.id);
      await handleGenerate({
        configOverride: optimizationSource
          ? withPromptOptimizationSource(
            {
              ...currentConfig,
              prompt: variant.promptPreview,
              taskId: undefined,
            },
            optimizationSource,
          )
          : {
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
    const sanitizedEffectiveConfig = withoutPromptOptimizationSource(effectiveConfig);
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
        imageUrl: formatImageUrl(preset.editConfig.originalImageUrl),
        initialPrompt: effectiveConfig.prompt || '',
        initialSession,
        legacySnapshot,
        initialModelId: String(effectiveConfig.model || selectedModel || defaultImageModelId),
        initialImageSize: String(effectiveConfig.imageSize || '1K'),
        initialAspectRatio: String(effectiveConfig.aspectRatio || '1:1'),
        initialBatchSize: 4,
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
        const resSize = sanitizedEffectiveConfig.imageSize || '1K';
        const arName = sanitizedEffectiveConfig.aspectRatio || '1:1';
        const dims = AR_MAP[arName]?.[resSize] || { w: sanitizedEffectiveConfig.width || 1024, h: sanitizedEffectiveConfig.height || 1024 };

        // Apply fixed config from preset
        setConfig(prev => ({
          ...prev,
          prompt: sanitizedEffectiveConfig.prompt || '',
          width: dims.w,
          height: dims.h,
          model: sanitizedEffectiveConfig.model || MODEL_ID_WORKFLOW,
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
      const modelToSet = sanitizedEffectiveConfig.model || 'Nano banana';
      const resSize = sanitizedEffectiveConfig.imageSize || '1K';
      const arName = sanitizedEffectiveConfig.aspectRatio || '1:1';
      const dims = AR_MAP[arName]?.[resSize] || { w: sanitizedEffectiveConfig.width || 1024, h: sanitizedEffectiveConfig.height || 1024 };

      setConfig(prev => ({
        ...prev,
        ...sanitizedEffectiveConfig,
        presetName: preset.editConfig ? undefined : presetName,
        loras: sanitizedEffectiveConfig.loras || [],
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
    const taggedOptimizationInput = prependPromptOptimizationRequestPrefix(
      optimizationInput,
      "[Event kv]",
    );
    const EMPTY_RESULT_ERROR = "KV_STRUCTURED_EMPTY_RESULT";
    const NO_USABLE_VARIANT_ERROR = "KV_STRUCTURED_NO_USABLE_VARIANT";
    const optimizationTaskId = `prompt-opt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimizationCreatedAt = new Date().toISOString();

    type KvStructuredOptimizationAttemptResult = {
      attemptIndex: number;
      optimizedText: string;
      sourceType: ReturnType<typeof parseDesignStructuredOptimizationResponse>["sourceType"];
      variant: ShortcutOptimizationVariantDraft;
    };

    const isMeaningfulVariant = (variant: ShortcutOptimizationVariantDraft, index: number) => (
      (variant.label.trim() && variant.label.trim() !== `版本 ${index + 1}`)
      || Object.values(variant.values).some((value) => value.trim())
      || Object.values(variant.coreSuggestions).some((value) => value.trim())
      || variant.palette.length > 0
      || Object.values(variant.analysis).some((section) => (
        section.detailText.trim().length > 0
      ))
      || variant.promptPreview.trim().length > 0
    );

    const cloneOptimizationVariant = (
      variant: ShortcutOptimizationVariantDraft,
    ): ShortcutOptimizationVariantDraft => ({
      ...variant,
      values: cloneShortcutValues(variant.values),
      removedFieldIds: [...variant.removedFieldIds],
      coreSuggestions: cloneShortcutValues(variant.coreSuggestions),
      palette: cloneDesignPalette(variant.palette),
      analysis: cloneDesignAnalysis(variant.analysis),
      baseline: cloneVariantBaseline(variant.baseline),
    });

    const buildSelectedVariants = (
      results: KvStructuredOptimizationAttemptResult[],
    ): ShortcutOptimizationVariantDraft[] => (
      results
        .slice(0, DESIGN_STRUCTURED_VARIANT_IDS.length)
        .map((result, index) => {
          const variantId = DESIGN_STRUCTURED_VARIANT_IDS[index] as KvStructuredVariantId;
          const nextLabel = result.variant.label.trim() || `版本 ${index + 1}`;
          return {
            ...result.variant,
            id: variantId,
            label: nextLabel,
            values: cloneShortcutValues(result.variant.values),
            removedFieldIds: [...result.variant.removedFieldIds],
            coreSuggestions: cloneShortcutValues(result.variant.coreSuggestions),
            palette: cloneDesignPalette(result.variant.palette),
            analysis: cloneDesignAnalysis(result.variant.analysis),
            baseline: {
              ...cloneVariantBaseline(result.variant.baseline),
              label: nextLabel,
            },
          };
        })
    );

    const buildActiveTemplateFromVariants = (
      variants: ShortcutOptimizationVariantDraft[],
      sourceType: ReturnType<typeof parseDesignStructuredOptimizationResponse>["sourceType"],
      lastRawResponse: string,
    ): ActiveShortcutTemplate | null => {
      if (variants.length === 0) {
        return null;
      }

      const latestTemplate = activeShortcutTemplateRef.current;
      const existingSession = latestTemplate?.shortcut.id === current.shortcut.id
        ? latestTemplate.optimizationSession
        : undefined;
      const existingVariantMap = new Map<KvStructuredVariantId, ShortcutOptimizationVariantDraft>(
        (existingSession?.variants || []).map((variant) => [variant.id, variant]),
      );
      const mergedVariants = variants.map((variant) => {
        const existingVariant = existingVariantMap.get(variant.id);
        return existingVariant
          ? cloneOptimizationVariant(existingVariant)
          : cloneOptimizationVariant(variant);
      });

      const fallbackVariant = mergedVariants[0];
      if (!fallbackVariant) {
        return null;
      }

      const activeVariantId = existingSession?.activeVariantId
        && mergedVariants.some((variant) => variant.id === existingSession.activeVariantId)
        ? existingSession.activeVariantId
        : fallbackVariant.id;
      const activeVariant = mergedVariants.find((variant) => variant.id === activeVariantId) || fallbackVariant;
      const optimizationSession: ShortcutOptimizationSession = {
        sourceType,
        originValues: cloneShortcutValues(sourceValues),
        originRemovedFieldIds: [...sourceRemovedFieldIds],
        activeVariantId,
        variants: mergedVariants,
        lastRawResponse,
      };

      return {
        shortcut: current.shortcut,
        values: cloneShortcutValues(activeVariant.values),
        removedFieldIds: [...activeVariant.removedFieldIds],
        appliedPrompt: activeVariant.promptPreview,
        optimizationSession,
      };
    };

    const runSingleAttempt = async (attemptIndex: number): Promise<KvStructuredOptimizationAttemptResult> => {
      const optimizedText = await optimizePrompt(taggedOptimizationInput, selectedAIModel);
      console.info(`[KV structured optimization] raw_response attempt_${attemptIndex + 1}`, optimizedText);

      if (!optimizedText) {
        throw new Error(EMPTY_RESULT_ERROR);
      }

      const parsedResponse = parseDesignStructuredOptimizationResponse(optimizedText);
      const variants = createShortcutOptimizationVariants(
        current.shortcut,
        sourceValues,
        sourceRemovedFieldIds,
        optimizedText,
      );
      const firstUsableVariant = variants.find((variant, index) => isMeaningfulVariant(variant, index));
      if (!firstUsableVariant) {
        throw new Error(NO_USABLE_VARIANT_ERROR);
      }

      return {
        attemptIndex,
        optimizedText,
        sourceType: parsedResponse.sourceType,
        variant: firstUsableVariant,
      };
    };

    const successfulResults: KvStructuredOptimizationAttemptResult[] = [];
    const rejectedReasons: unknown[] = [];
    let primarySourceType: ReturnType<typeof parseDesignStructuredOptimizationResponse>["sourceType"] | null = null;
    let latestRawResponse = "";
    let hasAppliedFirstResult = false;

    const applySuccessfulResult = (result: KvStructuredOptimizationAttemptResult) => {
      successfulResults.push(result);
      if (!primarySourceType) {
        primarySourceType = result.sourceType;
      }
      latestRawResponse = result.optimizedText;

      const selectedVariants = buildSelectedVariants(successfulResults);
      const activeTemplate = buildActiveTemplateFromVariants(
        selectedVariants,
        primarySourceType || result.sourceType,
        latestRawResponse,
      );
      if (!activeTemplate?.optimizationSession) {
        return;
      }

      const activeOptimizationSource = buildStructuredOptimizationSourcePayload(
        activeTemplate,
        optimizationTaskId,
        activeTemplate.optimizationSession.activeVariantId,
      );

      activeShortcutTemplateRef.current = activeTemplate;
      setActiveShortcutTemplate(activeTemplate);

      const currentConfig = usePlaygroundStore.getState().config;
      const nextPrompt = hasAppliedFirstResult ? currentConfig.prompt : activeTemplate.appliedPrompt;
      updateConfig(activeOptimizationSource
        ? withPromptOptimizationSource(
          {
            ...currentConfig,
            prompt: nextPrompt,
          },
          activeOptimizationSource,
        )
        : { prompt: nextPrompt },
      );

      hasAppliedFirstResult = true;
    };

    await Promise.allSettled(
      Array.from(
        { length: KV_STRUCTURED_OPTIMIZATION_PARALLEL_REQUEST_COUNT },
        (_, attemptIndex) => runSingleAttempt(attemptIndex)
          .then((result) => {
            applySuccessfulResult(result);
            return result;
          })
          .catch((error) => {
            rejectedReasons.push(error);
            throw error;
          }),
      ),
    );

    if (successfulResults.length === 0) {
      console.error("Failed to get usable KV structured optimization response", rejectedReasons);
      const hasParseFailure = rejectedReasons.some((reason) => (
        !(reason instanceof Error && reason.message === EMPTY_RESULT_ERROR)
      ));

      if (hasParseFailure) {
        toast({
          title: "AI 优化结果解析失败",
          description: "返回结果已尝试自动修复，但仍然无法解析，请重新请求一次。",
          variant: "destructive",
        });
      }

      return true;
    }

    const selectedVariants = (activeShortcutTemplateRef.current?.shortcut.id === current.shortcut.id
      ? activeShortcutTemplateRef.current?.optimizationSession?.variants
      : undefined) || buildSelectedVariants(successfulResults);
    const normalizedSelectedVariants = selectedVariants
      .slice(0, DESIGN_STRUCTURED_VARIANT_IDS.length)
      .map((variant) => cloneOptimizationVariant(variant));

    if (normalizedSelectedVariants.length === 0) {
      toast({
        title: "AI 优化结果解析失败",
        description: "返回结果已尝试自动修复，但仍然无法解析，请重新请求一次。",
        variant: "destructive",
      });
      return true;
    }

    const activeVariantIdCandidate = activeShortcutTemplateRef.current?.shortcut.id === current.shortcut.id
      ? activeShortcutTemplateRef.current?.optimizationSession?.activeVariantId
      : undefined;
    const activeVariantId = activeVariantIdCandidate
      && normalizedSelectedVariants.some((variant) => variant.id === activeVariantIdCandidate)
      ? activeVariantIdCandidate
      : normalizedSelectedVariants[0].id;
    const optimizationSession: ShortcutOptimizationSession = {
      sourceType: primarySourceType || successfulResults[0].sourceType,
      originValues: cloneShortcutValues(sourceValues),
      originRemovedFieldIds: [...sourceRemovedFieldIds],
      activeVariantId,
      variants: normalizedSelectedVariants,
      lastRawResponse: latestRawResponse || successfulResults[0].optimizedText,
    };

    prependHistoryItems(createPromptOptimizationHistoryItems({
      taskId: optimizationTaskId,
      createdAt: optimizationCreatedAt,
      userId: effectiveUserId,
      originalPrompt: buildShortcutPrompt(current.shortcut, sourceValues, {
        usePlaceholder: false,
        removedFieldIds: sourceRemovedFieldIds,
      }),
      sourceKind: "kv_structured",
      shortcutId: current.shortcut.id,
      session: serializeShortcutOptimizationSession(optimizationSession),
      variants: normalizedSelectedVariants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        prompt: variant.promptPreview,
      })),
      configBase: {
        model: current.shortcut.model,
        baseModel: current.shortcut.model,
        width: usePlaygroundStore.getState().config.width,
        height: usePlaygroundStore.getState().config.height,
      },
      maxItems: KV_STRUCTURED_HISTORY_BACKFILL_COUNT,
    }));
    toast({
      title: `AI 已生成 ${normalizedSelectedVariants.length} 个版本`,
      description: "可在输入区直接切换版本并继续编辑。",
    });

    return true;
  }, [effectiveUserId, optimizePrompt, prependHistoryItems, selectedAIModel, toast, updateConfig]);

  const handleShortcutOptimizationRegenerate = React.useCallback(async () => {
    await runKvStructuredOptimization();
  }, [runKvStructuredOptimization]);

  const handleOptimizePrompt = React.useCallback(async () => {
    const shortcutTemplateSnapshot = activeShortcutTemplateRef.current;
    const inlineShortcutTemplateSnapshot = shortcutTemplateSnapshot && !isKvShortcutId(shortcutTemplateSnapshot.shortcut.id)
      ? shortcutTemplateSnapshot
      : null;

    if (shortcutTemplateSnapshot && !inlineShortcutTemplateSnapshot) {
      setActiveShortcutTemplate(null);
    }

    const handledByKvFlow = await runKvStructuredOptimization(shortcutTemplateSnapshot);
    if (handledByKvFlow) {
      return;
    }

    const optimizationInput = buildPromptOptimizationVariantsInput(
      config.prompt,
      PROMPT_OPTIMIZATION_VARIANT_COUNT,
    );
    const taggedOptimizationInput = prependPromptOptimizationRequestPrefix(
      optimizationInput,
      "[Text]",
    );
    const optimizedText = await optimizePrompt(
      taggedOptimizationInput,
      selectedAIModel,
      undefined,
      undefined,
    );

    if (!optimizedText) {
      return;
    }

    const parsedVariants = parsePromptOptimizationVariants(
      optimizedText,
      PROMPT_OPTIMIZATION_VARIANT_COUNT,
    );
    if (parsedVariants.length === 0) {
      toast({
        title: "AI 优化结果为空",
        description: "本次没有拿到可用的优化结果，请重新尝试。",
        variant: "destructive",
      });
      return;
    }

    const createdAt = new Date().toISOString();
    const optimizationTaskId = `prompt-opt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const promptVariants = parsedVariants
      .slice(0, PROMPT_OPTIMIZATION_VARIANT_COUNT)
      .map((prompt, index) => ({
        id: `v${index + 1}`,
        label: `方案 ${String.fromCharCode(65 + index)}`,
        prompt,
      }));
    const firstVariant = promptVariants[0];

    prependHistoryItems(createPromptOptimizationHistoryItems({
      taskId: optimizationTaskId,
      createdAt,
      userId: effectiveUserId,
      originalPrompt: config.prompt,
      sourceKind: inlineShortcutTemplateSnapshot ? "shortcut_inline" : "plain_text",
      variants: promptVariants,
      configBase: {
        model: config.model,
        baseModel: config.baseModel || config.model,
        width: config.width,
        height: config.height,
      },
      shortcutId: inlineShortcutTemplateSnapshot?.shortcut.id,
    }));

    if (firstVariant) {
      const optimizationSource: PromptOptimizationSourcePayload = {
        version: 2,
        sourceKind: inlineShortcutTemplateSnapshot ? "shortcut_inline" : "plain_text",
        taskId: optimizationTaskId,
        originalPrompt: config.prompt,
        activeVariantId: firstVariant.id,
        activeVariantLabel: firstVariant.label,
        shortcutId: inlineShortcutTemplateSnapshot?.shortcut.id,
      };

      setConfig((prev) => withPromptOptimizationSource(
        {
          ...withoutPromptOptimizationSource(prev),
          prompt: firstVariant.prompt,
        },
        optimizationSource,
      ));

      if (inlineShortcutTemplateSnapshot) {
        const nextDocument = createShortcutEditorDocumentFromText(firstVariant.prompt);

        setActiveShortcutTemplate({
          shortcut: inlineShortcutTemplateSnapshot.shortcut,
          values: cloneShortcutValues(inlineShortcutTemplateSnapshot.values),
          removedFieldIds: getRemovedFieldIdsFromShortcutEditorDocument(
            inlineShortcutTemplateSnapshot.shortcut,
            nextDocument,
          ),
          appliedPrompt: firstVariant.prompt,
          editorDocument: nextDocument,
        });
      }
    }

    toast({
      title: `AI 已生成 ${promptVariants.length} 个方案`,
      description: "结果已写入历史记录，当前输入框已回填方案 A。",
    });
  }, [config.baseModel, config.height, config.model, config.prompt, config.width, effectiveUserId, optimizePrompt, prependHistoryItems, runKvStructuredOptimization, selectedAIModel, setConfig, toast]);

  const handleDescribe = React.useCallback(async () => {
    if (describeImages.length === 0) {
      toast({ title: "错误", description: "请先上传图片", variant: "destructive" });
      return;
    }

    setIsDescribing(true);
    setDescribePersistenceFailed(false);
    setHasGenerated(true); // Trigger split layout immediately like generate
    setViewMode('dock');
    setActiveTab('history');
    setShowHistory(true); // Auto-expand history panel

    const startTime = new Date().toISOString();
    // Create a unified taskId for the entire batch to ensure grouping
    const batchTaskId = Date.now().toString() + Math.random().toString(36).substring(2, 7);

    // Create temporary loading cards (show 4 placeholders while describing)
    const loadingBatchToken = Date.now();
    const loadingIds = Array.from({ length: 4 }, (_, index) => `describe-loading-${loadingBatchToken}-${index}`);
    const loadingIdSet = new Set(loadingIds);
    const image = describeImages[0];
    const imageUrl = image.path || image.previewUrl;

    const loadingCards: import('@/types/database').Generation[] = loadingIds.map((id) => ({
      id,
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
        historyRecordType: IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
        promptCategory: "image_description",
      },
      status: 'pending',
      createdAt: startTime,
    }));

    // Insert loading cards
    setHistory((prev: import('@/types/database').Generation[]) => [...loadingCards, ...prev]);
    setDescribeOptimisticHistory(loadingCards);

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

      const modelId = 'coze-prompt';
      const describeFocusPrompts = [
        '优先强调主体和动作姿态，并保持客观准确。',
        '优先强调服装材质、配饰和人物外观细节，并保持客观准确。',
        '优先强调场景环境、背景元素与空间层次，并保持客观准确。',
        '优先强调构图、光照、色彩氛围与可见文字信息，并保持客观准确。',
      ];

      const settledResults = await Promise.allSettled(
        loadingIds.map((_, index) => requestDescribeImage({
          image: `data:image/png;base64,${base64}`,
          model: modelId,
          prompt: `${VISION_DESCRIBE_SINGLE_SYSTEM_PROMPT}\n\n补充要求：${describeFocusPrompts[index % describeFocusPrompts.length]}`,
        }))
      );

      const rejectedCount = settledResults.filter((result) => result.status === 'rejected').length;
      if (rejectedCount > 0) {
        console.warn('Describe partial failures', {
          rejectedCount,
          totalCount: settledResults.length,
        });
      }

      const results = settledResults
        .flatMap((result) => result.status === 'fulfilled'
          ? result.value?.text?.split('|||') ?? []
          : [])
        .map((text) => text.trim())
        .filter(Boolean)
        .slice(0, loadingIds.length);

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
            historyRecordType: IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
            promptCategory: "image_description",
          },
          status: 'completed',
          createdAt: startTime,
        }));

        // Remove loading cards and add real results
        setDescribeOptimisticHistory(newHistoryItems);

        // Also save each description to backend and sync to gallery.
        // Keep optimistic cards until persistence round completes to avoid pending->completed flicker/disappear.
        setIsPersistingDescribeHistory(true);
        try {
          const persistResults = await Promise.all(newHistoryItems.map((item) => saveHistoryToBackend(item)));
          if (persistResults.some(Boolean)) {
            await mutateHistory();
          }
          if (persistResults.some((result) => !result)) {
            setDescribePersistenceFailed(true);
            toast({ title: "历史同步延迟", description: "部分反推结果尚未写入服务器，当前先保留在本地列表中。", variant: "destructive" });
          }
        } finally {
          setIsPersistingDescribeHistory(false);
        }

        if (rejectedCount > 0 || results.length < loadingIds.length) {
          toast({ title: "描述部分完成", description: `已生成 ${results.length}/${loadingIds.length} 组描述卡片` });
        } else {
          toast({ title: "描述成功", description: `已生成 ${results.length} 组描述卡片` });
        }
      } else {
        throw new Error("解析描述结果失败");
      }
    } catch (error) {
      console.error("Describe Error:", error);
      setDescribeOptimisticHistory([]);
      setIsPersistingDescribeHistory(false);
      // Remove loading cards on error
      setHistory((prev: import('@/types/database').Generation[]) => prev.filter(item => !loadingIdSet.has(item.id)));
      toast({ title: "描述失败", description: error instanceof Error ? error.message : "未知错误", variant: "destructive" });
    } finally {
      setIsDescribing(false);
    }
  }, [describeImages, setHasGenerated, setViewMode, setActiveTab, setShowHistory, config, toast, effectiveUserId, saveHistoryToBackend, mutateHistory]);

  const handleBatchUse = useCallback(async (results: Generation[]) => {
    if (!results || results.length === 0) return;
    toast({ title: "批量生成中", description: `即将开始 ${results.length} 个生成任务...` });
    
    // Generate ALL 仅复用每张卡片的 prompt，始终使用当前模型配置进行文生图。
    for (const result of results) {
      const currentStoreConfig = usePlaygroundStore.getState().config;
      const prompt = result.config?.prompt || '';

      const fullConfig: GenerationConfig = {
        ...currentStoreConfig,
        prompt,
        taskId: undefined,
        isEdit: false,
        editConfig: undefined,
        parentId: undefined,
        sourceImageUrls: [],
        localSourceIds: [],
      };

      await handleGenerate({ 
        configOverride: fullConfig,
        sourceImageUrls: [],
        localSourceIds: [],
      });
      await new Promise(r => setTimeout(r, 300));
    }
  }, [handleGenerate, toast]);


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

    const isEditGeneration = (item?: Generation): boolean => isHistoryEditGeneration(item?.config);

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

        const parentGeneration = getHistoryItem(parentRecordId);
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

    const normalizedImageUrl = formatImageUrl(imageUrl);

    setImageEditState({
      open: true,
      imageUrl: normalizedImageUrl,
      initialPrompt: historyItem.config.prompt || '',
      initialSession,
      legacySnapshot,
      initialModelId: String(historyItem.config.model || historyItem.config.baseModel || selectedModel || defaultImageModelId),
      initialImageSize: String(historyItem.config.imageSize || config.imageSize || '1K'),
      initialAspectRatio: String(historyItem.config.aspectRatio || config.aspectRatio || '1:1'),
      initialBatchSize: 4,
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
  }, [config.aspectRatio, config.imageSize, defaultImageModelId, getHistoryItem, selectedModel, setSelectedPresetName, updateConfig]);

  const handleEditUploadedImage = useCallback(() => {
    const imageToEdit = usePlaygroundStore.getState().uploadedImages[0];
    const imageUrl = imageToEdit ? (imageToEdit.path || imageToEdit.previewUrl) : "";
    const currentConfig = usePlaygroundStore.getState().config;

    const normalizedImageUrl = formatImageUrl(imageUrl);

    setImageEditState({
      open: true,
      imageUrl: normalizedImageUrl,
      initialPrompt: currentConfig.prompt || config.prompt || '',
      initialSession: currentConfig.imageEditorSession as ImageEditorSessionSnapshot | undefined,
      legacySnapshot: currentConfig.tldrawSnapshot as Record<string, unknown> | undefined,
      initialModelId: String(currentConfig.model || selectedModel || defaultImageModelId),
      initialImageSize: String(currentConfig.imageSize || '1K'),
      initialAspectRatio: String(currentConfig.aspectRatio || '1:1'),
      initialBatchSize: 4,
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
  }, [config.prompt, defaultImageModelId, selectedModel, setSelectedPresetName, updateConfig]);

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
      await handleFilesUpload([file], 'reference', { waitForUpload: true });

      updateConfig({
        prompt: payload.finalPrompt,
        model: payload.modelId,
        imageSize: payload.imageSize as GenerationConfig['imageSize'],
        aspectRatio: payload.aspectRatio as GenerationConfig['aspectRatio'],
        isEdit: true,
        isPreset: false,
        presetName: undefined,
        loras: [],
        parentId: imageEditState.parentId,
        imageEditorSession: payload.sessionSnapshot,
        editConfig: nextEditConfig,
      });
      setSelectedModel(payload.modelId);
      setBatchSize(payload.batchSize);

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

      await handleGenerate({ batchSizeOverride: payload.batchSize });

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
  }, [handleFilesUpload, handleGenerate, imageEditState.imageUrl, imageEditState.parentId, setSelectedModel, setSelectedPresetName, setUploadedImages, syncHistoryConfig, toast, updateConfig]);





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
      applyModel(model, withoutPromptOptimizationSource(usePlaygroundStore.getState().config));
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
      updateConfig(withoutPromptOptimizationSource({
        ...usePlaygroundStore.getState().config,
        presetName: undefined,
        isPreset: false,
      }));
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
        editorDocument: activeShortcutTemplate.editorDocument,
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
    onShortcutTemplateDocumentChange: handleShortcutTemplateDocumentChange,
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
    handleShortcutTemplateFieldRemove, handleShortcutTemplateDocumentChange, handleExitShortcutTemplate, handleClearShortcutTemplate,
    handleShortcutOptimizationAnalysisSectionChange, handleShortcutOptimizationPaletteChange,
    handleShortcutOptimizationEditInstructionChange, handleShortcutOptimizationPrefillInstruction,
    handleShortcutOptimizationApplyEdit, handleShortcutOptimizationRestoreVariant,
    handleShortcutOptimizationRegenerate,
    handleShortcutOptimizationVariantSelect, handleGenerateAllShortcutVariants
  ]);
  const isMoodboardDetailDialogOpen = React.useCallback(() => {
    if (typeof document === 'undefined') {
      return false;
    }
    return Boolean(document.querySelector('[data-moodboard-detail-open="true"]'));
  }, []);
  const shouldShowGalleryFloatingInput =
    viewMode === 'dock' &&
    activeTab === 'gallery' &&
    isFloatingInputVisible &&
    !isImageModalOpen;

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
          if (isMoodboardDetailDialogOpen()) {
            setIsDraggingOver(false);
            setIsDraggingOverPanel(false);
            return;
          }

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
          if (isMoodboardDetailDialogOpen()) {
            setIsDraggingOver(false);
            setIsDraggingOverPanel(false);
            return;
          }
          // 与 onDragEnter 保持一致的文件判定
          const hasFiles = e.dataTransfer?.types?.includes('Files');
          if (hasFiles && !isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isMoodboardDetailDialogOpen()) {
            setIsDraggingOver(false);
            setIsDraggingOverPanel(false);
            return;
          }
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
          if (isMoodboardDetailDialogOpen()) {
            setIsDraggingOver(false);
            setIsDraggingOverPanel(false);
            return;
          }
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
                    {viewMode === 'home' && !isPresetGridOpen && !shouldHideHomeEntryCards && (
                      <PlaygroundHomeActions
                        onOpenDescribe={() => { setViewMode('dock'); setActiveTab('describe'); }}
                        onEdit={handleEditUploadedImage}
                        onOpenHistory={() => { setViewMode('dock'); setActiveTab('history'); }}
                        onOpenGallery={() => { setViewMode('dock'); setActiveTab('gallery'); }}
                      />
                    )}

                    {viewMode === 'dock' && activeTab === 'history' && (
                      <PlaygroundHistoryPanel
                        history={historyForPanel}
                        historyLayoutMode={historyLayoutMode}
                        onHistoryLayoutModeChange={setHistoryLayoutMode}
                        onClose={() => setViewMode('home')}
                        onLoadMore={() => setSize(size + 1)}
                        hasMore={hasMoreHistory}
                        isLoading={isHistoryLoading}
                        isLoadingMore={isHistoryLoadingMore}
                        onRegenerate={handleRegenerate}
                        onApplyModelFromHistory={(result) => {
                          if (result.config) {
                            applyModel(result.config.model, {
                              ...result.config,
                              loras: result.config.loras || [],
                              presetName: result.config.presetName,
                            });
                          }
                        }}
                        onDownload={handleDownload}
                        onEdit={handleEditImage}
                        onImageClick={openImageModal}
                        onUsePrompt={handleUseHistoryPrompt}
                        onBatchUse={handleBatchUse}
                      />
                    )}

                  </div>
                </div>

                <PlaygroundDockPanels
                  viewMode={viewMode}
                  activeTab={activeTab}
                  onImageClick={openImageModal}
                  onUsePrompt={handleUseGalleryPrompt}
                  onUseImage={handleUseGalleryImage}
                  onShortcutQuickApply={handleShortcutQuickApply}
                  onMoodboardApply={() => setViewMode('home')}
                  isGenerating={isGenerating}
                  onGenerateBanner={(options) => handleGenerate((options as GenerateOptions) || {})}
                  bannerSessionHistory={bannerSessionHistory}
                  isDraggingOver={isDraggingOver}
                  historyController={historyController}
                />

              </div>

            </div>

            {!isPresetGridOpen && !isPresetManagerOpen && viewMode === 'home' && !shouldHideHomeEntryCards && (
              <div className="absolute bottom-0 w-full overflow-visible z-50 pointer-events-none flex flex-col items-center">
                <MoodboardMarquee
                  items={moodboardCardEntries.slice(0, 10)}
                  onQuickApply={handleShortcutQuickApply}
                  onPreviewImage={handleShortcutPreviewOpen}
                  onMoodboardCardsChange={refreshMoodboardCards}
                />
                <div className="mt-4 mb-8 pointer-events-auto">
                  <button
                    onClick={() => { setViewMode('dock'); setActiveTab('style'); }}
                    className={cn(
                     "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all bg-black/20",
          "border-white/20 text-white/90 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    
                    <span className="text-sm font-medium">See All Moodboard</span>
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

        {shouldShowGalleryFloatingInput && (
          <div className="pointer-events-none fixed left-1/2 bottom-8 z-[1370] w-[50vw] max-w-[1200px] scale-75 -translate-x-1/2">
            <div
              key={floatingInputAnimationKey}
              className="pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <PlaygroundInputSection {...inputSectionProps} hideTitle isFloatingOverlay />
            </div>
          </div>
        )}

        <PlaygroundModalStack
          selectedResultPreviewKey={selectedResultPreviewKey}
          isImageModalOpen={isImageModalOpen}
          onCloseImageModal={closeImageModal}
          selectedResult={selectedResult}
          previewableHistory={previewableHistory}
          currentIndex={currentIndex}
          isHydratingSelectedResult={isHydratingSelectedResult}
          onSelectResult={jumpToResult}
          onEditImage={handleEditImage}
          onNextImage={handleNextImage}
          onPrevImage={handlePrevImage}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onRegenerate={handleRegenerate}
          onApplyPrompt={handleModalApplyPrompt}
          onApplyImage={handleModalApplyImage}
          selectedShortcutPreviewKey={selectedShortcutPreviewKey}
          selectedShortcutPreviewResult={selectedShortcutPreviewResult}
          onCloseShortcutPreview={handleShortcutPreviewClose}
          shortcutPreviewResults={shortcutPreviewResults}
          shortcutPreviewCurrentIndex={shortcutPreviewCurrentIndex}
          onSelectShortcutPreview={handleShortcutPreviewSelect}
          onNextShortcutPreview={handleShortcutPreviewNext}
          onPrevShortcutPreview={handleShortcutPreviewPrev}
          shortcutPreviewHasNext={shortcutPreviewHasNext}
          shortcutPreviewHasPrev={shortcutPreviewHasPrev}
          imageEditState={imageEditState}
          onImageEditOpenChange={(open) => {
            setImageEditState((previous) => ({
              ...previous,
              open,
            }));
          }}
          onImageEditConfirm={handleImageEditConfirm}
          fluxKleinConnectionHelp={fluxKleinConnectionHelp}
          onDismissFluxKleinConnectionHelp={dismissFluxKleinConnectionHelp}
          previewImageUrl={previewImageUrl}
          previewLayoutId={previewLayoutId}
          onClosePreviewImage={() => setPreviewImage(null)}
          activeDragItem={activeDragItem}
          selectedHistoryCount={selectedHistoryIds.size}
        />
      </div >
    </DndContext >
  );
};

export default PlaygroundV2Page;
