"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Plus, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import Image from "next/image";
import { getApiBase } from "@/lib/api-base";

interface CreateWorkflowDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: { title: string; coverImg: string; workflowApiJSON: WorkflowApiJSON | null }) => void;
}

export function CreateWorkflowDialog({ open, onOpenChange, onSubmit }: CreateWorkflowDialogProps) {
    const [title, setTitle] = useState("");
    const [coverImg, setCoverImg] = useState<string>("");
    const [workflowApiJSON, setWorkflowApiJSON] = useState<WorkflowApiJSON | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const jsonInputRef = useRef<HTMLInputElement>(null);

    const handleReset = () => {
        setTitle("");
        setCoverImg("");
        setWorkflowApiJSON(null);
        setFileName("");
    };

    const handleOpenChange = (val: boolean) => {
        if (!val) handleReset();
        onOpenChange(val);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error("图片大小不能超过 2MB");
                return;
            }

            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch(`${getApiBase()}/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    setCoverImg(data.path);
                    toast.success("封面上传成功");
                } else {
                    toast.error("上传图片失败");
                }
            } catch (error) {
                console.error("Upload error:", error);
                toast.error("上传图片过程中出错");
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    };

    const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const text = await file.text();
                const json = JSON.parse(text);
                setWorkflowApiJSON(json);
                setFileName(file.name);
                if (!title) {
                    setTitle(file.name.replace(".json", ""));
                }
            } catch {
                toast.error("无效的 JSON 文件");
            }
        }
    };

    const handleSubmit = () => {
        if (!title) {
            toast.error("请输入配置标题");
            return;
        }
        onSubmit({ title, coverImg, workflowApiJSON });
        handleOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md bg-[#18181b] border-white/5 rounded-2xl overflow-hidden p-0 gap-0 ">
                <DialogHeader className="p-8 pb-4">
                    <DialogTitle className="text-xl font-bold tracking-tight text-white/90 leading-none">
                        新建映射配置
                    </DialogTitle>
                    <p className="text-xs text-white/40 mt-2">为您的工作流创建一个美观的入口</p>
                </DialogHeader>

                <div className="p-8 pt-4 space-y-6">
                    <div className="space-y-4">
                        {/* Cover Image Upload */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">封面图片</Label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "relative aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group overflow-hidden",
                                    coverImg ? "border-transparent bg-zinc-900" : "border-white/5 bg-white/[0.02] hover:bg-primary/[0.03] hover:border-primary/30"
                                )}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />

                                <AnimatePresence mode="wait">
                                    {coverImg ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="absolute inset-0"
                                        >
                                            <Image
                                                src={coverImg}
                                                alt="Cover Preview"
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Upload className="w-6 h-6 text-white" />
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-500">
                                                {isUploading ? (
                                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                                                ) : (
                                                    <Upload className="w-5 h-5 text-zinc-500 group-hover:text-primary" />
                                                )}
                                            </div>
                                            <span className="text-xs text-zinc-500 font-medium group-hover:text-zinc-300 transition-colors">
                                                {isUploading ? "上传中..." : "上传封面图"}
                                            </span>
                                        </div>
                                    )}
                                </AnimatePresence>

                                {coverImg && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white/60 hover:text-white hover:bg-black/80 z-10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCoverImg("");
                                        }}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Title Input */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">配置标题</Label>
                            <Input
                                placeholder="例如: 电影感胶片工作流"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-zinc-900/50 border-white/5 h-12 rounded-xl focus:ring-1 focus:ring-primary/20 transition-all px-4 text-sm"
                            />
                        </div>

                        {/* JSON File Upload */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">ComfyUI JSON (可选)</Label>
                            <div
                                onClick={() => jsonInputRef.current?.click()}
                                className={cn(
                                    "h-14 rounded-xl border border-white/5 bg-zinc-900/50 flex items-center px-4 gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors group",
                                    fileName && "border-emerald-500/20 bg-emerald-500/[0.02]"
                                )}
                            >
                                <input
                                    type="file"
                                    ref={jsonInputRef}
                                    className="hidden"
                                    accept=".json"
                                    onChange={handleJsonUpload}
                                />
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                    fileName ? "bg-emerald-500/20 text-emerald-500" : "bg-white/5 text-zinc-500 group-hover:text-white"
                                )}>
                                    {fileName ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 flex flex-col min-w-0">
                                    <span className={cn(
                                        "text-[11px] font-medium truncate",
                                        fileName ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"
                                    )}>
                                        {fileName || "上传 API JSON 定义"}
                                    </span>
                                    {!fileName && <span className="text-[9px] text-zinc-700">ComfyUI 工作流 API 导出的 JSON</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-8 pt-0 flex-row gap-3">
                    <Button
                        variant="ghost"
                        className="flex-1 h-12 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest text-[10px]"
                        onClick={() => handleOpenChange(false)}
                    >
                        取消
                    </Button>
                    <Button
                        className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                        onClick={handleSubmit}
                        disabled={isUploading}
                    >
                        {isUploading ? "上传中..." : "创建配置"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
