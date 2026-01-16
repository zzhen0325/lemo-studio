"use client";

import { DatasetCollection } from "./DatasetManagerView";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreVertical, RefreshCw, Download, Copy, Trash2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CollectionListProps {
    collections: DatasetCollection[];
    onSelect: (id: string) => void;
    isLoading?: boolean;
    onRefresh?: () => void;
    onCreate?: (name: string) => void;
    onExport?: (id: string, name: string) => void;
    onCopy?: (id: string, name: string) => void;
    onDelete?: (id: string, name: string) => void;
    className?: string;
}

export default function CollectionList({
    collections,
    onSelect,
    isLoading,
    onRefresh,
    onCreate,
    onExport,
    onCopy,
    onDelete,
    className
}: CollectionListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner size={32} className="text-white/50" />
            </div>
        );
    }
    return (
        <div className={`space-y-6 w-full p-8 max-w-8xl ${className || ''}`}>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Datasets</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={onRefresh} className="text-muted-foreground hover:text-foreground">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                        className="bg-white/10 hover:bg-white/20 text-white rounded-xl"
                        onClick={() => {
                            const name = window.prompt("Enter new collection name:");
                            if (name && name.trim()) {
                                onCreate?.(name.trim());
                            }
                        }}
                    >
                        Create New Collection
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {collections.map((col) => (
                    <Card
                        key={col.id}
                        className="bg-card border-border overflow-hidden hover:border-primary/50 transition-all cursor-pointer group"
                        onClick={() => onSelect(col.id)}
                    >
                        <CardContent className="p-0 aspect-square relative">
                            <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5 bg-muted">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="relative bg-muted/50 flex items-center justify-center overflow-hidden">
                                        {col.previews[i] ? (
                                            <Image
                                                src={col.previews[i]}
                                                alt=""
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded bg-muted border border-border" />
                                        )}
                                    </div>
                                ))}
                            </div>

                        </CardContent>
                        <CardFooter className="p-4 flex  justify-between items-center bg-card/50">
                            <div className="flex flex-col">
                                <h3 className="font-semibold text-lg text-card-foreground">{col.name}</h3>
                                <p className="text-sm text-muted-foreground">{col.imageCount} images</p>

                            </div>

                            <div className="border border-transparent hover:border-white/20 rounded-lg">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-white bg-black/40 hover:bg-black/60 rounded-lg"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport?.(col.id, col.name); }}>
                                            <Download className="mr-2 h-4 w-4" />
                                            <span>Export</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy?.(col.id, col.name); }}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            <span>Copy</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => { e.stopPropagation(); onDelete?.(col.id, col.name); }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>Delete</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
