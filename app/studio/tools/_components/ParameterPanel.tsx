"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { WebGLToolConfig, ToolParameter, ToolPreset } from './tool-configs';
import { Trash2, Plus, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { getApiBase } from "@/lib/api-base";

import { useImageUpload } from '@/hooks/common/use-image-upload';

interface ParameterPanelProps {
    config: WebGLToolConfig;
    values: Record<string, number | string | boolean>;
    onChange: (id: string, value: number | string | boolean) => void;
    onLoadPreset?: (values: Record<string, number | string | boolean>) => void;
    onCaptureScreenshot?: () => Promise<string | null>;
}

// --- Aesthetic UI Components ---

const AestheticSlider: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void
}> = ({ label, value, min, max, step, onChange }) => (
    <div className="space-y-2.5 group">
        <div className="flex items-center justify-between">
            <label className="text-[10px] text-white/30 uppercase font-bold tracking-wider group-hover:text-white/50 transition-colors">
                {label}
            </label>
            <span className="text-[10px] font-mono text-blue-400/80 tabular-nums">
                {Number(value) % 1 === 0 ? value : Number(value).toFixed(2)}
            </span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-4 aesthetic-range"
        />
    </div>
);

const AestheticSwitch: React.FC<{
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
    <div
        className="flex items-center justify-between group cursor-pointer"
        onClick={() => onChange(!checked)}
    >
        <span className="text-[11px] text-white/50 group-hover:text-white transition-colors">
            {label}
        </span>
        <div className={`w-8 h-4 rounded-full transition-all duration-300 relative ${checked ? 'bg-blue-600' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
        </div>
    </div>
);

const AestheticColorSlot: React.FC<{
    color: string;
    index: number;
    onChange: (v: string) => void;
}> = ({ color, index, onChange }) => (
    <div className="flex items-center gap-3 group">
        <div className="relative w-full h-10 flex items-center px-4 rounded-xl bg-white/[0.03] border border-white/10 group-hover:border-white/20 transition-all cursor-pointer overflow-hidden">
            <input
                type="color"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div
                className="w-6 h-6 rounded-lg border border-white/20 shadow-lg shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: color }}
            />
            <span className="ml-3 text-[11px] font-mono text-white/60 group-hover:text-white transition-colors tracking-tight uppercase">
                {color}
            </span>
            <span className="ml-auto text-[8px] text-white/10 group-hover:text-white/30 font-bold uppercase tracking-tighter">
                Slot_{index + 1}
            </span>
        </div>
    </div>
);

// --- Main Panel ---

const AestheticImagePicker: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
    const { uploadFile } = useImageUpload();
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create local URL for immediate preview (optional, but good for UX)
        const localUrl = URL.createObjectURL(file);
        onChange(localUrl);

        // Upload
        setIsUploading(true);
        await uploadFile(file, {
            onSuccess: () => {
                // Success
                setIsUploading(false);
            },
            onError: () => {
                setIsUploading(false);
            }
        });
    };

    return (
        <div className="space-y-2 group">
            <label className="text-[10px] text-white/30 uppercase font-bold tracking-wider group-hover:text-white/50 transition-colors">
                {label}
            </label>
            <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-full aspect-video bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:border-white/20 transition-all flex items-center justify-center group/picker"
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                />

                {value ? (
                    <>
                        {/* Try to show image or video thumbnail */}
                        {(value.endsWith('.mp4') || value.endsWith('.webm') || value.startsWith('blob:')) && <video src={value} className="w-full h-full object-cover opacity-50" muted loop autoPlay playsInline />}
                        {/* Fallback to image if not video ext, or overlay */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={value} alt="Selected" className="absolute inset-0 w-full h-full object-cover" />

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/picker:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Change Media</span>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 opacity-40 group-hover/picker:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-full border border-dashed border-white flex items-center justify-center">
                            <Plus className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[9px] uppercase tracking-widest">Select Media</span>
                    </div>
                )}

                {isUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20">
                        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-blue-500 animate-spin" />
                    </div>
                )}
            </div>
            {value && (
                <div className="flex justify-end">
                    <button
                        onClick={(e) => { e.stopPropagation(); onChange(''); }}
                        className="text-[9px] text-red-400 hover:text-red-300 uppercase tracking-wider"
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
};

// --- Main Panel ---

const ParameterPanel: React.FC<ParameterPanelProps> = ({ config, values, onChange, onLoadPreset, onCaptureScreenshot }) => {
    // ... existing state ...
    const [presets, setPresets] = useState<ToolPreset[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const { uploadFile } = useImageUpload();

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

    const handleSaveCurrent = async () => {
        // ... existing handleSaveCurrent code
        if (!newPresetName.trim() || isUploading) return;

        setIsUploading(true);

        try {
            let screenshotPath = '';

            // Capture screenshot if available
            if (onCaptureScreenshot) {
                const dataUrl = await onCaptureScreenshot();
                if (dataUrl) {
                    const response = await fetch(dataUrl);
                    const blob = await response.blob();
                    const file = new File([blob], 'screenshot.png', { type: 'image/png' });

                    // 使用统一上传逻辑
                    const uploaded = await uploadFile(file, {
                        onSuccess: (tempId, path) => {
                            screenshotPath = path;
                        }
                    });

                    // 等待上传完成（因为这里是保存 Preset，需要路径）
                    // 虽然 useImageUpload 是后台上传，但对于 Preset 保存这种需要路径的操作，我们可以稍微等待
                    // 或者修改 useImageUpload 支持同步返回 Promise
                    if (uploaded) {
                        // 轮询或者等待 path
                        let attempts = 0;
                        while (!screenshotPath && attempts < 10) {
                            await new Promise(r => setTimeout(r, 500));
                            attempts++;
                        }
                    }
                }
            }

            const formData = new FormData();
            formData.append('toolId', config.id);
            formData.append('name', newPresetName.trim());
            formData.append('values', JSON.stringify(values));
            if (screenshotPath) {
                formData.append('screenshotUrl', screenshotPath);
            }

            const res = await fetch(`${getApiBase()}/tools/presets`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                await fetchPresets();
                setNewPresetName('');
                setIsSaving(false);
            }
        } catch (e) {
            console.error('Failed to save preset', e);
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
            }
        } catch (e) {
            console.error('Failed to delete preset', e);
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

        const order = ['Input', 'Geometry', 'Simulation', 'Palette', 'Analysis', 'Parameters'];
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
        <div className="flex flex-col h-full bg-[#0a0a0c]/85 backdrop-blur-xl border-l border-white/10 select-none font-mono">
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
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">
                        {config.name}
                    </h1>
                    <span className="text-[8px] text-white/30 uppercase mt-0.5 tracking-widest truncate max-w-[200px]">
                        {config.description}
                    </span>
                </div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* Presets Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Bookmark className="w-3 h-3 text-blue-500" />
                            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Presets</h3>
                        </div>
                        <button
                            onClick={() => setIsSaving(!isSaving)}
                            className="text-[9px] uppercase font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            {isSaving ? 'Cancel' : 'New'}
                        </button>
                    </div>

                    {isSaving && (
                        <div className="p-3 bg-white/[0.03] border border-blue-500/30 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] h-8 rounded-lg font-bold"
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
                            <span className="text-[9px] text-blue-500 font-bold">
                                {String(groupIndex + 1).padStart(2, '0')}
                            </span>
                            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">
                                {group.name}
                            </h3>
                            <div className="h-px flex-1 bg-white/5" />
                        </div>

                        <div className={`space-y-4 px-1 ${group.name === 'Palette' ? 'grid grid-cols-1 gap-2.5 space-y-0' : ''}`}>
                            {group.params.map((param, paramIndex) => (
                                <React.Fragment key={param.id}>
                                    {/* Image / Media Picker */}
                                    {param.type === 'image' && (
                                        <AestheticImagePicker
                                            label={param.name}
                                            value={values[param.id] as string}
                                            onChange={(val) => onChange(param.id, val)}
                                        />
                                    )}

                                    {param.type === 'number' && (
                                        <AestheticSlider
                                            label={param.name}
                                            value={values[param.id] as number}
                                            min={param.min || 0}
                                            max={param.max || 1}
                                            step={param.step || 0.01}
                                            onChange={(val) => onChange(param.id, val)}
                                        />
                                    )}
                                    {param.type === 'boolean' && (
                                        <AestheticSwitch
                                            label={param.name}
                                            checked={values[param.id] as boolean}
                                            onChange={(val) => onChange(param.id, val)}
                                        />
                                    )}
                                    {param.type === 'color' && (
                                        <AestheticColorSlot
                                            color={values[param.id] as string}
                                            index={paramIndex}
                                            onChange={(val) => onChange(param.id, val)}
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default ParameterPanel;
