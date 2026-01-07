"use client"
import { TabValue, TabContext, } from "@/components/layout/sidebar";
import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";


// 动态导入核心视图
const PlaygroundV2Page = dynamic(() => import("@/pages/playground").then(m => m.PlaygroundV2Page), {
    loading: () => <div className="flex items-center justify-center h-full text-white">Loading Playground...</div>,
    ssr: false
});

const GalleryView = dynamic(() => import("@/components/features/playground-v2/GalleryView"), {
    loading: () => <div className="flex items-center justify-center h-full text-white">Loading Gallery...</div>,
    ssr: false
});

const DatasetManagerView = dynamic(() => import("@/components/features/dataset/DatasetManagerView"), {
    loading: () => <div className="flex items-center justify-center h-full text-white">Loading Dataset Manager...</div>,
    ssr: false
});

const SettingsView = dynamic(() => import("@/components/features/settings/SettingsView").then(m => m.SettingsView), {
    loading: () => <div className="flex items-center justify-center h-full text-white">Loading Settings...</div>,
    ssr: false
});

const ToolsView = dynamic(() => import("@/components/features/tools/ToolsView"), {
    loading: () => <div className="flex items-center justify-center h-full text-white">Loading Tools...</div>,
    ssr: false
});


import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import { NewSidebar } from "@/components/layout/NewSidebar";
import { usePlaygroundStore } from "@/lib/store/playground-store";


export default function Page() {
    const [currentTab, setCurrentTab] = useState<TabValue>(TabValue.Playground);

    const [deployWindow, setDeployWindow] = useState<boolean>(false);

    // const timelineRef = useRef<gsap.core.Timeline | null>(null);

    useEffect(() => {
        const parseHash = () => {
            const h = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as TabValue;
            if (h && Object.values(TabValue).includes(h)) {
                setCurrentTab(h);
            }
        };
        parseHash();
        const handler = () => parseHash();
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
    }, []);

    const setHasGenerated = usePlaygroundStore(s => s.setHasGenerated);
    const hasGenerated = usePlaygroundStore(s => s.hasGenerated);

    const handleTabChange = (tab: TabValue) => {
        if (tab === TabValue.History) {
            setCurrentTab(TabValue.History);
            setHasGenerated(true);
            if (typeof window !== 'undefined') {
                window.location.hash = TabValue.History;
            }
            return;
        }

        if (tab === TabValue.Playground) {
            setHasGenerated(false);
            usePlaygroundStore.getState().setShowHistory(false);
        }

        setCurrentTab(tab);
        if (typeof window !== 'undefined') {
            window.location.hash = tab as string;
        }
    };

    const handleBackgroundAnimate = () => {
        setHasGenerated(true);
    };

    const handleEditMapping = (workflow: IViewComfy) => {
        localStorage.setItem("MAPPING_EDITOR_INITIAL_WORKFLOW", JSON.stringify(workflow));
        handleTabChange(TabValue.MappingEditor);
    };

    /* useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;
  
        if (isBackgroundOut) return; // 动画在外面或正在执行动画时禁用视差
  
        const duration = 0.1;
        const ease = "power2.out";
  
        if (cloudRef.current) gsap.to(cloudRef.current, { x: x * 25, y: y * 25, duration, ease });
        if (treeRef.current) gsap.to(treeRef.current, { x: x * 15, y: y * 15, duration, ease });
        if (dogRef.current) gsap.to(dogRef.current, { x: x * 35, y: y * 35, duration, ease });
        if (manRef.current) gsap.to(manRef.current, { x: x * 40, y: y * 40, duration, ease });
        if (frontRef.current) gsap.to(frontRef.current, { x: x * 50, y: y * 50, duration, ease });
      };
      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isBackgroundOut]); */


    return (
        <TabContext.Provider value={{ currentTab, setCurrentTab: handleTabChange, deployWindow, setDeployWindow }}>
            <div className={cn(
                "flex flex-col h-screen w-screen overflow-hidden text-neutral-200 selection:bg-indigo-500/30 relative transition-all duration-700",
                hasGenerated ? "bg-black" : "bg-black"
            )}>
                <NewSidebar currentTab={currentTab} onTabChange={handleTabChange} />

                <main className="flex-1 relative h-full flex flex-col overflow-hidden w-full mx-auto">
                    <div className="flex flex-col flex-1 h-full overflow-hidden transition-all duration-500">

                        {/* Playground Tab */}
                        {(currentTab === TabValue.Playground || currentTab === TabValue.ByteArtist || currentTab === TabValue.History) && (
                            <div className="flex flex-col flex-1 h-full overflow-hidden">
                                <Suspense fallback={<div className="flex items-center justify-center h-full text-white">Loading Playground...</div>}>
                                    <PlaygroundV2Page
                                        onEditMapping={handleEditMapping}
                                        onGenerate={() => handleBackgroundAnimate()}
                                    />
                                </Suspense>
                            </div>
                        )}



                        {/* Gallery Tab */}
                        {currentTab === TabValue.Gallery && (
                            <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
                                <Suspense fallback={<div className="flex items-center justify-center h-full text-white">Loading Gallery...</div>}>
                                    <GalleryView variant="full" />
                                </Suspense>
                            </div>
                        )}


                        {/* Settings Tab */}
                        {currentTab === TabValue.Settings && (
                            <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
                                <Suspense fallback={<div className="flex items-center justify-center h-full text-white">Loading Settings...</div>}>
                                    <SettingsView />
                                </Suspense>
                            </div>
                        )}


                        {/* Dataset Manager Tab */}
                        {currentTab === TabValue.DatasetManager && (
                            <div className="flex flex-col flex-1 h-full w-full overflow-hidden animate-in fade-in duration-500">
                                <Suspense fallback={<div className="flex items-center justify-center h-full text-white">Loading Dataset...</div>}>
                                    <DatasetManagerView />
                                </Suspense>
                            </div>
                        )}


                        {/* Tools Tab */}
                        {currentTab === TabValue.Tools && (
                            <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
                                <Suspense fallback={<div className="flex items-center justify-center h-full text-white">Loading Tools...</div>}>
                                    <ToolsView />
                                </Suspense>
                            </div>
                        )}

                    </div>


                </main>
            </div>
        </TabContext.Provider>
    );
}
