import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Tldraw, Editor, createShapeId, AssetRecordType } from 'tldraw';
import 'tldraw/tldraw.css';
import { X, Save, Wand2, AlertCircle, ChevronDown, Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { AVAILABLE_MODELS } from '@/hooks/features/PlaygroundV2/useGenerationService';
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';

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
    const [editor, setEditor] = useState<Editor | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const refImageInputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);
    const [localPrompt, setLocalPrompt] = useState("");
    const [referenceImages, setReferenceImages] = useState<Array<{ id: string; dataUrl: string; label: string }>>([]);

    // Annotation state - extracted from Tldraw shapes
    interface TldrawAnnotation {
        id: string;
        type: 'text' | 'note' | 'geo';
        text: string;
        description: string; // User's custom instruction for this region
        color: string;
    }
    const [annotations, setAnnotations] = useState<TldrawAnnotation[]>([]);

    // Handle reference image upload
    const handleRefInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file, i) => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                if (dataUrl) {
                    const newImg = {
                        id: `ref-${Date.now()}-${i}`,
                        dataUrl,
                        label: `Image ${referenceImages.length + i + 1}`
                    };
                    setReferenceImages(prev => [...prev, newImg]);
                }
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    }, [referenceImages.length]);

    const removeReferenceImage = useCallback((id: string) => {
        setReferenceImages(prev => prev.filter(img => img.id !== id));
    }, []);

    // Sync store prompt to local on open
    const storePrompt = usePlaygroundStore(s => s.config.prompt);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setLocalPrompt(storePrompt);
        }
    }, [isOpen, storePrompt]);

    // Handle initial image setup
    useEffect(() => {
        if (editor && imageUrl && isOpen) {
            const setupImage = async () => {
                // Clear initial
                editor.selectAll().deleteShapes(editor.getSelectedShapeIds());

                const assetId = AssetRecordType.createId();
                const shapeId = createShapeId();

                const img = new Image();
                img.src = imageUrl;
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve; // Continue even if image fails
                });

                const w = img.width || 1024;
                const h = img.height || 1024;

                editor.createAssets([
                    {
                        id: assetId,
                        type: 'image',
                        typeName: 'asset',
                        props: {
                            name: 'base-image',
                            src: imageUrl,
                            w,
                            h,
                            mimeType: 'image/png',
                            isAnimated: false,
                        },
                        meta: {},
                    },
                ]);

                editor.createShapes([
                    {
                        id: shapeId,
                        type: 'image',
                        x: 0,
                        y: 0,
                        props: {
                            assetId,
                            w,
                            h,
                        },
                        isLocked: true,
                    },
                ]);

                editor.zoomToFit();
            };

            setupImage();
        } else if (editor && !imageUrl && isOpen) {
            // New canvas mode
            editor.selectAll().deleteShapes(editor.getSelectedShapeIds());
        }
    }, [editor, imageUrl, isOpen]);

    // Use ref to access current annotations without causing infinite loops
    const annotationsRef = useRef(annotations);
    annotationsRef.current = annotations;

    // Listen to editor changes and extract annotations
    useEffect(() => {
        if (!editor) return;

        const updateAnnotations = () => {
            const shapes = editor.getCurrentPageShapes();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const textShapes = shapes.filter(s => s.type === 'text' || s.type === 'note' || (s.type === 'geo' && (s as any).props.text));

            const newAnnotations: TldrawAnnotation[] = textShapes.map(s => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const props = (s as any).props;
                const existingAnn = annotationsRef.current.find(a => a.id === s.id);
                return {
                    id: s.id,
                    type: s.type as 'text' | 'note' | 'geo',
                    text: props.text || '',
                    description: existingAnn?.description || '', // Preserve user's custom description
                    color: props.color || '#3b82f6'
                };
            });

            setAnnotations(newAnnotations);
        };

        // Initial extraction
        updateAnnotations();

        // Listen for shape changes
        const unsubscribe = editor.store.listen(() => {
            updateAnnotations();
        }, { scope: 'document' });

        return () => unsubscribe();
    }, [editor]);

    // Update annotation description
    const updateAnnotationDescription = useCallback((id: string, description: string) => {
        setAnnotations(prev => prev.map(ann =>
            ann.id === id ? { ...ann, description } : ann
        ));
    }, []);

    const handleExport = useCallback(async (shouldGenerate = false) => {
        if (!editor) return;

        // Build prompt with annotation instructions
        const basePrompt = inputSectionProps?.config.prompt || localPrompt;

        // Include annotations with custom descriptions
        const annotationPrompts = annotations
            .filter(ann => ann.description.trim() !== '')
            .map(ann => `[${ann.text || 'Region'}]: ${ann.description}`)
            .join('\n');

        const finalPrompt = annotationPrompts
            ? `${basePrompt}\n\nRegion Instructions:\n${annotationPrompts}`
            : basePrompt;

        // Export Canvas (Future: Generate Mask/Result)
        onSave('', finalPrompt, [], shouldGenerate);
    }, [editor, localPrompt, inputSectionProps?.config.prompt, annotations, onSave]);

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!editor || !files || files.length === 0) return;

        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const src = e.target?.result as string;
                if (!src) return;

                const assetId = AssetRecordType.createId();
                const shapeId = createShapeId();

                const img = new Image();
                img.src = src;
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });

                editor.createAssets([
                    {
                        id: assetId,
                        type: 'image',
                        typeName: 'asset',
                        props: {
                            name: file.name,
                            src,
                            w: img.width,
                            h: img.height,
                            mimeType: file.type,
                            isAnimated: false,
                        },
                        meta: {},
                    },
                ]);

                editor.createShapes([
                    {
                        id: shapeId,
                        type: 'image',
                        x: editor.getViewportPageBounds().center.x - img.width / 4,
                        y: editor.getViewportPageBounds().center.y - img.height / 4,
                        props: {
                            assetId,
                            w: img.width / 2, // Default to 50% size for better fitting
                            h: img.height / 2,
                        },
                    },
                ]);
            };
            reader.readAsDataURL(file);
        }
    }, [editor]);

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
                {/* Header */}
                <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-[101]">
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
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExport(false)}
                            className="rounded-2xl bg-gray-100 hover:bg-gray-200 border-none text-gray-900 font-bold px-5"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Sync Prompt
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => handleExport(true)}
                            className="rounded-2xl bg-black text-white hover:bg-gray-900 shadow-lg shadow-black/10 px-6 font-bold group"
                        >
                            <Wand2 className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                            Generate
                        </Button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 relative flex overflow-hidden">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    <input
                        type="file"
                        ref={refImageInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleRefInputChange}
                    />

                    {/* Left Side: Modification Panel */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="w-[320px] h-full bg-white/95 backdrop-blur-2xl p-4 flex flex-col shrink-0 overflow-hidden border-r border-gray-200 shadow-xl"
                        >
                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                                <div className="flex flex-col gap-6 pb-4">
                                    {/* Command Center */}
                                    <div className="flex flex-col gap-3 p-1">
                                        <div className="text-sm font-semibold text-gray-900">Modification</div>

                                        {/* Prompt Input Area */}
                                        <div className="relative">
                                            <Textarea
                                                value={inputSectionProps?.config.prompt || localPrompt}
                                                onChange={(e) => {
                                                    if (inputSectionProps) {
                                                        inputSectionProps.setConfig(prev => ({ ...prev, prompt: e.target.value }));
                                                    } else {
                                                        setLocalPrompt(e.target.value);
                                                    }
                                                }}
                                                placeholder="Describe how to modify the image..."
                                                className="min-h-[100px] w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-400 resize-none"
                                            />

                                            {/* Badge Helpers */}
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {referenceImages.map((_, i) => (
                                                    <button
                                                        key={`ref-${i}`}
                                                        onClick={() => {
                                                            const newPrompt = (inputSectionProps?.config.prompt || localPrompt) + ` [Image ${i + 1}] `;
                                                            if (inputSectionProps) {
                                                                inputSectionProps.setConfig(prev => ({ ...prev, prompt: newPrompt }));
                                                            } else {
                                                                setLocalPrompt(newPrompt);
                                                            }
                                                        }}
                                                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                                                    >
                                                        + [Image {i + 1}]
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => refImageInputRef.current?.click()}
                                                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                                                >
                                                    <Upload className="w-3 h-3 mr-1" /> Add Ref
                                                </button>
                                            </div>
                                        </div>

                                        {/* Reference Images Display */}
                                        {referenceImages.length > 0 && (
                                            <div className="flex flex-col gap-2 mt-2">
                                                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Reference Images</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {referenceImages.map((img) => (
                                                        <div
                                                            key={img.id}
                                                            className="relative group cursor-pointer"
                                                            onClick={() => {
                                                                const newPrompt = (inputSectionProps?.config.prompt || localPrompt) + ` [${img.label}] `;
                                                                if (inputSectionProps) {
                                                                    inputSectionProps.setConfig(prev => ({ ...prev, prompt: newPrompt }));
                                                                } else {
                                                                    setLocalPrompt(newPrompt);
                                                                }
                                                            }}
                                                            title={`Click to insert: [${img.label}]`}
                                                        >
                                                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group-hover:border-blue-400 transition-colors">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={img.dataUrl}
                                                                    alt={img.label}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/80 px-1 py-0.5 rounded text-[9px] text-white whitespace-nowrap">
                                                                {img.label}
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeReferenceImage(img.id);
                                                                }}
                                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                            >
                                                                <X className="w-2.5 h-2.5 text-white" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Annotations Specific Instructions */}
                                        {annotations.length > 0 && (
                                            <div className="flex flex-col gap-4 mt-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Region Instructions</div>
                                                    <div className="text-[10px] text-gray-400">{annotations.length} regions</div>
                                                </div>
                                                <div className="space-y-3">
                                                    {annotations.map((ann) => (
                                                        <div key={ann.id} className="space-y-1.5 p-2.5 rounded-xl bg-gray-50/50 border border-gray-100 transition-all hover:bg-gray-50 hover:border-gray-200">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                                <span className="text-[11px] font-medium text-gray-600 truncate flex-1">
                                                                    {ann.text || `${ann.type === 'note' ? 'Note' : ann.type === 'geo' ? 'Shape' : 'Text'} Region`}
                                                                </span>
                                                                <span className="text-[9px] text-gray-400 uppercase">{ann.type}</span>
                                                            </div>
                                                            <Textarea
                                                                value={ann.description}
                                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                                                    updateAnnotationDescription(ann.id, e.target.value);
                                                                }}
                                                                placeholder="Instructions for this area..."
                                                                className="min-h-[60px] text-xs text-gray-500 bg-white border-gray-200 rounded-lg resize-none focus-visible:ring-1"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Model & Size Selectors */}
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Model</div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="w-full h-9 justify-start px-2 bg-white border-gray-200 text-gray-700 text-xs hover:bg-gray-50">
                                                            <span className="truncate flex-1 text-left">
                                                                {AVAILABLE_MODELS.find(m => m.id === inputSectionProps?.config.model)?.displayName || 'Select Model'}
                                                            </span>
                                                            <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-[180px] bg-white border-gray-200">
                                                        {AVAILABLE_MODELS.filter(m => !m.id.includes('workflow') || true).map(m => (
                                                            <DropdownMenuItem
                                                                key={m.id}
                                                                onClick={() => inputSectionProps?.setConfig(prev => ({ ...prev, model: m.id }))}
                                                                className="text-gray-700 hover:bg-gray-100 text-xs"
                                                            >
                                                                {m.displayName}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Size</div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="w-full h-9 justify-start px-2 bg-white border-gray-200 text-gray-700 text-xs hover:bg-gray-50">
                                                            <span className="truncate flex-1 text-left">
                                                                {inputSectionProps?.config.imageSize || 'Default'}
                                                            </span>
                                                            <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-[120px] bg-white border-gray-200">
                                                        {['1K', '2K', '4K'].map(s => (
                                                            <DropdownMenuItem
                                                                key={s}
                                                                onClick={() => inputSectionProps?.setConfig(prev => ({ ...prev, imageSize: s as "1K" | "2K" | "4K" }))}
                                                                className="text-gray-700 hover:bg-gray-100 text-xs"
                                                            >
                                                                {s}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Static Bottom Actions */}
                            <div className="flex flex-col gap-3 pt-4 mt-auto border-t border-gray-100">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleExport(false)}
                                    className="w-full h-9 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 bg-white border border-gray-200 text-xs transition-colors"
                                >
                                    <Save className="w-3.5 h-3.5 mr-2" />
                                    Sync Prompt
                                </Button>
                                <Button
                                    className="w-full h-11 bg-black hover:bg-black/90 text-white rounded-xl font-semibold shadow-lg shadow-black/5 transition-all active:scale-[0.98]"
                                    onClick={() => handleExport(true)}
                                >
                                    <Wand2 className="w-4 h-4 mr-2" />
                                    Generate
                                </Button>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Right Side: Tldraw Canvas */}
                    <div className="flex-1 relative bg-[#F3F4F6]">
                        <Tldraw
                            onMount={setEditor}
                            autoFocus
                            // Enable default UI for a full studio experience
                            hideUi={false}
                            forceMobile={false}
                        />
                    </div>
                </main>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
