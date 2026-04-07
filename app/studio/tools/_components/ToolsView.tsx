"use client";

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Video, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import WebGLRenderer from './WebGLRenderer';
import ParameterPanel from './ParameterPanel';
import { WEBGL_TOOLS, WebGLToolConfig } from './tool-configs';
import { useToast } from "@/hooks/common/use-toast";

const ToolsView: React.FC = () => {
    const [selectedTool, setSelectedTool] = useState<WebGLToolConfig | null>(null);
    const [paramValues, setParamValues] = useState<Record<string, number | string | boolean>>({});
    const { toast } = useToast();
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    const handleSelectTool = (tool: WebGLToolConfig) => {
        setSelectedTool(tool);
        const initialValues = tool.parameters.reduce((acc, p) => {
            acc[p.id] = p.defaultValue;
            return acc;
        }, {} as Record<string, number | string | boolean>);
        setParamValues(initialValues);
    };

    const handleParamChange = (id: string, value: number | string | boolean) => {
        setParamValues(prev => ({ ...prev, [id]: value }));
    };

    const handleExportImage = () => {
        const canvas = canvasContainerRef.current?.querySelector('canvas');
        if (!canvas) return;

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${selectedTool?.id || 'tool'}-${Date.now()}.png`;
        link.click();
        toast({ title: "导出成功", description: "图片已保存" });
    };

    const handleToggleRecording = () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }

        const canvas = canvasContainerRef.current?.querySelector('canvas');
        if (!canvas) return;

        const stream = canvas.captureStream(60); // 60 FPS
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${selectedTool?.id || 'tool'}-${Date.now()}.webm`;
            link.click();
            toast({ title: "录制成功", description: "视频已保存" });
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        toast({ title: "开始录制", description: "正在捕获画布动画..." });
    };

    return (
        <div className="flex flex-col pt-16 h-screen overflow-hidden "
            style={{
                background: "linear-gradient(180deg, #0F0F15 0%, #131718 30%, #1079BB 75%, #D8C6B8 100%)",
            }}>
            <AnimatePresence mode="wait">
                {!selectedTool ? (
                    // Grid View
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="p-8 h-full overflow-y-auto"
                    >
                        <div className="max-w-[80vw] mx-auto space-y-8  ">
                            <div className="flex items-center justify-center gap-3">

                                <h2 className="text-3xl font-serif font-normal text-white">WebGL Tools Studio</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
                                {WEBGL_TOOLS.map((tool) => (
                                    <Card
                                        key={tool.id}
                                        className="bg-black border-[#2e2e2e] hover:bg-black transition-colors cursor-pointer rounded-none group overflow-hidden"
                                        onClick={() => handleSelectTool(tool)}
                                    >
                                        <div className="aspect-video rounded-none relative bg-black/40">
                                            {/* 简单预览渲染 */}
                                            {tool.type === 'shader' && tool.fragmentShader && (
                                                <WebGLRenderer
                                                    shader={tool.fragmentShader}
                                                    uniforms={tool.parameters.reduce((acc, p) => { acc[p.id] = p.defaultValue as number; return acc; }, {} as Record<string, number | number[]>)}
                                                    width={400}
                                                    height={225}
                                                />
                                            )}
                                            {tool.type === 'component' && tool.component && (
                                                <div className="w-full h-full rounded-none relative isolate">
                                                    <tool.component
                                                        key={tool.id} // 强制隔离
                                                        isPreview
                                                        {...tool.parameters.reduce((acc, p) => { acc[p.id] = p.defaultValue; return acc; }, {} as Record<string, number | string | boolean | undefined>)}
                                                    />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Button variant="outline" className="rounded-full border-white/40 bg-white/10 backdrop-blur-xl hover:bg-white/20 text-white">Open Tool</Button>
                                            </div>
                                        </div>
                                        <CardContent className="p-4">
                                            <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
                                            <p className="text-xs text-white/50">{tool.description}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    // Detail Editor View
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        className="flex flex-1 h-full bg-[#0f1016] overflow-hidden"
                    >
                        {/* Left Main Canvas */}
                        <div className="flex-1 relative flex flex-col min-h-0">
                            <div className="absolute top-8 left-8 z-20 flex gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full bg-black/40 border-white/20 text-white hover:bg-black/60"
                                    onClick={() => setSelectedTool(null)}
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                                <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
                                    <span className="text-white font-medium">{selectedTool.name}</span>
                                </div>
                            </div>

                            <div ref={canvasContainerRef} className="flex-1 bg-[#0f1016] overflow-hidden flex items-center justify-center relative  p-4">
                                {selectedTool.type === 'shader' && selectedTool.fragmentShader && (
                                    <WebGLRenderer
                                        shader={selectedTool.fragmentShader}
                                        uniforms={paramValues as Record<string, number>}
                                        width={1920}
                                        height={1080}
                                        className="max-w-full max-h-full aspect-video rounded-2xl "
                                    />
                                )}
                                {selectedTool.type === 'component' && selectedTool.component && (
                                    <selectedTool.component
                                        {...paramValues}
                                        onChange={handleParamChange}
                                    />
                                )}
                            </div>

                            {/* Bottom Actions */}
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-4">
                                <Button
                                    className="rounded-2xl bg-black/10 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white gap-2 px-6"
                                    onClick={handleExportImage}
                                >
                                    <Download className="w-4 h-4" />
                                    Capture PNG
                                </Button>
                                <Button
                                    variant={isRecording ? "default" : "destructive"}
                                    className={`rounded-2xl gap-2 px-6 ${!isRecording ? 'bg-black/10 backdrop-blur-md  border border-white/10 hover:bg-white/20 text-white' : ''}`}
                                    onClick={handleToggleRecording}
                                >
                                    <Video className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                                    {isRecording ? 'Stop Recording' : 'Record Video'}
                                </Button>
                            </div>
                        </div>

                        {/* Right Panel */}
                        <div className="w-80 h-full relative bg-[#0f1016] backdrop-blur-xl py-4 pr-4 ">
                                <div className="w-full h-full  flex flex-col border border-white/10 rounded-xl">
                            <ParameterPanel
                                config={selectedTool}
                                values={paramValues}
                                onChange={handleParamChange}
                                onLoadPreset={(presetValues: Record<string, number | string | boolean>) => setParamValues(presetValues)}
                                onCaptureScreenshot={async () => {
                                    const canvas = canvasContainerRef.current?.querySelector('canvas');
                                    if (!canvas) return null;
                                    return canvas.toDataURL('image/png');
                                }}
                            />
                            <div className=" p-4 bg-[#0f1016] backdrop-blur-xl rounded-xl ">
                               
                                    <h4 className="text-xs font-medium text-white/40 uppercase mb-2">Export Info</h4>
                                    <p className="text-xs text-white/60">Export Resolution: 1920x1080 (HD)</p>
                                    <p className="text-xs text-white/60">Format: PNG / WebM</p>
                                
                            </div>
                        </div>
                            


                        </div>
                    
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ToolsView;
