'use client';

import React from 'react';
import { StyleStack } from './types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Copy, Trash2, Edit2, Check, X, Upload, Settings2, Image as ImageIcon, Wand2, Download } from 'lucide-react';
import NextImage from 'next/image';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/common/use-toast';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { getApiBase, formatImageUrl } from '@/lib/api-base';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SimpleImagePreview from './SimpleImagePreview';
import { cn } from '@/lib/utils';
import { TooltipButton } from '@/components/ui/tooltip-button';
import { StyleCollageEditor } from './StyleCollageEditor';
import {
    buildShortcutPrompt,
    createShortcutPromptValues,
    getShortcutByMoodboardId,
} from '@/config/playground-shortcuts';

interface StyleDetailViewProps {
    style: StyleStack;
    onBack: () => void;
}

export const StyleDetailView: React.FC<StyleDetailViewProps> = ({
    style,
    onBack
}) => {
    const { toast } = useToast();
    const { updateStyle, removeImageFromStyle, applyPrompt, applyImage } = usePlaygroundStore();

    const [isEditingName, setIsEditingName] = React.useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = React.useState(false);
    const [tempName, setTempName] = React.useState(style.name);
    const [tempPrompt, setTempPrompt] = React.useState(style.prompt);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isManaging, setIsManaging] = React.useState(false);
    const [selectedPaths, setSelectedPaths] = React.useState<string[]>([]);
    const [previewImage, setPreviewImage] = React.useState<string | null>(null);
    const [previewLayoutId, setPreviewLayoutId] = React.useState<string | null>(null);
    const [isCollageEditorOpen, setIsCollageEditorOpen] = React.useState(false);
    const [showCollageTools, setShowCollageTools] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const linkedShortcut = getShortcutByMoodboardId(style.id);
    const promptTemplate = linkedShortcut
        ? buildShortcutPrompt(linkedShortcut, createShortcutPromptValues(linkedShortcut))
        : '';
    const quickApplyPrompt = style.prompt.trim() || promptTemplate;

    React.useEffect(() => {
        setTempName(style.name);
        setTempPrompt(style.prompt);
    }, [style.id, style.name, style.prompt]);

    const handleCopyPrompt = async () => {
        if (!style.prompt) return;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(style.prompt);
                toast({ title: "已复制", description: "提示词已复制到剪贴板" });
            } else {
                // Fallback for non-secure contexts or browsers without clipboard API
                const textArea = document.createElement("textarea");
                textArea.value = style.prompt;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    toast({ title: "已复制", description: "提示词已复制到剪贴板" });
                } catch (err) {
                    console.error('Fallback copy failed', err);
                    toast({ title: "复制失败", description: "请手动复制提示词", variant: "destructive" });
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Failed to copy: ', err);
            toast({ title: "复制失败", description: "请手动复制提示词", variant: "destructive" });
        }
    };

    const handleSaveName = async () => {
        if (!tempName.trim()) return;
        await updateStyle({ ...style, name: tempName });
        setIsEditingName(false);
        toast({ title: "修改成功", description: "情绪板名称已更新" });
    };

    const handleSavePrompt = async () => {
        await updateStyle({ ...style, prompt: tempPrompt });
        setIsEditingPrompt(false);
        toast({ title: "修改成功", description: "提示词已更新" });
    };

    const handleBatchDelete = async () => {
        if (selectedPaths.length === 0) return;

        if (confirm(`确定要移除选中的 ${selectedPaths.length} 张图片吗？`)) {
            try {
                // 并行移除所有选中的图片
                await Promise.all(selectedPaths.map(path => removeImageFromStyle(style.id, path)));
                toast({
                    title: "移除成功",
                    description: `已成功移除 ${selectedPaths.length} 张图片`
                });
                setSelectedPaths([]);
                setIsManaging(false);
            } catch (error) {
                console.error("Batch delete failed", error);
                toast({
                    title: "移除失败",
                    description: "部分或全部图片移除失败",
                    variant: "destructive"
                });
            }
        }
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleUseImage = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        try {
            await applyImage(formatImageUrl(path));
            toast({ title: "已添加", description: "图片已作为参考图添加到输入框" });
        } catch (error) {
            console.error("Failed to use image", error);
            toast({ title: "添加失败", description: "无法将图片添加到输入框", variant: "destructive" });
        }
    };

    const handleUseCollage = async () => {
        if (!style.collageImageUrl) return;

        try {
            await applyImage(formatImageUrl(style.collageImageUrl));
            toast({ title: "已添加", description: "该情绪板的拼图已作为参考图添加到输入框" });
        } catch (error) {
            console.error("Failed to use collage", error);
            toast({ title: "添加失败", description: "无法将拼合图添加到输入框", variant: "destructive" });
        }
    };

    const handleQuickApplyPrompt = () => {
        if (!quickApplyPrompt) return;
        applyPrompt(quickApplyPrompt);
        toast({
            title: "已快速应用",
            description: `${style.name} 的 prompt 已应用到输入框`,
        });
    };

    const handleUsePrompt = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!quickApplyPrompt) return;
        applyPrompt(quickApplyPrompt);
        toast({ title: "Prompt Applied", description: "提示词已应用到输入框" });
    };

    const handleDownloadImage = (e: React.MouseEvent, path: string, index: number) => {
        e.stopPropagation();
        const link = document.createElement("a");
        link.href = formatImageUrl(path);
        link.download = `${style.name}-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        toast({ title: "正在上传", description: `正在上传 ${files.length} 张图片到该情绪板...` });

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
        <div className="flex flex-col w-full h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header / Navigation */}
            <div className="flex flex-row items-center justify-between gap-6 px-8 pt-8 mb-8">
                <div className="flex items-center gap-6">
                    <Button
                        variant="light"
                        onClick={onBack}
                        className="w-fit border border-white/10 text-white/40 hover:text-white hover:bg-white/5 rounded-xl h-10 px-4"
                    >
                        <ChevronLeft size={18} className="-ml-1" />
                        返回
                    </Button>


                </div>
                <div className="group relative">
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className="text-2xl font-semibold bg-white/5 border-white/20 h-11 w-[300px] rounded-xl px-4 focus:border-primary/50 transition-colors"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            />
                            <div className="flex items-center gap-1">
                                <Button size="icon" className="rounded-lg h-9 w-9 bg-primary hover:bg-primary/80" onClick={handleSaveName}>
                                    <Check size={18} />
                                </Button>
                                <Button size="icon" variant="ghost" className="rounded-lg h-9 w-9 text-white/40 hover:text-white" onClick={() => { setIsEditingName(false); setTempName(style.name); }}>
                                    <X size={18} />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-semibold text-white">{style.name}</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-all rounded-full h-8 w-8 bg-white/5 hover:bg-white/10"
                                onClick={() => setIsEditingName(true)}
                            >
                                <Edit2 size={14} className="text-white/40" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* <Button
                    variant="light"
                    onClick={() => onApply(style.prompt)}
                    disabled={!style.prompt}
                    className="w-fit border border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary hover:border-primary transition-all duration-200 rounded-xl h-10 px-6 font-medium"
                >
                    <Play size={14} className="fill-current mr-2" />
                    使用此风格生成
                </Button> */}
            </div>

            <div className='w-full flex-1 overflow-y-auto flex flex-col gap-10 px-8 pb-8 custom-scrollbar'>
                <div className="flex flex-wrap items-center gap-3">
                    {quickApplyPrompt && (
                        <Button
                            onClick={handleQuickApplyPrompt}
                            className="rounded-xl border border-[#E8FFB7]/20 bg-[#E8FFB7]/10 px-4 text-[#F4FFCE] hover:bg-[#E8FFB7]/15"
                        >
                            <Wand2 size={14} className="mr-2" />
                            快速应用
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        onClick={() => setShowCollageTools((prev) => !prev)}
                        className="rounded-xl px-4 text-white/45 hover:text-white hover:bg-white/5"
                    >
                        <Settings2 size={14} className="mr-2" />
                        {showCollageTools ? '收起拼图工具' : '显示拼图工具'}
                    </Button>
                </div>

                {/* 提示词区域 */}


                <div className="group relative w-full  space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xl text-white/60 font-normal">Prompt</span>

                        </div>

                        <Button
                            onClick={() => setIsEditingPrompt(true)}
                            className="p-2.5  h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors border border-white/5"
                            title="编辑提示词"
                        >
                            <Edit2 size={8} />
                            Edit
                        </Button>
                        <Button

                            variant="light"

                            onClick={handleCopyPrompt}
                            className="p-2.5 h-8  rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors border border-white/5"
                            title="复制提示词"
                        >
                            <Copy size={8} />
                            Copy
                        </Button>








                    </div>

                    {isEditingPrompt ? (
                        <div className="flex flex-col gap-3">
                            <Textarea
                                value={tempPrompt}
                                onChange={(e) => setTempPrompt(e.target.value)}
                                className="text-sm bg-white/5 h-40 border-white/20 rounded-2xl p-6 leading-relaxed min-h-[160px] focus:border-primary/50 transition-colors resize-none"
                                autoFocus
                                placeholder="输入这个情绪板当前要复用的 prompt..."
                            />
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="ghost"
                                    className="rounded-xl px-6 text-white/40 hover:text-white"
                                    onClick={() => { setIsEditingPrompt(false); setTempPrompt(style.prompt); }}
                                >
                                    取消
                                </Button>
                                <Button
                                    className="rounded-xl px-8 bg-white/10 hover:bg-primary/30 text-white"
                                    onClick={handleSavePrompt}
                                >
                                    保存修改
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative p-6 rounded-2xl  h-40  min-h-[120px] bg-white/5 border border-white/10 hover:border-primary/30 transition-all group/prompt">
                            <p className="text-sm text-white/80 leading-relaxed pr-12 whitespace-pre-wrap">
                                {style.prompt || "点击按钮补充这个情绪板当前要复用的 prompt..."}
                            </p>

                        </div>
                    )}
                </div>

                {linkedShortcut && (
                    <div className="group relative w-full space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xl text-white/60 font-normal">Prompt Template</span>
                        </div>
                        <div className="relative p-6 rounded-2xl min-h-[120px] bg-white/5 border border-white/10">
                            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                                {promptTemplate}
                            </p>
                        </div>
                    </div>
                )}

                {/* Content Layout: Collage & Gallery (Left-Right) */}
                <div className="flex flex-col lg:flex-row gap-10 items-start">
                    {showCollageTools && (
                        <div className="w-full lg:w-[450px] space-y-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <span className="text-xl text-white/60 font-normal">Collage Tools</span>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsCollageEditorOpen(true)}
                                    className="rounded-xl border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 gap-2 h-9 px-4 text-xs transition-all"
                                >
                                    <Edit2 size={12} />
                                    {style.collageImageUrl ? '编辑拼图' : '生成拼图'}
                                </Button>
                            </div>

                            {style.collageImageUrl ? (
                                <div
                                    className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 bg-white/5 group cursor-pointer"
                                    onClick={handleUseCollage}
                                >
                                    <NextImage
                                        src={formatImageUrl(style.collageImageUrl)}
                                        alt="Moodboard Collage"
                                        fill
                                        className="object-cover transition-transform group-hover:scale-[1.02] duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                                <ImageIcon size={20} />
                                            </div>
                                            <p className="text-xs text-white font-medium">点击使用拼图作为参考图</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.01] hover:bg-white/5 transition-colors cursor-pointer group"
                                    onClick={() => setIsCollageEditorOpen(true)}
                                >
                                    <ImageIcon size={28} className="text-white/10 group-hover:text-primary transition-colors mb-3" />
                                    <p className="text-white/20 text-sm italic">点击生成情绪板拼图</p>
                                    <p className="text-white/10 text-[10px] mt-1">2048 x 2048, 高保真参考图</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Right side: Image Grid (Gallery) */}
                    <div className="flex-1 w-full space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xl text-white/60 font-normal">
                                    Gallery <span className="text-white/40 ml-1">({style.imagePaths.length})</span>
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {isManaging && selectedPaths.length > 0 && (
                                    <Button
                                        variant="destructive"
                                        onClick={handleBatchDelete}
                                        className="rounded-xl gap-2 h-9 px-4 text-xs transition-all bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20"
                                    >
                                        <Trash2 size={14} />
                                        删除选中 ({selectedPaths.length})
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsManaging(!isManaging);
                                        setSelectedPaths([]);
                                    }}
                                    className={cn(
                                        "rounded-xl border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 gap-2 h-9 px-4 text-xs transition-all",
                                        isManaging && "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                    )}
                                >
                                    <Settings2 size={14} />
                                    {isManaging ? '取消选择' : '批量选择'}
                                </Button>
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
                                    className="rounded-xl border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 gap-2 h-9 px-4 text-xs transition-all"
                                >
                                    <Upload size={14} />
                                    {isUploading ? '上传中...' : '添加图片'}
                                </Button>
                            </div>
                        </div>

                        {style.imagePaths.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                {style.imagePaths.map((path, index) => {
                                    const layoutId = `style-image-${style.id}-${index}`;
                                    const isSelected = selectedPaths.includes(path);

                                    return (
                                        <motion.div
                                            key={`${path}-${index}`}
                                            layoutId={layoutId}
                                            className={cn(
                                                "group relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-white/5",
                                                isManaging ? "cursor-pointer" : "cursor-zoom-in",
                                                isSelected ? "border-primary ring-2 ring-primary/50" : "hover:border-primary/50 transition-colors"
                                            )}
                                            onClick={() => {
                                                if (isManaging) {
                                                    setSelectedPaths(prev =>
                                                        prev.includes(path)
                                                            ? prev.filter(p => p !== path)
                                                            : [...prev, path]
                                                    );
                                                } else {
                                                    setPreviewImage(path);
                                                    setPreviewLayoutId(layoutId);
                                                }
                                            }}
                                            whileHover={{ scale: 1.02 }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 400,
                                                damping: 35,
                                                mass: 1
                                            }}
                                        >
                                            <NextImage
                                                src={formatImageUrl(path)}
                                                alt={`Style image ${index}`}
                                                fill
                                                className={cn(
                                                    "object-cover pointer-events-none transition-opacity",
                                                    isManaging && isSelected ? "opacity-60" : "opacity-100"
                                                )}
                                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                                            />

                                            {isManaging && (
                                                <div className={cn(
                                                    "absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                                    isSelected
                                                        ? "bg-primary border-primary text-white"
                                                        : "bg-black/20 border-white/40 text-transparent"
                                                )}>
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            )}

                                            {!isManaging && (
                                                <div
                                                    className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-black/50 shadow-2xl backdrop-blur-xl transition-all duration-150 opacity-0 translate-y-4 scale-95 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-hover:pointer-events-auto"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <TooltipButton
                                                        icon={<Wand2 className="w-4 h-4" />}
                                                        label="Use Prompt"
                                                        tooltipContent="Use Prompt"
                                                        tooltipSide="top"
                                                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                                                        onClick={handleUsePrompt}
                                                    />
                                                    <div className="mx-0.5 h-4 w-[1px] bg-white/10" />
                                                    <TooltipButton
                                                        icon={<ImageIcon className="w-4 h-4" />}
                                                        label="Use Image"
                                                        tooltipContent="Use Image"
                                                        tooltipSide="top"
                                                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                                                        onClick={(e) => handleUseImage(e, path)}
                                                    />
                                                    <div className="mx-0.5 h-4 w-[1px] bg-white/10" />
                                                    <TooltipButton
                                                        icon={<Download className="w-4 h-4" />}
                                                        label="Download"
                                                        tooltipContent="Download"
                                                        tooltipSide="top"
                                                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                                                        onClick={(e) => handleDownloadImage(e, path, index)}
                                                    />
                                                </div>
                                            )}

                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                                <p className="text-white/20 italic text-lg">暂无关联图片</p>
                                <p className="text-white/10 text-sm mt-2">从 Gallery 中添加图片来丰富这个情绪板</p>
                            </div>
                        )}
                    </div>
                </div>


            </div>

            <SimpleImagePreview
                imageUrl={previewImage}
                layoutId={previewLayoutId}
                onClose={() => {
                    setPreviewImage(null);
                    setPreviewLayoutId(null);
                }}
            />

            {isCollageEditorOpen && (
                <StyleCollageEditor
                    style={style}
                    onClose={() => setIsCollageEditorOpen(false)}
                    onSave={async (path, config) => {
                        await updateStyle({
                            ...style,
                            collageImageUrl: path,
                            collageConfig: config,
                            updatedAt: new Date().toISOString()
                        });
                    }}
                />
            )}

        </div>
    );
};
