"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
    Box,
    ChevronDown,
    Download,
    Eye,
    Globe,
    Image as ImageIcon,
    Languages,
    Pencil,
    Plus,
    RefreshCw,
    Settings2,
    Tags,
    Wand2,
    Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useToast } from "@/hooks/common/use-toast";
import { useMediaQuery } from "@/hooks/common/use-media-query";
import { Badge } from "@/components/ui/badge";
import { useAPIConfigStore } from "@/lib/store/api-config-store";
import { SETTINGS_THEME_VARS } from "@/lib/theme/studio-theme";
import {
    APIProviderConfig,
    MODEL_CONTEXT_BY_SERVICE,
    ModelContext,
    ServiceType,
    SERVICE_METADATA,
    serviceSupportsSystemPrompt
} from "@/lib/api-config/types";
import { selectModelsForContext } from "@/lib/model-center";
import { getPublicComfyUrl } from "@/lib/env/public";
import { ProviderFormModal } from "./ProviderFormModal";

enum SettingsTab {
    Models = "models",
    MappingEditor = "mapping-editor"
}

const MappingEditorPage = dynamic(
    () => import("../../mapping-editor/_components/mapping-editor-page"),
    {
        loading: () => <div className="flex h-full min-h-[800px] items-center justify-center text-white">Loading Mapping Editor...</div>,
    }
);

const serviceIcons: Record<ServiceType, React.ReactNode> = {
    imageGeneration: <ImageIcon className="size-4" />,
    translate: <Languages className="size-4" />,
    describe: <Eye className="size-4" />,
    optimize: <Wand2 className="size-4" />,
    datasetLabel: <Tags className="size-4" />,
};

const serviceList: ServiceType[] = ['imageGeneration', 'optimize', 'describe', 'translate', 'datasetLabel'];

const contextLabelMap: Record<ModelContext, string> = {
    'playground': 'playground',
    'banner': 'banner',
    'infinite-canvas': 'infinity canvas',
    'service:imageGeneration': '系统图像生成',
    'service:describe': '系统图像描述',
    'service:optimize': '系统提示词优化',
    'service:datasetLabel': '系统训练集打标',
};

const providerTypeLabelMap: Record<string, string> = {
    'google-genai': 'google模型',
    'google-translate': 'Google Translate',
    'workflow-local': 'Comfyui模型',
    'bytedance-afr': 'byteartist模型',
    'coze-image': 'coze模型',
    'coze-vision': 'coze模型',
    'openai-compatible': 'OpenAI兼容模型',
};

const themeVars = SETTINGS_THEME_VARS;

