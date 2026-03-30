'use client';

import React from 'react';
import NextImage from 'next/image';
import {
  ChevronDown,
  Copy,
  Download,
  ImagePlus,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TooltipButton } from '@/components/ui/tooltip-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/common/use-toast';
import { getApiBase, formatImageUrl } from '@/lib/api-base';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { cn } from '@/lib/utils';
import ImagePreviewModal from '@studio/playground/_components/Dialogs/ImagePreviewModal';
import { StyleCollageEditor } from '@studio/playground/_components/StyleCollageEditor';
import { usePlaygroundAvailableModels } from '@studio/playground/_components/hooks/useGenerationService';
import {
  buildShortcutFromDraft,
  buildShortcutPrompt,
  createShortcutPromptValues,
  extractShortcutTemplateTokens,
  type PlaygroundShortcut,
  type ShortcutPromptFieldDefinition,
  type ShortcutPromptValues,
} from '@/config/playground-shortcuts';
import type { Generation, StyleStack } from '@/types/database';

interface MoodboardDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moodboard: StyleStack | null;
  shortcut?: PlaygroundShortcut | null;
  onShortcutQuickApply?: (shortcut: PlaygroundShortcut) => void;
  onShortcutPreviewImage?: (shortcut: PlaygroundShortcut, imageIndex: number) => void;
  onShortcutsChange?: () => Promise<void> | void;
}

function buildNewFieldDraft(index: number): ShortcutPromptFieldDefinition {
  return {
    key: `token_${index + 1}`,
    label: `字段 ${index + 1}`,
    placeholder: `字段 ${index + 1}`,
    type: 'text',
    defaultValue: '',
    required: false,
    options: [],
    order: index,
  };
}

function normalizePromptFieldDrafts(fields: ShortcutPromptFieldDefinition[]): ShortcutPromptFieldDefinition[] {
  return fields.map((field, index) => ({
    key: (field.key || '').trim(),
    label: (field.label || '').trim(),
    placeholder: (field.placeholder || '').trim(),
    type: field.type || 'text',
    defaultValue: field.defaultValue ?? '',
    required: Boolean(field.required),
    options: Array.isArray(field.options)
      ? field.options.map((option) => option.trim()).filter(Boolean)
      : [],
    order: index,
  }));
}

async function copyText(text: string) {
  if (!text) {
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

function InlinePromptPreview({
  shortcut,
  values,
  onValueChange,
}: {
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  onValueChange: (key: string, value: string) => void;
}) {
  const parts = shortcut.promptParts;

  return (
    <div className="text-[14px] font-medium leading-[48px] text-white/80 ">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.value}</span>;
        }

        const field = shortcut.fields.find((f) => f.id === part.fieldId);
        if (!field) return null;

        const value = values[field.id] || '';
        const displayValue = value || `${field.label}`;

        if (field.type === 'select' && field.options?.length) {
          return (
            <Select key={index} value={value} onValueChange={(v) => onValueChange(field.id, v)}>
              <SelectTrigger
                className={cn(
                  "mx-1 inline-flex h-auto w-auto items-center  rounded-sm border px-1 text-[10px]  transition-all duration-200 focus:ring-0 ",
                  value
                    ? "border-[#E8FFB7]/30 bg-[#E8FFB7]/10 text-[#E8FFB7] hover:bg-[#E8FFB7]/20"
                    : "border-white/10 bg-white/5 text-white/30 hover:border-white/20 hover:bg-white/10"
                )}
              >
                <SelectValue placeholder={field.label} />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0b0d12] text-white">
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-white">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        if (field.type === 'color') {
          return (
            <span
              key={index}
              className={cn(
                "mx-1 inline-flex items-center rounded-sm h-8 border px-1 text-[12px] font-bold transition-all duration-200",
                value
                  ? "border-[#E8FFB7]/30 bg-[#E8FFB7]/10 text-[#E8FFB7] hover:bg-[#E8FFB7]/20"
                  : "border-white/10 bg-white/5 text-white/30 hover:border-white/20 hover:bg-white/10"
              )}
            >
              <div
                className="h-4 w-4 rounded-full border border-white/20 ml-2 mr-2"
                style={{ backgroundColor: value || 'transparent' }}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onValueChange(field.id, e.target.value)}
                className="w-[60px] bg-transparent outline-none placeholder:text-white/20 md:w-[70px]"
                placeholder="#HEX"
              />
            </span>
          );
        }

        return (
          <span
            key={index}
            className={cn(
              "mx-1 inline-flex items-center rounded-sm h-8 border px-2  py-0.5 text-[12px] font-bold transition-all duration-200 ",
              value
                ? "border-[#E8FFB7]/30 bg-[#E8FFB7]/10 text-[#E8FFB7] hover:bg-[#E8FFB7]/20"
                : "border-white/10 bg-white/5 text-white/30 hover:border-white/20 hover:bg-white/10"
            )}
          >
            <input
              value={value}
              onChange={(e) => onValueChange(field.id, e.target.value)}
              className="min-w-[40px] bg-transparent outline-none placeholder:text-white/20"
              style={{ width: `${Math.max(displayValue.length * (value ? 9 : 8), 60)}px` }}
              placeholder={field.label}
            />
          </span>
        );
      })}
    </div>
  );
}


