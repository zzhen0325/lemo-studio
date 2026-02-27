"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown,
    Key,
    Globe,
    Languages,
    Sparkles,
    Plus,
    RefreshCw,
    Image as ImageIcon,
    Wand2,
    Eye,
    Box
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/common/use-toast";
import MappingEditorPage from "../../mapping-editor/_components/mapping-editor-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useMediaQuery } from "@/hooks/common/use-media-query";

import { useAPIConfigStore } from "@/lib/store/api-config-store";
import { APIProviderConfig, ServiceType, SERVICE_METADATA } from "@/lib/api-config/types";
import { getPublicComfyUrl } from "@/lib/env/public";
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
    const [comfyUrlDraft, setComfyUrlDraft] = useState("");
    const comfyUrlFromEnv = getPublicComfyUrl();
    const isDesktop = useMediaQuery("(min-width: 1440px)");

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

    useEffect(() => {
        setComfyUrlDraft(comfyUrlFromEnv || settings.comfyUrl || "");
    }, [comfyUrlFromEnv, settings.comfyUrl]);

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
            await updateSettings({
                ...settings,
                comfyUrl: (comfyUrlFromEnv || comfyUrlDraft).trim()
            });
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
        {
            id: SettingsTab.Providers,
            label: "Model Providers",
            icon: Key,
            description: "Manage API keys and neural endpoints"
        },
        {
            id: SettingsTab.Services,
            label: "System Services",
            icon: Sparkles,
            description: "Configure core AI engines and prompts"
        },
        {
            id: SettingsTab.MappingEditor,
            label: "Workflow Mapper",
            icon: Box,
            description: "Synthesize parameter interfaces"
        },
    ];

    // 服务列表
    const serviceList: ServiceType[] = ['imageGeneration', 'describe', 'optimize', 'translate'];

    return (
        <div className="flex h-full w-full pt-20 overflow-hidden bg-[111117] text-zinc-100 relative"
        >

            {/* Dock Sidebar */}
            <div className={cn(
                "z-[60] transition-all duration-300",
                isDesktop
                    ? "absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4"
                    : "relative top-0 flex flex-row justify-center gap-8 mb-6 w-full pt-2"
            )}>
                {sidebarItems.map((item) => {
                    const isActive = currentTab === item.id;
                    return (
                        <div key={item.id} className="flex flex-col items-center gap-1">
                            <TooltipButton
                                icon={<item.icon className="w-5 h-5" />}
                                label={item.label}
                                tooltipContent={item.description}
                                tooltipSide="right"
                                className={cn(
                                    "w-10 h-10 rounded-2xl transition-all duration-200",
                                    isActive
                                        ? "bg-primary/20 text-white border border-white/40 hover:bg-primary/30 hover:border-white/60 hover:scale-105"
                                        : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:scale-110"
                                )}
                                onClick={() => setCurrentTab(item.id)}
                            />
                            <span className={cn(
                                "text-[10px] transition-colors duration-200",
                                isActive ? "text-primary font-medium" : "text-zinc-500"
                            )}>
                                {item.label.split(' ')[1] || item.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Content Area */}
            <main className={cn(
                "flex-1 h-full overflow-hidden flex flex-col z-10 transition-all duration-300",
                isDesktop ? "pl-32" : "pl-0"
            )}>
                <div className={cn(
                    "flex-1 flex flex-col min-h-0",
                    currentTab !== SettingsTab.MappingEditor && "overflow-y-auto px-12 custom-scrollbar"
                )}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentTab}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            className="flex-1 flex flex-col min-h-0"
                        >
                            {/* API Providers Tab */}
                            {currentTab === SettingsTab.Providers && (
                                <div className="space-y-10 pb-20 pt-12">
                                    <div className="flex items-end justify-between border-b border-white/5 pb-8">
                                        <div className="space-y-3">
                                            <h1 className="text-4xl font-bold tracking-tight text-white">API Providers</h1>
                                            <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
                                                Manage your model provider configurations. Integrate OpenAI-compatible interfaces,
                                                Google GenAI, and custom neural engines into your workflow.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <TooltipProvider>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={fetchConfig}
                                                    disabled={isLoading}
                                                    className="h-11 w-11 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                                                >
                                                    <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                                                </Button>
                                            </TooltipProvider>
                                            <Button
                                                onClick={handleOpenAddProvider}
                                                className="h-11 px-6 rounded-xl bg-primary text-white hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all font-bold text-xs uppercase tracking-widest gap-2"
                                            >
                                                <Plus className="size-4" />
                                                Add Provider
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
                                <div className="space-y-10 pb-20 pt-12">
                                    <div className="flex items-end justify-between border-b border-white/5 pb-8">
                                        <div className="space-y-3">
                                            <h1 className="text-4xl font-bold tracking-tight text-white">Service Config</h1>
                                            <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
                                                Assign default model providers for system services. Fine-tune which neural engine
                                                powers your workflow analysis and parameter mapping.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-6">
                                        {serviceList.map((serviceType) => {
                                            const meta = SERVICE_METADATA[serviceType];
                                            const serviceConfig = settings.services?.[serviceType];
                                            const isExpanded = expandedServices.has(serviceType);
                                            const models = getModelsForTask(meta.requiredTask);
                                            const currentValue = serviceConfig?.binding
                                                ? `${serviceConfig.binding.providerId}:${serviceConfig.binding.modelId}`
                                                : '';

                                            return (
                                                <Collapsible
                                                    key={serviceType}
                                                    open={isExpanded}
                                                    onOpenChange={() => toggleServiceExpanded(serviceType)}
                                                    className="group"
                                                >
                                                    <Card className={cn(
                                                        "bg-white/[0.01] border-white/5 overflow-hidden transition-all duration-500",
                                                        isExpanded ? "bg-white/[0.03] border-white/10 shadow-2xl" : "hover:bg-white/[0.02]"
                                                    )}>
                                                        <CollapsibleTrigger asChild>
                                                            <div className="flex items-center justify-between p-6 cursor-pointer select-none">
                                                                <div className="flex items-center gap-5">
                                                                    <div className={cn(
                                                                        "p-3 rounded-2xl transition-all duration-500",
                                                                        isExpanded ? "bg-primary/20 text-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]" : "bg-white/5 text-zinc-500"
                                                                    )}>
                                                                        {serviceIcons[serviceType]}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-lg font-bold text-white tracking-tight">{meta.label}</h3>
                                                                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">{meta.description}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-6">
                                                                    <div className="hidden md:flex flex-col items-end">
                                                                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Neural Binding</span>
                                                                        <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 text-[10px] font-mono px-2 py-0.5">
                                                                            {serviceConfig?.binding?.modelId || "Not Bound"}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className={cn(
                                                                        "p-2 rounded-xl bg-white/5 text-zinc-500 transition-transform duration-500",
                                                                        isExpanded && "rotate-180 bg-primary/10 text-primary"
                                                                    )}>
                                                                        <ChevronDown className="size-4" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CollapsibleTrigger>

                                                        <CollapsibleContent>
                                                            <div className="p-8 pt-2 space-y-8 border-t border-white/5 bg-black/20">
                                                                <div className="space-y-3">
                                                                    <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-1">Neural Model Binding</Label>
                                                                    <Select
                                                                        value={currentValue}
                                                                        onValueChange={(val) => {
                                                                            const [providerId, modelId] = val.split(':');
                                                                            updateServiceConfig(serviceType, {
                                                                                binding: { providerId, modelId }
                                                                            });
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="bg-white/[0.02] border-white/5 h-12 rounded-xl focus:ring-1 focus:ring-primary/20 transition-all px-4">
                                                                            <SelectValue placeholder="Select a model engine" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-zinc-900 border-white/10">
                                                                            {models.map(m => (
                                                                                <SelectItem
                                                                                    key={`${m.providerId}:${m.modelId}`}
                                                                                    value={`${m.providerId}:${m.modelId}`}
                                                                                    className="text-zinc-300 focus:bg-primary/20 focus:text-white transition-colors"
                                                                                >
                                                                                    {m.providerName} / {m.displayName}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                {meta.hasSystemPrompt && (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center justify-between px-1">
                                                                            <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Core Directives</Label>
                                                                            <span className="text-[10px] text-zinc-700 font-mono italic">Behavioral constraints for this module</span>
                                                                        </div>
                                                                        <Textarea
                                                                            placeholder="Enter system prompt instructions..."
                                                                            value={serviceConfig?.systemPrompt || ''}
                                                                            onChange={(e) => {
                                                                                updateServiceConfig(serviceType, {
                                                                                    systemPrompt: e.target.value
                                                                                });
                                                                            }}
                                                                            className="bg-white/[0.02] border-white/5 min-h-[140px] rounded-2xl focus:ring-1 focus:ring-primary/20 transition-all p-5 leading-relaxed text-sm resize-none custom-scrollbar font-mono"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CollapsibleContent>
                                                    </Card>
                                                </Collapsible>
                                            );
                                        })}
                                    </div>

                                    {/* ComfyUI Global Config */}
                                    <div className="pt-10 ">
                                        <Card className="bg-white/[0.01] border-white/5 overflow-hidden">
                                            <div className="p-8 flex items-center justify-between">
                                                <div className="flex items-center gap-5">
                                                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        <Globe className="size-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white tracking-tight">ComfyUI Endpoint</h3>
                                                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">Managed by env `COMFYUI_API_URL` (read-only here)</p>
                                                    </div>
                                                </div>
                                                <div className="flex-1 max-w-md ml-12">
                                                    <div className="relative group">
                                                        <Input
                                                            type="text"
                                                            placeholder="http://127.0.0.1:8188/"
                                                            value={comfyUrlFromEnv || comfyUrlDraft}
                                                            readOnly
                                                            disabled
                                                            className="bg-white/[0.02] border-white/5 h-12 rounded-xl transition-all px-4 font-mono text-sm opacity-80 cursor-not-allowed"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span className="text-[9px] font-bold text-zinc-600 uppercase">ENV</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>

                                    {/* Footer Action */}
                                    <div className="sticky bottom-8 flex justify-end pt-10">
                                        <Button
                                            onClick={handleSaveSettings}
                                            className="rounded-2xl px-10 h-14 bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-[0.2em] text-[10px] shadow-2xl transition-all hover:scale-105 active:scale-95"
                                        >
                                            Commit Configuration
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {currentTab === SettingsTab.MappingEditor && (
                                <div className="flex-1 min-h-0 w-full overflow-hidden">
                                    <MappingEditorPage />
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
