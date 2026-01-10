"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings as SettingsIcon,
    SquareTerminal,
    ChevronRight,
    ChevronDown,
    Key,
    Globe,
    Languages,
    Sparkles,
    Plus,
    RefreshCw,
    Image as ImageIcon,
    Wand2,
    Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/common/use-toast";
import MappingEditorPage from "@/pages/mapping-editor-page";

import { useAPIConfigStore } from "@/lib/store/api-config-store";
import { APIProviderConfig, ServiceType, SERVICE_METADATA } from "@/lib/api-config/types";
import { ProviderCard } from "./ProviderCard";
import { ProviderFormModal } from "./ProviderFormModal";

enum SettingsTab {
    Providers = "providers",
    Services = "services",
    MappingEditor = "mapping-editor"
}

// 服务图标映射
const serviceIcons: Record<ServiceType, React.ReactNode> = {
    imageGeneration: <ImageIcon className="size-4" />,
    translate: <Languages className="size-4" />,
    describe: <Eye className="size-4" />,
    optimize: <Wand2 className="size-4" />
};

export function SettingsView() {
    const [currentTab, setCurrentTab] = useState<SettingsTab>(SettingsTab.Providers);
    const { toast } = useToast();
    const [expandedServices, setExpandedServices] = useState<Set<ServiceType>>(new Set(['describe', 'optimize']));

    // Provider Form Modal State
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<APIProviderConfig | null>(null);

    // Use the API Config Store
    const {
        providers,
        settings,
        isLoading,
        fetchConfig,
        addProvider,
        updateProvider,
        removeProvider,
        updateSettings,
        updateServiceConfig
    } = useAPIConfigStore();

    // Fetch config on mount
    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    // Handlers
    const handleOpenAddProvider = () => {
        setEditingProvider(null);
        setIsFormModalOpen(true);
    };

    const handleEditProvider = (provider: APIProviderConfig) => {
        setEditingProvider(provider);
        setIsFormModalOpen(true);
    };

    const handleDeleteProvider = async (id: string) => {
        if (!confirm('确定要删除此 Provider 吗？')) return;
        try {
            await removeProvider(id);
            toast({ title: "删除成功", description: "Provider 已删除" });
        } catch {
            toast({ title: "删除失败", variant: "destructive" });
        }
    };

    const handleToggleEnabled = async (id: string, enabled: boolean) => {
        try {
            await updateProvider(id, { isEnabled: enabled });
        } catch {
            toast({ title: "更新失败", variant: "destructive" });
        }
    };

    const handleSaveProvider = async (providerData: Partial<APIProviderConfig>) => {
        if (providerData.id) {
            await updateProvider(providerData.id, providerData);
            toast({ title: "更新成功", description: "Provider 配置已更新" });
        } else {
            await addProvider(providerData);
            toast({ title: "创建成功", description: "新 Provider 已添加" });
        }
    };

    const handleSaveSettings = async () => {
        try {
            await updateSettings(settings);
            toast({ title: "保存成功", description: "设置已更新" });
        } catch {
            toast({ title: "保存失败", variant: "destructive" });
        }
    };

    const toggleServiceExpanded = (service: ServiceType) => {
        setExpandedServices(prev => {
            const next = new Set(prev);
            if (next.has(service)) {
                next.delete(service);
            } else {
                next.add(service);
            }
            return next;
        });
    };

    // Get models for a specific task type
    const getModelsForTask = (task: 'text' | 'vision' | 'image' | 'translate') => {
        const models: { providerId: string; providerName: string; modelId: string; displayName: string }[] = [];

        // 翻译服务使用固定的 Google Translate
        if (task === 'translate') {
            models.push({
                providerId: 'google-translate',
                providerName: 'Google',
                modelId: 'google-translate-api',
                displayName: 'Google Translation API'
            });
            return models;
        }

        for (const provider of providers.filter(p => p.isEnabled)) {
            for (const model of provider.models) {
                if (model.task.includes(task as 'text' | 'vision' | 'image')) {
                    models.push({
                        providerId: provider.id,
                        providerName: provider.name,
                        modelId: model.modelId,
                        displayName: model.displayName || model.modelId
                    });
                }
            }
        }
        return models;
    };

    const sidebarItems = [
        { id: SettingsTab.Providers, label: "API Providers", description: "管理模型服务商配置", icon: Key },
        { id: SettingsTab.Services, label: "服务配置", description: "各功能的模型绑定和提示词", icon: SettingsIcon },
        { id: SettingsTab.MappingEditor, label: "Mapping Editor", description: "节点映射配置", icon: SquareTerminal },
    ];

    // 服务列表
    const serviceList: ServiceType[] = ['imageGeneration', 'describe', 'optimize', 'translate'];

    return (
        <div className="flex h-full pt-20 w-full overflow-hidden text-zinc-100"
            style={{
                background: "linear-gradient(180deg, #131718 0%, #1079BB 150%)",
            }}>
            {/* Sidebar */}
            <aside className="w-72 flex flex-col bg-black/0">
                <div className="p-6 pb-4">
                    <h2 className="text-sm font-bold text-white/90 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        Settings
                    </h2>
                </div>
                <div className="px-3 flex-1 overflow-y-auto space-y-1">
                    {sidebarItems.map((item) => {
                        const isActive = currentTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setCurrentTab(item.id)}
                                className={cn(
                                    "flex items-center w-full px-3 py-3 rounded-lg transition-all duration-200 group text-left",
                                    isActive
                                        ? "bg-zinc-800/50 text-white"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-md mr-3 transition-colors",
                                    isActive ? "bg-white/10 text-white" : "bg-white/5 text-zinc-500 group-hover:text-zinc-300"
                                )}>
                                    <item.icon className="size-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium">{item.label}</div>
                                    <div className="text-[10px] text-white/30 truncate">{item.description}</div>
                                </div>
                                {isActive && <ChevronRight className="size-3 text-white/30 ml-2" />}
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 h-full overflow-hidden px-10 flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="h-full w-full"
                        >
                            {/* API Providers Tab */}
                            {currentTab === SettingsTab.Providers && (
                                <div className="space-y-8 pb-20">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2">
                                            <h1 className="text-3xl font-bold tracking-tight text-white">API Providers</h1>
                                            <p className="text-zinc-400 text-sm max-w-2xl">
                                                管理模型服务商配置，支持 OpenAI 兼容接口、Google GenAI 等多种 Provider 类型。
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={fetchConfig}
                                                disabled={isLoading}
                                                className="text-zinc-400 hover:text-white"
                                            >
                                                <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                                            </Button>
                                            <Button
                                                onClick={handleOpenAddProvider}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                            >
                                                <Plus className="size-4 mr-2" />
                                                新增 Provider
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Provider List */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AnimatePresence>
                                            {providers.map((provider) => (
                                                <ProviderCard
                                                    key={provider.id}
                                                    provider={provider}
                                                    onEdit={handleEditProvider}
                                                    onDelete={handleDeleteProvider}
                                                    onToggleEnabled={handleToggleEnabled}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>

                                    {providers.length === 0 && !isLoading && (
                                        <div className="py-16 text-center">
                                            <div className="text-zinc-500 text-sm mb-4">
                                                还没有配置任何 Provider
                                            </div>
                                            <Button
                                                onClick={handleOpenAddProvider}
                                                variant="outline"
                                                className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                                            >
                                                <Plus className="size-4 mr-2" />
                                                添加第一个 Provider
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Services Configuration Tab */}
                            {currentTab === SettingsTab.Services && (
                                <div className="space-y-8 pb-20">
                                    <div className="space-y-2">
                                        <h1 className="text-3xl font-bold tracking-tight text-white">服务配置</h1>
                                        <p className="text-zinc-400 text-sm max-w-2xl">
                                            配置各项AI服务使用的模型和系统提示词。
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {serviceList.map((serviceType) => {
                                            const meta = SERVICE_METADATA[serviceType];
                                            const serviceConfig = settings.services?.[serviceType];
                                            const isExpanded = expandedServices.has(serviceType);
                                            const models = getModelsForTask(meta.requiredTask);
                                            const currentValue = serviceConfig?.binding
                                                ? `${serviceConfig.binding.providerId}:${serviceConfig.binding.modelId}`
                                                : '';

                                            return (
                                                <Card key={serviceType} className="bg-black/40 border-white/5">
                                                    <Collapsible open={isExpanded} onOpenChange={() => toggleServiceExpanded(serviceType)}>
                                                        <CollapsibleTrigger asChild>
                                                            <CardHeader className="cursor-pointer hover:bg-white/5 transition-colors rounded-t-lg">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 rounded-lg bg-white/10 text-emerald-400">
                                                                            {serviceIcons[serviceType]}
                                                                        </div>
                                                                        <div>
                                                                            <CardTitle className="text-sm text-white">{meta.label}</CardTitle>
                                                                            <CardDescription className="text-xs text-zinc-500">
                                                                                {meta.description}
                                                                            </CardDescription>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-xs text-zinc-500">
                                                                            {serviceConfig?.binding?.modelId || '未配置'}
                                                                        </span>
                                                                        {isExpanded ? (
                                                                            <ChevronDown className="size-4 text-zinc-400" />
                                                                        ) : (
                                                                            <ChevronRight className="size-4 text-zinc-400" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </CardHeader>
                                                        </CollapsibleTrigger>

                                                        <CollapsibleContent>
                                                            <CardContent className="pt-0 space-y-4">
                                                                {/* Model Binding */}
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs text-zinc-400 font-medium">
                                                                        使用模型
                                                                    </Label>
                                                                    <Select
                                                                        value={currentValue}
                                                                        onValueChange={(val) => {
                                                                            const [providerId, modelId] = val.split(':');
                                                                            updateServiceConfig(serviceType, {
                                                                                binding: { providerId, modelId }
                                                                            });
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="bg-black/40 border-white/10 text-white/90 h-10">
                                                                            <SelectValue placeholder="选择模型" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-zinc-950 border-white/10 text-zinc-200">
                                                                            {models.map(m => (
                                                                                <SelectItem
                                                                                    key={`${m.providerId}:${m.modelId}`}
                                                                                    value={`${m.providerId}:${m.modelId}`}
                                                                                >
                                                                                    {m.providerName} / {m.displayName}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                {/* System Prompt (only for services that support it) */}
                                                                {meta.hasSystemPrompt && (
                                                                    <div className="space-y-2">
                                                                        <Label className="text-xs text-zinc-400 font-medium">
                                                                            系统提示词
                                                                        </Label>
                                                                        <Textarea
                                                                            value={serviceConfig?.systemPrompt || ''}
                                                                            onChange={(e) => {
                                                                                updateServiceConfig(serviceType, {
                                                                                    systemPrompt: e.target.value
                                                                                });
                                                                            }}
                                                                            placeholder="输入系统提示词..."
                                                                            className="bg-black/40 border-white/10 text-white/90 placeholder:text-zinc-600 min-h-[120px] font-mono text-xs resize-y"
                                                                        />
                                                                        <p className="text-[10px] text-zinc-600">
                                                                            用于指导AI模型的行为和输出格式
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </CardContent>
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                </Card>
                                            );
                                        })}
                                    </div>

                                    {/* ComfyUI Config */}
                                    <Card className="bg-black/40 border-white/5">
                                        <CardHeader>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-white/10 text-blue-400">
                                                    <Globe className="size-4" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-sm text-white">ComfyUI 配置</CardTitle>
                                                    <CardDescription className="text-xs text-zinc-500">
                                                        配置 ComfyUI 服务器连接
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                <Label htmlFor="comfyUrl" className="text-xs text-zinc-400 font-medium">
                                                    服务器地址
                                                </Label>
                                                <Input
                                                    id="comfyUrl"
                                                    type="text"
                                                    placeholder="e.g. http://127.0.0.1:8188/"
                                                    value={settings.comfyUrl || ''}
                                                    onChange={(e) => updateSettings({ ...settings, comfyUrl: e.target.value })}
                                                    className="bg-black/40 border-white/10 text-white/90 placeholder:text-zinc-600 font-mono text-sm"
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Footer Action */}
                                    <div className="sticky bottom-6 flex justify-end">
                                        <Button
                                            onClick={handleSaveSettings}
                                            className="rounded-full px-8 h-12 bg-white text-black hover:bg-white/90 font-medium shadow-lg"
                                        >
                                            保存设置
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {currentTab === SettingsTab.MappingEditor && (
                                <div className="h-full w-full -m-8 md:-m-12">
                                    <div className="h-full w-full">
                                        <MappingEditorPage />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>

            {/* Provider Form Modal */}
            <ProviderFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSave={handleSaveProvider}
                provider={editingProvider}
            />
        </div>
    );
}
