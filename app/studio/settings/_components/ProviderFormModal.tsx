"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Plus,
    Trash2,
    Server,
    Cloud,
    Cpu,
    Workflow,
    Sparkles,
    ChevronDown,
} from "lucide-react";
import { APIProviderConfig, ModelContext, ModelEntry, ProviderType } from "@/lib/api-config/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface ProviderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (provider: Partial<APIProviderConfig>) => Promise<void>;
    provider?: APIProviderConfig | null;
}

type QuickModelTemplate = 'image-editable' | 'image-static' | 'text-service' | 'vision-service';
type ReferenceMode = 'none' | 'single' | 'multi';

const providerTypeOptions: { value: ProviderType; label: string; icon: React.ReactNode }[] = [
    { value: 'openai-compatible', label: 'OpenAI 兼容', icon: <Server className="size-4" /> },
    { value: 'google-genai', label: 'Google 模型', icon: <Cloud className="size-4" /> },
    { value: 'google-translate', label: 'Google Translate', icon: <Cloud className="size-4" /> },
    { value: 'bytedance-afr', label: 'ByteArtist 模型', icon: <Cpu className="size-4" /> },
    { value: 'coze-image', label: 'Coze 图像模型', icon: <Cloud className="size-4" /> },
    { value: 'coze-vision', label: 'Coze 视觉模型', icon: <Cloud className="size-4" /> },
    { value: 'workflow-local', label: 'ComfyUI 工作流', icon: <Workflow className="size-4" /> },
];

const providerDefaults: Partial<Record<ProviderType, { name: string; baseURL?: string }>> = {
    'google-genai': {
        name: 'Google Gemini',
        baseURL: 'https://generativelanguage.googleapis.com',
    },
    'google-translate': {
        name: 'Google Translate',
        baseURL: 'https://translation.googleapis.com',
    },
    'openai-compatible': {
        name: 'OpenAI Compatible',
        baseURL: 'https://api.openai.com/v1',
    },
    'workflow-local': {
        name: 'ComfyUI Local',
        baseURL: 'http://127.0.0.1:8188',
    },
};

const taskOptions: { value: 'text' | 'vision' | 'image'; label: string }[] = [
    { value: 'text', label: '文本生成' },
    { value: 'vision', label: '视觉理解' },
    { value: 'image', label: '图像生成' },
];

const contextOptions: { value: ModelContext; label: string }[] = [
    { value: 'playground', label: 'Playground' },
    { value: 'banner', label: 'Banner' },
    { value: 'infinite-canvas', label: 'Infinity Canvas' },
    { value: 'service:imageGeneration', label: '系统服务：图像生成' },
    { value: 'service:describe', label: '系统服务：图像描述' },
    { value: 'service:optimize', label: '系统服务：提示词优化' },
    { value: 'service:datasetLabel', label: '系统服务：训练集打标' },
];

const quickTemplateOptions: { value: QuickModelTemplate; label: string; hint: string }[] = [
    { value: 'image-editable', label: '图像模型（可编辑）', hint: '支持参考图编辑，默认支持多参考图' },
    { value: 'image-static', label: '图像模型（不可编辑）', hint: '仅文生图，不支持参考图' },
    { value: 'text-service', label: '文本模型', hint: '用于提示词优化、翻译等文本服务' },
    { value: 'vision-service', label: '视觉模型', hint: '用于 Describe / 训练集打标' },
];

const imageSizeOptions: Array<'1K' | '2K' | '4K'> = ['1K', '2K', '4K'];

const capabilityOptions: Array<{
    key: 'supportsAspectRatio' | 'supportsImageSize' | 'supportsSeed' | 'supportsBatch' | 'supportsMultiImage' | 'supportsImageEdit';
    label: string;
}> = [
        { key: 'supportsImageEdit', label: '可编辑类型' },
        { key: 'supportsAspectRatio', label: '支持宽高比' },
        { key: 'supportsImageSize', label: '支持尺寸档位（1K/2K/4K）' },
        { key: 'supportsSeed', label: '支持 Seed' },
        { key: 'supportsBatch', label: '支持批量生成' },
        { key: 'supportsMultiImage', label: '支持多参考图' },
    ];

