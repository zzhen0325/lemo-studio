"use client";

import { useState, useEffect, useRef } from "react";
import CollectionList from "./CollectionList";
import CollectionDetail from "./CollectionDetail";
import JSZip from "jszip";
import { useToast } from "@/hooks/common/use-toast";
import { getApiBase } from "@/lib/api-base";


export interface DatasetCollection {
    id: string;
    name: string;
    imageCount: number;
    previews: string[]; // 2x2 grid previews
}

export default function DatasetManagerView() {
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [collections, setCollections] = useState<DatasetCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const selectedCollectionIdRef = useRef<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        selectedCollectionIdRef.current = selectedCollectionId;
    }, [selectedCollectionId]);

    const fetchCollections = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`${getApiBase()}/dataset`);
            if (res.ok) {
                const data = await res.json();
                setCollections(data.collections || []);
            }
        } catch (error) {
            console.error("Failed to fetch collections", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCollection = async (name: string) => {
        try {
            const formData = new FormData();
            formData.append('collection', name);
            const res = await fetch(`${getApiBase()}/dataset`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                fetchCollections();
            } else {
                console.error("Failed to create collection");
            }
        } catch (error) {
            console.error("Create collection error", error);
        }
    };

    const handleDeleteCollection = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete collection "${name}"?`)) return;

        try {
            const res = await fetch(`${getApiBase()}/dataset?collection=${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchCollections();
                toast({ title: "Collection deleted" });
            } else {
                toast({ title: "Delete failed", variant: "destructive" });
            }
        } catch (error) {
            console.error("Delete collection error", error);
            toast({ title: "Delete failed", variant: "destructive" });
        }
    };

    const handleCopyCollection = async (id: string, name: string) => {
        const newName = window.prompt("Enter new collection name:", `${name}_copy`);
        if (!newName || !newName.trim()) return;

        try {
            const formData = new FormData();
            formData.append('collection', id);
            formData.append('mode', 'duplicate');
            formData.append('newName', newName.trim());

            const res = await fetch(`${getApiBase()}/dataset`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                fetchCollections();
                toast({ title: "Collection duplicated" });
            } else {
                const err = await res.json();
                toast({ title: "Duplicate failed", description: err.error, variant: "destructive" });
            }
        } catch (error) {
            console.error("Copy collection error", error);
            toast({ title: "Duplicate failed", variant: "destructive" });
        }
    };

    const handleExportCollection = async (id: string, name: string) => {
        try {
            toast({ title: "Preparing export", description: "Fetching collection data..." });
            const res = await fetch(`${getApiBase()}/dataset?collection=${encodeURIComponent(id)}`);
            if (res.ok) {
                const data = await res.json();
                const images = data.images || [];
                if (images.length === 0) {
                    toast({ title: "Export failed", description: "No images in collection", variant: "destructive" });
                    return;
                }

                toast({ title: "Zipping images", description: `Processing ${images.length} files...` });
                const zip = new JSZip();
                for (const img of images) {
                    try {
                        const imgRes = await fetch(img.url);
                        const blob = await imgRes.blob();
                        const baseName = img.filename.replace(/\.[^/.]+$/, "");
                        zip.file(img.filename, blob);
                        zip.file(`${baseName}.txt`, img.prompt || "");
                    } catch (e) {
                        console.warn(`Failed to fetch image for zip: ${img.url}`, e);
                    }
                }

                const content = await zip.generateAsync({ type: "blob" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(content);
                link.download = `${name}.zip`;
                link.click();
                toast({ title: "Export complete", description: "Dataset ZIP is ready." });
            }
        } catch (error) {
            console.error("Export collection error", error);
            toast({ title: "Export failed", variant: "destructive" });
        }
    };

    useEffect(() => {
        fetchCollections();

        // 实时同步逻辑：EventSource 监听
        const eventSource = new EventSource(`${getApiBase()}/dataset/sync`);

        const handleSyncMessage = (event: MessageEvent) => {
            if (event.data === 'refresh') {
                if (selectedCollectionIdRef.current) {
                    return;
                }
                fetchCollections();
            }
        };

        // Backward compatibility: support both named SSE events and default messages
        eventSource.addEventListener('sync', handleSyncMessage as EventListener);
        eventSource.onmessage = handleSyncMessage;

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            eventSource.close();
        };

        return () => {
            eventSource.removeEventListener('sync', handleSyncMessage as EventListener);
            eventSource.close();
        };
    }, []);

    const selectedCollection = collections.find(c => c.id === selectedCollectionId);

    return (
        <div className="relative h-full pt-4 pb-4 w-full px-4 lg:px-8 flex flex-col min-h-0 bg-[#0e0e0e]"

        >
            <div className="relative z-10 flex flex-col flex-1 h-full w-full max-w-[1440px] mx-auto min-h-0 text-foreground">
                <div id="dataset-scroll-container" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full">
                    {!selectedCollectionId ? (
                        <CollectionList
                            collections={collections}
                            onSelect={setSelectedCollectionId}
                            isLoading={isLoading}
                            onRefresh={fetchCollections}
                            onCreate={handleCreateCollection}
                            onDelete={handleDeleteCollection}
                            onCopy={handleCopyCollection}
                            onExport={handleExportCollection}
                        />
                    ) : (
                        <CollectionDetail
                            collection={selectedCollection!}
                            onBack={() => {
                                setSelectedCollectionId(null);
                                fetchCollections(); // Refresh on back to update counts/previews
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
