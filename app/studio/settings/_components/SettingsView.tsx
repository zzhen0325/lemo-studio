"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
    Box,
    Globe,
    Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useMediaQuery } from "@/hooks/common/use-media-query";
import { useToast } from "@/hooks/common/use-toast";
import { SETTINGS_THEME_VARS } from "@/lib/theme/studio-theme";
import { getPublicComfyUrl } from "@/lib/env/public";

enum SettingsTab {
    Settings = "settings",
    MappingEditor = "mapping-editor"
}

const MappingEditorPage = dynamic(
    () => import("../../mapping-editor/_components/mapping-editor-page"),
    {
        loading: () => <div className="flex h-full min-h-[800px] items-center justify-center text-white">Loading Mapping Editor...</div>,
    }
);

const themeVars = SETTINGS_THEME_VARS;

export function SettingsView() {
    const [currentTab, setCurrentTab] = React.useState<SettingsTab>(SettingsTab.Settings);
    const isDesktop = useMediaQuery("(min-width: 1440px)");
    const { toast } = useToast();
    const comfyUrlFromEnv = getPublicComfyUrl();

    const sidebarItems = [
        {
            id: SettingsTab.Settings,
            label: "Settings",
            icon: Settings2,
            description: "Application settings",
        },
        {
            id: SettingsTab.MappingEditor,
            label: "Workflow Mapper",
            icon: Box,
            description: "Map workflow input and output parameters",
        },
    ];

    const handleSaveSettings = async () => {
        toast({ title: "保存成功", description: "设置已更新" });
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
                                "max-w-[1020px] mx-auto min-h-[400px] flex-1 w-full pb-[160px]",
                                currentTab === SettingsTab.Settings ? "px-6 md:px-10 pt-10" : "px-6 md:px-10 pt-6"
                            )}
                        >
                            {currentTab === SettingsTab.Settings && (
                                <div className="space-y-12">
                                    <div className="flex items-center justify-between pb-4 border-b border-[#2e2e2e]">
                                        <h1 className="text-xl font-medium tracking-tight">Settings</h1>
                                    </div>

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
                                                        value={comfyUrlFromEnv || ""}
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
                    {currentTab === SettingsTab.Settings && (
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
        </div>
    );
}