const categorySuggestions = ['image', 'text', 'vision', 'gemini-image', 'seedream', 'workflow', 'general'];

function createModelFromTemplate(template: QuickModelTemplate): ModelEntry {
    const base: ModelEntry = {
        modelId: '',
        displayName: '',
        task: ['image'],
        category: 'image',
        contexts: ['playground', 'banner', 'infinite-canvas'],
        capabilities: {
            supportsImageEdit: true,
            supportsAspectRatio: true,
            supportsImageSize: true,
            allowedImageSizes: ['1K', '2K', '4K'],
            supportsSeed: true,
            supportsBatch: true,
            maxBatchSize: 4,
            supportsMultiImage: true,
            maxReferenceImages: 4,
        },
        priority: 100,
        status: 'active',
    };

    if (template === 'image-static') {
        return {
            ...base,
            contexts: ['playground', 'infinite-canvas'],
            capabilities: {
                ...base.capabilities,
                supportsImageEdit: false,
                supportsMultiImage: false,
                maxReferenceImages: 1,
            },
        };
    }

    if (template === 'text-service') {
        return {
            ...base,
            task: ['text'],
            category: 'text',
            contexts: ['service:optimize'],
            capabilities: {
                supportsText: true,
                supportsImageEdit: false,
                supportsAspectRatio: false,
                supportsImageSize: false,
                supportsSeed: false,
                supportsBatch: false,
                maxBatchSize: 1,
                supportsMultiImage: false,
                maxReferenceImages: 1,
            },
        };
    }

    if (template === 'vision-service') {
        return {
            ...base,
            task: ['vision'],
            category: 'vision',
            contexts: ['service:describe', 'service:datasetLabel'],
            capabilities: {
                supportsVision: true,
                supportsImageEdit: false,
                supportsAspectRatio: false,
                supportsImageSize: false,
                supportsSeed: false,
                supportsBatch: false,
                maxBatchSize: 1,
                supportsMultiImage: false,
                maxReferenceImages: 1,
            },
        };
    }

    return base;
}

function createDefaultModel(): ModelEntry {
    return createModelFromTemplate('image-editable');
}

function normalizeIncomingModel(model: ModelEntry): ModelEntry {
    const base = createDefaultModel();
    return {
        ...base,
        ...model,
        task: model.task && model.task.length > 0 ? model.task : base.task,
        contexts: model.contexts || [],
        capabilities: {
            ...(base.capabilities || {}),
            ...(model.capabilities || {}),
            allowedImageSizes: (model.capabilities?.allowedImageSizes && model.capabilities.allowedImageSizes.length > 0)
                ? model.capabilities.allowedImageSizes
                : (base.capabilities?.allowedImageSizes || ['1K', '2K', '4K']),
        },
    };
}

function inferTemplate(model: ModelEntry): QuickModelTemplate {
    const taskSet = new Set(model.task || []);
    const isImageOnly = taskSet.has('image') && taskSet.size === 1;
    if (isImageOnly) {
        return model.capabilities?.supportsImageEdit === false ? 'image-static' : 'image-editable';
    }
    if (taskSet.has('text') && taskSet.size === 1) return 'text-service';
    if (taskSet.has('vision') && taskSet.size === 1) return 'vision-service';
    return 'image-editable';
}

function inferReferenceMode(model: ModelEntry): ReferenceMode {
    if (model.capabilities?.supportsImageEdit === false) return 'none';
    if (model.capabilities?.supportsMultiImage === false) return 'single';
    return 'multi';
}

function getQuickContextOptions(model: ModelEntry): Array<{ value: ModelContext; label: string }> {
    const taskSet = new Set(model.task || []);
    if (taskSet.has('image')) {
        return contextOptions.filter((item) => ['playground', 'banner', 'infinite-canvas'].includes(item.value));
    }
    if (taskSet.has('vision')) {
        return contextOptions.filter((item) => ['service:describe', 'service:datasetLabel'].includes(item.value));
    }
    if (taskSet.has('text')) {
        return contextOptions.filter((item) => ['service:optimize'].includes(item.value));
    }
    return contextOptions;
}