export function MoodboardDetailDialog({
  open,
  onOpenChange,
  moodboard,
  shortcut,
  onShortcutQuickApply,
  onShortcutPreviewImage,
  onShortcutsChange,
}: MoodboardDetailDialogProps) {
  const { toast } = useToast();
  const availableModels = usePlaygroundAvailableModels();
  const applyPrompt = usePlaygroundStore((state) => state.applyPrompt);
  const applyImage = usePlaygroundStore((state) => state.applyImage);
  const updateStyle = usePlaygroundStore((state) => state.updateStyle);
  const removeImageFromStyle = usePlaygroundStore((state) => state.removeImageFromStyle);
  const currentConfig = usePlaygroundStore((state) => state.config);

  const [draftName, setDraftName] = React.useState('');
  const [draftDescription, setDraftDescription] = React.useState('');
  const [draftPrompt, setDraftPrompt] = React.useState('');
  const [draftPromptTemplate, setDraftPromptTemplate] = React.useState('');
  const [draftModelId, setDraftModelId] = React.useState('');
  const [draftPromptFields, setDraftPromptFields] = React.useState<ShortcutPromptFieldDefinition[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isMetadataExpanded, setIsMetadataExpanded] = React.useState(false);
  const [showCollageTools, setShowCollageTools] = React.useState(false);
  const [isCollageEditorOpen, setIsCollageEditorOpen] = React.useState(false);
  const [selectedGalleryPreviewResult, setSelectedGalleryPreviewResult] = React.useState<Generation | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Helper to update a single prompt field
  const handleFieldChange = React.useCallback((key: string, value: string) => {
    setDraftPromptFields((prev) =>
      prev.map((field) => (field.key === key ? { ...field, defaultValue: value } : field))
    );
  }, []);

  React.useEffect(() => {
    if (!open || !moodboard) {
      return;
    }

    setDraftName(moodboard.name || shortcut?.name || '');
    setDraftDescription(shortcut?.detailDescription || '');
    setDraftPrompt(moodboard.prompt || '');
    setDraftPromptTemplate(shortcut?.promptTemplate || '');
    setDraftModelId(shortcut?.model || availableModels[0]?.id || '');
    setDraftPromptFields(shortcut?.promptFields?.map((field) => ({ ...field })) || []);
    setShowCollageTools(false);
  }, [availableModels, moodboard, open, shortcut]);

  const modelLabelById = React.useMemo(() => {
    return new Map(availableModels.map((model) => [model.id, model.displayName]));
  }, [availableModels]);

  const draftShortcut = React.useMemo(() => {
    if (!shortcut) {
      return null;
    }

    return buildShortcutFromDraft({
      baseShortcut: shortcut,
      name: draftName,
      detailDescription: draftDescription,
      model: draftModelId,
      modelLabel: modelLabelById.get(draftModelId) || draftModelId,
      promptTemplate: draftPromptTemplate,
      promptFields: draftPromptFields,
    });
  }, [draftDescription, draftModelId, draftName, draftPromptFields, draftPromptTemplate, modelLabelById, shortcut]);

  const promptPreview = React.useMemo(() => {
    if (!draftShortcut) {
      return '';
    }

    return buildShortcutPrompt(draftShortcut, createShortcutPromptValues(draftShortcut));
  }, [draftShortcut]);

  const galleryImages = React.useMemo(() => moodboard?.imagePaths || [], [moodboard]);
  const dialogTitle = shortcut ? `${draftName || shortcut.name} Moodboard` : (draftName || moodboard?.name || 'Moodboard');
  const moodboardPreviewPrompt = React.useMemo(() => {
    if (draftShortcut) {
      return promptPreview;
    }

    return draftPrompt || moodboard?.prompt || '';
  }, [draftPrompt, draftShortcut, moodboard?.prompt, promptPreview]);
  const galleryPreviewResults = React.useMemo<Generation[]>(() => {
    if (!moodboard) {
      return [];
    }

    const previewCreatedAt = moodboard.updatedAt || new Date().toISOString();

    return galleryImages.map((imagePath, index) => ({
      id: `${moodboard.id}-image-preview-${index}`,
      userId: 'moodboard-preview',
      projectId: moodboard.id,
      outputUrl: imagePath,
      config: {
        prompt: moodboardPreviewPrompt,
        model: draftShortcut?.model || currentConfig.model,
        baseModel: draftShortcut?.model || currentConfig.baseModel || currentConfig.model,
        width: currentConfig.width || 1024,
        height: currentConfig.height || 1024,
        imageSize: currentConfig.imageSize,
        aspectRatio: currentConfig.aspectRatio,
        loras: currentConfig.loras || [],
        workflowName: draftName || moodboard.name,
        presetName: draftShortcut ? draftShortcut.name : moodboard.name,
        isPreset: false,
        isEdit: false,
        generationMode: 'playground',
      },
      status: 'completed',
      createdAt: previewCreatedAt,
    }));
  }, [
    currentConfig.aspectRatio,
    currentConfig.baseModel,
    currentConfig.height,
    currentConfig.imageSize,
    currentConfig.loras,
    currentConfig.model,
    currentConfig.width,
    draftName,
    draftShortcut,
    galleryImages,
    moodboard,
    moodboardPreviewPrompt,
  ]);
  const selectedGalleryPreviewKey = React.useMemo(() => {
    if (!selectedGalleryPreviewResult) {
      return 'moodboard-preview-none';
    }

    return selectedGalleryPreviewResult.id?.trim()
      || selectedGalleryPreviewResult.outputUrl?.trim()
      || selectedGalleryPreviewResult.createdAt?.trim()
      || 'moodboard-preview-current';
  }, [selectedGalleryPreviewResult]);
  const selectedGalleryPreviewIndex = React.useMemo(
    () => (
      selectedGalleryPreviewResult
        ? galleryPreviewResults.findIndex((result) => result.id === selectedGalleryPreviewResult.id)
        : -1
    ),
    [galleryPreviewResults, selectedGalleryPreviewResult]
  );
  const galleryPreviewHasNext = selectedGalleryPreviewIndex >= 0 && selectedGalleryPreviewIndex < galleryPreviewResults.length - 1;
  const galleryPreviewHasPrev = selectedGalleryPreviewIndex > 0;

  React.useEffect(() => {
    if (!selectedGalleryPreviewResult) {
      return;
    }

    const nextSelectedResult = galleryPreviewResults.find((result) => result.id === selectedGalleryPreviewResult.id);
    if (nextSelectedResult) {
      if (nextSelectedResult !== selectedGalleryPreviewResult) {
        setSelectedGalleryPreviewResult(nextSelectedResult);
      }
      return;
    }

    setSelectedGalleryPreviewResult(undefined);
  }, [galleryPreviewResults, selectedGalleryPreviewResult]);

  const persistMoodboardOverlay = React.useCallback(async (patch: Partial<StyleStack>) => {
    if (!moodboard) {
      return;
    }

    await updateStyle({
      ...moodboard,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }, [moodboard, updateStyle]);

  const handleShortcutSave = React.useCallback(async () => {
    if (!shortcut || !draftShortcut) {
      return;
    }

    const normalizedFields = normalizePromptFieldDrafts(draftPromptFields);
    const duplicateKeys = normalizedFields.reduce<string[]>((acc, field, index) => {
      if (!field.key) {
        acc.push(`字段 ${index + 1} 缺少 token key`);
        return acc;
      }

      if (normalizedFields.findIndex((item) => item.key === field.key) !== index) {
        acc.push(field.key);
      }

      return acc;
    }, []);

    if (!draftName.trim()) {
      toast({
        title: '缺少名称',
        description: '请先填写 moodboard 名称。',
        variant: 'destructive',
      });
      return;
    }

    if (!draftPromptTemplate.trim()) {
      toast({
        title: '缺少模板',
        description: '请先填写 prompt 模版。',
        variant: 'destructive',
      });
      return;
    }

    if (duplicateKeys.length > 0) {
      toast({
        title: '字段无效',
        description: `Token key 不能为空且不能重复: ${Array.from(new Set(duplicateKeys)).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    const templateTokens = extractShortcutTemplateTokens(draftPromptTemplate);
    const fieldKeys = normalizedFields.map((field) => field.key);
    const missingDefinitions = templateTokens.filter((token) => !fieldKeys.includes(token));
    const unusedFields = fieldKeys.filter((key) => !templateTokens.includes(key));

    if (missingDefinitions.length > 0 || unusedFields.length > 0) {
      const messages: string[] = [];
      if (missingDefinitions.length > 0) {
        messages.push(`模板里缺少字段定义: ${missingDefinitions.join(', ')}`);
      }
      if (unusedFields.length > 0) {
        messages.push(`字段未被模板使用: ${unusedFields.join(', ')}`);
      }
      toast({
        title: '模板与 token 不匹配',
        description: messages.join('；'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let persistedId = shortcut.persistedId;
      if (!persistedId) {
        const existingResponse = await fetch(`${getApiBase()}/playground-shortcuts/code/${shortcut.id}`, {
          cache: 'no-store',
        });
        if (existingResponse.ok) {
          const existingShortcut = await existingResponse.json();
          persistedId = existingShortcut.id as string | undefined;
        } else if (existingResponse.status !== 404) {
          throw new Error(`Failed to load shortcut: ${existingResponse.status}`);
        }
      }

      const payload = {
        code: shortcut.id,
        name: draftName.trim(),
        modelId: draftModelId || shortcut.model,
        promptTemplate: draftPromptTemplate.trim(),
        promptFields: normalizedFields,
        moodboardDescription: draftDescription.trim(),
        isEnabled: true,
        publishStatus: 'published',
      };

      const response = await fetch(
        persistedId
          ? `${getApiBase()}/playground-shortcuts/${persistedId}`
          : `${getApiBase()}/playground-shortcuts`,
        {
          method: persistedId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const raw = await response.text();
        throw new Error(raw || `Failed to save shortcut: ${response.status}`);
      }

      await onShortcutsChange?.();
      toast({
        title: '快捷入口已更新',
        description: '名称、简介、模型和 prompt 模版已保存。',
      });
    } catch (error) {
      console.error('[MoodboardDetailDialog] Failed to save shortcut', error);
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '快捷入口保存失败，请重试。',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [draftDescription, draftModelId, draftName, draftPromptFields, draftPromptTemplate, draftShortcut, onShortcutsChange, shortcut, toast]);

  const handleCustomMoodboardSave = React.useCallback(async () => {
    if (!moodboard) {
      return;
    }

    if (!draftName.trim()) {
      toast({
        title: '缺少名称',
        description: '请先填写 moodboard 名称。',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateStyle({
        ...moodboard,
        name: draftName.trim(),
        prompt: draftPrompt,
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: 'Moodboard 已更新',
        description: '名称和 prompt 已保存。',
      });
    } catch (error) {
      console.error('[MoodboardDetailDialog] Failed to save custom moodboard', error);
      toast({
        title: '保存失败',
        description: '情绪板保存失败，请重试。',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [draftName, draftPrompt, moodboard, toast, updateStyle]);

  const handleSave = React.useCallback(async () => {
    if (shortcut) {
      await handleShortcutSave();
      return;
    }

    await handleCustomMoodboardSave();
  }, [handleCustomMoodboardSave, handleShortcutSave, shortcut]);

  const handleQuickApply = React.useCallback(() => {
    if (draftShortcut) {
      if (onShortcutQuickApply) {
        onShortcutQuickApply(draftShortcut);
      } else {
        applyPrompt(promptPreview);
      }

      toast({
        title: '已快速应用',
        description: `已应用 ${draftShortcut.name} 的模型和模板。`,
      });
      return;
    }

    applyPrompt(draftPrompt);
    toast({
      title: '已快速应用',
      description: `${draftName || moodboard?.name || 'Moodboard'} 的 prompt 已应用到输入框。`,
    });
  }, [applyPrompt, draftName, draftPrompt, draftShortcut, moodboard?.name, onShortcutQuickApply, promptPreview, toast]);

  const handleUseImage = React.useCallback(async (path: string) => {
    try {
      await applyImage(formatImageUrl(path));
      toast({
        title: '已添加参考图',
        description: '图片已添加到输入框。',
      });
    } catch (error) {
      console.error('[MoodboardDetailDialog] Failed to apply image', error);
      toast({
        title: '添加失败',
        description: '无法将图片添加到输入框。',
        variant: 'destructive',
      });
    }
  }, [applyImage, toast]);

  const handleUploadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadImages = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!moodboard) {
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      const uploadedPaths = await Promise.all(Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${getApiBase()}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }
        const data = await response.json();
        return String(data.path);
      }));

      await persistMoodboardOverlay({
        imagePaths: [...galleryImages, ...uploadedPaths],
      });

      toast({
        title: '图片已上传',
        description: `已新增 ${uploadedPaths.length} 张图片。`,
      });
    } catch (error) {
      console.error('[MoodboardDetailDialog] Failed to upload images', error);
      toast({
        title: '上传失败',
        description: error instanceof Error ? error.message : '图片上传失败，请重试。',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [galleryImages, moodboard, persistMoodboardOverlay, toast]);

  const handleRemoveImage = React.useCallback(async (path: string) => {
    if (!moodboard) {
      return;
    }

    try {
      await removeImageFromStyle(moodboard.id, path);
      toast({
        title: '图片已移除',
        description: '该图片已从 moodboard 中删除。',
      });
    } catch (error) {
      console.error('[MoodboardDetailDialog] Failed to remove image', error);
      toast({
        title: '删除失败',
        description: '图片删除失败，请重试。',
        variant: 'destructive',
      });
    }
  }, [moodboard, removeImageFromStyle, toast]);

  const handleDownloadImage = React.useCallback((path: string, index: number) => {
    const link = document.createElement('a');
    link.href = formatImageUrl(path);
    link.download = `${draftName || moodboard?.name || 'moodboard'}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [draftName, moodboard?.name]);

  if (!moodboard) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[80vh] max-w-[1240px] overflow-hidden rounded-3xl border border-white/10 bg-[#07090d]/95 p-0 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex h-full min-h-0 flex-col">
            {/* Unified top bar: close + gallery count | title | actions */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5 lg:px-8">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full border border-white/10 bg-white/5 text-white/55"
                  onClick={() => onOpenChange(false)}
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </Button>
               
              </div>
              <div className="order-last flex min-w-0 flex-[1_1_220px] items-center justify-center gap-3 sm:order-none sm:flex-1 sm:justify-start">
                <h2 className="truncate text-lg font-semibold text-white/90">{dialogTitle}</h2>
                {shortcut ? (
                  <span className="rounded-sm border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">{draftShortcut?.modelLabel}</span>
                ) : null}
                 <span className="rounded-sm border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
                  {galleryImages.length} images
                </span>
              </div>
             
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-md border border-white/10 bg-white/5 px-4 text-sm text-white/60 hover:bg-white/10"
                  onClick={() => {
                    if (isEditMode) {
                      setIsEditMode(false);
                    } else {
                      setIsEditMode(true);
                      setIsMetadataExpanded(true);
                    }
                  }}
                >

                  <PencilLine className="mr-2 h-4 w-4" />
                  {isEditMode ? 'Cancel' : 'Edit Template'}
                </Button>
                
                <Button
                  type="button"
                  className="h-9 rounded-md bg-[#E8FFB7] px-6 text-sm font-medium text-black hover:bg-[#d9f2a0]"
                  onClick={handleQuickApply}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Quick Apply
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[3fr_2fr]">
            {/* Left Column: Gallery */}
            <div className="flex min-h-0 flex-col border-white/10 lg:border-r">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wider text-white/30">Gallery</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full border border-white/10 bg-white/5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                    onClick={handleUploadClick}
                    disabled={isUploading}
                  >
                    <Upload className="mr-1.5 h-3 w-3" />
                    {isUploading ? 'Uploading...' : 'Add Image'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUploadImages}
                  />
                </div>

                {galleryImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {galleryImages.map((imagePath, index) => {
                      return (
                        <div
                          key={`${imagePath}-${index}`}
                          className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]"
                        >
                          <button
                            type="button"
                            className="relative block aspect-[4/5] w-full"
                            onClick={() => {
                              if (shortcut && onShortcutPreviewImage) {
                                onShortcutPreviewImage(draftShortcut || shortcut, index);
                                return;
                              }
                              setSelectedGalleryPreviewResult(galleryPreviewResults[index] || undefined);
                            }}
                          >
                            <NextImage
                              src={formatImageUrl(imagePath)}
                              alt={`${dialogTitle} ${index + 1}`}
                              fill
                              sizes="300px"
                              className="object-cover transition-transform duration-500 group-hover:scale-110"
                              unoptimized={imagePath.startsWith('local:')}
                            />
                          </button>
                          <div
                            className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 translate-y-4 scale-95 items-center gap-1 rounded-xl border border-white/10 bg-black/50 opacity-0 shadow-2xl backdrop-blur-xl transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <TooltipButton
                              icon={<ImagePlus className="h-4 w-4" />}
                              label="Use Image"
                              tooltipContent="Use Image"
                              tooltipSide="top"
                              className="h-8 w-8 rounded-xl text-white/70 hover:bg-[#E8FFB7] hover:text-black"
                              onClick={() => void handleUseImage(imagePath)}
                            />
                            <div className="mx-0.5 h-4 w-px bg-white/10" />
                            <TooltipButton
                              icon={<Download className="h-4 w-4" />}
                              label="Download"
                              tooltipContent="Download"
                              tooltipSide="top"
                              className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
                              onClick={() => handleDownloadImage(imagePath, index)}
                            />
                            <TooltipButton
                              icon={<Trash2 className="h-4 w-4" />}
                              label="Delete"
                              tooltipContent="Delete"
                              tooltipSide="top"
                              className="h-8 w-8 rounded-xl text-red-300 hover:bg-red-500 hover:text-white"
                              onClick={() => void handleRemoveImage(imagePath)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                    <div className="mb-4 rounded-full bg-white/5 p-4">
                      <ImagePlus className="h-8 w-8 text-white/20" />
                    </div>
                    <div className="text-sm font-medium text-white/40">No images yet</div>
                    <p className="mt-1 text-xs text-white/20">Upload references to build your moodboard gallery.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Main Content */}
            <div className="flex min-h-0 flex-col bg-[#0b0e14]/50">
              <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                <div className="mx-auto max-w-xl space-y-5">
                  {/* Collapsible Metadata (Name, Description, Model) */}

                     {/* Main Prompt Area */}
                     <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium  text-white/70">Prompt Template</div>
                      <div className="flex items-center gap-2">
                        {isEditMode && shortcut && (
                          <Button
                            type="button"
                            variant="light"
                            size="sm"
                            className="h-8 rounded-full border border-[#E8FFB7]/10 bg-[#E8FFB7]/5 text-[11px] text-[#E8FFB7] hover:bg-white/10"
                            onClick={() => {
                              const nextField = buildNewFieldDraft(draftPromptFields.length);
                              setDraftPromptFields((prev) => [...prev, nextField]);
                              setDraftPromptTemplate((prev) => (
                                prev.includes(`{{${nextField.key}}}`) ? prev : `${prev}${prev ? ' ' : ''}{{${nextField.key}}}`
                              ));
                            }}
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Token
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-full border border-white/10 bg-white/5 text-[12px] text-white/70 hover:text-white"
                          onClick={() => void copyText(shortcut ? draftPromptTemplate : draftPrompt).then(() => {
                            toast({ title: 'Copied', description: 'Template copied to clipboard' });
                          })}
                        >
                          <Copy className=" h-3 w-3" />
                          Copy
                        </Button>
                      </div>
                    </div>

                    <div className={cn(
                      "group relative overflow-hidden rounded-2xl border min-h-[200px] transition-all duration-500",
                      isEditMode
                        ? "border-[#E8FFB7]/20 bg-[#E8FFB7]/[0.02]"
                        : "border-white/10 bg-white/10 p-4"
                    )}>
                      {isEditMode ? (
                        <div className="flex flex-col h-full">
                          <Textarea
                            value={shortcut ? draftPromptTemplate : draftPrompt}
                            onChange={(e) => shortcut ? setDraftPromptTemplate(e.target.value) : setDraftPrompt(e.target.value)}
                            className="flex-1 border-0 bg-transparent p-8 font-mono text-base leading-relaxed text-white outline-none placeholder:text-white/10"
                            placeholder={shortcut ? "Use {{token}} syntax to define dynamic fields" : "Enter prompt here..."}
                          />
                          {shortcut && (
                            <div className="border-t border-white/5 bg-white/[0.02] p-6">
                              <div className="mb-4 text-[10px] font-medium uppercase tracking-widest text-white/20">Tokens Configuration</div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {draftPromptFields.map((field, index) => (
                                  <div key={index} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 p-2 pl-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="truncate text-[10px] font-mono text-[#E8FFB7]/60">{field.key}</div>
                                      <input
                                        value={field.label}
                                        onChange={(e) => {
                                          const next = [...draftPromptFields];
                                          next[index] = { ...field, label: e.target.value };
                                          setDraftPromptFields(next);
                                        }}
                                        className="w-full bg-transparent text-xs text-white outline-none"
                                        placeholder="Display Label"
                                      />
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 rounded-lg text-white/20 hover:bg-red-500/10 hover:text-red-400"
                                      onClick={() => {
                                        setDraftPromptFields(prev => prev.filter((_, i) => i !== index));
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="prose prose-invert max-w-none">
                          {shortcut ? (
                            <InlinePromptPreview
                              shortcut={draftShortcut!}
                              values={Object.fromEntries(draftPromptFields.map(f => [f.key, String(f.defaultValue || '')]))}
                              onValueChange={handleFieldChange}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed text-white/90">
                              {draftPrompt || 'No prompt content'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>



                  <div className={cn(
                    "rounded-2xl border border-white/10 bg-white/[0.03] transition-all duration-300",
                    isMetadataExpanded ? "p-6" : "p-3"
                  )}>
                    <div
                      className="flex cursor-pointer items-center justify-between"
                      onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                    >
                      <div className="flex items-center gap-3 px-3">
                        <div className="rounded-full bg-white/5 p-1.5">
                          <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", !isMetadataExpanded && "-rotate-90")} />
                        </div>
                        <span className="text-xs font-medium  text-white/40">Moodboard Details</span>
                      </div>
                      {!isMetadataExpanded && (
                        <span className="max-w-[300px] truncate pr-3 text-xs text-white/20">
                          {draftDescription || 'No description provided'}
                        </span>
                      )}
                    </div>

                    {isMetadataExpanded && (
                      <div className="mt-6 grid gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-[11px] font-medium  text-white/30">Name</label>
                            <Input
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              disabled={!isEditMode}
                              className="h-11 rounded-xl border-white/5 bg-white/5 text-sm text-white placeholder:text-white/20 focus:border-[#E8FFB7]/30"
                              placeholder="Name your moodboard"
                            />
                          </div>
                          {shortcut && (
                            <div className="space-y-2">
                              <label className="text-[11px] font-medium  text-white/30">Default Model</label>
                              <Select value={draftModelId} onValueChange={setDraftModelId} disabled={!isEditMode}>
                                <SelectTrigger className="h-11 rounded-xl border-white/5 bg-white/5 text-sm text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-white/10 bg-[#0b0d12] text-white">
                                  {availableModels.map((model) => (
                                    <SelectItem key={model.id} value={model.id} className="text-white">
                                      {model.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        {shortcut && (
                          <div className="space-y-2">
                            <label className="text-[11px] font-medium text-white/30">Description</label>
                            <Textarea
                              value={draftDescription}
                              onChange={(e) => setDraftDescription(e.target.value)}
                              disabled={!isEditMode}
                              className="min-h-[80px] rounded-xl border-white/5 bg-white/5 text-sm leading-relaxed text-white placeholder:text-white/20 focus:border-[#E8FFB7]/30"
                              placeholder="What is this collection about?"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

               
                  {/* Collage Tool - Minimalist Collapsible */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div
                      className="flex cursor-pointer items-center justify-between p-4 px-6"
                      onClick={() => setShowCollageTools(!showCollageTools)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-white/5 p-1.5">
                          <Sparkles className="h-4 w-4 text-white/40" />
                        </div>
                        <span className="text-xs font-medium uppercase tracking-wider text-white/40">Collage Tools</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", showCollageTools && "rotate-180")} />
                    </div>

                    {showCollageTools && (
                      <div className="border-t border-white/5 p-6 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between mb-6">
                          <p className="text-xs text-white/30">Create visual moodboard collage from your gallery.</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-xl border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
                            onClick={() => setIsCollageEditorOpen(true)}
                          >
                            <PencilLine className="mr-2 h-3.5 w-3.5" />
                            {moodboard.collageImageUrl ? 'Edit Collage' : 'Generate Collage'}
                          </Button>
                        </div>

                        {moodboard.collageImageUrl ? (
                          <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                            <NextImage
                              src={formatImageUrl(moodboard.collageImageUrl)}
                              alt="Collage"
                              fill
                              className="object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                className="rounded-full bg-white text-black hover:bg-[#E8FFB7]"
                                onClick={() => void handleUseImage(moodboard.collageImageUrl!)}
                              >
                                Use this Collage
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
                            <Sparkles className="h-6 w-6 text-white/10 mb-2" />
                            <span className="text-xs text-white/20">No collage generated yet</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Sticky Action Bar */}
              {isEditMode && (
                <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-[#07090d]/80 p-6 px-10 backdrop-blur-md">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full text-white/40 hover:text-white"
                    onClick={() => setIsEditMode(false)}
                  >
                    Discard Changes
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full bg-white px-8 text-sm font-bold text-black hover:bg-[#E8FFB7]"
                    onClick={async () => {
                      await handleSave();
                      setIsEditMode(false);
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Template'}
                  </Button>
                </div>
              )}
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImagePreviewModal
        key={selectedGalleryPreviewKey}
        isOpen={Boolean(selectedGalleryPreviewResult)}
        onClose={() => setSelectedGalleryPreviewResult(undefined)}
        result={selectedGalleryPreviewResult}
        results={galleryPreviewResults}
        currentIndex={selectedGalleryPreviewIndex}
        onSelectResult={setSelectedGalleryPreviewResult}
        onNext={() => {
          if (!galleryPreviewHasNext) return;
          setSelectedGalleryPreviewResult(galleryPreviewResults[selectedGalleryPreviewIndex + 1]);
        }}
        onPrev={() => {
          if (!galleryPreviewHasPrev) return;
          setSelectedGalleryPreviewResult(galleryPreviewResults[selectedGalleryPreviewIndex - 1]);
        }}
        hasNext={galleryPreviewHasNext}
        hasPrev={galleryPreviewHasPrev}
      />

      {isCollageEditorOpen ? (
        <StyleCollageEditor
          style={moodboard}
          onClose={() => setIsCollageEditorOpen(false)}
          onSave={async (path, config) => {
            await persistMoodboardOverlay({
              collageImageUrl: path,
              collageConfig: config,
            });
            toast({
              title: '拼图已更新',
              description: '新的拼图已经保存到 moodboard。',
            });
          }}
        />
      ) : null}
    </>
  );
}
