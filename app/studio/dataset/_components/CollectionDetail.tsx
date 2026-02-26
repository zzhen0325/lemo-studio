"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DatasetCollection } from "./DatasetManagerView";
import { ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import JSZip from "jszip";
import { useToast } from "@/hooks/common/use-toast";
import {
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useAIService } from "@/hooks/ai/useAIService";
import { getApiBase } from "@/lib/api-base";
import type { CropMode, DatasetImage, TranslateLang } from "./collection-detail/types";
import {
    deleteCollectionImage,
    deleteCollectionImages,
    fetchCollectionImages,
    renameCollection,
    renameCollectionBatch,
    saveCollectionOrder,
    updateCollectionData,
} from "./collection-detail/collection-detail.service";
import { CollectionDetailHeader } from "./collection-detail/CollectionDetailHeader";
import { CollectionDetailPrefixBar } from "./collection-detail/CollectionDetailPrefixBar";
import { CollectionDetailListView } from "./collection-detail/CollectionDetailListView";
import { CollectionDetailGridView } from "./collection-detail/CollectionDetailGridView";
import {
    getPromptByLang,
    normalizePromptFields,
    setPromptByLang,
} from "./collection-detail/collection-detail.utils";
import { useCollectionDetailAiWorkflow } from "./collection-detail/useCollectionDetailAiWorkflow";
import { processCollectionUpload } from "./collection-detail/collection-detail.upload";


interface CollectionDetailProps {
    collection: DatasetCollection;
    onBack: () => void;
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
        await processCollectionUpload({
            files,
            collectionName: collection.name,
            activePromptLang: activePromptLangRef.current,
            setIsProcessing,
            setProgress,
            setImages,
            toast,
            fetchImages,
            suppressSyncRef,
            pendingSyncRefreshRef,
        });
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

    const {
        isConflictDialogOpen,
        setIsConflictDialogOpen,
        handleOptimizeAll,
        handleOptimizeSelected,
        handleOptimizePrompt,
        handlePromptLangSwitch,
        handleImagePromptLangSwitch,
        handleKeepCurrentTask,
        handleInterruptAndStartPendingTask,
    } = useCollectionDetailAiWorkflow({
        collectionName: collection.name,
        images,
        selectedIds,
        isProcessing,
        systemPrompt,
        batchPrefix,
        callVision,
        toast,
        dismiss,
        fetchImages,
        getDisplayLangForImage,
        activePromptLangRef,
        cancelRef,
        suppressSyncRef,
        pendingSyncRefreshRef,
        setImages,
        setDirtyIds,
        setIsProcessing,
        setProgress,
        setPromptDisplayLangById,
        setActivePromptLang,
        setIsAutoSavePaused,
        handlePromptChange,
    });

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
            className="flex flex-col pb-20 pt-10 space-y-6 relative w-full px-10"
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
            <CollectionDetailHeader
                collectionName={collection.name}
                imagesCount={images.length}
                isEditingName={isEditingName}
                newName={newName}
                isProcessing={isProcessing}
                progress={progress}
                viewMode={viewMode}
                gridColumns={gridColumns}
                selectedCount={selectedIds.size}
                activePromptLang={activePromptLang}
                isPromptPanelOpen={isPromptPanelOpen}
                systemPrompt={systemPrompt}
                systemPromptLiveValue={systemPromptRef.current}
                cropMode={cropMode}
                targetSize={targetSize}
                isBatchRenameDialogOpen={isBatchRenameDialogOpen}
                renamePrefix={renamePrefix}
                batchPrefix={batchPrefix}
                onBack={onBack}
                onStartEditingName={() => setIsEditingName(true)}
                onNameChange={setNewName}
                onNameCommit={handleRenameCollection}
                onSwitchViewMode={(mode) => {
                    setViewMode(mode);
                    deselectAll();
                }}
                onGridColumnsChange={setGridColumns}
                onSaveAllData={handleSaveAllData}
                onTogglePromptPanel={() => setIsPromptPanelOpen((prev) => !prev)}
                onUpload={handleUpload}
                onCropModeChange={setCropMode}
                onTargetSizeChange={setTargetSize}
                onBatchCrop={handleBatchCrop}
                onBatchRenameDialogOpenChange={setIsBatchRenameDialogOpen}
                onRenamePrefixChange={setRenamePrefix}
                onBatchRename={handleBatchRename}
                onPrimaryBatchAction={selectedIds.size > 0 ? handleAddPrefix : handleOptimizeAll}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onOptimizeSelected={handleOptimizeSelected}
                onBatchDelete={handleBatchDelete}
                onPromptLangSwitch={handlePromptLangSwitch}
                onExport={handleExport}
                onSystemPromptCommit={applySystemPrompt}
                onSystemPromptEditingChange={setIsSystemPromptEditing}
                onModifierChange={handleModifierChange}
                onCancelProcessing={() => cancelRef.current?.abort()}
            />

            <CollectionDetailPrefixBar
                activeTags={activeTags}
                batchPrefix={batchPrefix}
                onBatchPrefixChange={setBatchPrefix}
                onAddPrefix={handleAddPrefix}
                onRemoveTag={handleRemoveTag}
            />

            {viewMode === 'list' ? (
                <CollectionDetailListView
                    images={images}
                    selectedIds={selectedIds}
                    activePromptLang={activePromptLang}
                    promptDisplayLangById={promptDisplayLangById}
                    isProcessing={isProcessing}
                    isConflictDialogOpen={isConflictDialogOpen}
                    cropMode={cropMode}
                    targetSize={targetSize}
                    onConflictDialogOpenChange={setIsConflictDialogOpen}
                    onKeepCurrentTask={handleKeepCurrentTask}
                    onInterruptAndStartPendingTask={handleInterruptAndStartPendingTask}
                    onUpload={handleUpload}
                    onSelect={toggleSelect}
                    onImagePromptLangSwitch={handleImagePromptLangSwitch}
                    onOptimizePrompt={handleOptimizePrompt}
                    onCropModeChange={setCropMode}
                    onTargetSizeChange={setTargetSize}
                    onCropImage={handleCropImage}
                    onDeleteImage={handleDeleteImage}
                    onPromptChange={handlePromptChange}
                    onPromptEditingChange={setIsPromptEditing}
                />
            ) : (
                <CollectionDetailGridView
                    sensors={sensors}
                    gridColumns={gridColumns}
                    images={images}
                    selectedIds={selectedIds}
                    draggedId={draggedId}
                    draggedSize={draggedSize}
                    onUpload={handleUpload}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDeleteImage={handleDeleteImage}
                    onSelect={toggleSelect}
                />
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
        </div>
    );
}
