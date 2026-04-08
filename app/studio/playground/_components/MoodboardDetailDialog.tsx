'use client';

import React from 'react';
import NextImage from 'next/image';
import {
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
import ShinyText from '@/components/ui/ShinyText';


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
  buildGenerationOutputLookup,
  getMoodboardImageMatchKey,
} from '@/app/studio/playground/_lib/moodboard-image-match';
import {
  buildShortcutFromDraft,
  buildShortcutPrompt,
  createShortcutPromptValues,
  getShortcutById,
  type PlaygroundShortcut,
  type ShortcutPromptFieldDefinition,
  type ShortcutPromptValues,
} from '@/config/moodboard-cards';
import {
  createShortcutEditorDocumentFromParts,
  createShortcutEditorDocumentFromTemplate,
  getShortcutEditorDocumentFieldIds,
  serializeShortcutEditorDocumentToTemplate,
  type ShortcutEditorDocument,
} from '@/app/studio/playground/_lib/shortcut-editor-document';
import {
  normalizePromptFieldDrafts,
  normalizePromptTemplateDraftForSave,
  shouldShowMoodboardPromptSparkle,
  syncPromptFieldsWithTemplate,
} from '@/app/studio/playground/_lib/moodboard-prompt-template';
import type { Generation, StyleStack } from '@/types/database';
import {
  ShortcutSlateEditor,
  type ShortcutSlateInsertTokenRequest,
} from './ShortcutSlateEditor';
import {
  persistShortcutGalleryOrder,
  upsertMoodboardAsShortcut,
} from '@/app/studio/playground/_lib/moodboard-card-gallery';

interface MoodboardDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moodboard: StyleStack | null;
  shortcut?: PlaygroundShortcut | null;
  onShortcutQuickApply?: (shortcut: PlaygroundShortcut) => void;
  onMoodboardApply?: () => void;
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

function normalizeTokenKeyInput(input: string): string {
  return input.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}

function buildUniqueTokenKey(baseKey: string, fields: ShortcutPromptFieldDefinition[]): string {
  const existingKeys = new Set(
    fields.map((field) => field.key.trim()).filter(Boolean),
  );

  if (!existingKeys.has(baseKey)) {
    return baseKey;
  }

  let suffix = 2;
  let candidate = `${baseKey}_${suffix}`;
  while (existingKeys.has(candidate)) {
    suffix += 1;
    candidate = `${baseKey}_${suffix}`;
  }
  return candidate;
}

function buildUniqueNewFieldDraft(
  fields: ShortcutPromptFieldDefinition[],
): ShortcutPromptFieldDefinition {
  const existingKeys = new Set(
    fields.map((field) => field.key.trim()).filter(Boolean),
  );
  let candidateIndex = fields.length;
  let draft = buildNewFieldDraft(candidateIndex);

  while (existingKeys.has(draft.key)) {
    candidateIndex += 1;
    draft = buildNewFieldDraft(candidateIndex);
  }

  return draft;
}

function hasDroppableImageFiles(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) {
    return false;
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files).some((file) => file.type.startsWith('image/'));
  }

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
  }

  return false;
}

function normalizeImageFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter((file) => file.type.startsWith('image/'));
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
  const tokenContainerClassName =
    'mx- inline-flex h-7 min-w-[2rem] items-center gap-2 rounded-md border border-none bg-white/10 px-2 text-white transition-colors focus-within:border-[#E8FFB7]/20 focus-within:bg-[#E8FFB7]/18';
  const tokenLabelClassName = 'shrink-0 whitespace-nowrap text-[10px] font-normal text-[#F4FFCE]';
  const tokenInputClassName = 'min-w-[5rem] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35';

  return (
    <div className=" break-words text-sm leading-10 text-white">
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
                  tokenContainerClassName,
                  'focus:ring-0 focus:ring-offset-0 data-[state=open]:border-[#E8FFB7]/20 data-[state=open]:bg-[#E8FFB7]/18'
                )}
              >
                <span className={tokenLabelClassName}>
                  {field.label}
                </span>
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
              className={tokenContainerClassName}
            >
              <span className={tokenLabelClassName}>
                {field.label}
              </span>
              <div
                className="h-4 w-4 shrink-0 rounded-sm border border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: value || 'transparent' }}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onValueChange(field.id, e.target.value)}
                className={cn(tokenInputClassName, 'uppercase')}
                placeholder="#HEX"
              />
            </span>
          );
        }

        return (
          <span
            key={index}
            className={tokenContainerClassName}
          >
            <span className={tokenLabelClassName}>
              {field.label}
            </span>
            <input
              value={value}
              onChange={(e) => onValueChange(field.id, e.target.value)}
              className={tokenInputClassName}
              style={{ width: `${Math.max(displayValue.length * 8, 80)}px` }}
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
  onMoodboardApply,
  onShortcutPreviewImage,
  onShortcutsChange,
}: MoodboardDetailDialogProps) {
  const { toast } = useToast();
  const availableModels = usePlaygroundAvailableModels();
  const applyPrompt = usePlaygroundStore((state) => state.applyPrompt);
  const applyImage = usePlaygroundStore((state) => state.applyImage);
  const deleteStyle = usePlaygroundStore((state) => state.deleteStyle);
  const currentConfig = usePlaygroundStore((state) => state.config);
  const generationHistory = usePlaygroundStore((state) => state.generationHistory);

  const [draftName, setDraftName] = React.useState('');
  const [draftDescription, setDraftDescription] = React.useState('');
  const [draftPrompt, setDraftPrompt] = React.useState('');
  const [draftPromptTemplate, setDraftPromptTemplate] = React.useState('');
  const [draftModelId, setDraftModelId] = React.useState('');
  const [draftPromptFields, setDraftPromptFields] = React.useState<ShortcutPromptFieldDefinition[]>([]);
  const [draftEditorDocument, setDraftEditorDocument] = React.useState<ShortcutEditorDocument | null>(null);
  const [pendingInsertTokenRequest, setPendingInsertTokenRequest] = React.useState<ShortcutSlateInsertTokenRequest | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragOverUploadZone, setIsDragOverUploadZone] = React.useState(false);
  const [isDeletingMoodboard, setIsDeletingMoodboard] = React.useState(false);
  const [isGeneratingPromptTemplate, setIsGeneratingPromptTemplate] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isCollageEditorOpen, setIsCollageEditorOpen] = React.useState(false);
  const [selectedGalleryPreviewResult, setSelectedGalleryPreviewResult] = React.useState<Generation | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isBuiltinShortcut = React.useMemo(
    () => Boolean(shortcut && getShortcutById(shortcut.id)),
    [shortcut],
  );
  const canDeleteShortcut = Boolean(shortcut && !isBuiltinShortcut);

  // Helper to update a single prompt field
  const handleFieldChange = React.useCallback((key: string, value: string) => {
    setDraftPromptFields((prev) =>
      prev.map((field) => (field.key === key ? { ...field, defaultValue: value } : field))
    );
  }, []);

  const handleShortcutDocumentChange = React.useCallback((nextDocument: ShortcutEditorDocument) => {
    setDraftEditorDocument(nextDocument);
    setDraftPromptTemplate(serializeShortcutEditorDocumentToTemplate(nextDocument));

    const nextFieldIds = getShortcutEditorDocumentFieldIds(nextDocument);
    setDraftPromptFields((prev) => {
      const normalizedPrevFields = normalizePromptFieldDrafts(prev);
      const previousFieldsByKey = new Map(
        normalizedPrevFields.map((field) => [field.key, field]),
      );

      return nextFieldIds.map((fieldId, index) => {
        const existingField = previousFieldsByKey.get(fieldId);
        if (existingField) {
          return {
            ...existingField,
            order: index,
          };
        }

        return {
          key: fieldId,
          label: fieldId,
          placeholder: fieldId,
          type: 'text',
          defaultValue: '',
          required: false,
          options: [],
          order: index,
        } satisfies ShortcutPromptFieldDefinition;
      });
    });
  }, []);

  const handleAddPromptToken = React.useCallback(() => {
    const draftField = buildUniqueNewFieldDraft(draftPromptFields);
    const rawTokenName = window.prompt('请输入 token 名称', draftField.key);
    if (rawTokenName === null) {
      return;
    }

    const tokenLabel = rawTokenName.trim();
    if (!tokenLabel) {
      toast({
        title: 'Token 名称无效',
        description: '请输入非空的 token 名称。',
        variant: 'destructive',
      });
      return;
    }

    const normalizedTokenKey = normalizeTokenKeyInput(tokenLabel);
    const tokenKey = buildUniqueTokenKey(
      normalizedTokenKey || draftField.key,
      draftPromptFields,
    );

    const nextField: ShortcutPromptFieldDefinition = {
      ...draftField,
      key: tokenKey,
      label: tokenLabel,
      placeholder: tokenLabel,
      order: draftPromptFields.length,
    };

    setDraftPromptFields((prev) => [...prev, nextField]);
    setPendingInsertTokenRequest({
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fieldId: tokenKey,
    });
  }, [draftPromptFields, toast]);

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
    setDraftEditorDocument(
      shortcut ? createShortcutEditorDocumentFromParts(shortcut.promptParts) : null,
    );
    setPendingInsertTokenRequest(null);
  }, [availableModels, moodboard, open, shortcut]);

  React.useEffect(() => {
    if (!open) {
      setIsDragOverUploadZone(false);
    }
  }, [open]);

  const draftPromptValues = React.useMemo(
    () => Object.fromEntries(
      draftPromptFields.map((field) => [field.key, String(field.defaultValue || '')]),
    ),
    [draftPromptFields],
  );

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

    return buildShortcutPrompt(
      draftShortcut,
      Object.keys(draftPromptValues).length > 0 ? draftPromptValues : createShortcutPromptValues(draftShortcut),
    );
  }, [draftPromptValues, draftShortcut]);

  const galleryImages = React.useMemo(() => moodboard?.imagePaths || [], [moodboard]);
  const shouldShowPromptSparkle = React.useMemo(
    () => shouldShowMoodboardPromptSparkle(shortcut?.id),
    [shortcut?.id],
  );
  const dialogTitle = shortcut ? `${draftName || shortcut.name} ` : (draftName || moodboard?.name || '');
  const moodboardPreviewPrompt = React.useMemo(() => {
    if (draftShortcut) {
      return promptPreview;
    }

    return draftPrompt || moodboard?.prompt || '';
  }, [draftPrompt, draftShortcut, moodboard?.prompt, promptPreview]);
  const imageRecordLookup = React.useMemo(
    () => buildGenerationOutputLookup(generationHistory),
    [generationHistory],
  );
  const galleryPreviewResults = React.useMemo<Generation[]>(() => {
    if (!moodboard) {
      return [];
    }

    const previewCreatedAt = moodboard.updatedAt || new Date().toISOString();

    return galleryImages.map((imagePath, index) => {
      const matchedRecord = imageRecordLookup.get(getMoodboardImageMatchKey(imagePath));
      const matchedConfig = matchedRecord?.config;
      const fallbackModel = draftShortcut?.model || currentConfig.model;
      const fallbackBaseModel = draftShortcut?.model || currentConfig.baseModel || currentConfig.model;
      const prompt = matchedConfig?.prompt || moodboardPreviewPrompt;

      return {
        id: `${moodboard.id}-image-preview-${index}`,
        userId: matchedRecord?.userId || 'moodboard-preview',
        projectId: matchedRecord?.projectId || moodboard.id,
        outputUrl: imagePath,
        config: {
          ...matchedConfig,
          prompt,
          model: matchedConfig?.model || fallbackModel,
          baseModel: matchedConfig?.baseModel || matchedConfig?.model || fallbackBaseModel,
          width: matchedConfig?.width || currentConfig.width || 1024,
          height: matchedConfig?.height || currentConfig.height || 1024,
          imageSize: matchedConfig?.imageSize || currentConfig.imageSize,
          aspectRatio: matchedConfig?.aspectRatio || currentConfig.aspectRatio,
          loras: matchedConfig?.loras || currentConfig.loras || [],
          workflowName: matchedConfig?.workflowName || draftName || moodboard.name,
          presetName: matchedConfig?.presetName || (draftShortcut ? draftShortcut.name : moodboard.name),
          isPreset: matchedConfig?.isPreset || false,
          isEdit: matchedConfig?.isEdit || false,
          generationMode: matchedConfig?.generationMode || 'playground',
        },
        status: matchedRecord?.status || 'completed',
        createdAt: matchedRecord?.createdAt || previewCreatedAt,
        interactionStats: matchedRecord?.interactionStats,
        viewerState: matchedRecord?.viewerState,
      };
    });
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
    imageRecordLookup,
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

    if (shortcut) {
      if (Array.isArray(patch.imagePaths)) {
        await persistShortcutGalleryOrder(shortcut, patch.imagePaths);
        await onShortcutsChange?.();
      }
      return;
    }

    await upsertMoodboardAsShortcut({
      name: (typeof patch.name === 'string' ? patch.name : draftName).trim() || moodboard.name,
      prompt: typeof patch.prompt === 'string' ? patch.prompt : (draftPrompt || moodboard.prompt || ''),
      imagePaths: Array.isArray(patch.imagePaths) ? patch.imagePaths : galleryImages,
      sourceStyleId: moodboard.id,
    });
    await deleteStyle(moodboard.id);
    await onShortcutsChange?.();
  }, [deleteStyle, draftName, draftPrompt, galleryImages, moodboard, onShortcutsChange, shortcut]);

  const handleShortcutSave = React.useCallback(async () => {
    if (!shortcut || !draftShortcut) {
      return;
    }

    const {
      promptTemplate: normalizedTemplate,
      promptFields: normalizedFields,
      missingDefinitions,
      unusedFields,
    } = normalizePromptTemplateDraftForSave(draftPromptTemplate, draftPromptFields);
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

    if (duplicateKeys.length > 0) {
      toast({
        title: '字段无效',
        description: `Token key 不能为空且不能重复: ${Array.from(new Set(duplicateKeys)).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

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
        const existingResponse = await fetch(`${getApiBase()}/moodboard-cards/code/${shortcut.id}`, {
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
        promptTemplate: normalizedTemplate,
        promptFields: normalizedFields,
        moodboardDescription: draftDescription.trim(),
        isEnabled: true,
        publishStatus: 'published',
      };

      const response = await fetch(
        persistedId
          ? `${getApiBase()}/moodboard-cards/${persistedId}`
          : `${getApiBase()}/moodboard-cards`,
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
      await upsertMoodboardAsShortcut({
        name: draftName.trim(),
        prompt: draftPrompt,
        imagePaths: galleryImages,
        sourceStyleId: moodboard.id,
      });
      await deleteStyle(moodboard.id);
      await onShortcutsChange?.();
      toast({
        title: '快捷入口已更新',
        description: '该 moodboard 已迁移为快捷入口并完成保存。',
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
  }, [deleteStyle, draftName, draftPrompt, galleryImages, moodboard, onShortcutsChange, toast]);

  const handleSave = React.useCallback(async () => {
    if (shortcut) {
      await handleShortcutSave();
      return;
    }

    await handleCustomMoodboardSave();
  }, [handleCustomMoodboardSave, handleShortcutSave, shortcut]);

  const [isHoveringApply, setIsHoveringApply] = React.useState(false);

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
      onOpenChange(false);
      onMoodboardApply?.();
      return;
    }

    applyPrompt(draftPrompt);
    toast({
      title: '已快速应用',
      description: `${draftName || moodboard?.name || 'Moodboard'} 的 prompt 已应用到输入框。`,
    });
    onOpenChange(false);
    onMoodboardApply?.();
  }, [applyPrompt, draftName, draftPrompt, draftShortcut, moodboard?.name, onShortcutQuickApply, promptPreview, toast, onOpenChange, onMoodboardApply]);

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

  const handleGeneratePromptTemplate = React.useCallback(async () => {
    if (!moodboard) {
      return;
    }

    if (galleryImages.length === 0) {
      toast({
        title: '缺少参考图',
        description: '请先为当前 moodboard 添加至少一张图片。',
        variant: 'destructive',
      });
      return;
    }

    const currentTemplate = (shortcut ? draftPromptTemplate : draftPrompt).trim();
    if (currentTemplate) {
      const shouldReplace = window.confirm('当前已存在 Prompt Template，是否替换当前模板并重新 AI 描述？');
      if (!shouldReplace) {
        return;
      }
    }

    setIsGeneratingPromptTemplate(true);
    try {
      const response = await fetch(`${getApiBase()}/moodboard-cards/prompt-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: galleryImages.slice(0, 4),
          moodboardName: (draftName || moodboard.name || '').trim(),
          currentTemplate,
        }),
      });
      const raw = await response.text();

      if (!response.ok) {
        let message = `AI 生成失败（${response.status}）`;
        if (raw.trim()) {
          try {
            const parsed = JSON.parse(raw) as { error?: string };
            message = parsed.error?.trim() || message;
          } catch {
            message = raw.trim();
          }
        }
        throw new Error(message);
      }

      let payload: { promptTemplate?: string; imageCount?: number } = {};
      if (raw.trim()) {
        payload = JSON.parse(raw) as { promptTemplate?: string; imageCount?: number };
      }

      const nextTemplate = (payload.promptTemplate || '').trim();
      if (!nextTemplate) {
        throw new Error('AI 未返回可用的 Prompt Template');
      }

      if (shortcut) {
        const syncedFields = syncPromptFieldsWithTemplate(nextTemplate, draftPromptFields);
        setDraftPromptFields(syncedFields);
        setDraftPromptTemplate(nextTemplate);
        setDraftEditorDocument(createShortcutEditorDocumentFromTemplate(nextTemplate));
        setPendingInsertTokenRequest(null);
      } else {
        setDraftPrompt(nextTemplate);
      }

      setIsEditMode(true);
      toast({
        title: 'Prompt Template 已生成',
        description: `已基于 ${payload.imageCount || Math.min(galleryImages.length, 4)} 张参考图生成，可继续编辑并保存。`,
      });
    } catch (error) {
      console.error('[MoodboardDetailDialog] Failed to generate prompt template', error);
      toast({
        title: '生成失败',
        description: error instanceof Error ? error.message : 'AI 生成 Prompt Template 失败，请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPromptTemplate(false);
    }
  }, [
    draftName,
    draftPrompt,
    draftPromptFields,
    draftPromptTemplate,
    galleryImages,
    moodboard,
    shortcut,
    toast,
  ]);

  const uploadMoodboardFiles = React.useCallback(async (rawFiles: Iterable<File>) => {
    if (!moodboard) {
      return;
    }

    const files = normalizeImageFiles(rawFiles);
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      const uploadedPaths = await Promise.all(files.map(async (file) => {
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
      setIsDragOverUploadZone(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [galleryImages, moodboard, persistMoodboardOverlay, toast]);

  const handleUploadImages = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    await uploadMoodboardFiles(files);
  }, [uploadMoodboardFiles]);

  const handleDialogDragEnter = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!hasDroppableImageFiles(event.dataTransfer)) {
      return;
    }

    setIsDragOverUploadZone(true);
  }, []);

  const handleDialogDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!hasDroppableImageFiles(event.dataTransfer)) {
      return;
    }

    setIsDragOverUploadZone(true);
  }, []);

  const handleDialogDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOverUploadZone(false);
  }, []);

  const handleDialogDrop = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOverUploadZone(false);

    if (!hasDroppableImageFiles(event.dataTransfer)) {
      return;
    }

    const files = normalizeImageFiles(event.dataTransfer.files);
    if (files.length === 0) {
      return;
    }

    void uploadMoodboardFiles(files);
  }, [uploadMoodboardFiles]);

  const handleDeleteMoodboard = React.useCallback(async () => {
    if (!canDeleteShortcut || !shortcut) {
      return;
    }

    const confirmed = window.confirm(`确认删除 Moodboard「${shortcut.name}」吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    setIsDeletingMoodboard(true);
    try {
      let persistedId = shortcut.persistedId || null;
      if (!persistedId) {
        const lookupResponse = await fetch(`${getApiBase()}/moodboard-cards/code/${encodeURIComponent(shortcut.id)}`, {
          cache: 'no-store',
        });

        if (lookupResponse.ok) {
          const lookupData = await lookupResponse.json() as { id?: string };
          persistedId = lookupData.id?.trim() || null;
        } else if (lookupResponse.status !== 404) {
          throw new Error(`Failed to load moodboard card: ${lookupResponse.status}`);
        }
      }

      if (!persistedId) {
        throw new Error('当前 Moodboard 未找到可删除的数据记录。');
      }

      const deleteResponse = await fetch(`${getApiBase()}/moodboard-cards/${persistedId}`, {
        method: 'DELETE',
      });

      if (!deleteResponse.ok) {
        const raw = await deleteResponse.text();
        throw new Error(raw || `Delete failed: ${deleteResponse.status}`);
      }

      onOpenChange(false);
      await onShortcutsChange?.();
      toast({
        title: 'Moodboard 已删除',
        description: `已删除 ${shortcut.name}。`,
      });
    } catch (error) {
      console.error('[MoodboardDetailDialog] Failed to delete moodboard', error);
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除失败，请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingMoodboard(false);
    }
  }, [canDeleteShortcut, onOpenChange, onShortcutsChange, shortcut, toast]);

  const handleRemoveImage = React.useCallback(async (path: string) => {
    if (!moodboard) {
      return;
    }

    try {
      if (shortcut) {
        const nextImagePaths = galleryImages.filter((item) => item !== path);
        await persistShortcutGalleryOrder(shortcut, nextImagePaths);
        await onShortcutsChange?.();
      } else {
        await persistMoodboardOverlay({
          imagePaths: galleryImages.filter((item) => item !== path),
        });
      }
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
  }, [galleryImages, moodboard, onShortcutsChange, persistMoodboardOverlay, shortcut, toast]);

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
        <DialogContent
          data-moodboard-detail-open="true"
          onDragEnter={handleDialogDragEnter}
          onDragOver={handleDialogDragOver}
          onDragLeave={handleDialogDragLeave}
          onDrop={handleDialogDrop}
          className="h-[70vh] max-w-[1200px] overflow-hidden rounded-3xl border border-white/10 bg-[#1C1C1C]/80 p-0 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >




          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_500px]">
            {/* Left Column: Gallery */}
            <div className="flex min-h-0 min-w-0 flex-col ">
              <div className={cn(
                'h-full flex-1 overflow-y-auto px-4 py-8 custom-scrollbar transition-all',
                isDragOverUploadZone ? 'rounded-2xl border border-dashed border-[#E8FFB7]/35 bg-[#E8FFB7]/10' : '',
              )}>
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-full  bg-white/5 px-3 py-1 text-xs text-white/60">
                    {galleryImages.length} images
                  </span>
                  <Button
                    type="button"
                    variant="light"
                    size="sm"
                    className="h-8 text-sm border border-white/10 bg-white/5"
                    onClick={handleUploadClick}
                    disabled={isUploading}
                  >
                    <Upload className=" h-3 w-3" />
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
                          className="group relative overflow-hidden  h-full rounded-xl border border-white/5 bg-white/[0.02]"
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
            <div className="flex h-full min-h-0 w-full max-w-[500px] flex-col rounded-3xl bg-black/50 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 w-full px-4 pt-8 pb-4 custom-scrollbar flex flex-col">
                {/* Collapsible Metadata (Name, Description, Model) */}
                <div className={`flex w-full shrink-0 flex-col ${isEditMode ? 'gap-3' : ''}`}>
                    <div className={`flex w-full items-center ${isEditMode ? 'justify-end' : 'h-10 justify-between'} px-0`}>
                      {!isEditMode && (
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-normal text-white">{dialogTitle}</h2>
                          {shortcut ? (
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
                              {draftShortcut?.modelLabel}
                            </span>
                          ) : null}
                        </div>
                      )}
                      <div className={cn('flex items-center gap-2', !isEditMode ? 'mb-2' : '')}>
                        {canDeleteShortcut && isEditMode ? (
                          <Button
                            type="button"
                            variant="light"
                            className="h-8 rounded-md border border-red-400/20 bg-red-500/10 px-2 text-sm text-red-200 hover:bg-red-500/20"
                            onClick={() => void handleDeleteMoodboard()}
                            disabled={isDeletingMoodboard}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            {isDeletingMoodboard ? 'Deleting...' : 'Delete'}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="light"
                          className="h-8 rounded-md border border-white/10 bg-white/10 px-2 text-sm text-white hover:bg-white/10"
                          onClick={() => {
                            setIsEditMode((prev) => !prev);
                          }}
                        >
                          <PencilLine className="mr-1 h-4 w-4" />
                          {isEditMode ? 'Cancel' : 'Edit'}
                        </Button>
                      </div>
                    </div>

                    {isEditMode && (
                      <div className="flex w-full flex-col gap-3">
                        <Input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="h-10 w-full rounded-xl border-white/10 bg-white/5 text-base text-white placeholder:text-white/30 focus:border-[#E8FFB7]/30"
                          placeholder="Name your moodboard"
                        />
                        {shortcut && (
                          <Select value={draftModelId} onValueChange={setDraftModelId}>
                            <SelectTrigger className="h-10 w-full rounded-xl border-white/10 bg-white/5 text-xs text-white">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-[#0b0d12] text-white">
                              {availableModels.map((model) => (
                                <SelectItem key={model.id} value={model.id} className="text-white">
                                  {model.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>

                  {shortcut ? (
                    isEditMode ? (
                      <Textarea
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        className="min-h-[60px] shrink-0 mt-2 w-full rounded-xl border-white/10  bg-white/5 text-xs text-white placeholder:text-white/30 focus:border-[#E8FFB7]/30"
                        placeholder="Add a description for this moodboard"
                      />
                    ) : (
                      <span className="w-full shrink-0 text-xs text-white/40 mt-2">
                        {draftDescription || 'No description provided'}
                      </span>
                    )
                  ) : (
                    <span className="w-full shrink-0 text-xs text-white/60 mt-2">
                      {draftDescription || 'No description provided'}
                    </span>
                  )}


                  {/* Main Prompt Area */}
                  <div className="flex flex-col flex-1 min-h-0 mt-8">
                    <div className="flex shrink-0 items-center justify-between mb-4">
                      <div className="text-xs font-medium  text-white/70">Prompt Template</div>
                      <div className="flex items-center gap-2">
                        {shouldShowPromptSparkle ? (
                          <Button
                            type="button"
                            variant="light"
                            size="icon"
                            className="h-8 w-8 rounded-full border border-[#E8FFB7]/10 bg-[#E8FFB7]/5 text-[#E8FFB7] hover:bg-white/10"
                            onClick={() => void handleGeneratePromptTemplate()}
                            disabled={isGeneratingPromptTemplate}
                            aria-label="Generate Prompt Template"
                          >
                            <Sparkles className={cn('h-4 w-4', isGeneratingPromptTemplate ? 'animate-pulse' : '')} />
                          </Button>
                        ) : null}
                        {isEditMode && shortcut && (
                          <Button
                            type="button"
                            variant="light"
                            size="sm"
                            className="h-8 rounded-full border border-[#E8FFB7]/10 bg-[#E8FFB7]/5 text-[11px] text-[#E8FFB7] hover:bg-white/10"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleAddPromptToken}
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Token
                          </Button>
                        )}
                       
                      </div>
                    </div>

                    <div className="group relative flex-1 min-h-[150px] overflow-hidden rounded-2xl bg-[#2C2D2F]/50 border border-white/10 transition-colors focus-within:border-[#E8FFB7]/20 flex flex-col">
                      {isEditMode ? (
                        shortcut && draftShortcut && draftEditorDocument ? (
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <ShortcutSlateEditor
                              shortcut={draftShortcut}
                              values={draftPromptValues}
                              document={draftEditorDocument}
                              onFieldChange={handleFieldChange}
                              onDocumentChange={handleShortcutDocumentChange}
                              insertTokenRequest={pendingInsertTokenRequest}
                              onInsertTokenRequestHandled={(requestId) => {
                                setPendingInsertTokenRequest((current) => (
                                  current?.requestId === requestId ? null : current
                                ));
                              }}
                            />
                          </div>
                        ) : (
                          <Textarea
                            value={shortcut ? draftPromptTemplate : draftPrompt}
                            onChange={(e) => shortcut ? setDraftPromptTemplate(e.target.value) : setDraftPrompt(e.target.value)}
                            className="flex-1 border-0 bg-transparent p-4 text-sm leading-10 text-white/80 outline-none placeholder:text-white/20 resize-none"
                            placeholder={shortcut ? "Use {{token}} syntax to define dynamic fields" : "Enter prompt here..."}
                          />
                        )
                      ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                          {shortcut ? (
                            <InlinePromptPreview
                              shortcut={draftShortcut!}
                              values={draftPromptValues}
                              onValueChange={handleFieldChange}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-10 text-white/80">
                              {draftPrompt || 'No prompt content'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              {/* Bottom Sticky Action Bar */}
              <div className="shrink-0 p-4 pt-2">
                {!isEditMode ? (
                  <Button
                    type="button"
                    className="group relative w-full h-12 overflow-hidden rounded-2xl bg-gradient-to-r from-white/45 via-[#E3FF9C] to-white/45 px-6 text-sm font-semibold text-black transition-all duration-500 ease-out hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99]"
                    onClick={handleQuickApply}
                    onMouseEnter={() => setIsHoveringApply(true)}
                    onMouseLeave={() => setIsHoveringApply(false)}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full transition-transform duration-1000 ease-out group-hover:translate-x-full" />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#E3FF9C]/25 via-white/10 to-[#E3FF9C]/25 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <span className="relative z-10 inline-flex items-center justify-center w-full">
                      {isHoveringApply ? (
                        <ShinyText
                          text="Quick Apply"
                          speed={1.8}
                          color="#111111"
                          shineColor="#BCE2FF"
                          spread={135}
                          className="font-inherit"
                        />
                      ) : (
                        "Quick Apply"
                      )}
                    </span>
                  </Button>
                ) : (
                  <div className="flex flex-row items-center justify-end gap-3 rounded-2xl bg-black/20 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-2xl text-white/40 hover:text-white border border-white/10 bg-white/5"
                      onClick={() => setIsEditMode(false)}
                    >
                      Discard Changes
                    </Button>
                    <Button
                      type="button"
                      className="rounded-2xl bg-white px-8 text-sm font-bold text-black hover:bg-[#E8FFB7]"
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
