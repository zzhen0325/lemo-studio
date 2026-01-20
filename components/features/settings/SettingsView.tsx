"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
import MappingEditorPage from "@/pages/mapping-editor-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

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
        <div className="flex h-full w-full  pt-20 overflow-hidden text-zinc-100 relative"
         style={{
                background: "linear-gradient(180deg, #0F0F15 0%, #131718 30%, #1079BB 75%, #D8C6B8 100%)",
            }}>
         
            
            {/* Sidebar */}
            <aside className="w-72 flex flex-col bg-black/40 backdrop-blur-xl border-r border-white/5 z-10">
                
                
                <div className="px-4 flex-1 overflow-y-auto space-y-2 py-4">
                    {sidebarItems.map((item) => {
                        const isActive = currentTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setCurrentTab(item.id)}
                                className={cn(
                                    "flex items-center w-full px-4 py-3.5 rounded-2xl transition-all duration-300 group text-left relative overflow-hidden",
                                    isActive
                                        ? "bg-white/5 text-white shadow-lg border border-white/10"
                                        : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300 border border-transparent"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active-pill"
                                        className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-full"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <div className={cn(
                                    "p-2.5 rounded-xl mr-4 transition-all duration-300",
                                    isActive 
                                        ? "bg-primary/20 text-primary shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                                        : "bg-white/5 text-zinc-600 group-hover:text-zinc-400"
                                )}>
                                    <item.icon className="size-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "text-sm font-semibold transition-colors",
                                        isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                                    )}>{item.label}</div>
                                    <div className="text-[10px] text-zinc-600 truncate mt-0.5">{item.description}</div>
                                </div>
                                <ChevronRight className={cn(
                                    "size-3 transition-all duration-300",
                                    isActive ? "text-primary opacity-100 translate-x-0" : "text-zinc-700 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                                )} />
                            </button>
                        );
                    })}
                </div>

                <div className="p-6 mt-auto border-t border-white/5 bg-black/20">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Core Engine Active</span>
                    </div>
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 h-full overflow-hidden flex flex-col z-10">
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
                                    <div className="pt-10 border-t border-white/5">
                                        <Card className="bg-white/[0.01] border-white/5 overflow-hidden">
                                            <div className="p-8 flex items-center justify-between">
                                                <div className="flex items-center gap-5">
                                                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        <Globe className="size-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white tracking-tight">ComfyUI Endpoint</h3>
                                                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">Global ComfyUI server connection parameters</p>
                                                    </div>
                                                </div>
                                                <div className="flex-1 max-w-md ml-12">
                                                    <div className="relative group">
                                                        <Input
                                                            type="text"
                                                            placeholder="http://127.0.0.1:8188/"
                                                            value={settings.comfyUrl || ''}
                                                            onChange={(e) => updateSettings({ ...settings, comfyUrl: e.target.value })}
                                                            className="bg-white/[0.02] border-white/5 h-12 rounded-xl focus:ring-1 focus:ring-primary/20 transition-all px-4 font-mono text-sm"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span className="text-[9px] font-bold text-zinc-600 uppercase">Live</span>
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
