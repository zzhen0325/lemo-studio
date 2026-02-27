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

        <div className={`space-y-6 w-full max-w-7xl mx-auto  pt-14 ${className || ''}`}
        >
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-zinc-200">Datasets</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={onRefresh} className="text-muted-foreground hover:text-foreground">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                        className="bg-teal-600 hover:bg-teal-500 shadow-sm text-white rounded-xl h-9 px-4 text-sm font-medium border-0"
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

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
                    {collections.map((col) => (
                        <Card
                            key={col.id}
                            className="bg-[#1a1a1a] border-[#2e2e2e] rounded-2xl overflow-hidden hover:border-[#3a3a3a] hover:bg-[#1f1f1f] transition-all duration-200 cursor-pointer group shadow-sm"
                            onClick={() => onSelect(col.id)}
                        >
                            <CardContent className="p-0 aspect-square relative">
                                <div className="grid grid-cols-2 grid-rows-2 h-full  bg-[#161616] ">
                                    {[0, 1, 2, 3].map((i) => (
                                        <div key={i} className="relative bg-[#0e0e0e]  flex items-center justify-center overflow-hidden">
                                            {col.previews[i] ? (
                                                <Image
                                                    src={col.previews[i]}
                                                    alt=""
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-muted border border-white/10" />
                                            )}
                                        </div>
                                    ))}
                                </div>

                            </CardContent>
                            <CardFooter className="p-3 flex justify-between items-center bg-[#1a1a1a] border-t border-[#2e2e2e]">
                                <div className="flex flex-col flex-1 min-w-0 pr-2">
                                    <h3 className="font-medium text-[15px] text-zinc-200 truncate transition-colors">{col.name}</h3>
                                    <p className="text-[13px] text-zinc-500 mt-0.5">{col.imageCount} images</p>

                                </div>

                                <div className="">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-400 bg-transparent hover:text-white hover:bg-[#2e2e2e] rounded-xl"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40 border-[#2e2e2e] bg-[#1a1a1a] rounded-xl text-zinc-300">
                                            <DropdownMenuItem className="data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-white cursor-pointer rounded-lg" onClick={(e) => { e.stopPropagation(); onExport?.(col.id, col.name); }}>
                                                <Download className="mr-2 h-4 w-4" />
                                                <span>Export</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-white cursor-pointer rounded-lg" onClick={(e) => { e.stopPropagation(); onCopy?.(col.id, col.name); }}>
                                                <Copy className="mr-2 h-4 w-4" />
                                                <span>Copy</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-white cursor-pointer rounded-lg text-destructive focus:text-destructive"
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
        </div>
    );
}
