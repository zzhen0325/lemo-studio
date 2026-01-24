import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';
import { TldrawEditorView } from './TldrawEditorView';

interface TldrawEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean) => void;
    inputSectionProps?: PlaygroundInputSectionProps;
}

export default function TldrawEditorModal({
    isOpen,
    onClose,
    imageUrl,
    onSave,
    inputSectionProps,
}: TldrawEditorModalProps) {
    const [mounted, setMounted] = useState(false);
    const [localPrompt, setLocalPrompt] = useState("");
    const storePrompt = usePlaygroundStore(s => s.config.prompt);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setLocalPrompt(storePrompt);
        }
    }, [isOpen, storePrompt]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[10000] flex flex-col bg-[#F9FAFB] text-black overflow-hidden font-sans"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
            >
                <header className="absolute top-4 right-4 z-[101]">
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-2xl hover:bg-gray-100 group">
                        <X className="w-5 h-5 text-gray-500 group-hover:rotate-90 transition-transform duration-200" />
                    </Button>

                </header>

                {/* Header */}
                {/* <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-[101]">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-2xl hover:bg-gray-100 group">
                            <X className="w-5 h-5 text-gray-500 group-hover:rotate-90 transition-transform duration-200" />
                        </Button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-gray-900 tracking-tight">Tldraw AI Studio</h2>
                                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider">Beta</span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium">Draw to describe, say to generate.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-xl mr-4 hidden sm:flex">
                            <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                            <span className="text-[10px] font-bold text-yellow-700 uppercase">Sandbox Mode</span>
                        </div>
                    </div>
                </header> */}

                <TldrawEditorView
                    imageUrl={imageUrl}
                    onSave={onSave}
                    inputSectionProps={inputSectionProps}
                    localPrompt={localPrompt}
                    setLocalPrompt={setLocalPrompt}
                />
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
