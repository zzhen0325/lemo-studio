import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Hash } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Link from 'next/link';
import Image from 'next/image';
import { getApiBase } from "@/lib/api-base";

interface HistoryItem {
    id: string;
    outputUrl: string;
    createdAt: string;
    config?: Record<string, unknown> | null;
}

export default function HistoryPage() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const resp = await fetch(`${getApiBase()}/history`);
            const data = await resp.json();
            if (data.history) {
                setHistory(data.history);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (imageUrl: string, filename: string) => {
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8">
            <Head>
                <title>Generation History | Lemo Studio</title>
            </Head>

            <div className="max-w-7xl mx-auto">
                <header className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" className="rounded-full hover:bg-white/10 text-white">
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <h1 className="text-4xl font-bold font-serif tracking-tight">Gallery History</h1>
                    </div>
                    <div className="text-white/40 text-sm">
                        Total {history.length} Generations
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[60vh]">
                        <LoadingSpinner size={48} className="mb-4" />
                        <p className="text-white/50 animate-pulse">Loading archive...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
                        <p className="text-white/30 text-xl">No generation history found.</p>
                        <Link href="/playground-v2">
                            <Button className="mt-6 bg-emerald-600 hover:bg-emerald-500 rounded-full">Start Creating</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {Object.entries(
                            history.reduce((acc, item) => {
                                const date = new Date(item.createdAt);
                                const key = date.toLocaleString('zh-CN', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(item);
                                return acc;
                            }, {} as Record<string, HistoryItem[]>)
                        ).sort((a, b) => new Date(b[1][0].createdAt).getTime() - new Date(a[1][0].createdAt).getTime())
                            .map(([time, items]) => (
                                <div key={time}>
                                    <h2 className="text-xl font-medium text-white/50 mb-4 pl-1 border-l-2 border-emerald-500/50">{time}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {items.map((item) => (
                                            <Card key={item.id} className="group relative bg-[#121212] border-white/5 overflow-hidden rounded-2xl hover:border-emerald-500/50 transition-all duration-500">
                                                <CardContent className="p-0">
                                                    <div className="relative aspect-square overflow-hidden">
                                                        <Image
                                                            src={item.outputUrl}
                                                            alt="Generated image"
                                                            width={400}
                                                            height={400}
                                                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 300px"
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                        />

                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                className="rounded-full"
                                                                onClick={() => handleDownload(item.outputUrl, item.id)}
                                                            >
                                                                <Download className="w-4 h-4 mr-2" /> Download
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 space-y-3">
                                                        <div className="flex items-center justify-between text-xs text-white/40 border-b border-white/5 pb-2">
                                                            <span className="flex items-center gap-1">
                                                                <Hash className="w-3 h-3 text-emerald-500" /> {item.id.substring(0, 8)}
                                                            </span>
                                                            <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                                                        </div>

                                                        {!!item.config?.prompt && (
                                                            <div className="text-sm text-white/80 line-clamp-2 italic font-light">
                                                                &ldquo;{item.config.prompt as string}&rdquo;
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                            {!!item.config?.model && (
                                                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full border border-emerald-500/20 uppercase tracking-widest">
                                                                    {item.config.model as string}
                                                                </span>
                                                            )}
                                                            {!!item.config?.width && (
                                                                <span className="px-2 py-0.5 bg-white/5 text-white/50 text-[10px] rounded-full border border-white/5">
                                                                    {item.config.width as number}x{item.config.height as number}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            <style jsx global>{`
        @font-face {
          font-family: 'InstrumentSerif';
          src: local('InstrumentSerif-Regular');
        }
        .font-serif {
          font-family: 'InstrumentSerif', serif;
        }
      `}</style>
        </div>
    );
}
