"use client";

import React, { useState } from "react";
import {
    Palette,
    Layers,
    Settings,
    Wand2,
    User as UserIcon,
    ChevronDown,
    LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TabValue } from "./sidebar";
import SplitText from "../ui/split-text";
import { observer } from "mobx-react-lite";
import { userStore } from "@/lib/store/user-store";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AuthDialog } from "../features/auth/AuthDialog";
import { UserProfileDialog } from "../features/auth/UserProfileDialog";
import Image from "next/image";
import { Button } from "@/components/ui/button";

import { usePlaygroundStore } from "@/lib/store/playground-store";

interface NewSidebarProps {
    currentTab: TabValue;
    onTabChange: (tab: TabValue) => void;
}

const navItems = [
    { label: "Playground", value: TabValue.Playground, icon: Palette },
    { label: "Tools", value: TabValue.Tools, icon: Wand2 },
    { label: "Dataset", value: TabValue.DatasetManager, icon: Layers },
    { label: "Settings", value: TabValue.Settings, icon: Settings },
];

export const NewSidebar = observer(({ currentTab, onTabChange }: NewSidebarProps) => {
    const [authOpen, setAuthOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const { setViewMode } = usePlaygroundStore();

    return (
        <header
            className="fixed top-2 px-10 left-0 right-0 h-14 z-50 flex items-center justify-between  select-none"
        >
            <div
                className="flex items-center cursor-pointer  hover:opacity-80 transition-opacity"
                onClick={() => {
                    onTabChange(TabValue.Playground);
                    setViewMode('home');
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

                {/* Tldraw Beta Entry */}
                {/* <button
                    onClick={() => setTldrawEditorOpen(true)}
                    className="ml-4 px-3 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all flex items-center gap-2 group"
                >
                    <Wand2 className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Tldraw Beta</span>
                </button> */}
            </nav>

            <div className="flex items-center ">
                {userStore.currentUser ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger className="outline-none">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/10">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden">
                                    {userStore.currentUser.avatar ? (
                                        <Image
                                            src={userStore.currentUser.avatar}
                                            alt={userStore.currentUser.name}
                                            width={20}
                                            height={20}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-[10px] font-bold text-white">
                                            {userStore.currentUser.name.charAt(0)}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-white/80">{userStore.currentUser.name}</span>
                                <ChevronDown className="w-3 h-3 text-white/50" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-black/90 border-white/10 backdrop-blur-xl text-white">
                            <div className="px-2 py-1.5 text-xs text-white/50 font-medium">
                                Signed in as <br />
                                <span className="text-white font-bold truncate block">{userStore.currentUser.name}</span>
                            </div>
                            <DropdownMenuSeparator className="bg-white/10" />

                            <DropdownMenuItem
                                onClick={() => setProfileOpen(true)}
                                className="cursor-pointer focus:bg-white/10 focus:text-white"
                            >
                                <UserIcon className="w-4 h-4 mr-2" />
                                <span>Profile Settings</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-white/10" />

                            <DropdownMenuItem
                                onClick={() => userStore.logout()}
                                className="cursor-pointer focus:bg-white/10 focus:text-red-400 text-red-400"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <Button
                        onClick={() => setAuthOpen(true)}
                        variant="ghost"
                        size="sm"
                        className="text-white/80 hover:text-white hover:bg-white/10"
                    >
                        Sign In
                    </Button>
                )}


            </div>

            <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
            <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        </header>
    );
});
