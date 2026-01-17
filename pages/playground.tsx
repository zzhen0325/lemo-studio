"use client";


import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import NextImage from "next/image";
import { useToast } from "@/hooks/common/use-toast";

import { usePromptOptimization, AIModel } from "@/hooks/features/PlaygroundV2/usePromptOptimization";


import { useGenerationService } from "@/hooks/features/PlaygroundV2/useGenerationService";
import { useAIService } from "@/hooks/ai/useAIService";
import { GoogleApiStatus } from "@/components/features/playground-v2/GoogleApiStatus";
import SimpleImagePreview from "@/components/features/playground-v2/SimpleImagePreview";
import HistoryList from "@/components/features/playground-v2/HistoryList";
import ImagePreviewModal from "@/components/features/playground-v2/Dialogs/ImagePreviewModal";
import ImageEditorModal from "@/components/features/playground-v2/Dialogs/ImageEditorModal";
import WorkflowSelectorDialog from "@/components/features/playground-v2/Dialogs/WorkflowSelectorDialog";
import BaseModelSelectorDialog from "@/components/features/playground-v2/Dialogs/BaseModelSelectorDialog";
import LoraSelectorDialog, { SelectedLora } from "@/components/features/playground-v2/Dialogs/LoraSelectorDialog";
import { PresetManagerDialog } from "@/components/features/playground-v2/Dialogs/PresetManagerDialog";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import type { UIComponent } from "@/types/features/mapping-editor";
import type { GenerationConfig, UploadedImage, PresetExtended, EditPresetConfig } from "@/components/features/playground-v2/types";
import { VISION_DESCRIBE_SYSTEM_PROMPT } from "@/components/features/playground-v2/types";
import type { Generation } from "@/types/database";

import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";
import { History, Image as ImageIcon, Edit2, Sparkles, Palette } from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import dynamic from "next/dynamic";

const GalleryView = dynamic(() => import("@/components/features/playground-v2/GalleryView"), {
  loading: () => <div className="flex items-center justify-center h-full text-white">Loading Gallery...</div>,
  ssr: false
});
import { StyleStacksView } from '@/components/features/playground-v2/StyleStacksView';
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { useMediaQuery } from "@/hooks/common/use-media-query";
import { PresetGridOverlay } from "@/components/features/playground-v2/PresetGridOverlay";
import { PlaygroundBackground } from "@/components/features/playground-v2/PlaygroundBackground";
import { PlaygroundInputSection } from "@/components/features/playground-v2/PlaygroundInputSection";
import { AR_MAP } from "@/components/features/playground-v2/constants/aspect-ratio";
import { StylesMarquee } from "@/components/features/playground-v2/StylesMarquee";
import { v4 as uuidv4 } from 'uuid';

import gsap from "gsap";
import { Flip } from "gsap/all";
import { useGSAP } from "@gsap/react";
import { observer } from "mobx-react-lite";
import { projectStore } from "@/lib/store/project-store";
import { AllProjectsView } from "@/components/features/playground-v2/ProjectSection/project-sidebar/AllProjectsView";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

gsap.registerPlugin(Flip, useGSAP);

export interface PlaygroundV2PageProps {
  onEditMapping?: (workflow: IViewComfy) => void;
  onGenerate?: () => void;
  onHistoryChange?: (history: Generation[]) => void;

}

