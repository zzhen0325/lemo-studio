"use client";

import React from 'react';
import { Plus } from 'lucide-react';
import { getApiBase, formatImageUrl } from "@/lib/api-base";
import { useToast } from '@/hooks/common/use-toast';
import type { ToolParameter } from './tool-configs';

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
            <label className="text-xs font-sans text-white/60  font-medium  group-hover:text-white transition-colors">
                {label}
            </label>
            <span className="text-xs font-sans text-primary tabular-nums">
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

const AestheticTextInput: React.FC<{
    label: string;
    value: string;
    placeholder?: string;
    onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
    <div className="space-y-2 group">
        <label className="text-[10px] text-white/30 uppercase font-bold tracking-wider group-hover:text-white/50 transition-colors">
            {label}
        </label>
        <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 transition-colors"
        />
    </div>
);

const AestheticSelect: React.FC<{
    label: string;
    value: string;
    options: string[];
    onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
    <div className="space-y-2 group">
        <label className="text-[10px] text-white/30 uppercase font-bold tracking-wider group-hover:text-white/50 transition-colors">
            {label}
        </label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white outline-none focus:border-blue-500/50 transition-colors"
        >
            {options.map((opt) => (
                <option key={opt} value={opt} className="bg-[#0f1016] text-white">
                    {opt}
                </option>
            ))}
        </select>
    </div>
);

const AestheticImagePicker: React.FC<{
    label: string;
    value: string;
    accept?: string;
    onChange: (v: string) => void;
}> = ({ label, value, accept, onChange }) => {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = React.useState(false);
    const previewUrlRef = React.useRef<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }
        };
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
        }
        const localUrl = URL.createObjectURL(file);
        previewUrlRef.current = localUrl;
        onChange(localUrl);

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${getApiBase()}/upload`, {
                method: 'POST',
                body: formData
            });

            const payload = await res.json().catch(() => null);
            const path = typeof payload?.path === 'string' ? payload.path : '';
            const url = typeof payload?.url === 'string' ? payload.url : '';

            if (!res.ok || !path) {
                throw new Error(typeof payload?.error === 'string' ? payload.error : '上传失败');
            }

            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }

            // Store the storageKey (path) for persistence, but use URL for display
            // The value will be processed by useImageSource or similar hooks
            onChange(path);
        } catch (error) {
            onChange('');
            toast({
                title: "上传失败",
                description: error instanceof Error ? error.message : "媒体上传失败，请重试",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const lowerValue = value.toLowerCase();
    const isVideo = lowerValue.endsWith('.mp4') || lowerValue.endsWith('.webm') || lowerValue.endsWith('.mov');
    
    // Convert storageKey to accessible URL for display
    const displayUrl = formatImageUrl(value);

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
                    accept={accept ?? 'image/*,video/*'}
                    onChange={handleFileChange}
                />

                {value ? (
                    <>
                        {isVideo ? (
                            <video src={displayUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={displayUrl} alt="Selected" className="absolute inset-0 w-full h-full object-cover" />
                        )}

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

export const ParameterField: React.FC<{
    param: ToolParameter;
    value: number | string | boolean;
    onChange: (value: number | string | boolean) => void;
    index: number;
}> = ({ param, value, onChange, index }) => {
    if (param.type === 'image') {
        return (
            <AestheticImagePicker
                label={param.name}
                value={String(value ?? '')}
                accept={param.accept}
                onChange={onChange}
            />
        );
    }

    if (param.type === 'number') {
        return (
            <AestheticSlider
                label={param.name}
                value={Number(value ?? param.defaultValue)}
                min={param.min || 0}
                max={param.max || 1}
                step={param.step || 0.01}
                onChange={onChange}
            />
        );
    }

    if (param.type === 'boolean') {
        return (
            <AestheticSwitch
                label={param.name}
                checked={Boolean(value)}
                onChange={onChange}
            />
        );
    }

    if (param.type === 'color') {
        return (
            <AestheticColorSlot
                color={String(value ?? param.defaultValue)}
                index={index}
                onChange={onChange}
            />
        );
    }

    if (param.type === 'text') {
        if (Array.isArray(param.options) && param.options.length > 0) {
            return (
                <AestheticSelect
                    label={param.name}
                    value={String(value ?? param.defaultValue ?? param.options[0] ?? '')}
                    options={param.options}
                    onChange={onChange}
                />
            );
        }
        return (
            <AestheticTextInput
                label={param.name}
                value={String(value ?? '')}
                placeholder={param.placeholder}
                onChange={onChange}
            />
        );
    }

    return null;
};
