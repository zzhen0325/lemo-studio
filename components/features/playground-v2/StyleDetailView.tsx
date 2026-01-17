'use client';

import React from 'react';
import { StyleStack } from './types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Play, Copy, ExternalLink, Trash2, Edit2, Check, X, Upload } from 'lucide-react';
import NextImage from 'next/image';
import { useToast } from '@/hooks/common/use-toast';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { getApiBase } from '@/lib/api-base';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface StyleDetailViewProps {
    style: StyleStack;
    onBack: () => void;
    onApply: (prompt: string) => void;
}

export const StyleDetailView: React.FC<StyleDetailViewProps> = ({
    style,
    onBack,
    onApply
}) => {
    const { toast } = useToast();
    const { updateStyle, removeImageFromStyle } = usePlaygroundStore();

    const [isEditingName, setIsEditingName] = React.useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = React.useState(false);
    const [tempName, setTempName] = React.useState(style.name);
    const [tempPrompt, setTempPrompt] = React.useState(style.prompt);
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(style.prompt);
        toast({ title: "已复制", description: "提示词已复制到剪贴板" });
    };

    const handleSaveName = async () => {
        if (!tempName.trim()) return;
        await updateStyle({ ...style, name: tempName });
        setIsEditingName(false);
        toast({ title: "修改成功", description: "风格名称已更新" });
    };

    const handleSavePrompt = async () => {
        await updateStyle({ ...style, prompt: tempPrompt });
        setIsEditingPrompt(false);
        toast({ title: "修改成功", description: "提示词已更新" });
    };

    const handleDeleteImage = async (path: string) => {
        if (confirm('确定要从这个风格中移除这张图片吗？')) {
            await removeImageFromStyle(style.id, path);
            toast({ title: "移除成功", description: "图片已从风格中移除" });
        }
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        toast({ title: "正在上传", description: `正在上传 ${files.length} 张图片到该风格...` });

        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);
                const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: formData });
                if (!resp.ok) throw new Error('Upload failed');
                const data = await resp.json();
                return data.path;
            });

            const newPaths = await Promise.all(uploadPromises);
            await updateStyle({
                ...style,
                imagePaths: [...style.imagePaths, ...newPaths],
                updatedAt: new Date().toISOString()
            });
            toast({ title: "上传成功", description: `已成功添加 ${newPaths.length} 张图片` });
        } catch (error) {
            console.error("Upload failed", error);
            toast({ title: "上传失败", description: "部分或全部图片上传失败", variant: "destructive" });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header / Navigation */}
            <div className="flex flex-col gap-6">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="w-fit -ml-2 text-white/40 hover:text-white hover:bg-white/5 gap-2 rounded-xl"
                >
                    <ChevronLeft size={20} />
                    返回风格库
                </Button>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                    <div className="flex-1 space-y-6">
                        <div className="group relative">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        className="text-4xl font-bold bg-white/5 border-white/20 h-16 rounded-2xl"
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                    />
                                    <Button size="icon" className="rounded-xl h-12 w-12 bg-green-600 hover:bg-green-500" onClick={handleSaveName}>
                                        <Check size={20} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="rounded-xl h-12 w-12" onClick={() => { setIsEditingName(false); setTempName(style.name); }}>
                                        <X size={20} />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <h2 className="text-5xl font-black text-white tracking-tight">{style.name}</h2>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-10 w-10 bg-white/5"
                                        onClick={() => setIsEditingName(true)}
                                    >
                                        <Edit2 size={16} className="text-white/40" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="group relative max-w-3xl">
                            {isEditingPrompt ? (
                                <div className="flex flex-col gap-2">
                                    <Textarea
                                        value={tempPrompt}
                                        onChange={(e) => setTempPrompt(e.target.value)}
                                        className="text-lg bg-white/5 border-white/20 min-h-[120px] rounded-2xl p-6 leading-relaxed"
                                        autoFocus
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="ghost" className="rounded-xl px-6" onClick={() => { setIsEditingPrompt(false); setTempPrompt(style.prompt); }}>
                                            取消
                                        </Button>
                                        <Button size="sm" className="rounded-xl px-8 bg-purple-600 hover:bg-purple-500" onClick={handleSavePrompt}>
                                            保存修改
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all group/prompt">
                                    <p className="text-xl text-white/80 leading-relaxed pr-12 font-medium">
                                        {style.prompt || "点击按钮添加该风格的核心提示词..."}
                                    </p>
                                    <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover/prompt:opacity-100 transition-all transform translate-x-2 group-hover/prompt:translate-x-0">
                                        <button
                                            onClick={handleCopyPrompt}
                                            className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                            title="复制提示词"
                                        >
                                            <Copy size={18} />
                                        </button>
                                        <button
                                            onClick={() => setIsEditingPrompt(true)}
                                            className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                            title="编辑提示词"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 shrink-0">
                        <Button
                            onClick={() => onApply(style.prompt)}
                            disabled={!style.prompt}
                            className="rounded-[2rem] h-16 px-10 bg-white text-black hover:bg-neutral-200 gap-3 font-bold shadow-2xl hover:scale-105 transition-all active:scale-95 text-lg"
                        >
                            <Play size={20} fill="currentColor" />
                            使用此风格生成
                        </Button>
                        <p className="text-center text-[10px] text-white/20 uppercase tracking-[0.2em]">Apply Moodboard Style</p>
                    </div>
                </div>
            </div>

            {/* Image Grid */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">
                            Gallery ({style.imagePaths.length})
                        </span>
                        <div className="h-[1px] w-20 bg-white/10" />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        <Button
                            variant="outline"
                            onClick={handleUploadClick}
                            disabled={isUploading}
                            className="rounded-full border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 gap-2 h-10 px-6"
                        >
                            <Upload size={16} />
                            {isUploading ? '正在上传...' : '添加更多图片'}
                        </Button>
                    </div>
                </div>

                {style.imagePaths.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                        {style.imagePaths.map((path, index) => (
                            <div
                                key={`${path}-${index}`}
                                className="group relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 bg-neutral-900/50"
                            >
                                <NextImage
                                    src={path}
                                    alt={`Style image ${index}`}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                                    <div className="flex gap-2">
                                        <Button size="icon" variant="ghost" className="rounded-full h-12 w-12 bg-white/10 text-white hover:bg-white/20" asChild>
                                            <a href={path} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink size={20} />
                                            </a>
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="rounded-full h-12 w-12 bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300"
                                            onClick={() => handleDeleteImage(path)}
                                        >
                                            <Trash2 size={20} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
                        <p className="text-white/20 italic text-lg">暂无关联图片</p>
                        <p className="text-white/10 text-sm">在 Gallery 中点击“添加到风格”来丰富此堆叠</p>
                    </div>
                )}
            </div>
        </div>
    );
};