type DockTab = 'history' | 'gallery' | 'describe' | 'style';

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
  const initPresets = usePlaygroundStore(s => s.initPresets);
  const generationHistory = usePlaygroundStore(s => s.generationHistory);
  const setGenerationHistory = usePlaygroundStore(s => s.setGenerationHistory);
  const fetchHistory = usePlaygroundStore(s => s.fetchHistory);
  const applyModel = usePlaygroundStore(s => s.applyModel);
  const addStyle = usePlaygroundStore(s => s.addStyle);

  const setConfig = (val: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => {
    const currentConfig = usePlaygroundStore.getState().config;
    if (typeof val === 'function') {
      updateConfig(val(currentConfig));
    } else {
      updateConfig(val);
    }
  };

  // const hasGenerated = usePlaygroundStore(s => s.hasGenerated);
  const setHasGenerated = usePlaygroundStore(s => s.setHasGenerated);
  // const remix = usePlaygroundStore(s => s.remix);
  const isAspectRatioLocked = usePlaygroundStore(s => s.isAspectRatioLocked);
  const setIsAspectRatioLocked = usePlaygroundStore(s => s.setAspectRatioLocked);
  const isMockMode = usePlaygroundStore(s => s.isMockMode);
  const setMockMode = usePlaygroundStore(s => s.setMockMode);
  const isSelectorExpanded = usePlaygroundStore(s => s.isSelectorExpanded);
  const setIsSelectorExpanded = usePlaygroundStore(s => s.setSelectorExpanded);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const describePanelRef = useRef<HTMLDivElement>(null);

  const [showAllProjects, setShowAllProjects] = useState(false);

  const mobxProjectId = projectStore.currentProjectId;

  useEffect(() => {
    fetchHistory(1, mobxProjectId || undefined);
  }, [fetchHistory, mobxProjectId]);

  const filteredHistory = useMemo(() => {
    if (!mobxProjectId) return generationHistory;
    return generationHistory.filter(h => h.projectId === mobxProjectId);
  }, [generationHistory, mobxProjectId]);

  const [selectedAIModel, setSelectedAIModel] = useState<AIModel>('auto'); // 默认使用settings中的配置
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isBaseModelDialogOpen, setIsBaseModelDialogOpen] = useState(false);
  const [isLoraDialogOpen, setIsLoraDialogOpen] = useState(false);
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isPresetGridOpen, setIsPresetGridOpen] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  // const [isDescribeMode, setIsDescribeMode] = useState(false); // Refactored to viewMode
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverPanel, setIsDraggingOverPanel] = useState(false);
  const [historyLayoutMode, setHistoryLayoutMode] = useState<'grid' | 'list'>('list');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [batchSize, setBatchSize] = useState(4); // Default batch size

  // New View Mode State
  const [activeTab, setActiveTab] = useState<DockTab>('history');

  const {
    showHistory,
    setShowHistory,
    showProjectSidebar,
    selectedPresetName,
    setSelectedPresetName,
    viewMode,
    setViewMode,
    previewImageUrl,
    previewLayoutId,
    setPreviewImage,
    setIsSelectionMode,
    selectedHistoryIds,
    clearHistorySelection,
    setGenerationHistory: setGlobalGenerationHistory
  } = usePlaygroundStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeDragItem, setActiveDragItem] = useState<Generation | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'history-item') {
      setActiveDragItem(event.active.data.current.generation);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { over } = event;
    if (!over) return;

    const selectedItems = generationHistory.filter(h => selectedHistoryIds.has(h.id));

    if (over.data.current?.type === 'project') {
      const targetProjectId = over.data.current.projectId;

      // 1. Update project store
      await projectStore.addGenerationsToProject(targetProjectId, selectedItems);

      // 2. Update global store
      setGlobalGenerationHistory(prev => prev.map(item =>
        selectedHistoryIds.has(item.id) ? { ...item, projectId: targetProjectId } : item
      ));

      toast({ title: "Success", description: `Moved ${selectedItems.length} items to project` });
      setIsSelectionMode(false);
      clearHistorySelection();
    } else if (over.data.current?.type === 'new-project') {
      // 1. Create new project
      const newProject = await projectStore.createProjectWithHistory('New Project', selectedItems);

      // 2. Update global store
      setGlobalGenerationHistory(prev => prev.map(item =>
        selectedHistoryIds.has(item.id) ? { ...item, projectId: newProject.id } : item
      ));

      toast({ title: "Success", description: `Created new project with ${selectedItems.length} items` });
      setIsSelectionMode(false);
      clearHistorySelection();
    }
  };

  useEffect(() => {
    projectStore.toggleSidebar(showProjectSidebar);
  }, [showProjectSidebar]);

  // Sync showHistory with viewMode for side effects (like project sidebar)
  useEffect(() => {
    if (viewMode === 'dock') {
      if (!showHistory) setShowHistory(true);
    } else {
      if (showHistory) setShowHistory(false);
    }
  }, [viewMode, setShowHistory, showHistory]);

  // Sync workflow config when workflowName changes (e.g., during backfilling/remix)
  useEffect(() => {
    if (selectedModel === 'Workflow' && config.workflowName && !selectedWorkflowConfig) {
      const wf = workflows.find(w => w.viewComfyJSON.title === config.workflowName);
      if (wf) {
        setSelectedWorkflowConfig(wf);
      }
    }
  }, [config.workflowName, selectedModel, workflows, selectedWorkflowConfig, setSelectedWorkflowConfig]);

  // Removed click outside listener for Describe panel as it is now a persistent tab in Dock Mode.

  const promptWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initPresets();
  }, [initPresets]);

  // Helper: save history using unified fields
  const saveHistoryToBackend = async (item: import('@/types/database').Generation) => {
    try {
      const gen = {
        id: item.id,
        userId: item.userId || 'anonymous',
        projectId: item.projectId || 'default',
        outputUrl: item.outputUrl || '',
        config: item.config,
        status: item.status || 'completed',
        sourceImageUrl: item.sourceImageUrl,
        createdAt: item.createdAt || new Date().toISOString(),
      };
      await fetch(`${getApiBase()}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gen),
      });
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

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
    const path = uploadedImages[0]?.path;
    updateConfig({ sourceImageUrl: path });
  }, [uploadedImages, updateConfig]);


  const applyWorkflowDefaults = (workflow: IViewComfy) => {
    const mappingConfig = workflow.viewComfyJSON.mappingConfig as { components: UIComponent[] } | undefined;
    const newConfig = { ...config };
    const newLoras: SelectedLora[] = [];

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
          if (actualValue && typeof actualValue === 'string') newConfig.prompt = actualValue;
          else if (defaultValue) newConfig.prompt = defaultValue;
        } else if (paramName === 'width') {
          if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) newConfig.width = Number(actualValue);
          else if (defaultValue) newConfig.width = Number(defaultValue);
        } else if (paramName === 'height') {
          if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) newConfig.height = Number(actualValue);
          else if (defaultValue) newConfig.height = Number(defaultValue);
        } else if (paramName === 'model' || paramName === 'base_model') {
          if (actualValue && typeof actualValue === 'string') newConfig.model = actualValue;
          else if (defaultValue) newConfig.model = defaultValue;
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
          if (typeof val === "string") newConfig.prompt = val;
        } else if (title === "width" || title.includes("width")) {
          if (typeof val === "number" || typeof val === "string") newConfig.width = Number(val);
        } else if (title === "height" || title.includes("height")) {
          if (typeof val === "number" || typeof val === "string") newConfig.height = Number(val);
        } else if (title.includes("model") || title.includes("模型")) {
          if (!title.includes("lora")) {
            if (typeof val === "string") newConfig.model = val;
          }
        }
        if (title.includes("lora")) {
          if (typeof val === "string" && val) {
            newLoras.push({ model_name: val, strength: 1.0 });
          }
        }
      });
    }
    setConfig({ ...newConfig, loras: newLoras });
    if (selectedModel !== 'Workflow') setSelectedModel('Workflow');
    setSelectedLoras(newLoras);
  };

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Generation | undefined>(undefined);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string>("");
  const [editingPresetConfig, setEditingPresetConfig] = useState<EditPresetConfig | undefined>(undefined);

  const { handleGenerate: singleGenerate, executeGeneration, isGenerating } = useGenerationService();
  const { callVision } = useAIService();

  // Wrapper for batch generation
  const handleGenerate = async (configOverride?: GenerationConfig) => {
    // Switch to Dock Mode and History Tab
    setViewMode('dock');
    setActiveTab('history');
    setShowHistory(true); // Explicitly set for immediate effect

    // Create a unified timestamp for the entire batch to ensure grouping
    const startTime = new Date().toISOString();

    // Determine the effective batch size: 1 if overriding config (e.g. regenerate), otherwise current batchSize
    const effectiveBatchSize = configOverride ? 1 : batchSize;

    // Launch generation tasks
    // Frontend logic: call singleGenerate for each task immediately to show loading cards
    // Backend logic: singleGenerate handles the sequential submission or we use a custom delay here for the API call only
    for (let i = 0; i < effectiveBatchSize; i++) {
      // Create history item immediately to show all cards at once
      const currentConfig = usePlaygroundStore.getState().config;
      const currentLoras = usePlaygroundStore.getState().selectedLoras;
      const finalConfig = {
        ...(configOverride && typeof configOverride === 'object' && 'prompt' in configOverride
          ? configOverride
          : currentConfig),
        loras: currentLoras
      };
      const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
      const firstImage = currentUploadedImages[0];
      const sourceImageUrl = firstImage ? (firstImage.path || firstImage.previewUrl) : undefined;

      // 1. Immediately create and show the pending card
      singleGenerate(configOverride, startTime, true).then((taskId) => {
        // 2. Schedule the actual backend execution with a staggered delay
        if (taskId) {
          setTimeout(() => {
            executeGeneration(taskId, finalConfig, startTime, sourceImageUrl);
          }, i * 1100);
        }
      });
    }
  };
  const { optimizePrompt, isOptimizing } = usePromptOptimization(); // 使用settings中的配置

  const handleFilesUpload = async (files: File[] | FileList, target: 'reference' | 'describe' = 'reference') => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    const setImages = target === 'describe' ? setDescribeImages : setUploadedImages;

    for (const file of uploads) {
      const tempId = Math.random().toString(36).substring(7);
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result));
        reader.readAsDataURL(file);
      });

      // Add placeholder
      setImages((prev: UploadedImage[]) => [...prev, {
        id: tempId,
        file,
        base64: '',
        previewUrl: dataUrl,
        isUploading: true
      }]);

      const form = new FormData();
      form.append('file', file);

      try {
        const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: form });
        const json = await resp.json();
        const path = resp.ok && json?.path ? String(json.path) : undefined;
        const base64Data = dataUrl.split(',')[1];

        setImages((prev: UploadedImage[]) => prev.map((img: UploadedImage) =>
          img.id === tempId
            ? { ...img, base64: base64Data, path, isUploading: false }
            : img
        ));
      } catch (err) {
        console.error("Upload failed", err);
        const base64Data = dataUrl.split(',')[1];
        setImages((prev: UploadedImage[]) => prev.map((img: UploadedImage) =>
          img.id === tempId
            ? { ...img, base64: base64Data, isUploading: false }
            : img
        ));
      }
    }
  };
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    // 默认通过 input 上传的归为参考图，除非有特殊逻辑
    await handleFilesUpload(files, activeTab === 'describe' ? 'describe' : 'reference');
  };
  const removeImage = (index: number) => { setUploadedImages(prev => prev.filter((_, i) => i !== index)); };

  const handleStyleUpload = async (files: File[] | FileList) => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (uploads.length === 0) return;

    toast({ title: "正在上传图片", description: `正在为新风格处理 ${uploads.length} 张图片...` });

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
        name: `新风格 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        prompt: '',
        imagePaths,
        updatedAt: new Date().toISOString()
      };

      await addStyle(newStyle);
      toast({ title: "风格创建成功", description: `已成功创建新风格并包含 ${uploads.length} 张图片` });
    } catch (error) {
      console.error("Failed to upload images for new style", error);
      toast({
        title: "创建失败",
        description: "上传图片过程中出现错误，请重试",
        variant: "destructive"
      });
    }
  };

  const handleEditUploadedImage = () => {
    setEditingImageUrl(uploadedImages[0]?.previewUrl || "");
    setIsEditorOpen(true);
  };



  const handlePresetSelect = (p: PresetExtended) => {
    const preset = p as PresetExtended;
    const effectiveConfig = (preset.config as GenerationConfig) || (preset as unknown as GenerationConfig);
    const workflowId = (preset as PresetExtended & { workflow_id?: string }).workflow_id || effectiveConfig.workflowName;
    const presetName = (preset as PresetExtended & { title?: string; name?: string }).title || (preset as PresetExtended & { title?: string; name?: string }).name || effectiveConfig.workflowName || 'Preset';

    if (preset.editConfig) {
      setEditingImageUrl(preset.editConfig.originalImageUrl);
      setEditingPresetConfig(preset.editConfig);
      setIsEditorOpen(true);
    } else {
      setEditingPresetConfig(undefined);
    }

    // If it's a workflow preset, find and select the workflow first
    if (workflowId) {
      const workflow = workflows.find(w => w.viewComfyJSON.id === workflowId);
      if (workflow) {
        setSelectedWorkflowConfig(workflow);
        setSelectedModel('Workflow');

        // 比例和尺寸处理
        const resSize = effectiveConfig.resolution || '1K';
        const arName = effectiveConfig.aspectRatio || '1:1';
        const dims = AR_MAP[arName]?.[resSize] || { w: effectiveConfig.width || 1024, h: effectiveConfig.height || 1024 };

        // Apply fixed config from preset
        setConfig({
          ...config,
          prompt: effectiveConfig.prompt || '',
          width: dims.w,
          height: dims.h,
          model: effectiveConfig.model || 'Workflow',
          resolution: resSize,
          aspectRatio: arName as GenerationConfig['aspectRatio']
        });
        // Then apply remaining defaults from workflow (loras, etc)
        applyWorkflowDefaults(workflow);
      }
    } else {
      // Regular preset
      const modelToSet = effectiveConfig.model || 'Nano banana';
      const resSize = effectiveConfig.resolution || '1K';
      const arName = effectiveConfig.aspectRatio || '1:1';
      const dims = AR_MAP[arName]?.[resSize] || { w: effectiveConfig.width || 1024, h: effectiveConfig.height || 1024 };

      setConfig({
        ...effectiveConfig,
        presetName: presetName,
        loras: effectiveConfig.loras || [],
        model: modelToSet,
        width: dims.w,
        height: dims.h,
        resolution: resSize,
        aspectRatio: arName as GenerationConfig['aspectRatio']
      });
      setSelectedWorkflowConfig(undefined);
      if (modelToSet !== config.model) {
        setSelectedModel(modelToSet);
      }
    }

    setSelectedPresetName(presetName);
    setIsPresetGridOpen(false);
  };
  const handleOptimizePrompt = async () => {
    const optimizedText = await optimizePrompt(config.prompt, selectedAIModel);
    if (optimizedText) setConfig(prev => ({ ...prev, prompt: optimizedText }));
  };

  const handleDescribe = async () => {
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

    // Create a temporary loading card
    const loadingId = `describe-loading-${Date.now()}`;
    const loadingCard: import('@/types/database').Generation = {
      id: loadingId,
      userId: 'anonymous',
      projectId: 'default',
      outputUrl: describeImages[0].previewUrl,
      config: {
        prompt: "Analyzing image...",
        width: config.width,
        height: config.height,
        model: config.model,
        lora: config.lora,
      },
      status: 'pending',
      sourceImageUrl: describeImages[0].previewUrl,
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

      if (!base64) {
        throw new Error("无法获取图片数据");
      }

      // 2. Call unified Vision service
      const result = await callVision({
        image: `data:image/png;base64,${base64}`,
        systemPrompt: VISION_DESCRIBE_SYSTEM_PROMPT
      });

      const text = result?.text || "";
      const results = text.split('|||').map((s: string) => s.trim()).filter(Boolean);

      if (results.length > 0) {
        // Create history cards for each description result
        const newHistoryItems: import('@/types/database').Generation[] = results.map((desc: string, index: number) => ({
          id: `describe-${Date.now()}-${index}`,
          userId: 'anonymous',
          projectId: 'default',
          outputUrl: describeImages[0].previewUrl,
          config: {
            prompt: desc,
            width: config.width,
            height: config.height,
            model: "gemini-3-pro-image-preview",
            lora: config.lora,
          },
          status: 'completed',
          sourceImageUrl: describeImages[0].previewUrl,
          createdAt: startTime,
        }));

        // Remove loading card and add real results
        setGenerationHistory((prev: import('@/types/database').Generation[]) => [...newHistoryItems, ...prev.filter(item => item.id !== loadingId)]);

        // Also save each description to backend
        newHistoryItems.forEach(item => saveHistoryToBackend(item));

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
  };

  const handleBatchUse = async (results: Generation[]) => {
    if (!results || results.length === 0) return;
    toast({ title: "批量生成中", description: `即将开始 ${results.length} 个生成任务...` });
    for (const result of results) {
      const newConfig = { ...config, prompt: result.config?.prompt || "" };
      await handleGenerate(newConfig);
      await new Promise(r => setTimeout(r, 200));
    }
  };


  const handleRegenerate = async (result: Generation) => {
    const fullConfig: GenerationConfig = {
      ...config,
      prompt: result.config?.prompt || '',
      width: result.config?.width || config.width,
      height: result.config?.height || config.height,
      model: result.config?.model || config.model,
    };
    await handleGenerate(fullConfig);
  };

  const handleDownload = (imageUrl: string) => { const link = document.createElement("a"); link.href = imageUrl; link.download = `PlaygroundV2-${Date.now()}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };

  const openImageModal = (result: Generation) => {
    setSelectedResult(result);
    setIsImageModalOpen(true);
    // Ensure dock mode is active if we're viewing a specific result
    if (viewMode !== 'dock') {
      setViewMode('dock');
      setActiveTab('history');
    }
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    // Don't clear selectedResult here to allow exit animation to use the data
  };

  const handleEditImage = (result: import('@/types/database').Generation) => {
    const url = result.outputUrl || "";
    if (url) {
      setEditingImageUrl(url);
      setIsEditorOpen(true);
      setIsImageModalOpen(false);
    }
  };

  const handleSaveEditedImage = async (dataUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean) => {
    setIsEditorOpen(false);
    try {
      // If a prompt was provided (e.g. from labeling tool), update the playground prompt
      if (prompt) {
        setConfig(prev => ({ ...prev, prompt }));
      }

      // 准备所有要添加的图片
      const imagesToAdd: UploadedImage[] = [];

      // 1. 先添加标注图（主图）
      const mainRes = await fetch(dataUrl);
      const mainBlob = await mainRes.blob();
      const mainFile = new File([mainBlob], `annotated-${Date.now()}.png`, { type: 'image/png' });

      // Upload main image
      const mainForm = new FormData();
      mainForm.append('file', mainFile);
      const mainUploadResp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: mainForm });
      const mainUploadJson = await mainUploadResp.json();
      const mainPath = mainUploadResp.ok && mainUploadJson?.path ? String(mainUploadJson.path) : undefined;

      const mainBase64 = dataUrl.split(',')[1];
      imagesToAdd.push({
        file: mainFile,
        base64: mainBase64,
        previewUrl: dataUrl,
        path: mainPath
      });

      // 2. 然后添加参考图（按 Image 1, Image 2, ... 顺序）
      if (referenceImageUrls && referenceImageUrls.length > 0) {
        for (let i = 0; i < referenceImageUrls.length; i++) {
          const refDataUrl = referenceImageUrls[i];
          const refRes = await fetch(refDataUrl);
          const refBlob = await refRes.blob();
          const refFile = new File([refBlob], `reference-${i + 1}-${Date.now()}.png`, { type: 'image/png' });

          // Upload reference image
          const refForm = new FormData();
          refForm.append('file', refFile);
          const refUploadResp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: refForm });
          const refUploadJson = await refUploadResp.json();
          const refPath = refUploadResp.ok && refUploadJson?.path ? String(refUploadJson.path) : undefined;

          const refBase64 = refDataUrl.split(',')[1];
          imagesToAdd.push({
            file: refFile,
            base64: refBase64,
            previewUrl: refDataUrl,
            path: refPath
          });
        }
      }

      // 3. 添加所有图片到 playground state（按顺序：标注图, 参考图1, 参考图2...）
      setUploadedImages(prev => [...prev, ...imagesToAdd]);

      const refCount = referenceImageUrls?.length || 0;
      const message = refCount > 0
        ? `已添加标注图和 ${refCount} 张参考图到输入框`
        : "标注图已添加到输入框";
      toast({ title: "图片已保存", description: message });

      if (shouldGenerate) {
        handleGenerate();
      }
    } catch (error) {
      console.error("Failed to save edited image:", error);
      toast({ title: "Error", description: "Failed to save edited image", variant: "destructive" });
    }
  };




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
    isMockMode,
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
    handleGenerate: () => handleGenerate(),
    handleDescribe,
    setSelectedAIModel,
    setSelectedModel,
    setIsAspectRatioLocked,
    setSelectedWorkflowConfig,
    applyWorkflowDefaults,
    setMockMode,
    setIsSelectorExpanded,
    setBatchSize,
    setIsLoraDialogOpen,
    setIsPresetGridOpen,
    onClearPreset: () => setSelectedPresetName(undefined),
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
  }), [
    viewMode, config, uploadedImages, describeImages, isStackHovered, isInputFocused,
    isOptimizing, isGenerating, isDescribing, activeTab, isDraggingOver,
    isDraggingOverPanel, isPresetGridOpen, isAspectRatioLocked, isMockMode,
    isSelectorExpanded, batchSize, selectedModel, selectedAIModel, selectedLoras,
    selectedPresetName, selectedWorkflowConfig, workflows, fileInputRef,
    describePanelRef, setConfig, setIsStackHovered, setIsInputFocused,
    setPreviewImage, removeImage, handleFilesUpload, handleOptimizePrompt,
    handleGenerate, handleDescribe, setSelectedAIModel, setSelectedModel,
    setIsAspectRatioLocked, setSelectedWorkflowConfig, applyWorkflowDefaults,
    setMockMode, setIsSelectorExpanded, setBatchSize, setIsLoraDialogOpen,
    setIsPresetGridOpen, setDescribeImages, setIsDraggingOver,
    setIsDraggingOverPanel, setViewMode, setSelectedPresetName
  ]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex-1 relative p-12 pt-16 h-full flex flex-col overflow-hidden"
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
          // 只有在非 Style Tab 下才自动切换到 Describe Tab
          if (activeTab !== 'describe' && activeTab !== 'style') {
            setViewMode('dock');
            setActiveTab('describe');
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDraggingOver) setIsDraggingOver(true);
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
                <div className={cn(
                  "z-[60] transition-all duration-300",
                  isDesktop
                    ? "absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4"
                    : "relative top-4 flex flex-row justify-center gap-8 mb-6 w-full pt-2"
                )}>
                  {/* 抽取统一的样式逻辑 */}
                  {(() => {
                    const getButtonStyle = (isActive: boolean) => cn(
                      "w-10 h-10 rounded-2xl transition-all duration-200",
                      isActive
                        ? "bg-primary/20 text-white border border-white/40 hover:bg-primary/30 hover:border-white/60 hover:scale-105"
                        : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:scale-110"
                    );

                    const tooltipSide = isDesktop ? "right" : "bottom";

                    return (
                      <>
                        <div className="flex flex-col items-center gap-1">
                          <TooltipButton
                            icon={<Sparkles className="w-5 h-5" />}
                            label="Describe"
                            tooltipContent="Describe image"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'describe')}
                            onClick={() => activeTab === 'describe' ? setActiveTab('history') : setActiveTab('describe')}

                          />
                          <span className="text-[10px]">Describe</span>


                        </div>


                        <div className="flex flex-col items-center gap-1">

                          <TooltipButton
                            icon={<Edit2 className="w-5 h-5" />}
                            label="Edit Image"
                            tooltipContent={uploadedImages.length > 0 ? "Edit Image" : "Image Editor"}
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(false)}
                            onClick={handleEditUploadedImage}
                          />
                          <span className="text-[10px]">Edit</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">

                          <TooltipButton
                            icon={<History className="w-5 h-5" />}
                            label="History"
                            tooltipContent="History"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'history')}
                            onClick={() => setActiveTab('history')}
                          />
                          <span className="text-[10px]">History</span>

                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <TooltipButton
                            icon={<ImageIcon className="w-5 h-5" />}
                            label="Gallery"
                            tooltipContent="Gallery"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'gallery')}
                            onClick={() => setActiveTab('gallery')}
                          />
                          <span className="text-[10px]">Gallery</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <TooltipButton
                            icon={<Palette className="w-5 h-5" />}
                            label="Styles"
                            tooltipContent="Styles"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'style')}
                            onClick={() => setActiveTab('style')}
                          />
                          <span className="text-[10px]">Moodboards</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
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
                  (activeTab === 'gallery' || activeTab === 'style')
                    ? "hidden"
                    : viewMode === 'dock'
                      ? "max-w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] xl:max-w-[1200px] 2xl:max-w-[1400px] h-full pt-4 overflow-hidden"
                      : "max-w-full sm:max-w-[540px] md:max-w-[720px] lg:max-w-[800px] xl:max-w-[900px] 2xl:max-w-[1000px]",
                  (viewMode === 'home') && (isPresetGridOpen ? "mt-0" : "-mt-60")
                )}>

                  <div className={cn(
                    "flex flex-col w-full items-center relative z-30",
                    (viewMode === 'dock') && "h-full"
                  )}>


                    {/* Input UI - Always present but layout changes based on viewMode */}
                    {activeTab !== 'gallery' && activeTab !== 'style' && (
                      <div ref={promptWrapperRef} className={cn(
                        "w-full transition-all duration-300",
                        (viewMode === 'dock' && activeTab === 'describe') ? "h-full flex flex-col" : "h-auto"
                      )}>
                        <div className={cn(
                          "w-full transition-all duration-300",
                          (viewMode === 'dock' && activeTab === 'describe') ? "flex-1 min-h-0" : ""
                        )}>
                          <PlaygroundInputSection {...inputSectionProps} />
                        </div>
                      </div>
                    )}

                    {/* Capsule Triggers - Only visible in Home Mode */}
                    {viewMode === 'home' && !isPresetGridOpen && (
                      <div className="flex justify-center mt-4 gap-4">
                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('describe'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all bg-black/10",
                            "border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Sparkles className="w-4 h-4" />
                          <span className="text-sm font-medium">Describe</span>
                        </button>
                        <button
                          onClick={handleEditUploadedImage}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-black/10 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            Edit
                          </span>
                        </button>
                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('history'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-black/10 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <History className="w-4 h-4" />
                          <span className="text-sm font-medium">History</span>
                        </button>
                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('gallery'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all",
                            "bg-black/10 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Gallery</span>
                        </button>

                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('style'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all",
                            "bg-black/10 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Palette className="w-4 h-4" />
                          <span className="text-sm font-medium">Moodboards</span>
                        </button>



                      </div>
                    )}

                    {/* History List - Visible in History Tab */}
                    {viewMode === 'dock' && activeTab === 'history' && (
                      <div className="mt-2  w-full relative flex-1 overflow-hidden z-30">
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
                        />
                      </div>
                    )}

                  </div>
                </div>

                {/* Gallery View - Now a sibling to History List, full width if needed */}
                {viewMode === 'dock' && activeTab === 'gallery' && (
                  <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-28">
                    <div className="h-full w-full  overflow-hidden relative">
                      <Suspense fallback={<div className="flex w-[90%] items-center justify-center h-full text-white">Loading Gallery...</div>}>
                        <GalleryView />
                      </Suspense>
                    </div>
                  </div>
                )}

                {/* Style View */}
                {viewMode === 'dock' && activeTab === 'style' && (
                  <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-32">
                    <div className="h-full w-full  overflow-hidden relative">
                      <Suspense fallback={<div className="flex  w-[90%] items-center justify-center h-full text-white">Loading Styles...</div>}>
                        <StyleStacksView isDragging={isDraggingOver} />
                      </Suspense>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {!isPresetGridOpen && !isPresetManagerOpen && viewMode === 'home' && (
              <div className="absolute bottom-0 w-full overflow-visible z-50">
                <StylesMarquee />
              </div>
            )}

            <GoogleApiStatus className="fixed bottom-4 right-4 z-[60]" />

            {showAllProjects && <AllProjectsView onClose={() => setShowAllProjects(false)} />}

            <WorkflowSelectorDialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen} onSelect={(wf) => setSelectedWorkflowConfig(wf)} onEdit={onEditMapping} />
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
              onOpenChange={setIsPresetManagerOpen}
              workflows={workflows}
              currentConfig={config}
            />
          </main>
        </div>

        <ImagePreviewModal
          isOpen={isImageModalOpen}
          onClose={closeImageModal}
          result={selectedResult}
          onEdit={handleEditImage}
        />

        {
          isEditorOpen && (
            <ImageEditorModal
              isOpen={isEditorOpen}
              imageUrl={editingImageUrl}
              onClose={() => setIsEditorOpen(false)}
              onSave={handleSaveEditedImage}
              initialState={editingPresetConfig}
              workflows={workflows}
              inputSectionProps={inputSectionProps}
            />
          )
        }

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
                  src={activeDragItem.outputUrl}
                  alt="dragging"
                  width={40}
                  height={40}
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

export default function PlaygroundV2Route() {
  return <PlaygroundV2Page />;
}