export function ProviderFormModal({ isOpen, onClose, onSave, provider }: ProviderFormModalProps) {
    const isEditing = !!provider;
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<APIProviderConfig>>({
        name: '',
        providerType: 'openai-compatible',
        apiKey: '',
        baseURL: '',
        models: [],
        isEnabled: true,
    });

    useEffect(() => {
        if (provider) {
            setFormData({
                id: provider.id,
                name: provider.name,
                providerType: provider.providerType,
                apiKey: provider.apiKey,
                baseURL: provider.baseURL || '',
                models: (provider.models || []).map((model) => normalizeIncomingModel(model)),
                isEnabled: provider.isEnabled,
            });
            return;
        }

        setFormData({
            name: '',
            providerType: 'openai-compatible',
            apiKey: '',
            baseURL: '',
            models: [],
            isEnabled: true,
        });
    }, [provider, isOpen]);

    const providerTypeHint = useMemo(() => {
        const currentType = formData.providerType as ProviderType;
        return providerDefaults[currentType];
    }, [formData.providerType]);

    const handleProviderTypeChange = (value: ProviderType) => {
        setFormData((prev) => {
            const defaults = providerDefaults[value];
            return {
                ...prev,
                providerType: value,
                name: prev.name?.trim() ? prev.name : (defaults?.name || prev.name),
                baseURL: prev.baseURL?.trim() ? prev.baseURL : (defaults?.baseURL || prev.baseURL),
            };
        });
    };

    const handleAddModel = (template: QuickModelTemplate = 'image-editable') => {
        setFormData((prev) => ({
            ...prev,
            models: [...(prev.models || []), createModelFromTemplate(template)],
        }));
    };

    const handleApplyTemplate = (index: number, template: QuickModelTemplate) => {
        updateModelAt(index, (model) => {
            const next = createModelFromTemplate(template);
            return {
                ...next,
                modelId: model.modelId,
                displayName: model.displayName,
                category: model.category || next.category,
                priority: model.priority ?? next.priority,
                status: model.status || next.status,
            };
        });
    };

    const handleRemoveModel = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            models: prev.models?.filter((_, i) => i !== index) || [],
        }));
    };

    const updateModelAt = (index: number, updater: (model: ModelEntry) => ModelEntry) => {
        setFormData((prev) => ({
            ...prev,
            models: prev.models?.map((model, i) => (i === index ? updater(model) : model)) || [],
        }));
    };

    const handleModelFieldChange = <K extends keyof ModelEntry>(index: number, field: K, value: ModelEntry[K]) => {
        updateModelAt(index, (model) => ({ ...model, [field]: value }));
    };

    const handleTaskToggle = (index: number, task: 'text' | 'vision' | 'image') => {
        updateModelAt(index, (model) => {
            const current = model.task || [];
            const next = current.includes(task)
                ? current.filter((item) => item !== task)
                : [...current, task];
            return {
                ...model,
                task: next.length > 0 ? next : current,
            };
        });
    };

    const handleContextToggle = (index: number, context: ModelContext) => {
        updateModelAt(index, (model) => {
            const current = model.contexts || [];
            const next = current.includes(context)
                ? current.filter((item) => item !== context)
                : [...current, context];
            return { ...model, contexts: next };
        });
    };

    const handleReferenceModeChange = (index: number, mode: ReferenceMode) => {
        updateModelAt(index, (model) => {
            const capabilities = { ...(model.capabilities || {}) };
            if (mode === 'none') {
                capabilities.supportsImageEdit = false;
                capabilities.supportsMultiImage = false;
                capabilities.maxReferenceImages = 1;
            }
            if (mode === 'single') {
                capabilities.supportsImageEdit = true;
                capabilities.supportsMultiImage = false;
                capabilities.maxReferenceImages = 1;
            }
            if (mode === 'multi') {
                capabilities.supportsImageEdit = true;
                capabilities.supportsMultiImage = true;
                capabilities.maxReferenceImages = Math.max(2, model.capabilities?.maxReferenceImages || 4);
            }
            return {
                ...model,
                capabilities,
            };
        });
    };

    const handleCapabilityToggle = (
        index: number,
        key: 'supportsAspectRatio' | 'supportsImageSize' | 'supportsSeed' | 'supportsBatch' | 'supportsMultiImage' | 'supportsImageEdit',
    ) => {
        updateModelAt(index, (model) => {
            const nextValue = !Boolean(model.capabilities?.[key]);
            const nextCaps = {
                ...(model.capabilities || {}),
                [key]: nextValue,
            };
            if (key === 'supportsImageEdit' && !nextValue) {
                nextCaps.supportsMultiImage = false;
                nextCaps.maxReferenceImages = 1;
            }
            if (key === 'supportsMultiImage' && nextValue && nextCaps.supportsImageEdit === false) {
                nextCaps.supportsImageEdit = true;
            }
            return {
                ...model,
                capabilities: nextCaps,
            };
        });
    };

    const handleAllowedImageSizeToggle = (index: number, value: '1K' | '2K' | '4K') => {
        updateModelAt(index, (model) => {
            const current = model.capabilities?.allowedImageSizes || [];
            const next = current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value];

            return {
                ...model,
                capabilities: {
                    ...(model.capabilities || {}),
                    allowedImageSizes: next.length > 0 ? next : ['1K'],
                },
            };
        });
    };

    const handleCapabilityNumber = (
        index: number,
        key: 'maxBatchSize' | 'maxReferenceImages' | 'minWidth' | 'minHeight',
        rawValue: string,
    ) => {
        const parsed = rawValue.trim() === '' ? undefined : Number(rawValue);
        updateModelAt(index, (model) => ({
            ...model,
            capabilities: {
                ...(model.capabilities || {}),
                [key]: Number.isFinite(parsed) ? parsed : undefined,
            },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim()) return;

        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Failed to save provider:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl"
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <div>
                            <h2 className="text-lg font-semibold text-white">{isEditing ? '编辑 Provider' : '新增 Provider'}</h2>
                            <p className="text-xs text-zinc-500 mt-1">先填 Provider 基础信息，再用模板快速新增模型。</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="size-8 text-zinc-400 hover:text-white">
                            <X className="size-4" />
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
                        <div className="space-y-4 p-4 rounded-xl bg-black/25 border border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-400">Provider 名称 *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                        placeholder="例如：Google Gemini"
                                        className="bg-black/40 border-white/10 text-white"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-400">Provider 类型 *</Label>
                                    <Select
                                        value={String(formData.providerType || 'openai-compatible')}
                                        onValueChange={(value: ProviderType) => handleProviderTypeChange(value)}
                                    >
                                        <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-white/10">
                                            {providerTypeOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value} className="text-zinc-300">
                                                    <span className="flex items-center gap-2">
                                                        {opt.icon}
                                                        {opt.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-400">API Key</Label>
                                    <Input
                                        type="password"
                                        value={formData.apiKey}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                                        placeholder="sk-..."
                                        className="bg-black/40 border-white/10 text-white font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-400">Base URL（可选）</Label>
                                    <Input
                                        value={formData.baseURL}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, baseURL: e.target.value }))}
                                        placeholder={providerTypeHint?.baseURL || "https://api.openai.com/v1"}
                                        className="bg-black/40 border-white/10 text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <Label className="text-xs text-zinc-400">模型列表</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAddModel('image-editable')}
                                        className="text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                    >
                                        <Plus className="size-3 mr-1" />
                                        图像模型（可编辑）
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAddModel('image-static')}
                                        className="text-xs border-zinc-500/40 text-zinc-300 hover:bg-zinc-500/10"
                                    >
                                        <Plus className="size-3 mr-1" />
                                        图像模型（不可编辑）
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAddModel('text-service')}
                                        className="text-xs border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
                                    >
                                        <Plus className="size-3 mr-1" />
                                        文本模型
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAddModel('vision-service')}
                                        className="text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                                    >
                                        <Plus className="size-3 mr-1" />
                                        视觉模型
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {formData.models?.map((model, index) => {
                                    const selectedTemplate = inferTemplate(model);
                                    const referenceMode = inferReferenceMode(model);
                                    const quickContexts = getQuickContextOptions(model);
                                    const isImageModel = model.task.includes('image');

                                    return (
                                        <div key={`${index}-${model.modelId || 'new'}`} className="p-4 rounded-lg bg-black/30 border border-white/10 space-y-4">
                                            <div className="flex flex-wrap items-center gap-2 justify-between">
                                                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                                                    <Sparkles className="size-3" />
                                                    使用模板可自动填好任务、上下文和能力限制
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveModel(index)}
                                                    className="size-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="space-y-1 md:col-span-2">
                                                    <Label className="text-xs text-zinc-400">显示名称</Label>
                                                    <Input
                                                        value={model.displayName}
                                                        onChange={(e) => handleModelFieldChange(index, 'displayName', e.target.value)}
                                                        placeholder="例如：Nano banana 2"
                                                        className="bg-black/40 border-white/10 text-white text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-zinc-400">快速模板</Label>
                                                    <Select
                                                        value={selectedTemplate}
                                                        onValueChange={(value: QuickModelTemplate) => handleApplyTemplate(index, value)}
                                                    >
                                                        <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-zinc-900 border-white/10">
                                                            {quickTemplateOptions.map((option) => (
                                                                <SelectItem key={option.value} value={option.value} className="text-zinc-200">
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="space-y-1 md:col-span-2">
                                                    <Label className="text-xs text-zinc-400">模型 ID *</Label>
                                                    <Input
                                                        value={model.modelId}
                                                        onChange={(e) => handleModelFieldChange(index, 'modelId', e.target.value)}
                                                        placeholder="例如：gemini-3.1-flash-image-preview"
                                                        className="bg-black/40 border-white/10 text-white text-sm"
                                                        required
                                                    />
                                                </div>
                                                {isImageModel && (
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-zinc-400">参考图能力</Label>
                                                        <Select
                                                            value={referenceMode}
                                                            onValueChange={(value: ReferenceMode) => handleReferenceModeChange(index, value)}
                                                        >
                                                            <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-zinc-900 border-white/10">
                                                                <SelectItem value="none">不支持</SelectItem>
                                                                <SelectItem value="single">支持单参考图</SelectItem>
                                                                <SelectItem value="multi">支持多参考图</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">适用范围</div>
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    {quickContexts.map((option) => (
                                                        <label key={option.value} className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                                                            <Checkbox
                                                                checked={Boolean(model.contexts?.includes(option.value))}
                                                                onCheckedChange={() => handleContextToggle(index, option.value)}
                                                                className="size-3.5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                            />
                                                            {option.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <details className="rounded-lg border border-white/10 bg-black/20">
                                                <summary className="px-3 py-2 cursor-pointer text-xs text-zinc-400 flex items-center gap-2 select-none">
                                                    <ChevronDown className="size-3" />
                                                    高级参数（可选）
                                                </summary>
                                                <div className="px-3 pb-3 space-y-4 border-t border-white/10">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] text-zinc-500">分类（管理用）</Label>
                                                            <Input
                                                                list={`category-options-${index}`}
                                                                value={model.category || ''}
                                                                onChange={(e) => handleModelFieldChange(index, 'category', e.target.value)}
                                                                placeholder="如 gemini-image"
                                                                className="bg-black/40 border-white/10 text-white text-sm"
                                                            />
                                                            <datalist id={`category-options-${index}`}>
                                                                {categorySuggestions.map((item) => (
                                                                    <option key={item} value={item} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] text-zinc-500">状态</Label>
                                                            <Select
                                                                value={model.status || 'active'}
                                                                onValueChange={(value: 'active' | 'deprecated' | 'hidden') => handleModelFieldChange(index, 'status', value)}
                                                            >
                                                                <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-zinc-900 border-white/10">
                                                                    <SelectItem value="active">active</SelectItem>
                                                                    <SelectItem value="deprecated">deprecated</SelectItem>
                                                                    <SelectItem value="hidden">hidden</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] text-zinc-500">排序（越小越靠前）</Label>
                                                            <Input
                                                                value={String(model.priority ?? 100)}
                                                                onChange={(e) => handleModelFieldChange(index, 'priority', Number(e.target.value) || 100)}
                                                                className="bg-black/40 border-white/10 text-white text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Tasks</div>
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            {taskOptions.map((task) => (
                                                                <label key={task.value} className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                                                                    <Checkbox
                                                                        checked={model.task?.includes(task.value)}
                                                                        onCheckedChange={() => handleTaskToggle(index, task.value)}
                                                                        className="size-3.5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                                    />
                                                                    {task.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="text-[10px] text-zinc-500 uppercase tracking-wide">全部 Contexts</div>
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            {contextOptions.map((option) => (
                                                                <label key={option.value} className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                                                                    <Checkbox
                                                                        checked={Boolean(model.contexts?.includes(option.value))}
                                                                        onCheckedChange={() => handleContextToggle(index, option.value)}
                                                                        className="size-3.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                                    />
                                                                    {option.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Capabilities</div>
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            {capabilityOptions.map((item) => (
                                                                <label key={item.key} className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                                                                    <Checkbox
                                                                        checked={Boolean(model.capabilities?.[item.key as keyof NonNullable<ModelEntry['capabilities']>])}
                                                                        onCheckedChange={() => handleCapabilityToggle(index, item.key)}
                                                                        className="size-3.5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                                    />
                                                                    {item.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {model.capabilities?.supportsImageSize && (
                                                        <div className="space-y-2">
                                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Allowed Image Sizes</div>
                                                            <div className="flex items-center gap-4">
                                                                {imageSizeOptions.map((size) => (
                                                                    <label key={size} className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                                                                        <Checkbox
                                                                            checked={Boolean(model.capabilities?.allowedImageSizes?.includes(size))}
                                                                            onCheckedChange={() => handleAllowedImageSizeToggle(index, size)}
                                                                            className="size-3.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                                        />
                                                                        {size}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        {model.capabilities?.supportsBatch && (
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] text-zinc-500">maxBatchSize</div>
                                                                <Input
                                                                    value={model.capabilities?.maxBatchSize ?? ''}
                                                                    onChange={(e) => handleCapabilityNumber(index, 'maxBatchSize', e.target.value)}
                                                                    className="bg-black/40 border-white/10 text-white text-sm"
                                                                />
                                                            </div>
                                                        )}
                                                        {model.capabilities?.supportsImageEdit && (
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] text-zinc-500">maxReferenceImages</div>
                                                                <Input
                                                                    value={model.capabilities?.maxReferenceImages ?? ''}
                                                                    onChange={(e) => handleCapabilityNumber(index, 'maxReferenceImages', e.target.value)}
                                                                    className="bg-black/40 border-white/10 text-white text-sm"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] text-zinc-500">minWidth</div>
                                                            <Input
                                                                value={model.capabilities?.minWidth ?? ''}
                                                                onChange={(e) => handleCapabilityNumber(index, 'minWidth', e.target.value)}
                                                                className="bg-black/40 border-white/10 text-white text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] text-zinc-500">minHeight</div>
                                                            <Input
                                                                value={model.capabilities?.minHeight ?? ''}
                                                                onChange={(e) => handleCapabilityNumber(index, 'minHeight', e.target.value)}
                                                                className="bg-black/40 border-white/10 text-white text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>

                                            <div className="text-[11px] text-zinc-500">
                                                当前模板：{quickTemplateOptions.find((item) => item.value === selectedTemplate)?.hint}
                                            </div>
                                        </div>
                                    );
                                })}

                                {(!formData.models || formData.models.length === 0) && (
                                    <div className="py-8 text-center text-zinc-500 text-sm border border-dashed border-white/10 rounded-lg bg-black/20">
                                        暂无模型，点击上方按钮可快速新增。
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-black/20">
                        <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
                            取消
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSaving || !formData.name?.trim()}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                            {isSaving ? '保存中...' : (isEditing ? '保存更改' : '创建 Provider')}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
