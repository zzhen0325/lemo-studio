"use client";

import React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Server, Cloud, Cpu, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { APIProviderConfig, ProviderType } from "@/lib/api-config/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages, MoreVertical } from "lucide-react";

interface ProviderCardProps {
    provider: APIProviderConfig;
    onEdit: (provider: APIProviderConfig) => void;
    onDelete: (id: string) => void;
    onToggleEnabled: (id: string, enabled: boolean) => void;
}

const providerIcons: Record<ProviderType, React.ReactNode> = {
    'openai-compatible': <Server className="size-5" />,
    'google-genai': <Cloud className="size-5" />,
    'bytedance-afr': <Cpu className="size-5" />,
    'google-translate': <Languages className="size-5" />,
    'coze-image': <Cloud className="size-5" />,
    'coze-vision': <Cloud className="size-5" />,
    'workflow-local': <Workflow className="size-5" />
};

const providerColors: Record<ProviderType, string> = {
    'openai-compatible': 'bg-[#C8F88D]/15 text-[#C8F88D] border-[#C8F88D]/30',
    'google-genai': 'bg-[#C8F88D]/15 text-[#C8F88D] border-[#C8F88D]/30',
    'bytedance-afr': 'bg-zinc-700/50 text-zinc-200 border-zinc-500/40',
    'google-translate': 'bg-[#C8F88D]/15 text-[#C8F88D] border-[#C8F88D]/30',
    'coze-image': 'bg-zinc-700/50 text-zinc-200 border-zinc-500/40',
    'coze-vision': 'bg-zinc-700/50 text-zinc-200 border-zinc-500/40',
    'workflow-local': 'bg-[#C8F88D]/15 text-[#C8F88D] border-[#C8F88D]/30'
};

const providerLabels: Record<ProviderType, string> = {
    'openai-compatible': 'OpenAI Compatible',
    'google-genai': 'Google GenAI',
    'bytedance-afr': 'Bytedance AFR',
    'google-translate': 'Google Translate',
    'coze-image': 'Coze Image',
    'coze-vision': 'Coze Vision',
    'workflow-local': 'Workflow Local'
};

function resolveProviderType(type: string): ProviderType {
    if (type in providerLabels) {
        return type as ProviderType;
    }
    return 'openai-compatible';
}

export function ProviderCard({ provider, onEdit, onDelete, onToggleEnabled }: ProviderCardProps) {
    const modelCount = provider.models.length;
    const hasApiKey = !!provider.apiKey;
    const resolvedProviderType = resolveProviderType(provider.providerType);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                "group relative p-4 rounded-xl border transition-all duration-200",
                provider.isEnabled
                    ? "bg-[#2C2D2F] border-[#4A4C4D] hover:border-[#C8F88D]/40"
                    : "bg-[#1C1C1C] border-[#4A4C4D]/70 opacity-60"
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Provider Type Icon */}
                    <div className={cn(
                        "p-2.5 rounded-lg border",
                        providerColors[resolvedProviderType]
                    )}>
                        {providerIcons[resolvedProviderType]}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white truncate">
                            {provider.name}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {providerLabels[resolvedProviderType]}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Switch
                        checked={provider.isEnabled}
                        onCheckedChange={(checked) => onToggleEnabled(provider.id, checked)}
                        className="data-[state=checked]:bg-[#C8F88D]"
                    />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-zinc-400 hover:text-white hover:bg-[#1C1C1C]"
                            >
                                <MoreVertical className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#1C1C1C] border-[#4A4C4D]">
                            <DropdownMenuItem
                                onClick={() => onEdit(provider)}
                                className="text-zinc-300 hover:text-white focus:text-white cursor-pointer"
                            >
                                <Pencil className="size-4 mr-2" />
                                编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => onDelete(provider.id)}
                                className="text-red-400 hover:text-red-300 focus:text-red-300 cursor-pointer"
                            >
                                <Trash2 className="size-4 mr-2" />
                                删除
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Info */}
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                <div className="flex items-center gap-1.5">
                    <div className={cn(
                        "size-2 rounded-full",
                        hasApiKey ? "bg-[#C8F88D]" : "bg-amber-500"
                    )} />
                    <span>{hasApiKey ? "已配置API Key" : "未配置API Key"}</span>
                </div>
                <div>
                    {modelCount} 个模型
                </div>
            </div>

            {/* Model Tags */}
            {modelCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {provider.models.slice(0, 3).map((model) => (
                        <span
                            key={model.modelId}
                            className="px-2 py-0.5 text-[10px] bg-[#1C1C1C] border border-[#4A4C4D] text-zinc-300 rounded-md"
                        >
                            {model.displayName || model.modelId}
                        </span>
                    ))}
                    {modelCount > 3 && (
                        <span className="px-2 py-0.5 text-[10px] bg-[#1C1C1C] border border-[#4A4C4D] text-zinc-500 rounded-md">
                            +{modelCount - 3}
                        </span>
                    )}
                </div>
            )}
        </motion.div>
    );
}
