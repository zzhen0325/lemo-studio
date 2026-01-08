"use client";

import React from "react";
import {
    History,
    Palette,
    Layers,
    Settings,
    Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TabValue } from "./sidebar";
import SplitText from "../ui/split-text";

interface NewSidebarProps {
    currentTab: TabValue;
    onTabChange: (tab: TabValue) => void;
}

const navItems = [
    { label: "Playground", value: TabValue.Playground, icon: Palette },
    { label: "Explore", value: TabValue.Gallery, icon: History },
    { label: "Tools", value: TabValue.Tools, icon: Wand2 },
    { label: "Dataset", value: TabValue.DatasetManager, icon: Layers },
    { label: "Settings", value: TabValue.Settings, icon: Settings },
];

export function NewSidebar({ currentTab, onTabChange }: NewSidebarProps) {
    return (
        <header
            className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-8 select-none"
        >
            <div
                className="flex items-center cursor-pointer absolute top-4 left-6  hover:opacity-80 transition-opacity"
                onClick={() => {
                    onTabChange(TabValue.Playground);
                }}
            >
                <span className="text-white font-bold text-lg ">
                    LEMO STUDIO
                </span>
            </div>

            <nav className="flex items-center mx-auto space-x-1">
                {navItems.map((item) => {
                    const isActive = currentTab === item.value;

                    return (
                        <button
                            key={item.value}
                            onClick={() => {
                                onTabChange(item.value);
                            }}
                            className={cn(
                                "px-4 h-10 flex items-center transition-all relative group text-sm whitespace-nowrap",
                                isActive
                                    ? "text-white font-medium"
                                    : "text-white/60 hover:text-white"
                            )}
                        >
                            <SplitText
                                text={item.label}
                                className="text-sm"
                                delay={30}
                                duration={0.5}
                                animateOnHover={true}
                                tag="span"
                            />
                            {isActive && (
                                <span className="absolute bottom-1 left-4 right-4 h-[1px] bg-white/20 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="flex items-center gap-4">
                <div className="text-white/20 text-[10px] tracking-tight">
                    v0.2.0
                </div>
            </div>
        </header>
    );
}
