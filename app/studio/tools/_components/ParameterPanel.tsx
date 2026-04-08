"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { WebGLToolConfig, ToolParameter, ToolPreset } from './tool-configs';
import { Trash2, Plus, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { getApiBase } from "@/lib/api-base";
import { useToast } from '@/hooks/common/use-toast';
import { useImageUpload } from '@/hooks/common/use-image-upload';
import { ParameterField } from './ParameterFieldControls';

interface ParameterPanelProps {
    config: WebGLToolConfig;
    values: Record<string, number | string | boolean>;
    onChange: (id: string, value: number | string | boolean) => void;
    onLoadPreset?: (values: Record<string, number | string | boolean>) => void;
    onCaptureScreenshot?: () => Promise<string | null>;
}

const ParameterPanel: React.FC<ParameterPanelProps> = ({ config, values, onChange, onLoadPreset, onCaptureScreenshot }) => {
    const [presets, setPresets] = useState<ToolPreset[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const { uploadFile } = useImageUpload();
    const { toast } = useToast();

    const fetchPresets = React.useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/tools/presets?toolId=${config.id}`);
            if (res.ok) {
                const data = await res.json();
                setPresets(data);
            }
        } catch (e) {
            console.error('Failed to fetch presets', e);
        }
    }, [config.id]);

    // Load presets from API
    useEffect(() => {
        fetchPresets();
    }, [fetchPresets]);

    const uploadScreenshot = async (dataUrl: string) => {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'screenshot.png', { type: 'image/png' });

        return new Promise<string>((resolve, reject) => {
            let settled = false;
            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error('截图上传超时'));
            }, 15_000);

            void uploadFile(file, {
                onSuccess: (_tempId, path) => {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timeoutId);
                    resolve(path);
                },
                onError: (_tempId, error) => {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timeoutId);
                    reject(error instanceof Error ? error : new Error('截图上传失败'));
                }
            }).then((uploaded) => {
                if (uploaded || settled) {
                    return;
                }
                settled = true;
                window.clearTimeout(timeoutId);
                reject(new Error('截图上传失败'));
            }).catch((error) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                reject(error instanceof Error ? error : new Error('截图上传失败'));
            });
        });
    };

    const handleSaveCurrent = async () => {
        if (isUploading) return;

        const trimmedName = newPresetName.trim();
        if (!trimmedName) {
            toast({ title: "保存失败", description: "请先输入预设名称", variant: "destructive" });
            return;
        }

        if (Object.values(values).some((value) => typeof value === 'string' && value.startsWith('blob:'))) {
            toast({ title: "保存失败", description: "媒体仍在上传，请稍后再保存预设", variant: "destructive" });
            return;
        }

        setIsUploading(true);

        try {
            let screenshotPath = '';

            if (onCaptureScreenshot) {
                const dataUrl = await onCaptureScreenshot();
                if (dataUrl) {
                    screenshotPath = await uploadScreenshot(dataUrl);
                }
            }

            const formData = new FormData();
            formData.append('toolId', config.id);
            formData.append('name', trimmedName);
            formData.append('values', JSON.stringify(values));
            if (screenshotPath) {
                formData.append('screenshotUrl', screenshotPath);
            }

            const res = await fetch(`${getApiBase()}/tools/presets`, {
                method: 'POST',
                body: formData
            });

            const payload = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(typeof payload?.error === 'string' ? payload.error : '保存预设失败');
            }

            await fetchPresets();
            setNewPresetName('');
            setIsSaving(false);
            toast({ title: "保存成功", description: "参数预设已保存" });
        } catch (e) {
            console.error('Failed to save preset', e);
            toast({
                title: "保存失败",
                description: e instanceof Error ? e.message : "保存预设失败，请稍后重试",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${getApiBase()}/tools/presets?id=${id}&toolId=${config.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setPresets(prev => prev.filter(p => p.id !== id));
                toast({ title: "删除成功", description: "预设已删除" });
                return;
            }
            const payload = await res.json().catch(() => null);
            throw new Error(typeof payload?.error === 'string' ? payload.error : '删除预设失败');
        } catch (e) {
            console.error('Failed to delete preset', e);
            toast({
                title: "删除失败",
                description: e instanceof Error ? e.message : "删除预设失败，请稍后重试",
                variant: "destructive"
            });
        }
    };

    // Group parameters by category
    const groups = useMemo(() => {
        const grouped: Record<string, ToolParameter[]> = {};
        const defaultGroup = 'Parameters';

        config.parameters.forEach(param => {
            const category = param.category || defaultGroup;
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(param);
        });

        const order = ['Input', 'Glass', 'Geometry', 'Environment', 'Lighting', 'Motion', 'Simulation', 'Palette', 'Analysis', 'Parameters'];
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        return sortedKeys.map(key => ({
            name: key,
            params: grouped[key]
        }));
    }, [config.parameters]);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0c]/0   border-white/10 select-none font-sans">
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
                
                .aesthetic-range { -webkit-appearance: none; background: transparent; }
                .aesthetic-range::-webkit-slider-runnable-track { 
                  width: 100%; height: 2px; cursor: pointer; background: rgba(255,255,255,0.1); border-radius: 1px;
                }
                .aesthetic-range::-webkit-slider-thumb {
                  height: 14px; width: 14px; border-radius: 50%; background: #ffffff;
                  cursor: pointer; -webkit-appearance: none; margin-top: -6px;
                  box-shadow: 0 0 10px rgba(0,0,0,0.5);
                  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .aesthetic-range:active::-webkit-slider-thumb { 
                  transform: scale(1.2);
                  background: #3b82f6;
                  box-shadow: 0 0 20px rgba(59,130,246,0.4);
                }
            `}</style>

            {/* Header */}
            <div className="px-4 py-4  flex justify-between items-center bg-transparent rounded-xl shrink-0">
                <div className="flex flex-col">
                    <h1 className=" font-medium  font-sans text-lg text-white">
                        {config.name}
                    </h1>
                    <span className="text-xs text-white/60 font-sans mt-2 mb-4">
                        {config.description}
                    </span>
                </div>
               
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-8">
                {/* Presets Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <Bookmark className="w-4 h-4 text-primary" />
                            <h3 className="text-sm  font-bold text-white">Presets</h3>
                        </div>
                        <button
                            onClick={() => setIsSaving(!isSaving)}
                            className="text-xs font-sans font-medium py-1  px-3 border border-white/10  bg-white/5 rounded-sm text-primary hover:text-white transition-colors flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            {isSaving ? 'Cancel' : 'New'}
                        </button>
                    </div>

                    {isSaving && (
                        <div className="p-3 bg-white/10 border border-blue-500/30 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Preset name..."
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrent()}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 transition-colors"
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    disabled={isUploading}
                                    onClick={handleSaveCurrent}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-md h-8 rounded-lg font-bold"
                                >
                                    {isUploading ? 'Saving...' : 'Save Current'}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        {presets.length === 0 && !isSaving && (
                            <div className="col-span-2 py-8 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center opacity-20">
                                <Bookmark className="w-5 h-5 mb-2" />
                                <span className="text-[9px] uppercase tracking-tighter">No presets saved</span>
                            </div>
                        )}
                        {presets.map(preset => (
                            <div
                                key={preset.id}
                                onClick={() => onLoadPreset?.(preset.values)}
                                className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-all overflow-hidden flex flex-col"
                            >
                                <div className="aspect-video relative bg-black/40 overflow-hidden">
                                    {preset.thumbnail ? (
                                        <Image
                                            src={preset.thumbnail}
                                            alt={preset.name}
                                            fill
                                            className="object-cover transition-transform group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center opacity-20">
                                            <Bookmark className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={(e) => handleDeletePreset(preset.id, e)}
                                            className="p-1.5 hover:bg-red-500/80 text-white rounded-md transition-all transform translate-y-2 group-hover:translate-y-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-2 flex flex-col gap-0.5">
                                    <span className="text-[10px] text-white/80 group-hover:text-white transition-colors truncate">{preset.name}</span>
                                    <span className="text-[7px] text-white/20 uppercase tracking-tighter">
                                        {new Date(preset.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                <div className="h-px w-full bg-white/5" />

                {groups.map((group, groupIndex) => (
                    <section key={group.name} className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-md text-blue-500 font-medium font-sans">
                                {String(groupIndex + 1).padStart(2, '0')}
                            </span>
                            <h3 className="text-md font-bold font-sans text-white">
                                {group.name}
                            </h3>
                            
                        </div>

                        <div className={`space-y-4 px-1 ${group.name === 'Palette' ? 'grid grid-cols-1 gap-2.5 space-y-0' : ''}`}>
                            {group.params.map((param, paramIndex) => (
                                <ParameterField
                                    key={param.id}
                                    param={param}
                                    value={values[param.id]}
                                    index={paramIndex}
                                    onChange={(value) => onChange(param.id, value)}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default ParameterPanel;
