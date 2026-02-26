"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Server, Cloud, Cpu } from "lucide-react";
// cn utility removed - not used in this component
import { APIProviderConfig, ProviderType, ModelEntry } from "@/lib/api-config/types";
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

const providerTypeOptions: { value: ProviderType; label: string; icon: React.ReactNode }[] = [
    { value: 'openai-compatible', label: 'OpenAI Compatible', icon: <Server className="size-4" /> },
    { value: 'google-genai', label: 'Google GenAI', icon: <Cloud className="size-4" /> },
    { value: 'bytedance-afr', label: 'Bytedance AFR', icon: <Cpu className="size-4" /> }
];

const taskOptions: { value: 'text' | 'vision' | 'image'; label: string }[] = [
    { value: 'text', label: '文本生成' },
    { value: 'vision', label: '视觉理解' },
    { value: 'image', label: '图像生成' }
];

export function ProviderFormModal({ isOpen, onClose, onSave, provider }: ProviderFormModalProps) {
    const isEditing = !!provider;

    const [formData, setFormData] = useState<Partial<APIProviderConfig>>({
        name: '',
        providerType: 'openai-compatible',
        apiKey: '',
        baseURL: '',
        models: [],
        isEnabled: true
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (provider) {
            setFormData({
                id: provider.id,
                name: provider.name,
                providerType: provider.providerType,
                apiKey: provider.apiKey,
                baseURL: provider.baseURL || '',
                models: [...provider.models],
                isEnabled: provider.isEnabled
            });
        } else {
            setFormData({
                name: '',
                providerType: 'openai-compatible',
                apiKey: '',
                baseURL: '',
                models: [],
                isEnabled: true
            });
        }
    }, [provider, isOpen]);

    const handleAddModel = () => {
        setFormData(prev => ({
            ...prev,
            models: [
                ...(prev.models || []),
                { modelId: '', displayName: '', task: ['text'] }
            ]
        }));
    };

    const handleRemoveModel = (index: number) => {
        setFormData(prev => ({
            ...prev,
            models: prev.models?.filter((_, i) => i !== index) || []
        }));
    };

    const handleModelChange = (index: number, field: keyof ModelEntry, value: string | string[]) => {
        setFormData(prev => ({
            ...prev,
            models: prev.models?.map((model, i) =>
                i === index ? { ...model, [field]: value } : model
            ) || []
        }));
    };

    const handleTaskToggle = (index: number, task: 'text' | 'vision' | 'image') => {
        setFormData(prev => ({
            ...prev,
            models: prev.models?.map((model, i) => {
                if (i !== index) return model;
                const currentTasks = model.task || [];
                const newTasks = currentTasks.includes(task)
                    ? currentTasks.filter(t => t !== task)
                    : [...currentTasks, task];
                return { ...model, task: newTasks };
            }) || []
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
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <h2 className="text-lg font-semibold text-white">
                            {isEditing ? '编辑 Provider' : '新增 Provider'}
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="size-8 text-zinc-400 hover:text-white"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-8rem)]">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-zinc-400">Provider 名称 *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="例如：My OpenAI"
                                    className="bg-black/40 border-white/10 text-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-zinc-400">Provider 类型 *</Label>
                                <Select
                                    value={formData.providerType}
                                    onValueChange={(value: ProviderType) => setFormData(prev => ({ ...prev, providerType: value }))}
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

                        {/* API Config */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-zinc-400">API Key</Label>
                                <Input
                                    type="password"
                                    value={formData.apiKey}
                                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                                    placeholder="sk-..."
                                    className="bg-black/40 border-white/10 text-white font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-zinc-400">Base URL（可选）</Label>
                                <Input
                                    value={formData.baseURL}
                                    onChange={(e) => setFormData(prev => ({ ...prev, baseURL: e.target.value }))}
                                    placeholder="https://api.openai.com/v1"
                                    className="bg-black/40 border-white/10 text-white font-mono text-sm"
                                />
                            </div>
                        </div>

                        {/* Models */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-zinc-400">模型列表</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddModel}
                                    className="text-xs text-emerald-400 hover:text-emerald-300"
                                >
                                    <Plus className="size-3 mr-1" />
                                    添加模型
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {formData.models?.map((model, index) => (
                                    <div
                                        key={index}
                                        className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Input
                                                value={model.modelId}
                                                onChange={(e) => handleModelChange(index, 'modelId', e.target.value)}
                                                placeholder="Model ID"
                                                className="flex-1 bg-black/40 border-white/10 text-white text-sm"
                                            />
                                            <Input
                                                value={model.displayName}
                                                onChange={(e) => handleModelChange(index, 'displayName', e.target.value)}
                                                placeholder="显示名称"
                                                className="flex-1 bg-black/40 border-white/10 text-white text-sm"
                                            />
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
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Tasks:</span>
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
                                ))}

                                {(!formData.models || formData.models.length === 0) && (
                                    <div className="py-8 text-center text-zinc-500 text-sm">
                                        暂无模型，点击&quot;添加模型&quot;开始配置
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-black/20">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="text-zinc-400 hover:text-white"
                        >
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