export function SettingsView() {
    const [currentTab, setCurrentTab] = useState<SettingsTab>(SettingsTab.Models);
    const [expandedServices, setExpandedServices] = useState<Set<ServiceType>>(new Set(['optimize']));
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [comfyUrlDraft, setComfyUrlDraft] = useState("");
    const isDesktop = useMediaQuery("(min-width: 1440px)");
    const { toast } = useToast();
    const comfyUrlFromEnv = getPublicComfyUrl();
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<APIProviderConfig | null>(null);

    const {
        providers,
        settings,
        isLoading,
        fetchConfig,
        addProvider,
        updateProvider,
        removeProvider,
        updateSettings,
        updateServiceConfig,
        importProvidersFromFile,
        ensureBuiltinProviders,
    } = useAPIConfigStore();

    useEffect(() => {
        ensureBuiltinProviders();
        fetchConfig();
    }, [ensureBuiltinProviders, fetchConfig]);

    useEffect(() => {
        setComfyUrlDraft(comfyUrlFromEnv || settings.comfyUrl || "");
    }, [comfyUrlFromEnv, settings.comfyUrl]);

    const providerGroups = useMemo(() => {
        const image: APIProviderConfig[] = [];
        const text: APIProviderConfig[] = [];
        const other: APIProviderConfig[] = [];

        providers.forEach((provider) => {
            const models = provider.models || [];
            const hasImage = models.some((model) => model.status !== 'hidden' && model.task.includes('image'));
            const hasTextOrVision = models.some((model) => model.status !== 'hidden' && (model.task.includes('text') || model.task.includes('vision')));

            if (hasImage) {
                image.push(provider);
                return;
            }
            if (hasTextOrVision) {
                text.push(provider);
                return;
            }
            other.push(provider);
        });

        const sortByName = (a: APIProviderConfig, b: APIProviderConfig) => a.name.localeCompare(b.name);
        image.sort(sortByName);
        text.sort(sortByName);
        other.sort(sortByName);

        return { image, text, other };
    }, [providers]);

    const orderedProviders = useMemo(
        () => [...providerGroups.image, ...providerGroups.text, ...providerGroups.other],
        [providerGroups]
    );

    useEffect(() => {
        if (orderedProviders.length === 0) {
            setSelectedProviderId('');
            return;
        }
        if (!orderedProviders.some((provider) => provider.id === selectedProviderId)) {
            setSelectedProviderId(orderedProviders[0].id);
        }
    }, [orderedProviders, selectedProviderId]);

    const selectedProvider = useMemo(
        () => orderedProviders.find((provider) => provider.id === selectedProviderId) || null,
        [orderedProviders, selectedProviderId]
    );

    const selectedProviderModels = useMemo(() => {
        if (!selectedProvider) return [];
        return (selectedProvider.models || [])
            .filter((model) => model.status !== 'hidden')
            .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    }, [selectedProvider]);

    const sidebarItems = [
        {
            id: SettingsTab.Models,
            label: "Settings",
            icon: Settings2,
            description: "Manage model providers and services",
        },
        {
            id: SettingsTab.MappingEditor,
            label: "Workflow Mapper",
            icon: Box,
            description: "Map workflow input and output parameters",
        },
    ];

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

    const handleSaveProvider = async (providerData: Partial<APIProviderConfig>) => {
        if (providerData.id) {
            await updateProvider(providerData.id, providerData);
            toast({ title: "更新成功", description: "Provider 配置已更新" });
        } else {
            await addProvider(providerData);
            toast({ title: "创建成功", description: "新 Provider 已添加" });
        }
    };

    const handleEditSelectedProvider = () => {
        if (!selectedProvider) return;
        handleEditProvider(selectedProvider);
    };

    const handleAddModelToSelectedProvider = () => {
        if (!selectedProvider) {
            handleOpenAddProvider();
            return;
        }
        const providerDraft: APIProviderConfig = {
            ...selectedProvider,
            models: [
                ...(selectedProvider.models || []),
                {
                    modelId: '',
                    displayName: '',
                    task: ['image'],
                    contexts: ['playground', 'infinite-canvas'],
                    status: 'active',
                    priority: 100,
                }
            ],
        };
        setEditingProvider(providerDraft);
        setIsFormModalOpen(true);
    };

    const handleEditModelInSelectedProvider = (modelId: string) => {
        if (!selectedProvider) return;
        const models = selectedProvider.models || [];
        const highlighted = models.find((model) => model.modelId === modelId);
        if (!highlighted) {
            handleEditSelectedProvider();
            return;
        }
        const reorderedModels = [highlighted, ...models.filter((model) => model.modelId !== modelId)];
        setEditingProvider({
            ...selectedProvider,
            models: reorderedModels,
        });
        setIsFormModalOpen(true);
    };

    const handleImportProviders = async () => {
        try {
            await importProvidersFromFile();
            toast({ title: "导入成功", description: "已从 data/api-config/providers.json 导入 Provider 与模型" });
        } catch {
            toast({ title: "导入失败", description: "请检查 providers.json 与服务日志", variant: "destructive" });
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
        setExpandedServices((prev) => {
            const next = new Set(prev);
            if (next.has(service)) next.delete(service);
            else next.add(service);
            return next;
        });
    };

    const getModelsForService = (serviceType: ServiceType) => {
        const meta = SERVICE_METADATA[serviceType];
        const requiredContext = MODEL_CONTEXT_BY_SERVICE[serviceType];
        let options = requiredContext
            ? selectModelsForContext(providers, requiredContext, { requiredTask: meta.requiredTask })
            : [];

        if (serviceType === 'translate') {
            const translatePreferred = options.filter((item) =>
                item.providerType === 'google-translate' || item.modelId.includes('doubao')
            );
            options = translatePreferred.length > 0 ? translatePreferred : options;
        }

        return options.map((option) => ({
            providerId: option.providerId,
            providerName: option.providerName,
            modelId: option.modelId,
            displayName: option.displayName || option.modelId,
        }));
    };

    return (
        <div
            className="flex flex-col h-full w-full pt-20 overflow-hidden bg-[#0a0a0a] text-[#fafafa] relative"
            style={themeVars}
        >
            {/* Dock Sidebar */}
            <div
                className={cn(
                    "z-[60] transition-all duration-300",
                    isDesktop
                        ? "absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4"
                        : "relative top-0 flex flex-row justify-center gap-8 mb-4 w-full pt-2"
                )}
            >
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
                                        ? "bg-primary/20 text-primary border border-primary/35 hover:bg-primary/25 hover:border-primary/45 hover:scale-105"
                                        : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:scale-110"
                                )}
                                onClick={() => setCurrentTab(item.id)}
                            />
                            <span
                                className={cn(
                                    "text-[10px] transition-colors duration-200",
                                    isActive ? "text-primary font-medium" : "text-zinc-500"
                                )}
                            >
                                {item.label === "Workflow Mapper" ? "Mapper" : item.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Content Area */}
            <main
                className={cn(
                    "flex-1 h-full overflow-hidden flex flex-col z-10 transition-all duration-300",
                    isDesktop ? "pl-32" : "pl-0"
                )}
            >
                <div
                    className={cn(
                        "flex-1 flex flex-col min-h-0",
                        currentTab !== SettingsTab.MappingEditor && "overflow-y-auto custom-scrollbar"
                    )}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                "max-w-[1020px] mx-auto min-h-[900px] flex-1 w-full pb-[160px]",
                                currentTab === SettingsTab.Models ? "px-6 md:px-10 pt-10" : "px-6 md:px-10 pt-6"
                            )}
                        >
                            {currentTab === SettingsTab.Models && (
                                <div className="space-y-12">
                                    <div className="flex items-center justify-between pb-4 border-b border-[#2e2e2e]">
                                        <h1 className="text-xl font-medium tracking-tight">Settings</h1>
                                    </div>

                                    {/* Providers & Models Section formatted like Model Access Control */}
                                    <section className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-[16px] font-medium text-white">Models & Providers</h2>
                                                <p className="text-[13px] text-zinc-400 mt-[2px]">
                                                    Manage your API Providers and configured models. Active providers are visible in workflows.
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => fetchConfig(true)}
                                                    disabled={isLoading}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-[34px] w-[34px] rounded-lg border border-[#2e2e2e] bg-[#1C1C1C] text-zinc-400 hover:text-white hover:bg-[#2a2a2a]"
                                                >
                                                    <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
                                                </Button>
                                                <Button
                                                    onClick={handleImportProviders}
                                                    disabled={isLoading}
                                                    className="h-[34px] px-3.5 rounded-lg border border-[#2e2e2e] bg-[#1C1C1C] text-zinc-300 hover:text-white hover:bg-[#2a2a2a] gap-2 text-[12px] font-medium"
                                                >
                                                    <Download className="size-[14px]" />
                                                    Import Config
                                                </Button>
                                                <Button
                                                    onClick={handleOpenAddProvider}
                                                    className="h-[34px] px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground gap-2 border-0 text-[12px] font-medium transition-colors"
                                                >
                                                    <Plus className="size-[14px]" />
                                                    Add Provider
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="bg-[#1C1C1C] border border-[#2e2e2e] rounded-[16px] overflow-hidden shadow-sm flex lg:flex-row flex-col min-h-[460px]">
                                            {/* Providers List (Left side of the card) */}
                                            <div className="w-full lg:w-[280px] border-r border-[#2e2e2e] bg-[#161616] flex flex-col pt-1">
                                                <div className="px-3 pb-3 pt-3 border-b border-[#2e2e2e]">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-[14px] text-zinc-500" />
                                                        <Input
                                                            placeholder="Search providers..."
                                                            className="h-8 pl-9 bg-[#1c1c1c] border-[#2e2e2e] text-[13px] rounded-lg focus-visible:ring-1 focus-visible:ring-primary/40"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[400px]">
                                                    {/* Image Group */}
                                                    {(providerGroups.image.length > 0 || providerGroups.text.length > 0) && (
                                                        [...providerGroups.image, ...providerGroups.text, ...providerGroups.other].map((provider) => {
                                                            const isSelected = provider.id === selectedProviderId;
                                                            return (
                                                                <button
                                                                    key={provider.id}
                                                                    onClick={() => setSelectedProviderId(provider.id)}
                                                                    className={cn(
                                                                        "w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between group",
                                                                        isSelected
                                                                            ? "bg-primary/10 text-white ring-1 ring-primary/20"
                                                                            : "text-zinc-400 hover:bg-[#222222] hover:text-zinc-200"
                                                                    )}
                                                                >
                                                                    <div className="overflow-hidden">
                                                                        <div className="text-[13px] font-medium truncate">{provider.name}</div>
                                                                        <div className="text-[11.5px] text-zinc-500 mt-0.5">{provider.models?.length || 0} models</div>
                                                                    </div>
                                                                    <div className={cn("size-2 rounded-full flex-shrink-0 border border-white/5", provider.isEnabled ? "bg-primary" : "bg-zinc-600")} />
                                                                </button>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            {/* Models List (Right side of the card, mimics the Access Control list) */}
                                            <div className="flex-1 flex flex-col bg-[#1C1C1C]">
                                                <div className="p-4 border-b border-[#2e2e2e] flex items-center justify-between bg-[#161616]/40">
                                                    <div>
                                                        <div className="text-[14px] font-medium text-white flex items-center gap-2">
                                                            <span>{selectedProvider?.name || 'Select a Provider'}</span>
                                                            {selectedProvider && (
                                                                <Badge variant="outline" className="border-[#2e2e2e] bg-[#222] text-[#A3A3A3] text-[10px] h-5 px-1.5 font-normal">
                                                                    {providerTypeLabelMap[String(selectedProvider.providerType)] || selectedProvider.providerType}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => selectedProvider && handleDeleteProvider(selectedProvider.id)}
                                                            disabled={!selectedProvider}
                                                            className="h-[28px] px-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[12px] font-medium"
                                                        >
                                                            Delete
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            onClick={handleEditSelectedProvider}
                                                            disabled={!selectedProvider}
                                                            className="h-[28px] px-3 rounded-lg border-[#3a3a3a] bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] transition-all text-[12px] font-medium"
                                                        >
                                                            Edit Provider
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex-1 overflow-y-auto">
                                                    {!selectedProvider && (
                                                        <div className="flex items-center justify-center h-[300px] text-[13px] text-zinc-500">
                                                            Select a provider on the left to manage models
                                                        </div>
                                                    )}
                                                    {selectedProvider && selectedProviderModels.length === 0 && (
                                                        <div className="flex flex-col items-center justify-center h-[300px] gap-3">
                                                            <div className="text-[13px] text-zinc-500">No models configured.</div>
                                                            <Button
                                                                onClick={handleAddModelToSelectedProvider}
                                                                className="h-[30px] px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-medium border-0"
                                                            >
                                                                Add first model
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {selectedProvider && selectedProviderModels.length > 0 && (
                                                        <div className="flex flex-col">
                                                            {selectedProviderModels.map((model) => (
                                                                <div key={model.modelId} className="flex items-center justify-between py-[18px] px-5 border-b border-[#2e2e2e] last:border-0 hover:bg-white/[0.02] transition-colors group">
                                                                    <div className="flex-1 pr-4">
                                                                        <div className="text-[13.5px] font-medium text-white mb-1 leading-snug">{model.displayName || model.modelId}</div>
                                                                        <div className="text-[12.5px] text-[#A3A3A3] leading-relaxed">
                                                                            {model.task.map(t => t.toUpperCase()).join(' • ')} • {(model.contexts || []).map(c => contextLabelMap[c] || c).join(', ')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4 shrink-0">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleEditModelInSelectedProvider(model.modelId)}
                                                                            className="h-7 px-3 text-[12px] rounded-lg opacity-0 group-hover:opacity-100 bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] transition-all"
                                                                        >
                                                                            <Pencil className="size-3 mr-1.5" />
                                                                            Edit
                                                                        </Button>
                                                                        {/* Mock Toggle exactly like the image - Green when active */}
                                                                        <div className={cn(
                                                                            "w-10 h-6 rounded-full flex items-center px-[2px] cursor-pointer relative shrink-0 transition-colors shadow-inner",
                                                                            model.status === 'active' ? "bg-primary" : "bg-[#2e2e2e]"
                                                                        )}>
                                                                            <div className={cn(
                                                                                "w-[20px] h-[20px] rounded-full bg-white transition-transform drop-shadow-sm",
                                                                                model.status === 'active' ? "translate-x-4" : "translate-x-0"
                                                                            )} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <div className="p-4 border-t border-[#2e2e2e] bg-[#161616]/40">
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={handleAddModelToSelectedProvider}
                                                                    className="w-full h-9 border-dashed border-[#3a3a3a] bg-transparent text-zinc-400 hover:text-white hover:border-primary/50 hover:bg-primary/5 rounded-xl text-[12.5px]"
                                                                >
                                                                    <Plus className="size-3.5 mr-2" />
                                                                    Add Another Model
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* System Services exactly matching style */}
                                    <section className="space-y-4">
                                        <div>
                                            <h2 className="text-[16px] font-medium text-white">System Services</h2>
                                            <p className="text-[13px] text-zinc-400 mt-[2px]">
                                                Bind default models to system tasks. Extra instruction prompts appear only when the current model supports them.
                                            </p>
                                        </div>

                                        <div className="bg-[#1C1C1C] border border-[#2e2e2e] rounded-[16px] overflow-hidden shadow-sm">
                                            <div className="p-4 border-b border-[#2e2e2e] bg-[#161616]/40">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                                                    <Input
                                                        placeholder="Search services by name or function..."
                                                        className="pl-9 h-8 bg-[#1c1c1c] border-[#2e2e2e] text-[13px] rounded-lg focus-visible:ring-1 focus-visible:ring-primary/40"
                                                    />
                                                </div>
                                            </div>

                                            <div className="divide-y divide-[#2e2e2e]">
                                                {serviceList.map((serviceType) => {
                                                    const meta = SERVICE_METADATA[serviceType];
                                                    const isExpanded = expandedServices.has(serviceType);
                                                    const serviceConfig = settings.services?.[serviceType];
                                                    const serviceSystemPrompt = serviceConfig && 'systemPrompt' in serviceConfig
                                                        ? serviceConfig.systemPrompt
                                                        : '';
                                                    const showSystemPrompt = serviceSupportsSystemPrompt(serviceType, serviceConfig?.binding);
                                                    const usesManagedPrompt = !showSystemPrompt
                                                        && (serviceType === 'describe' || serviceType === 'optimize')
                                                        && serviceConfig?.binding?.modelId === 'coze-prompt';
                                                    const models = getModelsForService(serviceType);
                                                    const currentValue = serviceConfig?.binding
                                                        ? `${serviceConfig.binding.providerId}:${serviceConfig.binding.modelId}`
                                                        : '';

                                                    return (
                                                        <Collapsible
                                                            key={serviceType}
                                                            open={isExpanded}
                                                            onOpenChange={() => toggleServiceExpanded(serviceType)}
                                                        >
                                                            <CollapsibleTrigger asChild>
                                                                <div className="flex items-center justify-between py-[18px] px-5 cursor-pointer hover:bg-white/[0.02] transition-colors">
                                                                    <div>
                                                                        <div className="text-[13.5px] font-medium text-white flex items-center gap-2 mb-1">
                                                                            <div className="text-primary">{serviceIcons[serviceType]}</div>
                                                                            {meta.label}
                                                                        </div>
                                                                        <div className="text-[12.5px] text-[#A3A3A3] leading-snug pl-6">
                                                                            {meta.description}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="text-[12px] text-zinc-400 font-medium bg-[#161616] px-2 py-1 rounded-md border border-[#2e2e2e]">
                                                                            {serviceConfig?.binding?.modelId || 'Not Bound'}
                                                                        </span>
                                                                        <ChevronDown className={cn("size-4 text-zinc-500 transition-transform", isExpanded && "rotate-180")} />
                                                                    </div>
                                                                </div>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent>
                                                                <div className="px-5 pb-6 pt-2 pl-12 space-y-5 bg-[#161616]/30 border-t border-[#2e2e2e]/50">
                                                                    <div className="space-y-2 max-w-xl mt-4">
                                                                        <Label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Model Binding</Label>
                                                                        <Select
                                                                            value={currentValue}
                                                                            onValueChange={(val) => {
                                                                                const [providerId, modelId] = val.split(':');
                                                                                updateServiceConfig(serviceType, { binding: { providerId, modelId } });
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-[36px] rounded-lg bg-[#1a1a1a] border-[#2e2e2e] text-[13px] hover:bg-[#222]">
                                                                                <SelectValue placeholder="Select a model" />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="bg-[#1C1C1C] border-[#2e2e2e] rounded-xl shadow-xl">
                                                                                {models.map((m) => (
                                                                                    <SelectItem key={`${m.providerId}:${m.modelId}`} value={`${m.providerId}:${m.modelId}`} className="text-[13px]">
                                                                                        {m.providerName} / {m.displayName}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    {serviceType === 'datasetLabel' && (
                                                                        <p className="text-[12px] text-zinc-500">
                                                                            System prompts are configured directly in the dataset page.
                                                                        </p>
                                                                    )}

                                                                    {usesManagedPrompt && (
                                                                        <p className="text-[12px] text-zinc-500">
                                                                            Current binding uses Coze Prompt. No extra system prompt is needed here.
                                                                        </p>
                                                                    )}

                                                                    {showSystemPrompt && (
                                                                        <div className="space-y-2 max-w-2xl">
                                                                            <Label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Instruction Prompt</Label>
                                                                            <Textarea
                                                                                value={serviceSystemPrompt || ''}
                                                                                onChange={(e) => updateServiceConfig(serviceType, { systemPrompt: e.target.value })}
                                                                                className="min-h-[140px] rounded-xl bg-[#1a1a1a] border-[#2e2e2e] text-[13px] text-zinc-300 leading-relaxed focus-visible:ring-1 focus-visible:ring-primary/40 resize-none p-4 custom-scrollbar"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </section>

                                    {/* Advanced Settings */}
                                    <section className="space-y-4">
                                        <h2 className="text-[16px] font-medium text-white">Advanced</h2>
                                        <div className="bg-[#1C1C1C] border border-[#2e2e2e] rounded-[16px] overflow-hidden shadow-sm">
                                            <div className="flex items-center justify-between py-[18px] px-5">
                                                <div>
                                                    <div className="text-[13.5px] font-medium text-white flex items-center gap-2 mb-1">
                                                        <Globe className="size-4 text-primary" />
                                                        ComfyUI Endpoint
                                                    </div>
                                                    <div className="text-[12.5px] text-zinc-400 pl-6">
                                                        Browser direct mode uses env `NEXT_PUBLIC_COMFYUI_URL` (read-only in this environment)
                                                    </div>
                                                </div>
                                                <div className="w-[300px]">
                                                    <Input
                                                        type="text"
                                                        value={comfyUrlFromEnv || comfyUrlDraft}
                                                        readOnly
                                                        disabled
                                                        className="bg-[#161616] border-[#2e2e2e] text-zinc-500 h-[34px] rounded-lg text-[13px] font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="h-10" /> {/* Spacer */}
                                </div>
                            )}

                            {currentTab === SettingsTab.MappingEditor && (
                                <div className="min-h-[800px] bg-[#1C1C1C] border border-[#2e2e2e] rounded-2xl overflow-hidden mt-2 border-t">
                                    <MappingEditorPage />
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Save Block overlay */}
                    {currentTab === SettingsTab.Models && (
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "fixed bottom-0 right-0 p-6 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/95 to-transparent pointer-events-none flex justify-end z-[50]",
                                isDesktop ? "left-[128px]" : "left-0"
                            )}
                        >
                            <Button
                                onClick={handleSaveSettings}
                                className="pointer-events-auto rounded-xl px-10 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13.5px] transition-all border border-primary"
                            >
                                Save Settings
                            </Button>
                        </motion.div>
                    )}
                </div>
            </main>

            <ProviderFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSave={handleSaveProvider}
                provider={editingProvider}
            />
        </div>
    );
}
