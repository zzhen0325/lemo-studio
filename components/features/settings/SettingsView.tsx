"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings as SettingsIcon,
    SquareTerminal,
    ChevronRight,
    Key,
    Globe,
    Languages,
    Sparkles,
    Cpu
} from "lucide-react";
import { REGISTRY } from "@/lib/ai/registry";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/common/use-toast";
import { SETTINGS_STORAGE_KEY } from "@/lib/constants";
import MappingEditorPage from "@/pages/mapping-editor-page";

enum SettingsTab {
    General = "general",
    MappingEditor = "mapping-editor"
}

export function SettingsView() {
    const [currentTab, setCurrentTab] = useState<SettingsTab>(SettingsTab.General);
    const { toast } = useToast();
    const [apiKey, setApiKey] = useState<string>("");
    const [deepseekApiKey, setDeepseekApiKey] = useState<string>("");
    const [doubaoApiKey, setDoubaoApiKey] = useState<string>("");
    const [doubaoModel, setDoubaoModel] = useState<string>("");
    const [comfyUrl, setComfyUrl] = useState<string>("");
    const [describeModel, setDescribeModel] = useState<string>("gemini-1.5-flash");
    const [translateModel, setTranslateModel] = useState<string>("doubao-pro-4k");
    const [optimizeModel, setOptimizeModel] = useState<string>("doubao-pro-4k");

    useEffect(() => {
        try {
            const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (stored) {
                const s = JSON.parse(stored);
                if (s.apiKey) setApiKey(s.apiKey);
                if (s.deepseekApiKey) setDeepseekApiKey(s.deepseekApiKey);
                if (s.doubaoApiKey) setDoubaoApiKey(s.doubaoApiKey);
                if (s.doubaoModel) setDoubaoModel(s.doubaoModel);
                if (s.comfyUrl) setComfyUrl(s.comfyUrl);
                if (s.describeModel) setDescribeModel(s.describeModel);
                if (s.translateModel) setTranslateModel(s.translateModel);
                if (s.optimizeModel) setOptimizeModel(s.optimizeModel);
            }
        } catch {
            // ignore
        }
    }, []);

    const handleSaveSettings = () => {
        try {
            const payload = {
                apiKey: apiKey.trim(),
                deepseekApiKey: deepseekApiKey.trim(),
                doubaoApiKey: doubaoApiKey.trim(),
                doubaoModel: doubaoModel.trim(),
                comfyUrl: comfyUrl.trim(),
                describeModel,
                translateModel,
                optimizeModel
            };
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
            toast({ title: "Configuration Saved", description: "All preferences have been updated successfully." });
        } catch (e) {
            toast({ title: "Save Failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
        }
    };

    const sidebarItems = [
        { id: SettingsTab.General, label: "General", description: "Service credentials & preferences", icon: SettingsIcon },
        { id: SettingsTab.MappingEditor, label: "Mapping Editor", description: "Node mapping configuration", icon: SquareTerminal },
    ];

    return (
        <div className="flex h-full pt-20 w-full overflow-hidden  text-zinc-100"
            style={{
                background: "linear-gradient(180deg,  #131718 0%, #1079BB 150%)",
            }}>
            {/* Sidebar */}
            <aside className="w-72  flex flex-col bg-black/0">
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
                            {currentTab === SettingsTab.General && (
                                <div className="space-y-10 pb-20">
                                    <div className="space-y-2">
                                        <h1 className="text-3xl font-bold tracking-tight text-white">General Settings</h1>
                                        <p className="text-zinc-400 text-sm max-w-2xl">
                                            Manage your API credentials and configure global service providers for AI features.
                                        </p>
                                    </div>

                                    <div className="grid gap-8">
                                        {/* API Credentials Section */}
                                        <section className="space-y-4">
                                            <div className="flex items-center gap-2 text-white/80 font-medium pb-2 border-b border-white/5">
                                                <Key className="size-4 text-emerald-500" />
                                                <h3>API Credentials</h3>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Card className="bg-black/40 border-white/10 hover:bg-black/5 transition-colors">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-medium text-white">Google Gemini</CardTitle>
                                                        <CardDescription className="text-xs text-zinc-500">Required for advanced vision capabilities</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <Input
                                                            type="password"
                                                            placeholder="AIzaSy..."
                                                            value={apiKey}
                                                            onChange={(e) => setApiKey(e.target.value)}
                                                            className="bg-black/40 border-white/5 text-white/90 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                                        />
                                                    </CardContent>
                                                </Card>

                                                <Card className="bg-black/40 border-white/5 hover:bg-black/5 transition-colors">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-medium text-white">DeepSeek</CardTitle>
                                                        <CardDescription className="text-xs text-zinc-500">Required for reasoning tasks</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <Input
                                                            type="password"
                                                            placeholder="sk-..."
                                                            value={deepseekApiKey}
                                                            onChange={(e) => setDeepseekApiKey(e.target.value)}
                                                            className="bg-black/40 border-white/5 text-white/90 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                                        />
                                                    </CardContent>
                                                </Card>

                                                <Card className="bg-black/40 border-white/5 hover:bg-black/5 transition-colors md:col-span-2">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-medium text-white">Doubao / Volcengine</CardTitle>
                                                        <CardDescription className="text-xs text-zinc-500">Configure Volcengine credentials for translation and specialized models</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-zinc-400">API Key</Label>
                                                            <Input
                                                                type="password"
                                                                placeholder="Volcengine API Key"
                                                                value={doubaoApiKey}
                                                                onChange={(e) => setDoubaoApiKey(e.target.value)}
                                                                className="bg-black/40 border-white/5 text-white/90 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-zinc-400">Model Endpoint ID</Label>
                                                            <Input
                                                                type="text"
                                                                placeholder="ep-2024..."
                                                                value={doubaoModel}
                                                                onChange={(e) => setDoubaoModel(e.target.value)}
                                                                className="bg-black/40 border-white/5 text-white/90 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                                            />
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </section>

                                        {/* Services Section */}
                                        <section className="space-y-4">
                                            <div className="flex items-center gap-2 text-white/80 font-medium pb-2 border-b border-white/5">
                                                <Cpu className="size-4 text-blue-500" />
                                                <h3>Service Providers</h3>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                <Card className="bg-black/40 border-white/5">
                                                    <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        <div className="space-y-3">
                                                            <Label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                                                <SettingsIcon className="size-3" /> Description Provider
                                                            </Label>
                                                            <Select value={describeModel} onValueChange={setDescribeModel}>
                                                                <SelectTrigger className="bg-black/40 border-white/5 text-white/90 h-10 w-full hover:bg-black/60 focus:ring-emerald-500/20">
                                                                    <SelectValue placeholder="Select Model" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-zinc-950 border-white/10 text-zinc-200">
                                                                    {REGISTRY.filter(m => m.task.includes('vision')).map(model => (
                                                                        <SelectItem key={model.id} value={model.id}>{model.id}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <Label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                                                <Languages className="size-3" /> Translation Provider
                                                            </Label>
                                                            <Select value={translateModel} onValueChange={setTranslateModel}>
                                                                <SelectTrigger className="bg-black/40 border-white/5 text-white/90 h-10 w-full hover:bg-black/60 focus:ring-emerald-500/20">
                                                                    <SelectValue placeholder="Select Model" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-zinc-950 border-white/10 text-zinc-200">
                                                                    {REGISTRY.filter(m => m.task.includes('text')).map(model => (
                                                                        <SelectItem key={model.id} value={model.id}>{model.id}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <Label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                                                <Sparkles className="size-3" /> Optimization Provider
                                                            </Label>
                                                            <Select value={optimizeModel} onValueChange={setOptimizeModel}>
                                                                <SelectTrigger className="bg-black/40 border-white/5 text-white/90 h-10 w-full hover:bg-black/60 focus:ring-emerald-500/20">
                                                                    <SelectValue placeholder="Select Model" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-zinc-950 border-white/10 text-zinc-200">
                                                                    {REGISTRY.filter(m => m.task.includes('text')).map(model => (
                                                                        <SelectItem key={model.id} value={model.id}>{model.id}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </CardContent>
                                                    <CardContent className="p-6 pt-0 border-t border-white/5 mt-4">
                                                        <div className="mt-4 space-y-3">
                                                            <Label htmlFor="comfyUrl" className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                                                <Globe className="size-3" /> ComfyUI Server Address
                                                            </Label>
                                                            <Input
                                                                id="comfyUrl"
                                                                type="text"
                                                                placeholder="e.g. http://127.0.0.1:8188/"
                                                                value={comfyUrl}
                                                                onChange={(e) => setComfyUrl(e.target.value)}
                                                                className="bg-black/40 border-white/5 text-white/90 placeholder:text-zinc-600 font-mono text-sm focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                                            />
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Footer Action */}
                                    <div className="sticky bottom-6 flex justify-end">
                                        <Button
                                            onClick={handleSaveSettings}
                                            className="rounded-full px-8 h-12 bg-white text-black hover:bg-white/90 font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                                        >
                                            Save Changes
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
        </div>
    );
}
