import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';
import { TLEditorSnapshot } from 'tldraw';
import { TldrawEditorView } from './TldrawEditorView';
import { EditPresetConfig } from '../types';
import type { AnnotationLabelConfig } from '@/lib/utils/annotation-label';

interface TldrawEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean, snapshot?: TLEditorSnapshot, keepOpen?: boolean, taskId?: string) => void;
    inputSectionProps?: PlaygroundInputSectionProps;
    initialSnapshot?: TLEditorSnapshot;
    onSaveAsPreset?: (editConfig: EditPresetConfig, name?: string) => void;
    initialPrompt?: string;
    editorMode?: 'default' | 'banner';
    annotationLabelConfig?: AnnotationLabelConfig;
}

export default function TldrawEditorModal({
    isOpen,
    onClose,
    imageUrl,
    onSave,
    inputSectionProps,
    initialSnapshot,
    onSaveAsPreset,
    initialPrompt,
    editorMode = 'default',
    annotationLabelConfig
}: TldrawEditorModalProps) {
    const [mounted, setMounted] = useState(false);
    const [localPrompt, setLocalPrompt] = useState("");
    const storePrompt = usePlaygroundStore(s => s.config.prompt);

    const editorRef = React.useRef<{ getSnapshot: () => TLEditorSnapshot | null; getTaskId: () => string } | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setLocalPrompt(initialPrompt ?? storePrompt);
        }
    }, [isOpen, storePrompt, initialPrompt]);

    const handleClose = () => {
        if (editorRef.current) {
            const snapshot = editorRef.current.getSnapshot();
            if (snapshot) {
                // Save snapshot on exit. 
                // We pass the original imageUrl as the "edited" image because we aren't generating a new one right now.
                // shouldGenerate = false
                // keepOpen = false (we want to close)
                const taskId = editorRef.current.getTaskId();
                onSave(imageUrl, localPrompt, [], false, snapshot, false, taskId);
                return;
            }
        }
        onClose();
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[10000] flex flex-col bg-[#F9FAFB] text-black overflow-hidden font-sans"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                // 阻止拖拽事件冒泡到外层，防止触发 playground 的 describe 面板
                onDragEnter={(e) => e.stopPropagation()}
                onDragOver={(e) => e.stopPropagation()}
                onDragLeave={(e) => e.stopPropagation()}
                onDrop={(e) => e.stopPropagation()}
            >
                <header className="absolute top-4 right-4 z-[11000]">
                    <Button variant="default" size="icon" onClick={handleClose} className="rounded-2xl hover:bg-gray-500 border border-gray-500 bg-gray-800 group">
                        <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-200" />
                    </Button>
                </header>

                <TldrawEditorView
                    imageUrl={imageUrl}
                    onSave={onSave}
                    inputSectionProps={inputSectionProps}
                    localPrompt={localPrompt}
                    setLocalPrompt={setLocalPrompt}
                    initialSnapshot={initialSnapshot}
                    editorRef={editorRef}
                    onSaveAsPreset={onSaveAsPreset}
                    editorMode={editorMode}
                    annotationLabelConfig={annotationLabelConfig}
                />
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
