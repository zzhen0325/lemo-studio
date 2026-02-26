"use client";

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { DatasetCollection } from "./DatasetManagerView";
import { Button } from "@/components/ui/button";
import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronUp, Download, Scissors, Wand2, Plus, Loader2, Trash2, Save, ListOrdered, X, LayoutGrid, List } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Slider } from "@/components/ui/slider";
import Image from "next/image";
import { ImageZoom } from "@/components/ui/shadcn-io/image-zoom";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import JSZip from "jszip";
import { useToast } from "@/hooks/common/use-toast";
import { createPortal } from "react-dom";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useAIService } from "@/hooks/ai/useAIService";
import { getApiBase } from "@/lib/api-base";
import { SortableImageCard } from "@/components/features/dataset/collection-detail/SortableImageCard";
import { ImageSizeBadge } from "@/components/features/dataset/collection-detail/ImageSizeBadge";
import type { CropMode, DatasetImage, TranslateLang } from "@/components/features/dataset/collection-detail/types";
import {
    deleteCollectionImage,
    deleteCollectionImages,
    fetchCollectionImages,
    renameCollection,
    renameCollectionBatch,
    saveCollectionOrder,
    translatePromptsBatch,
    updateCollectionData,
    uploadCollectionFilesBatch,
} from "@/components/features/dataset/collection-detail/collection-detail.service";


interface CollectionDetailProps {
    collection: DatasetCollection;
    onBack: () => void;
}

const PROMPT_MODIFIERS = [
    { id: "char_name", label: "角色名", text: "If there is a person/character in the image, they must be referred to as {name}." },
    { id: "exclude_fixed", label: "固定角色特征", text: "Do not include information about the person/character that cannot be changed (e.g., race, gender, etc.), but still include attributes that can be changed (e.g., hairstyle)." },
    { id: "light", label: "光照信息", text: "Include information about lighting." },
    { id: "angle", label: "拍摄角度", text: "Please provide shooting angle information." },
    { id: "comp", label: "构图风格", text: "Include information about the composition style of the image, such as leading lines, the rule of thirds, or symmetry." },
    { id: "no_meta", label: "消除AI对话信息", text: "Your response will be used by text-to-image models, so please avoid using useless meta phrases like \"This image shows...\", \"You are viewing...\", etc." },
];

const DATASET_LABEL_MODEL = 'doubao-seed-2-0-lite-260215';
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp']);
const UPLOAD_CONCURRENCY = 4;
const UPLOAD_BATCH_SIZE = 12;
const OPTIMIZE_CONCURRENCY = 4;
const OPTIMIZE_BATCH_SIZE = 8;
const OPTIMIZE_MAX_RETRIES = 2;
const RETRYABLE_OPTIMIZE_STATUS = new Set([429, 500, 502, 503, 504]);
const TRANSLATE_CONCURRENCY = 5;
const TRANSLATE_BATCH_SIZE = 20;
const TRANSLATE_MAX_RETRIES = 3;
const RETRYABLE_TRANSLATE_STATUS = new Set([429, 500, 502, 503, 504]);

function chunkArray<T>(items: T[], size: number): T[][] {
    if (size <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function mapWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
) {
    if (items.length === 0) return;
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) return;
            await worker(items[index], index);
        }
    });
    await Promise.all(runners);
}

async function sleepWithAbort(ms: number, signal?: AbortSignal) {
    if (!signal) {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return;
    }

    if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

async function fetchImageAsDataUrl(imageUrl: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(imageUrl, signal ? { signal } : undefined);
    if (!response.ok) {
        throw new Error(`Image fetch failed (${response.status})`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
        throw new Error(`Image fetch returned non-image content (${contentType || 'unknown'})`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
        throw new Error('Image fetch returned empty content');
    }

    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(blob);
    });
}

interface PromptTextareaProps {
    imageId: string;
    value: string;
    lang: TranslateLang;
    disabled?: boolean;
    onCommit: (id: string, value: string, lang: TranslateLang) => void;
    onEditingChange: (editing: boolean) => void;
}

const PromptTextarea = memo(function PromptTextarea({
    imageId,
    value,
    lang,
    disabled,
    onCommit,
    onEditingChange,
}: PromptTextareaProps) {
    const [draft, setDraft] = useState(value);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setDraft(value);
        }
    }, [value, isFocused]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        onEditingChange(false);
        if (draft !== value) {
            onCommit(imageId, draft, lang);
        }
    }, [draft, imageId, lang, onCommit, onEditingChange, value]);

    return (
        <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => {
                setIsFocused(true);
                onEditingChange(true);
            }}
            onBlur={handleBlur}
            className="w-full flex-1 placeholder:text-muted-foreground/50 bg-background/40 hover:bg-background/80 border border-white/5 hover:border-white/10 text-foreground text-sm leading-relaxed p-4 focus:bg-background focus:border-primary/40 focus:ring-4 focus:ring-primary/10 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none resize-none transition-all duration-300 rounded-xl custom-scrollbar min-h-[160px]"
            placeholder="Write image description here..."
            disabled={disabled}
        />
    );
});

interface SystemPromptTextareaProps {
    value: string;
    onCommit: (value: string) => void;
    onEditingChange: (editing: boolean) => void;
}

const SystemPromptTextarea = memo(function SystemPromptTextarea({
    value,
    onCommit,
    onEditingChange,
}: SystemPromptTextareaProps) {
    const [draft, setDraft] = useState(value);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setDraft(value);
        }
    }, [value, isFocused]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        onEditingChange(false);
        if (draft !== value) {
            onCommit(draft);
        }
    }, [draft, onCommit, onEditingChange, value]);

    return (
        <AutosizeTextarea
            value={draft}
            onFocus={() => {
                setIsFocused(true);
                onEditingChange(true);
            }}
            onBlur={handleBlur}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-background border-white/10 text-foreground text-sm p-4 focus:border-primary/50 rounded-xl min-h-[80px]"
            placeholder="What is in this image? Describe the main objects and context."
        />
    );
});

function getPromptByLang(image: DatasetImage, lang: TranslateLang): string {
    if (lang === 'en') {
        return image.promptEn || '';
    }
    return image.promptZh || '';
}

function setPromptByLang(
    image: DatasetImage,
    lang: TranslateLang,
    value: string,
    displayLang: TranslateLang,
): DatasetImage {
    const next = lang === 'en'
        ? { ...image, promptEn: value }
        : { ...image, promptZh: value };
    return {
        ...next,
        prompt: getPromptByLang(next, displayLang),
    };
}

function normalizePromptFields(image: DatasetImage, displayLang: TranslateLang): DatasetImage {
    const promptZh = image.promptZh ?? image.prompt ?? '';
    const promptEn = image.promptEn ?? '';
    return {
        ...image,
        promptZh,
        promptEn,
        prompt: displayLang === 'en' ? promptEn : promptZh,
    };
}

export default function CollectionDetail({ collection, onBack }: CollectionDetailProps) {
    const [images, setImages] = useState<DatasetImage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [systemPrompt, setSystemPrompt] = useState("");
    const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [batchPrefix, setBatchPrefix] = useState("");
    const [cropMode, setCropMode] = useState<CropMode>('center');
    const [targetSize, setTargetSize] = useState<string>('512');
    const [isBatchRenameDialogOpen, setIsBatchRenameDialogOpen] = useState(false);
    const [renamePrefix, setRenamePrefix] = useState("");
    const [pendingTask, setPendingTask] = useState<{ type: 'optimize' | 'translate', lang?: TranslateLang } | null>(null);
    const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
    const { toast, dismiss } = useToast();
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [gridColumns, setGridColumns] = useState<number>(5);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activePromptLang, setActivePromptLang] = useState<TranslateLang>('zh');
    const [promptDisplayLangById, setPromptDisplayLangById] = useState<Record<string, TranslateLang>>({});
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isAutoSavePaused, setIsAutoSavePaused] = useState(false);
    const [isPromptEditing, setIsPromptEditing] = useState(false);
    const [isSystemPromptEditing, setIsSystemPromptEditing] = useState(false);
    const cancelRef = useRef<AbortController | null>(null);
    const suppressSyncRef = useRef(false);
    const pendingSyncRefreshRef = useRef(false);
    const lastSavedSystemPromptRef = useRef("");
    const systemPromptRef = useRef("");
    const isPromptEditingRef = useRef(false);
    const isSystemPromptEditingRef = useRef(false);
    const activePromptLangRef = useRef<TranslateLang>('zh');
    const promptDisplayLangByIdRef = useRef<Record<string, TranslateLang>>({});
    const { callVision } = useAIService();

    // DnD Logic
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [draggedSize, setDraggedSize] = useState<{ width: number; height: number } | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const getDisplayLangForImage = useCallback((id: string): TranslateLang => {
        return promptDisplayLangByIdRef.current[id] ?? activePromptLangRef.current;
    }, []);

    const applySystemPrompt = useCallback((nextPrompt: string) => {
        systemPromptRef.current = nextPrompt;
        setSystemPrompt((prev) => (prev === nextPrompt ? prev : nextPrompt));
        setIsSystemPromptDirty(nextPrompt !== lastSavedSystemPromptRef.current);
    }, []);

    const handleScrollToTop = useCallback(() => {
        const container = document.getElementById('dataset-scroll-container');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    const handleSaveOrder = useCallback(async (newImages: DatasetImage[]) => {
        try {
            const order = newImages.map(img => img.filename);
            await saveCollectionOrder(collection.name, order);
        } catch (e) {
            console.error("Failed to save order", e);
        }
    }, [collection.name]);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setDraggedId(active.id as string);

        // Measure the dragged element to ensure overlay matches size
        // We need to delay slightly or just grab it directly if it exists
        // Note: The element might be transforming, but initial size should be correct
        // If we attached id={img.id} to the SortableImageCard div
        const node = document.getElementById(active.id as string);
        if (node) {
            const rect = node.getBoundingClientRect();
            setDraggedSize({ width: rect.width, height: rect.height });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setImages((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                handleSaveOrder(newItems);
                return newItems;
            });
        }
        setDraggedId(null);
        setDraggedSize(null);
    };

    const handleDeleteImage = async (img: DatasetImage) => {
        if (!window.confirm("Are you sure you want to delete this image?")) return;

        setIsProcessing(true);
        try {
            const res = await deleteCollectionImage(collection.name, img.filename);

            if (res.ok) {
                setImages(prev => prev.filter(i => i.id !== img.id));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(img.id);
                    return next;
                });
                toast({ title: "Deleted", description: "Image and prompt removed." });
            } else {
                throw new Error("Delete failed");
            }
        } catch {
            toast({ title: "Delete failed", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} images?`)) return;

        setIsProcessing(true);
        try {
            const filenames = images
                .filter(img => selectedIds.has(img.id))
                .map(img => img.filename);

            const res = await deleteCollectionImages(collection.name, filenames);

            if (res.ok) {
                setImages(prev => prev.filter(img => !selectedIds.has(img.id)));
                setSelectedIds(new Set());
                toast({ title: "Deleted", description: "Selected images and prompts removed." });
            } else {
                throw new Error("Batch delete failed");
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Delete failed", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    const toggleSelect = (id: string, shiftKey?: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);

            if (shiftKey && lastSelectedId && lastSelectedId !== id) {
                const currentIndex = images.findIndex(img => img.id === id);
                const lastIndex = images.findIndex(img => img.id === lastSelectedId);

                if (currentIndex !== -1 && lastIndex !== -1) {
                    const start = Math.min(currentIndex, lastIndex);
                    const end = Math.max(currentIndex, lastIndex);

                    for (let i = start; i <= end; i++) {
                        next.add(images[i].id);
                    }
                    return next;
                }
            }

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
        setLastSelectedId(id);
    };

    const selectAll = () => {
        setSelectedIds(new Set(images.map(img => img.id)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleSaveAllData = async () => {
        setIsProcessing(true);
        try {
            const promptsZhMap: Record<string, string> = {};
            const promptsEnMap: Record<string, string> = {};
            images.forEach(img => {
                promptsZhMap[img.filename] = getPromptByLang(img, 'zh');
                promptsEnMap[img.filename] = getPromptByLang(img, 'en');
            });

            const [zhRes, enRes, systemRes] = await Promise.all([
                updateCollectionData({
                    collection: collection.name,
                    prompts: promptsZhMap,
                    promptLang: 'zh',
                }),
                updateCollectionData({
                    collection: collection.name,
                    prompts: promptsEnMap,
                    promptLang: 'en',
                }),
                updateCollectionData({
                    collection: collection.name,
                    systemPrompt,
                }),
            ]);

            if (!zhRes.ok || !enRes.ok || !systemRes.ok) {
                throw new Error("Batch save failed");
            }

            setDirtyIds(new Set()); // Clear any dirty tracking
            lastSavedSystemPromptRef.current = systemPrompt;
            setIsSystemPromptDirty(false);
            toast({ title: "Save Success", description: "All prompts and config saved." });
        } catch (error) {
            console.error("Save all failed", error);
            toast({ title: "Save Failed", description: "Check network connection.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const processCrop = async (img: DatasetImage, mode: CropMode, sizeStr: string): Promise<DatasetImage> => {
        const image = new window.Image();
        image.src = img.url;
        await new Promise((resolve) => (image.onload = resolve));

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return img;

        const size = sizeStr === 'original' ? (mode === 'center' ? Math.min(image.width, image.height) : Math.max(image.width, image.height)) : parseInt(sizeStr);

        if (mode === 'center') {
            canvas.width = size;
            canvas.height = size;
            const sourceSize = Math.min(image.width, image.height);
            ctx.drawImage(
                image,
                (image.width - sourceSize) / 2, (image.height - sourceSize) / 2, sourceSize, sourceSize,
                0, 0, size, size
            );
        } else {
            const ratio = size / Math.max(image.width, image.height);
            canvas.width = Math.round(image.width * ratio);
            canvas.height = Math.round(image.height * ratio);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        }

        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
        const newUrl = URL.createObjectURL(blob);
        return { ...img, url: newUrl };
    };

    const handleBatchCrop = async () => {
        if (images.length === 0) return;
        setIsProcessing(true);
        try {
            const croppedImages = await Promise.all(images.map(img => processCrop(img, cropMode, targetSize)));
            setImages(croppedImages);
            toast({ title: "Crop complete", description: `All images processed (${cropMode === 'center' ? 'Center Crop' : 'Scale'})` });
        } catch (error) {
            console.error("Batch crop failed", error);
            toast({ title: "Crop failed", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };


    const handleExport = async () => {
        if (images.length === 0) return;
        setIsProcessing(true);

        try {
            const zip = new JSZip();

            for (const img of images) {
                const response = await fetch(img.url);
                const blob = await response.blob();
                const baseName = img.filename.replace(/\.[^/.]+$/, "");

                zip.file(img.filename, blob);
                zip.file(`${baseName}.txt`, img.prompt);
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `${collection.name}.zip`;
            link.click();

            toast({ title: "Export success", description: "Dataset ZIP is ready for download." });
        } catch {
            toast({ title: "Export failed", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const [activeTags, setActiveTags] = useState<string[]>([]);

    const handleAddPrefix = () => {
        if (!batchPrefix.trim()) return;
        const prefix = batchPrefix.trim();
        const currentLang = activePromptLangRef.current;

        // If there are selected images, only apply to them. Otherwise apply to all.
        const targets = selectedIds.size > 0
            ? images.filter(img => selectedIds.has(img.id))
            : images;

        if (targets.length === 0) return;

        // Add to active tags if not present
        if (!activeTags.includes(prefix)) {
            setActiveTags([...activeTags, prefix]);
        }

        const newImages = images.map(img => {
            const isTarget = selectedIds.size > 0 ? selectedIds.has(img.id) : true;
            if (!isTarget) return img;

            const originalPrompt = getPromptByLang(img, currentLang) || "";
            let newPrompt = originalPrompt;
            // Check if prompt already starts with prefix
            const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,\\s*)?`, 'i');
            if (regex.test(newPrompt)) return img; // Already has prefix

            if (newPrompt) {
                newPrompt = `${prefix}, ${newPrompt}`;
            } else {
                newPrompt = prefix;
            }

            // Add to dirty list if changed
            if (newPrompt !== originalPrompt) {
                setDirtyIds(prev => new Set(prev).add(img.id));
            }
            return setPromptByLang(img, currentLang, newPrompt, currentLang);
        });
        setImages(newImages);
        toast({
            title: selectedIds.size > 0 ? "批量打标成功" : "Prefix Added",
            description: selectedIds.size > 0
                ? `已为选中的 ${selectedIds.size} 张图片添加了前缀 "${prefix}"。`
                : `Added "${prefix}" to all images.`,
        });
        setBatchPrefix("");
    };

    const handleRemoveTag = (tag: string) => {
        const prefix = tag.trim();
        const currentLang = activePromptLangRef.current;
        const newImages = images.map(img => {
            const originalPrompt = getPromptByLang(img, currentLang) || "";
            let newPrompt = originalPrompt;
            // Escape special regex characters in the tag
            const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`^${escapedPrefix}(,\\s*)?`, 'i'); // Match prefix at start, optional comma space

            if (regex.test(newPrompt)) {
                newPrompt = newPrompt.replace(regex, '');
                // Add to dirty list if changed
                setDirtyIds(prev => new Set(prev).add(img.id));
                return setPromptByLang(img, currentLang, newPrompt, currentLang);
            }
            return img;
        });
        setImages(newImages);
        setActiveTags(prev => prev.filter(t => t !== tag));
        toast({
            title: "Prefix Removed",
            description: `Removed "${prefix}" from matching images.`,
        });
    };
    const dirtyIdsRef = useRef<Set<string>>(new Set());
    const isSystemPromptDirtyRef = useRef(false);

    const fetchImages = useCallback(async () => {
        try {
            setIsProcessing(true);
            const res = await fetchCollectionImages(collection.name);
            if (!res.ok) {
                let errMsg = "Failed to load collection images.";
                try {
                    const data = await res.json();
                    errMsg = data?.error || errMsg;
                } catch { /* ignore */ }
                toast({ title: "加载失败", description: errMsg, variant: "destructive" });
                setImages([]);
                return;
            }
            const data = await res.json();

            // Smart Merge: Only update non-dirty images
            setImages(prev => {
                const incomingImages = ((data.images || []) as DatasetImage[])
                    .map((img) => normalizePromptFields(img, getDisplayLangForImage(img.id)));
                const currentDirty = dirtyIdsRef.current;

                if (currentDirty.size === 0) return incomingImages;

                return incomingImages.map(img => {
                    if (currentDirty.has(img.id)) {
                        const localImg = prev.find(p => p.id === img.id);
                        if (!localImg) return img;
                        return {
                            ...img,
                            prompt: localImg.prompt,
                            promptZh: localImg.promptZh,
                            promptEn: localImg.promptEn,
                        };
                    }
                    return img;
                });
            });

            setPromptDisplayLangById((prev) => {
                const incomingIds = new Set(((data.images || []) as DatasetImage[]).map((img) => img.id));
                let changed = false;
                const next: Record<string, TranslateLang> = {};
                Object.entries(prev).forEach(([id, lang]) => {
                    if (incomingIds.has(id)) {
                        next[id] = lang;
                    } else {
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });

            if (!isSystemPromptDirtyRef.current) {
                const nextSystemPrompt = data.systemPrompt || "";
                systemPromptRef.current = nextSystemPrompt;
                setSystemPrompt(nextSystemPrompt);
                lastSavedSystemPromptRef.current = nextSystemPrompt;
            }
        } catch (error) {
            console.error("Failed to fetch images", error);
            toast({ title: "加载失败", description: "无法读取数据集图片", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    }, [collection.name, getDisplayLangForImage, toast]); // Now only depends on collection.name

    useEffect(() => {
        fetchImages();

        // Real-time synchronization
        const eventSource = new EventSource(`${getApiBase()}/dataset/sync`);
        const handleSyncMessage = (event: MessageEvent) => {
            if (event.data === 'refresh') {
                if (suppressSyncRef.current || isPromptEditingRef.current || isSystemPromptEditingRef.current) {
                    pendingSyncRefreshRef.current = true;
                    return;
                }
                fetchImages();
            }
        };
        eventSource.addEventListener('sync', handleSyncMessage as EventListener);
        eventSource.onmessage = handleSyncMessage;

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.removeEventListener('sync', handleSyncMessage as EventListener);
            eventSource.close();
        };
    }, [fetchImages]);

    useEffect(() => {
        if (isPromptEditing || isSystemPromptEditing) return;
        if (suppressSyncRef.current) return;
        if (!pendingSyncRefreshRef.current) return;
        pendingSyncRefreshRef.current = false;
        void fetchImages();
    }, [isPromptEditing, isSystemPromptEditing, fetchImages]);

    useEffect(() => {
        const container = document.getElementById('dataset-scroll-container');
        const handleScroll = () => {
            const currentScroll = container ? container.scrollTop : window.scrollY;
            setShowScrollTop(currentScroll > 320);
        };
        handleScroll();

        if (container) {
            container.addEventListener('scroll', handleScroll, { passive: true });
            return () => container.removeEventListener('scroll', handleScroll);
        } else {
            window.addEventListener('scroll', handleScroll, { passive: true });
            return () => window.removeEventListener('scroll', handleScroll);
        }
    }, []);

    const processUploadFiles = async (files: File[]) => {
        if (files.length === 0) return;

        setIsProcessing(true);
        setProgress({ current: 0, total: files.length });
        suppressSyncRef.current = true;
        pendingSyncRefreshRef.current = false;
        let refreshed = false;

        try {
            // 1. 分类文件并读取 txt 内容
            const imageFiles: File[] = [];
            const promptMap: Record<string, string> = {};
            const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));

            // 读取所有 txt 文件内容
            await Promise.all(txtFiles.map(async (file) => {
                const text = await file.text();
                const baseName = file.name.replace(/\.txt$/i, '');
                promptMap[baseName] = text.trim();
            }));

            // 获取图片文件
            files.forEach(file => {
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (ext && IMAGE_EXTENSIONS.has(ext)) {
                    imageFiles.push(file);
                }
            });

            if (imageFiles.length === 0) {
                toast({ title: "No images found", description: "Only .txt files were provided.", variant: "destructive" });
                return;
            }

            const uploadedImages: DatasetImage[] = [];
            const promptUpdates: Record<string, string> = {};
            let successCount = 0;
            let processedCount = 0;
            setProgress({ current: 0, total: imageFiles.length });

            const uploadChunks = chunkArray(imageFiles, UPLOAD_BATCH_SIZE);
            await mapWithConcurrency(uploadChunks, UPLOAD_CONCURRENCY, async (chunkFiles) => {
                try {
                    const chunkPromptMap: Record<string, string> = {};
                    chunkFiles.forEach((file, index) => {
                        const baseName = file.name.replace(/\.[^/.]+$/, "");
                        const promptText = promptMap[baseName];
                        if (promptText) {
                            chunkPromptMap[`#${index}`] = promptText;
                            chunkPromptMap[String(index)] = promptText;
                            chunkPromptMap[baseName] = promptText;
                            chunkPromptMap[file.name] = promptText;
                        }
                    });

                    const res = await uploadCollectionFilesBatch(collection.name, chunkFiles, chunkPromptMap);
                    const data = await res.json().catch(() => ({})) as {
                        error?: string;
                        uploaded?: Array<{ filename: string; url: string; prompt?: string }>;
                    };

                    if (!res.ok) {
                        throw new Error(data.error || `Upload failed (${res.status})`);
                    }

                    const uploaded = data.uploaded || [];
                    successCount += uploaded.length;

                    uploaded.forEach((item: { filename: string; url: string; prompt?: string }) => {
                        const prompt = item.prompt || '';
                        const currentLang = activePromptLangRef.current;
                        uploadedImages.push({
                            id: item.filename,
                            filename: item.filename,
                            url: item.url,
                            prompt,
                            promptZh: currentLang === 'zh' ? prompt : '',
                            promptEn: currentLang === 'en' ? prompt : '',
                        });
                        if (prompt) {
                            promptUpdates[item.filename] = prompt;
                        }
                    });
                } catch (error) {
                    console.error('Batch upload chunk failed', error);
                } finally {
                    processedCount += chunkFiles.length;
                    setProgress({ current: Math.min(processedCount, imageFiles.length), total: imageFiles.length });
                }
            });

            if (successCount === 0) {
                throw new Error('No files uploaded successfully');
            }

            if (Object.keys(promptUpdates).length > 0) {
                const persistRes = await updateCollectionData({
                    collection: collection.name,
                    prompts: promptUpdates,
                    promptLang: activePromptLangRef.current,
                });
                if (!persistRes.ok) {
                    throw new Error('Prompt association failed after upload');
                }
            }

            if (uploadedImages.length > 0) {
                setImages((prev) => [...prev, ...uploadedImages]);
            }

            await fetchImages();
            refreshed = true;
            toast({ title: "Upload complete", description: `Uploaded ${successCount}/${imageFiles.length} images with associated prompts.` });
        } catch (error) {
            console.error('Upload failed', error);
            toast({ title: "Upload failed", variant: "destructive" });
        } finally {
            suppressSyncRef.current = false;
            if (!refreshed && pendingSyncRefreshRef.current) {
                await fetchImages();
            }
            pendingSyncRefreshRef.current = false;
            setIsProcessing(false);
            setProgress(null);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        processUploadFiles(files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        processUploadFiles(files);
    };

    const handleBatchRename = async () => {
        if (!renamePrefix) {
            toast({ title: "Error", description: "Prefix is required", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        try {
            // First save any pending prompt changes
            await handleSaveAllData();

            const res = await renameCollectionBatch(collection.name, renamePrefix);

            if (res.ok) {
                toast({ title: "Success", description: "Batch rename complete." });
                setIsBatchRenameDialogOpen(false);
                fetchImages(); // Refresh to see new filenames
            } else {
                const data = await res.json();
                toast({ title: "Failed", description: data.error || "Rename failed", variant: "destructive" });
            }
        } catch (error) {
            console.error('Batch rename error', error);
            toast({ title: "Error", description: "Internal server error", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
    const [isSystemPromptDirty, setIsSystemPromptDirty] = useState(false);

    // Sync refs with state for use in useCallback without changing dependencies
    useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);
    useEffect(() => { dirtyIdsRef.current = dirtyIds; }, [dirtyIds]);
    useEffect(() => { isSystemPromptDirtyRef.current = isSystemPromptDirty; }, [isSystemPromptDirty]);
    useEffect(() => { isPromptEditingRef.current = isPromptEditing; }, [isPromptEditing]);
    useEffect(() => { isSystemPromptEditingRef.current = isSystemPromptEditing; }, [isSystemPromptEditing]);
    useEffect(() => { activePromptLangRef.current = activePromptLang; }, [activePromptLang]);
    useEffect(() => { promptDisplayLangByIdRef.current = promptDisplayLangById; }, [promptDisplayLangById]);
    useEffect(() => {
        setImages((prev) => prev.map((img) => normalizePromptFields(img, getDisplayLangForImage(img.id))));
    }, [activePromptLang, getDisplayLangForImage]);

    const handlePromptChange = useCallback((id: string, newPrompt: string, lang?: TranslateLang) => {
        const currentLang = lang || getDisplayLangForImage(id);
        setImages((prev: DatasetImage[]) => prev.map((img: DatasetImage) => (
            img.id === id
                ? (getPromptByLang(img, currentLang) === newPrompt
                    ? img
                    : setPromptByLang(img, currentLang, newPrompt, currentLang))
                : img
        )));
        setDirtyIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, [getDisplayLangForImage]);

    // Unified auto-save with debounce
    useEffect(() => {
        if (isAutoSavePaused || isPromptEditing) return;
        const shouldSaveSystemPrompt = isSystemPromptDirty && !isSystemPromptEditing;
        if (dirtyIds.size === 0 && !shouldSaveSystemPrompt) return;

        const timer = setTimeout(async () => {
            const currentDirtyIds = Array.from(dirtyIds);
            const currentSystemPromptDirty = isSystemPromptDirty && !isSystemPromptEditing;
            const currentSystemPrompt = systemPrompt;
            const previousSuppressSync = suppressSyncRef.current;
            suppressSyncRef.current = true;

            // Do not clear flags optimistically to prevent SSE from overwriting during the save process
            try {
                if (currentDirtyIds.length > 0) {
                    const promptsZhToUpdate: Record<string, string> = {};
                    const promptsEnToUpdate: Record<string, string> = {};
                    currentDirtyIds.forEach(id => {
                        const img = images.find(i => i.id === id);
                        if (img) {
                            promptsZhToUpdate[img.filename] = getPromptByLang(img, 'zh');
                            promptsEnToUpdate[img.filename] = getPromptByLang(img, 'en');
                        }
                    });

                    const [zhRes, enRes] = await Promise.all([
                        updateCollectionData({
                            collection: collection.name,
                            prompts: promptsZhToUpdate,
                            promptLang: 'zh',
                        }),
                        updateCollectionData({
                            collection: collection.name,
                            prompts: promptsEnToUpdate,
                            promptLang: 'en',
                        }),
                    ]);
                    if (!zhRes.ok || !enRes.ok) {
                        throw new Error("Save failed");
                    }
                }

                if (currentSystemPromptDirty) {
                    const systemRes = await updateCollectionData({
                        collection: collection.name,
                        systemPrompt: currentSystemPrompt,
                    });
                    if (!systemRes.ok) {
                        throw new Error("Save failed");
                    }
                }

                if (currentDirtyIds.length > 0) {
                    setDirtyIds(prev => {
                        const next = new Set(prev);
                        currentDirtyIds.forEach(id => next.delete(id));
                        return next;
                    });
                }
                if (currentSystemPromptDirty) {
                    lastSavedSystemPromptRef.current = currentSystemPrompt;
                    setIsSystemPromptDirty(false);
                }
                pendingSyncRefreshRef.current = false;
            } catch (error) {
                console.error("Auto-save failed", error);
                // Re-mark as dirty on failure so it retries or allows manual save
                if (currentDirtyIds.length > 0) {
                    setDirtyIds(prev => new Set([...Array.from(prev), ...currentDirtyIds]));
                }
                if (currentSystemPromptDirty) {
                    setIsSystemPromptDirty(currentSystemPrompt !== lastSavedSystemPromptRef.current);
                }
                toast({ title: "同步失败", description: "自动保存暂不可用", variant: "destructive" });
            } finally {
                suppressSyncRef.current = previousSuppressSync;
            }
        }, 2000); // Slightly longer debounce for batch efficiency

        return () => clearTimeout(timer);
    }, [dirtyIds, isPromptEditing, isSystemPromptDirty, isSystemPromptEditing, collection.name, images, systemPrompt, toast, isAutoSavePaused]);

    const handleModifierChange = useCallback((modifierText: string, checked: boolean) => {
        let newPrompt = systemPromptRef.current.trim();
        if (checked) {
            if (!newPrompt.includes(modifierText)) {
                newPrompt = newPrompt ? `${newPrompt}\n\n${modifierText}` : modifierText;
            }
        } else {
            // Remove with possible extra newlines
            newPrompt = newPrompt.replace(modifierText, "").replace(/\n\n+/g, "\n\n").trim();
        }
        applySystemPrompt(newPrompt);
    }, [applySystemPrompt]);

    const requestDatasetLabel = async (imageBase64: string): Promise<string> => {
        const userPrompt = '请描述这张图片';
        let primaryError: unknown = null;

        try {
            const primary = await callVision({
                image: imageBase64,
                systemPrompt: systemPrompt || undefined,
                model: DATASET_LABEL_MODEL,
                prompt: userPrompt,
            });
            const primaryText = primary.text?.trim() || '';
            if (primaryText) {
                return primaryText;
            }
        } catch (error) {
            primaryError = error;
        }

        // Fallback: retry without system prompt to quickly distinguish prompt issues.
        if (systemPrompt.trim()) {
            try {
                const fallback = await callVision({
                    image: imageBase64,
                    model: DATASET_LABEL_MODEL,
                    prompt: userPrompt,
                });
                const fallbackText = fallback.text?.trim() || '';
                if (fallbackText) {
                    console.warn('[dataset] optimize fallback succeeded without systemPrompt');
                    return fallbackText;
                }
            } catch (fallbackError) {
                const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                if (primaryError) {
                    const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
                    throw new Error(`${primaryMsg}; fallback failed: ${fallbackMsg}`);
                }
                throw fallbackError;
            }
            if (primaryError) {
                throw primaryError;
            }
            throw new Error('Model returned empty text (with and without systemPrompt)');
        }

        if (primaryError) {
            throw primaryError;
        }
        throw new Error('Model returned empty text');
    };

    const isRetryableOptimizeError = (error: unknown): boolean => {
        const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
        if (message.includes('empty text')) return true;
        if (message.includes('network') || message.includes('timeout') || message.includes('failed to fetch')) return true;
        return Array.from(RETRYABLE_OPTIMIZE_STATUS).some((status) => message.includes(String(status)));
    };

    const optimizeImageWithRetry = async (img: DatasetImage, signal: AbortSignal): Promise<string> => {
        const base64 = await fetchImageAsDataUrl(img.url, signal);
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= OPTIMIZE_MAX_RETRIES; attempt++) {
            if (signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            try {
                return await requestDatasetLabel(base64);
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    throw error;
                }
                lastError = error instanceof Error ? error : new Error('Optimize request failed');
                if (!isRetryableOptimizeError(error) || attempt === OPTIMIZE_MAX_RETRIES) {
                    break;
                }
                await sleepWithAbort((600 * (2 ** attempt)) + Math.floor(Math.random() * 250), signal);
            }
        }

        throw lastError || new Error('Optimize request failed');
    };





    const handleOptimizeAll = async () => {
        if (isProcessing) {
            setPendingTask({ type: 'optimize' });
            setIsConflictDialogOpen(true);
            return;
        }
        startOptimizeAll();
    };

    const handleOptimizeSelected = async () => {
        if (selectedIds.size === 0) return;
        if (isProcessing) {
            setPendingTask({ type: 'optimize' });
            setIsConflictDialogOpen(true);
            return;
        }
        const targets = images.filter(img => selectedIds.has(img.id));
        startOptimizeAll(targets);
    };

    const startOptimizeAll = async (specificTargets?: DatasetImage[]) => {
        const targets = specificTargets || images;
        if (targets.length === 0) {
            toast({ title: "无图片", description: "没有可优化的图片。" });
            return;
        }
        const optimizeLang = activePromptLangRef.current;
        // Optimize specified images or ALL images
        setIsProcessing(true);
        setProgress({ current: 0, total: targets.length });
        suppressSyncRef.current = true;
        pendingSyncRefreshRef.current = false;

        // Initialize cancel controller
        const controller = new AbortController();
        cancelRef.current = controller;

        const toastId = toast({
            title: "批量优化中...",
            description: `准备中: 0/${targets.length}`,
            duration: Infinity, // Maintain visibility
            action: (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-semibold hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                        controller.abort();
                        dismiss(toastId);
                    }}
                >
                    Cancel
                </Button>
            ),
        });

        try {
            let success = 0;
            let processedCount = 0;
            let persistFailed = 0;

            const targetChunks = chunkArray(targets, OPTIMIZE_BATCH_SIZE);
            await mapWithConcurrency(targetChunks, OPTIMIZE_CONCURRENCY, async (chunkTargets) => {
                if (controller.signal.aborted) {
                    return;
                }

                const chunkIds = new Set(chunkTargets.map((item) => item.id));
                setImages((prev) => prev.map((item) => (
                    chunkIds.has(item.id) ? { ...item, isOptimizing: true } : item
                )));

                const chunkPrompts: Record<string, string> = {};
                const chunkSucceededIds: string[] = [];
                let chunkProcessed = 0;

                for (const img of chunkTargets) {
                    if (controller.signal.aborted) {
                        break;
                    }

                    try {
                        const newPrompt = await optimizeImageWithRetry(img, controller.signal);
                        chunkPrompts[img.filename] = newPrompt;
                        chunkSucceededIds.push(img.id);
                        success += 1;
                    } catch (error) {
                        if (error instanceof DOMException && error.name === 'AbortError') {
                            break;
                        }
                        console.error('[dataset] optimize failed for image', img.filename, error);
                    } finally {
                        chunkProcessed += 1;
                    }
                }

                if (!controller.signal.aborted && Object.keys(chunkPrompts).length > 0) {
                    try {
                        const persistRes = await updateCollectionData({
                            collection: collection.name,
                            prompts: chunkPrompts,
                            promptLang: optimizeLang,
                        }, controller.signal);

                        if (!persistRes.ok) {
                            persistFailed += Object.keys(chunkPrompts).length;
                            const failedIds = new Set(chunkSucceededIds);
                            setDirtyIds((prev) => {
                                const next = new Set(prev);
                                failedIds.forEach((id) => next.add(id));
                                return next;
                            });
                        } else {
                            const succeededIds = new Set(chunkSucceededIds);
                            setDirtyIds((prev) => {
                                const next = new Set(prev);
                                succeededIds.forEach((id) => next.delete(id));
                                return next;
                            });
                        }
                    } catch (error) {
                        if (!(error instanceof DOMException && error.name === 'AbortError')) {
                            console.error('[dataset] optimize persist failed for chunk', error);
                        }
                        persistFailed += Object.keys(chunkPrompts).length;
                        const failedIds = new Set(chunkSucceededIds);
                        setDirtyIds((prev) => {
                            const next = new Set(prev);
                            failedIds.forEach((id) => next.add(id));
                            return next;
                        });
                    }
                }

                const promptById = new Map(
                    chunkTargets
                        .filter((item) => chunkPrompts[item.filename])
                        .map((item) => [item.id, chunkPrompts[item.filename]])
                );

                setImages((prev) => prev.map((item) => {
                    if (!chunkIds.has(item.id)) return item;
                    const nextPrompt = promptById.get(item.id);
                    if (!nextPrompt) {
                        return { ...item, isOptimizing: false };
                    }
                    const nextImage = setPromptByLang(item, optimizeLang, nextPrompt, activePromptLangRef.current);
                    return {
                        ...nextImage,
                        isOptimizing: false,
                    };
                }));

                processedCount += chunkProcessed;
                setProgress({ current: Math.min(processedCount, targets.length), total: targets.length });
                toast({
                    id: toastId,
                    title: "批量优化中...",
                    description: `已处理 ${Math.min(processedCount, targets.length)}/${targets.length} 张...`,
                    duration: Infinity,
                });
            });

            if (!controller.signal.aborted) {
                dismiss(toastId);
                toast({
                    title: "优化完成",
                    description: persistFailed > 0
                        ? `成功生成 ${success}/${targets.length} 张，${persistFailed} 张保存失败（已标记待自动保存）。`
                        : `成功生成 ${success}/${targets.length} 张图片的提示词。`
                });
            } else {
                toast({
                    title: "任务已取消",
                    description: `已处理 ${success} 张后中止。`
                });
            }
        } catch (error) {
            dismiss(toastId);
            toast({
                title: "优化失败",
                variant: "destructive",
                description: error instanceof Error ? error.message : "发生未知错误，请重试。"
            });
        } finally {
            suppressSyncRef.current = false;
            if (pendingSyncRefreshRef.current) {
                pendingSyncRefreshRef.current = false;
                await fetchImages();
            }
            setIsProcessing(false);
            setProgress(null);
            cancelRef.current = null;
        }
    };

    const handleOptimizePrompt = async (img: DatasetImage) => {
        // Set local loading
        setImages(prev => prev.map(i => i.id === img.id ? { ...i, isOptimizing: true } : i));

        try {
            // Convert URL to Base64
            const base64 = await fetchImageAsDataUrl(img.url);
            const optimizedText = await requestDatasetLabel(base64);

            // Add batch prefix if exists
            let newPrompt = optimizedText;
            if (batchPrefix?.trim()) {
                const prefix = batchPrefix.trim();
                if (!newPrompt.toLowerCase().startsWith(prefix.toLowerCase())) {
                    newPrompt = `${prefix}, ${newPrompt}`;
                }
            }

            handlePromptChange(img.id, newPrompt);
            toast({
                title: "Optimized successfully",
                description: "Image prompt has been generated by AI."
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Optimization failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
            });
        } finally {
            setImages(prev => prev.map(i => i.id === img.id ? { ...i, isOptimizing: false } : i));
        }
    };

    const handleCropImage = async (img: DatasetImage) => {
        setIsProcessing(true);
        try {
            const updated = await processCrop(img, cropMode, targetSize);
            setImages(prev => prev.map(i => i.id === img.id ? updated : i));
            toast({ title: "Crop complete", description: "Image cropped successfully." });
        } catch {
            toast({ title: "Crop failed", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };


    const handlePromptLangSwitch = async (targetLang: TranslateLang) => {
        const sourceLang = activePromptLangRef.current;
        if (targetLang === sourceLang) return;

        if (isProcessing) {
            setPendingTask({ type: 'translate', lang: targetLang });
            setIsConflictDialogOpen(true);
            return;
        }

        const scopeTargets = images;

        if (scopeTargets.length === 0) {
            setActivePromptLang(targetLang);
            return;
        }

        setPromptDisplayLangById(() => {
            const next: Record<string, TranslateLang> = {};
            scopeTargets.forEach((img) => {
                next[img.id] = targetLang;
            });
            return next;
        });
        setActivePromptLang(targetLang);

        const hasSourcePrompt = scopeTargets.some((img) => getPromptByLang(img, sourceLang).trim().length > 0);
        if (!hasSourcePrompt) {
            toast({
                title: "已切换语言",
                description: targetLang === 'zh' ? "当前没有可翻译的英文内容。" : "当前没有可翻译的中文内容。",
            });
            return;
        }

        startBatchTranslate(targetLang, scopeTargets);
    };

    const handleImagePromptLangSwitch = async (img: DatasetImage, targetLang: TranslateLang) => {
        const sourceLang = getDisplayLangForImage(img.id);
        if (targetLang === sourceLang) return;
        if (img.isOptimizing || img.isTranslating) return;

        const sourceText = getPromptByLang(img, sourceLang).trim();
        const targetText = getPromptByLang(img, targetLang).trim();

        setPromptDisplayLangById((prev) => ({ ...prev, [img.id]: targetLang }));

        if (targetText) {
            setImages((prev) => prev.map((item) => (
                item.id === img.id ? normalizePromptFields(item, targetLang) : item
            )));
            return;
        }

        if (!sourceText) {
            setImages((prev) => prev.map((item) => (
                item.id === img.id ? normalizePromptFields(item, targetLang) : item
            )));
            toast({
                title: "已切换语言",
                description: targetLang === 'zh' ? "当前图片没有可翻译的英文内容。" : "当前图片没有可翻译的中文内容。",
            });
            return;
        }

        setImages((prev) => prev.map((item) => (
            item.id === img.id ? { ...item, isTranslating: true } : item
        )));

        const controller = new AbortController();
        try {
            const translatedTexts = await requestBatchTranslateWithRetry([sourceText], targetLang, controller.signal);
            const translatedText = (translatedTexts[0] || sourceText).trim() || sourceText;

            setImages((prev) => prev.map((item) => {
                if (item.id !== img.id) return item;
                const next = setPromptByLang(item, targetLang, translatedText, targetLang);
                return {
                    ...next,
                    isTranslating: false,
                };
            }));

            const persistRes = await updateCollectionData({
                collection: collection.name,
                prompts: { [img.filename]: translatedText },
                promptLang: targetLang,
            });
            if (!persistRes.ok) {
                throw new Error('Failed to persist translated prompt');
            }

            setDirtyIds((prev) => {
                const next = new Set(prev);
                next.delete(img.id);
                return next;
            });
        } catch (error) {
            console.error('Single translation failed', error);
            setPromptDisplayLangById((prev) => ({ ...prev, [img.id]: sourceLang }));
            setImages((prev) => prev.map((item) => (
                item.id === img.id
                    ? { ...normalizePromptFields(item, sourceLang), isTranslating: false }
                    : item
            )));
            toast({
                title: "翻译失败",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
            });
        }
    };

    const requestBatchTranslateWithRetry = async (
        texts: string[],
        targetLang: TranslateLang,
        signal: AbortSignal,
    ) => {
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= TRANSLATE_MAX_RETRIES; attempt++) {
            if (signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }
            try {
                const response = await translatePromptsBatch(texts, targetLang, signal);
                const data = await response.json().catch(() => ({} as {
                    error?: string;
                    translatedText?: string;
                    translatedTexts?: string[];
                }));

                if (!response.ok) {
                    const message = data.error || `Translation failed (${response.status})`;
                    if (!RETRYABLE_TRANSLATE_STATUS.has(response.status) || attempt === TRANSLATE_MAX_RETRIES) {
                        throw new Error(message);
                    }
                    await sleepWithAbort((500 * (2 ** attempt)) + Math.floor(Math.random() * 200), signal);
                    continue;
                }

                if (Array.isArray(data.translatedTexts) && data.translatedTexts.length > 0) {
                    return data.translatedTexts;
                }
                if (typeof data.translatedText === 'string') {
                    return [data.translatedText];
                }
                throw new Error('No translation returned');
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    throw error;
                }
                lastError = error instanceof Error ? error : new Error('Translation request failed');
                if (attempt === TRANSLATE_MAX_RETRIES) {
                    break;
                }
                await sleepWithAbort((500 * (2 ** attempt)) + Math.floor(Math.random() * 200), signal);
            }
        }

        throw lastError || new Error('Translation failed');
    };

    const startBatchTranslate = async (targetLang: TranslateLang, specificTargets?: DatasetImage[]) => {
        const baseTargets = specificTargets || images;
        if (baseTargets.length === 0) {
            toast({ title: "No images", description: "This collection is empty." });
            return;
        }

        const sourceLang = activePromptLangRef.current;
        if (targetLang === sourceLang) {
            toast({
                title: "语言未变化",
                description: targetLang === 'zh' ? "当前已在中文版本。" : "当前已在英文版本。",
            });
            return;
        }

        setPromptDisplayLangById((prev) => {
            const next = { ...prev };
            baseTargets.forEach((img) => {
                next[img.id] = targetLang;
            });
            return next;
        });
        setActivePromptLang(targetLang);

        // Only translate entries that have source text and no existing target text.
        const targets = baseTargets.filter((img) => {
            const sourceText = getPromptByLang(img, sourceLang).trim();
            const existingTargetText = getPromptByLang(img, targetLang).trim();
            return sourceText.length > 0 && existingTargetText.length === 0;
        });
        if (targets.length === 0) {
            toast({
                title: "已切换语言",
                description: targetLang === 'zh'
                    ? "当前图片已有中文文本，未重复翻译。"
                    : "当前图片已有英文文本，未重复翻译。",
            });
            return;
        }

        setIsProcessing(true);
        setProgress({ current: 0, total: targets.length });
        setIsAutoSavePaused(true);
        suppressSyncRef.current = true;
        pendingSyncRefreshRef.current = false;

        // Initialize cancel controller
        const controller = new AbortController();
        cancelRef.current = controller;

        let successCount = 0;
        let processedCount = 0;
        const translatedPromptMap: Record<string, string> = {};
        const translatedIds = new Set<string>();

        try {
            const targetChunks = chunkArray(targets, TRANSLATE_BATCH_SIZE);
            await mapWithConcurrency(targetChunks, TRANSLATE_CONCURRENCY, async (chunkTargets) => {
                if (controller.signal.aborted) {
                    processedCount += chunkTargets.length;
                    setProgress({ current: Math.min(processedCount, targets.length), total: targets.length });
                    return;
                }

                const chunkIds = new Set(chunkTargets.map((item) => item.id));
                setImages((prev) => prev.map((img) => (
                    chunkIds.has(img.id) ? { ...img, isTranslating: true } : img
                )));

                try {
                    const sourceTexts = chunkTargets.map((item) => getPromptByLang(item, sourceLang));
                    const translatedTexts = await requestBatchTranslateWithRetry(sourceTexts, targetLang, controller.signal);
                    const translatedById = new Map<string, string>();

                    chunkTargets.forEach((item, index) => {
                        const fallbackText = getPromptByLang(item, sourceLang);
                        const translatedText = (translatedTexts[index] || fallbackText).trim() || fallbackText;
                        translatedById.set(item.id, translatedText);
                        translatedPromptMap[item.filename] = translatedText;
                        translatedIds.add(item.id);
                        successCount += 1;
                    });

                    setImages((prev) => prev.map((img) => {
                        if (!translatedById.has(img.id)) return img;
                        const nextPrompt = translatedById.get(img.id) || '';
                        const nextImage = setPromptByLang(img, targetLang, nextPrompt, targetLang);
                        return {
                            ...nextImage,
                            isTranslating: false,
                        };
                    }));
                } catch (error: unknown) {
                    if (error instanceof DOMException && error.name === 'AbortError') {
                        return;
                    }
                    console.error('Failed to translate chunk', error);
                } finally {
                    setImages((prev) => prev.map((img) => (
                        chunkIds.has(img.id) ? { ...img, isTranslating: false } : img
                    )));
                    processedCount += chunkTargets.length;
                    setProgress({ current: Math.min(processedCount, targets.length), total: targets.length });
                }
            });

            if (Object.keys(translatedPromptMap).length > 0) {
                const persistRes = await updateCollectionData({
                    collection: collection.name,
                    prompts: translatedPromptMap,
                    promptLang: targetLang,
                });

                if (!persistRes.ok) {
                    throw new Error('Failed to persist translated prompts');
                }

                setDirtyIds((prev) => {
                    const next = new Set(prev);
                    translatedIds.forEach((id) => next.delete(id));
                    return next;
                });
            }

            if (!controller.signal.aborted) {
                toast({
                    title: "批量翻译完成",
                    description: `成功翻译 ${successCount}/${targets.length} 条提示词。`
                });
            } else {
                toast({
                    title: "翻译已取消",
                    description: `已处理 ${successCount} 条后中止。`
                });
            }
        } catch (error) {
            if (translatedIds.size > 0) {
                setDirtyIds((prev) => {
                    const next = new Set(prev);
                    translatedIds.forEach((id) => next.add(id));
                    return next;
                });
            }
            console.error('Batch translation failed', error);
            toast({
                title: "批量翻译失败",
                variant: "destructive"
            });
        } finally {
            suppressSyncRef.current = false;
            if (pendingSyncRefreshRef.current) {
                pendingSyncRefreshRef.current = false;
                await fetchImages();
            }
            setIsAutoSavePaused(false);
            setIsProcessing(false);
            setProgress(null);
            cancelRef.current = null;
        }
    };

    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(collection.name);

    // Sync newName if collection prop changes externally
    useEffect(() => {
        setNewName(collection.name);
    }, [collection.name]);

    const handleRenameCollection = async () => {
        if (!newName.trim() || newName === collection.name) {
            setIsEditingName(false);
            setNewName(collection.name);
            return;
        }

        setIsProcessing(true);
        try {
            const res = await renameCollection(collection.name, newName.trim());

            if (res.ok) {
                toast({ title: "Renamed", description: "Collection renamed successfully." });
                // We likely need to trigger a parent update or full reload because the URL or selected collection ID might need to change.
                // Since this component is likely controlled by a parent that passed `collection`, and `onBack` exists...
                // Ideally, we should notify the parent. But if the parent lists collections by re-fetching, maybe onBack() is the safest simple route,
                // OR we just force a page reload if we can't update parent state easily from here without a new prop.
                // Assuming simple app structure:
                window.location.reload(); // Simplest way to ensure everything re-syncs if we don't have an onRename prop.
            } else {
                const data = await res.json();
                throw new Error(data.error || "Rename failed");
            }
        } catch (error) {
            toast({
                title: "Rename Failed",
                description: error instanceof Error ? error.message : "Could not rename collection",
                variant: "destructive"
            });
            setNewName(collection.name); // Revert
        } finally {
            setIsProcessing(false);
            setIsEditingName(false);
        }
    };

    return (
        <div
            className="flex flex-col pb-20 pt-10 space-y-6 relative w-full  px-10"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-2xl animate-in fade-in duration-200 pointer-events-none">
                    <div className="bg-background/80 p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl scale-110">
                        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                            <Plus className="w-10 h-10 text-primary animate-bounce" />
                        </div>
                        <span className="text-2xl font-bold text-primary">Drop to Upload</span>
                    </div>
                </div>
            )}
            {/* Sticky Header Section */}
            <div className="sticky top-0 left-0  z-30 bg-[#2C2D2F]  px-6  py-4 border rounded-md border-white/5 ">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack} className="text-white bg-muted/50 border   border-white/10 hover:text-primary hover:bg-white/10 h-10 px-4 rounded-lg">
                            <ChevronLeft className="h-6 w-6 " />
                        </Button>

                        <div>
                            <div className="flex items-center gap-2">
                                {isEditingName ? (
                                    <Input
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onBlur={handleRenameCollection}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRenameCollection()}
                                        autoFocus
                                        className="h-8 py-1 text-xl font-bold w-[200px]"
                                    />
                                ) : (
                                    <h1
                                        className="text-2xl font-bold text-foreground cursor-pointer hover:bg-muted/50 px-2 rounded -ml-2 transition-colors select-none"
                                        onDoubleClick={() => setIsEditingName(true)}
                                        title="Double click to rename"
                                    >
                                        {collection.name}
                                    </h1>
                                )}

                            </div>
                            <p className="text-sm text-muted-foreground">{images.length} images with prompts</p>
                        </div>
                        {progress && (
                            <div className="flex items-center    ml-4 pl-4 bg-[linear-gradient(to_bottom,#12182d,#1d2446)] p-2 border border-white/20  rounded-lg animate-in fade-in slide-in-from-left-2 duration-100">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                                        <LoadingSpinner size={12} />
                                        <span>处理中 {progress.current}/{progress.total}</span>
                                    </div>
                                    <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300 ease-out"
                                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelRef.current?.abort()}
                                    className="h-8 px-2 text-xs text-muted-foreground bg-black/10 ml-3 border border-white/10 hover:text-destructive hover:bg-destructive/10"
                                >
                                    <X className="h-3.5 w-3.5 " />
                                    停止
                                </Button>
                            </div>
                        )}

                    </div>

                    <div className="flex  items-center gap-2">
                        {/* View Mode Toggle */}
                        <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-white/10 mr-2 h-10">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setViewMode('list');
                                    deselectAll();
                                }}
                                className={`h-8 w-8 rounded-md ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                title="List View"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setViewMode('grid');
                                    deselectAll();
                                }}
                                className={`h-8 w-8 rounded-md ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Grid View"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>

                        {viewMode === 'grid' && (
                            <div className="flex items-center gap-3 mr-4 w-[120px] animate-in fade-in slide-in-from-right-4">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Size</span>
                                <Slider
                                    value={[gridColumns]}
                                    onValueChange={(vals) => setGridColumns(vals[0])}
                                    min={2}
                                    max={10}
                                    step={1}
                                    className="w-full"
                                />
                            </div>
                        )}

                        <div className="w-[1px] h-6 bg-white/20 mx-2" />
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={handleSaveAllData}
                            className="text-primary hover:text-primary hover:bg-white/10 h-10 px-4 rounded-lg"
                        >
                            {isProcessing ? <LoadingSpinner size={16} /> : <Save className="h-4 w-4" />}
                            Save All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-white/10 h-10 px-4 rounded-lg"
                            onClick={() => setIsPromptPanelOpen(!isPromptPanelOpen)}
                        >
                            AI Settings
                            <Wand2 className="ml-2 h-4 w-4" />
                        </Button>
                        <div className="w-[1px] h-6 bg-white/20 ml-2 " />
                        <label className="cursor-pointer">

                            <input type="file" multiple accept="image/*,.txt" className="hidden" onChange={handleUpload} />
                        </label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={isProcessing}
                                    className="text-foreground"
                                >
                                    <Scissors className="h-4 w-4 " />
                                    Crop
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="start">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Crop Mode</Label>
                                        <div className="flex gap-2">
                                            <Select value={cropMode} onValueChange={(v: CropMode) => setCropMode(v)}>
                                                <SelectTrigger className="w-full h-9 bg-background border-white/10 text-xs">
                                                    <SelectValue placeholder="Mode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="center">Center Crop (1:1)</SelectItem>
                                                    <SelectItem value="longest">Scale Longest Side</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs">Target Size</Label>
                                        <Select value={targetSize} onValueChange={setTargetSize}>
                                            <SelectTrigger className="w-full h-9 bg-background border-white/10 text-xs">
                                                <SelectValue placeholder="Size" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="512">512px</SelectItem>
                                                <SelectItem value="768">768px</SelectItem>
                                                <SelectItem value="1024">1024px</SelectItem>
                                                <SelectItem value="2048">2048px</SelectItem>
                                                <SelectItem value="original">Original Size</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        variant="default"
                                        size="sm"
                                        disabled={isProcessing}
                                        onClick={handleBatchCrop}
                                        className="w-full h-9 text-xs"
                                    >
                                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin " /> : <Scissors className="h-4 w-4 " />}
                                        Apply Batch Crop
                                    </Button>

                                    <Dialog open={isBatchRenameDialogOpen} onOpenChange={setIsBatchRenameDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full h-9 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                                            >
                                                <ListOrdered className="h-4 w-4 mr-2" />
                                                Batch Rename (Files)
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Batch Rename Images</DialogTitle>
                                                <DialogDescription>
                                                    All images in this collection will be renamed to <b>prefix_01, prefix_02...</b>
                                                    <br />
                                                    <span className="text-destructive font-semibold">Important: This operation cannot be easily undone.</span>
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>File Prefix</Label>
                                                    <Input
                                                        placeholder="e.g. character_name_v1"
                                                        value={renamePrefix}
                                                        onChange={(e) => setRenamePrefix(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="ghost" onClick={() => setIsBatchRenameDialogOpen(false)}>Cancel</Button>
                                                <Button
                                                    variant="destructive"
                                                    onClick={handleBatchRename}
                                                    disabled={isProcessing || !renamePrefix}
                                                >
                                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                    Execute Rename
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant={selectedIds.size > 0 ? "default" : "outline"}
                            disabled={isProcessing || (selectedIds.size > 0 && !batchPrefix.trim())}
                            onClick={selectedIds.size > 0 ? handleAddPrefix : handleOptimizeAll}
                            className={selectedIds.size > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 rounded-lg" : "text-foreground h-10 px-4 rounded-lg"}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : selectedIds.size > 0 ? (
                                <Plus className="h-4 w-4 mr-2" />
                            ) : (
                                <Wand2 className="h-4 w-4 mr-2" />
                            )}
                            {selectedIds.size > 0 ? `批量打标 (${selectedIds.size})` : "Optimize All"}
                        </Button>

                        {/* Selection Bar (Shown when images are selected in either mode) */}
                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1 animate-in fade-in slide-in-from-top-2 duration-100">
                                <span className="text-xs font-medium text-primary mr-2">
                                    {selectedIds.size} Selected
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={selectAll}
                                    className="h-8 text-[10px] px-2 hover:bg-primary/20"
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={deselectAll}
                                    className="h-8 text-[10px] px-2 hover:bg-primary/20"
                                >
                                    Deselect
                                </Button>
                                <div className="w-[1px] h-6 bg-white/20 mx-1" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOptimizeSelected}
                                    disabled={isProcessing}
                                    className="h-8 text-[10px] px-3 font-bold border-primary/30 text-primary hover:bg-primary/10"
                                    title="AI Optimize selected images"
                                >
                                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                                    Optimize Selected
                                </Button>

                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleBatchDelete}
                                    disabled={isProcessing}
                                    className="h-8 text-[10px] px-3 font-bold shadow-lg"
                                >
                                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                                    Delete Batch
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-white/10">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePromptLangSwitch('zh')}
                                className={`h-8 px-3 text-xs ${activePromptLang === 'zh' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                中文
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePromptLangSwitch('en')}
                                className={`h-8 px-3 text-xs ${activePromptLang === 'en' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                English
                            </Button>
                        </div>
                        <div className="w-[1px] h-6 bg-white/20 ml-2 "></div>


                        <Button
                            variant="outline"
                            disabled={isProcessing}
                            onClick={handleExport}
                            className="text-foreground"
                        >

                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 " />}
                            Export
                        </Button>
                    </div>
                </div>

                {
                    isPromptPanelOpen && (
                        <div className="p-5 bg-card border border-white/10 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Wand2 className="h-4 w-4 text-primary" />
                                    System prompt for this collection
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => setIsPromptPanelOpen(false)}
                                    title="Collapse"
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>

                            </div>
                            <SystemPromptTextarea
                                value={systemPrompt}
                                onCommit={applySystemPrompt}
                                onEditingChange={setIsSystemPromptEditing}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-2">
                                {PROMPT_MODIFIERS.map(m => (
                                    <div key={m.id} className="flex items-start gap-2.5 group cursor-pointer" onClick={() => handleModifierChange(m.text, !systemPromptRef.current.includes(m.text))}>
                                        <Checkbox
                                            id={m.id}
                                            checked={systemPrompt.includes(m.text)}
                                            className="mt-0.5 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            onClick={(e) => e.stopPropagation()}
                                            onCheckedChange={(checked) => handleModifierChange(m.text, !!checked)}
                                        />
                                        <Label
                                            htmlFor={m.id}
                                            className="text-[12px] text-muted-foreground group-hover:text-foreground leading-relaxed cursor-pointer transition-colors"

                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {m.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>

                            <p className="text-[11px] text-muted-foreground italic">
                                * This prompt will be used for all images in this collection when clicking &quot;Optimize&quot;. Changes are auto-saved.
                            </p>

                            <div className="border-t border-white/10 my-4"></div>


                        </div>
                    )
                }


            </div>

            {/* 前缀 */}

            <div className="flex  gap-3">
                <div className="flex   w-full flex-wrap h-12 min-h-[40px] p-2 border border-white/10 rounded-xl bg-background">
                    {activeTags.map((tag) => (
                        <div key={tag} className="flex items-center gap-1  bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-sm text-xs font-medium animate-in fade-in zoom-in-95 duration-200">
                            {tag}
                            <button
                                onClick={() => handleRemoveTag(tag)}
                                className="ml-1 hover:text-red-500 focus:outline-none"
                                title="Remove prefix"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    <Input
                        value={batchPrefix}
                        onChange={(e) => setBatchPrefix(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddPrefix();
                            }
                        }}
                        className="flex-1 bg-transparent border-none text-foreground text-sm focus-visible:ring-0  h-8"
                        placeholder={activeTags.length === 0 ? "Type prefix and press Enter..." : ""}
                    />
                </div>
                <Button
                    variant="secondary"
                    onClick={handleAddPrefix}
                    disabled={!batchPrefix.trim()}
                    className="w-auto h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-white/10"
                >
                    <Plus className="h-4 w-4 " />
                    Add Prefix
                </Button>
            </div>


            {viewMode === 'list' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                    {/* 任务冲突对话框 */}
                    <Dialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    <Wand2 className="h-5 w-5 text-primary" />
                                    任务正在运行中
                                </DialogTitle>
                                <DialogDescription className="py-2 text-muted-foreground leading-relaxed">
                                    当前已有一个批量处理任务正在执行。您可以选择<b>中断</b>当前任务并启动新任务，或者<b>继续</b>等待当前任务完成。
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsConflictDialogOpen(false);
                                        setPendingTask(null);
                                    }}
                                    className="sm:flex-1"
                                >
                                    继续当前任务
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        setIsConflictDialogOpen(false);
                                        // 1. 中断当前任务
                                        cancelRef.current?.abort();

                                        // 2. 延迟启动新任务以确保状态重置
                                        setTimeout(() => {
                                            if (pendingTask?.type === 'optimize') {
                                                startOptimizeAll();
                                            } else if (pendingTask?.type === 'translate' && pendingTask.lang) {
                                                startBatchTranslate(pendingTask.lang);
                                            }
                                            setPendingTask(null);
                                        }, 100);
                                    }}
                                    className="sm:flex-1"
                                >
                                    中断并开启新任务
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Add Image Button as a card */}
                    <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-white/10 bg-card/40 rounded-2xl p-10 hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[300px]">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                            <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="mt-4 text-white text-xl font-medium  group-hover:text-primary transition-colors">Add</span>
                        <p className="mt-2 text-sm text-muted-foreground/70 text-center">Support multiple JPG, PNGfiles</p>
                        <input type="file" multiple accept="image/*,.txt" className="hidden" onChange={handleUpload} />
                    </label>

                    {/* Image Grid Items */}
                    {images.map((img: DatasetImage) => {
                        const imagePromptLang = promptDisplayLangById[img.id] ?? activePromptLang;
                        const imagePromptValue = getPromptByLang(img, imagePromptLang);
                        return (
                            <div key={img.id} className={`flex flex-col sm:flex-row bg-card/40 border rounded-2xl overflow-hidden group transition-all duration-300 hover:shadow-lg ${selectedIds.has(img.id)
                                ? 'border-primary ring-1 ring-primary shadow-[0_0_15px_oklch(var(--primary)/0.15)] bg-primary/5'
                                : 'border-white/5 hover:border-white/20'}`}>
                                {/* Image Section */}
                                <div
                                    className={`w-full sm:w-[320px] lg:w-[400px] shrink-0 relative bg-background/30 sm:min-h-[320px] border-b sm:border-b-0 sm:border-r border-white/5 flex items-center justify-center p-3 cursor-pointer transition-colors ${selectedIds.has(img.id) ? 'bg-primary/5' : ''}`}
                                    onClick={(e) => {
                                        // Only toggle selection if clicking the background or image area, not the zoom button
                                        if ((e.target as HTMLElement).closest('.image-zoom-trigger')) return;
                                        toggleSelect(img.id, e.shiftKey);
                                    }}
                                >
                                    <div className="w-full h-full min-h-[300px] sm:min-h-full relative rounded-xl overflow-hidden bg-muted/20">
                                        <ImageZoom className="w-full h-full image-zoom-trigger absolute inset-0">
                                            <Image
                                                src={img.url}
                                                alt=""
                                                fill
                                                className={`object-contain transition-transform duration-300 ${selectedIds.has(img.id) ? 'scale-[0.98]' : ''}`}
                                                sizes="(max-width: 768px) 100vw, 400px"
                                            />
                                        </ImageZoom>
                                    </div>

                                    {/* Selection Checkbox for List Mode */}
                                    <div className={`absolute top-5 left-5 z-10 transition-opacity duration-200 ${selectedIds.has(img.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md transition-colors ${selectedIds.has(img.id) ? 'bg-primary border-primary' : 'bg-black/40 border-white/60 backdrop-blur-sm hover:border-white'
                                            }`}>
                                            {selectedIds.has(img.id) && <Plus className="w-4 h-4 text-primary-foreground rotate-45" />}
                                        </div>
                                    </div>

                                    {(img.isOptimizing || img.isTranslating) && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                                            <LoadingSpinner size={32} className="text-primary" />
                                        </div>
                                    )}
                                </div>

                                {/* Content Section */}
                                <div className="flex-1 p-4 sm:p-6 flex flex-col gap-4 bg-transparent min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="text-base font-semibold text-foreground/90 tracking-tight truncate" title={img.filename}>
                                                {img.filename}
                                            </span>
                                            <ImageSizeBadge src={img.url} />
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center bg-background/60 backdrop-blur-sm rounded-lg p-0.5 border border-white/10">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleImagePromptLangSwitch(img, 'zh')}
                                                    disabled={img.isOptimizing || img.isTranslating}
                                                    className={`h-7 px-3 text-[11px] font-medium rounded-md transition-colors ${imagePromptLang === 'zh' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                                >
                                                    中文
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleImagePromptLangSwitch(img, 'en')}
                                                    disabled={img.isOptimizing || img.isTranslating}
                                                    className={`h-7 px-3 text-[11px] font-medium rounded-md transition-colors ${imagePromptLang === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                                >
                                                    English
                                                </Button>
                                            </div>

                                            <div className="w-[1px] h-4 bg-white/10 mx-1" />

                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-8 px-3 text-xs font-medium gap-1.5 bg-white/5 hover:bg-white/15 border border-white/10 text-foreground transition-all duration-200"
                                                onClick={() => handleOptimizePrompt(img)}
                                                disabled={img.isOptimizing || img.isTranslating}
                                                title="Optimize with AI"
                                            >
                                                <Wand2 className={`h-3.5 w-3.5 ${img.isOptimizing ? 'animate-pulse text-primary' : 'text-primary/80'}`} />
                                                AI 优化
                                            </Button>

                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="secondary"
                                                        size="icon"
                                                        className="h-8 w-8 bg-white/5 hover:bg-white/15 border border-white/10 text-muted-foreground hover:text-foreground transition-all duration-200"
                                                        title="Crop image"
                                                    >
                                                        <Scissors className="h-3.5 w-3.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-4" align="end">
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Crop Mode</Label>
                                                            <Select value={cropMode} onValueChange={(v: CropMode) => setCropMode(v)}>
                                                                <SelectTrigger className="w-full h-8 bg-background border-white/10 text-xs">
                                                                    <SelectValue placeholder="Mode" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="center">Center Crop (1:1)</SelectItem>
                                                                    <SelectItem value="longest">Scale Longest Side</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Target Size</Label>
                                                            <Select value={targetSize} onValueChange={setTargetSize}>
                                                                <SelectTrigger className="w-full h-8 bg-background border-white/10 text-xs">
                                                                    <SelectValue placeholder="Size" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="512">512px</SelectItem>
                                                                    <SelectItem value="768">768px</SelectItem>
                                                                    <SelectItem value="1024">1024px</SelectItem>
                                                                    <SelectItem value="2048">2048px</SelectItem>
                                                                    <SelectItem value="original">Original Size</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            disabled={isProcessing}
                                                            onClick={() => handleCropImage(img)}
                                                            className="w-full h-8 text-xs"
                                                        >
                                                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin " /> : <Scissors className="h-4 w-4 mr-1" />}
                                                            Apply Crop
                                                        </Button>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-destructive/80 transition-all duration-200 ml-1"
                                                onClick={() => handleDeleteImage(img)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <PromptTextarea
                                        imageId={img.id}
                                        value={imagePromptValue}
                                        lang={imagePromptLang}
                                        onCommit={handlePromptChange}
                                        onEditingChange={setIsPromptEditing}
                                        disabled={img.isOptimizing || img.isTranslating}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="space-y-4">
                        <div
                            className="grid gap-4"
                            style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
                        >
                            {/* Add Image Button in Grid */}
                            <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-white/10 bg-card/40 rounded-xl aspect-square hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden">
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-2" />
                                    <span className="text-xs text-muted-foreground font-medium">Add Image</span>
                                </div>
                                <input type="file" multiple accept="image/*,.txt" className="hidden" onChange={handleUpload} />
                            </label>

                            <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
                                {images.map((img: DatasetImage) => (
                                    <SortableImageCard
                                        key={img.id}
                                        img={img}
                                        gridColumns={gridColumns}
                                        onDelete={handleDeleteImage}
                                        isSelected={selectedIds.has(img.id)}
                                        onSelect={toggleSelect}
                                    />
                                ))}
                            </SortableContext>
                        </div>
                    </div>
                    {typeof window !== 'undefined' && createPortal(
                        <DragOverlay>
                            {draggedId && draggedSize ? (
                                <div
                                    className="relative aspect-square bg-card border border-white/10 rounded-xl overflow-hidden opacity-80 shadow-2xl cursor-grabbing pointer-events-none"
                                    style={{
                                        width: draggedSize.width,
                                        height: draggedSize.height
                                    }}
                                >
                                    <Image
                                        src={images.find(i => i.id === draggedId)?.url || ''}
                                        alt="Dragging"
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            ) : null}
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>
            )}

            {showScrollTop && (
                <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={handleScrollToTop}
                    className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full border border-white/15 bg-background/90 text-foreground shadow-lg backdrop-blur hover:bg-background"
                    title="Back to top"
                >
                    <ChevronUp className="h-4 w-4" />
                </Button>
            )}
        </div >
    );
}
