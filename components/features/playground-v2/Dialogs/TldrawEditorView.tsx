import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Tldraw,
    Editor,
    createShapeId,
    AssetRecordType,
    TLShapeId,
    useEditor,
    exportAs,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { Trash2, MessageSquarePlus, X, Save, Wand2, Upload, ChevronDown, Image as ImageIcon, Crop, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { AVAILABLE_MODELS, useGenerationService } from '@/hooks/features/PlaygroundV2/useGenerationService';
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';
import { AnnotationShapeUtil, ResultShapeUtil, AnnotationTool, AnnotationShape } from './TldrawShapes';


interface TldrawAnnotation {
    id: string;
    type: 'text' | 'note' | 'geo';
    text: string;
    description: string;
    color: string;
    label: string;
}

interface TldrawEditorViewProps {
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean) => void;
    inputSectionProps?: PlaygroundInputSectionProps;
    localPrompt: string;
    setLocalPrompt: (prompt: string) => void;
}

interface ToolbarComponentProps {
    imageScreenBounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null;
    annotations: TldrawAnnotation[];
    deleteAnnotationWithRenumber: (id: string) => void;
    setAnnotations: React.Dispatch<React.SetStateAction<TldrawAnnotation[]>>;
}

const ToolbarComponent = ({
    imageScreenBounds,
    annotations,
    deleteAnnotationWithRenumber,
    setAnnotations,
}: ToolbarComponentProps) => {
    const editor = useEditor();
    const [currentToolId, setCurrentToolId] = useState(editor.getCurrentToolId());

    useEffect(() => {
        const unsubscribe = editor.store.listen(() => {
            setCurrentToolId(editor.getCurrentToolId());
        }, { scope: 'session', source: 'user' });
        return () => {
            unsubscribe();
        }
    }, [editor]);

    if (!imageScreenBounds) return null;

    const handleUploadMedia = () => {
        // 触发文件上传
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const dataUrl = ev.target?.result as string;
                    if (dataUrl) {
                        const assetId = AssetRecordType.createId();
                        const img = new Image();
                        img.src = dataUrl;
                        await img.decode();
                        editor.createAssets([{
                            id: assetId,
                            type: 'image',
                            typeName: 'asset',
                            props: {
                                name: file.name,
                                src: dataUrl,
                                w: img.width,
                                h: img.height,
                                mimeType: file.type,
                                isAnimated: false,
                            },
                            meta: {},
                        }]);
                        editor.createShapes([{
                            type: 'image',
                            x: 0,
                            y: 0,
                            props: { assetId, w: img.width, h: img.height },
                        }]);
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleCrop = () => {
        const selected = editor.getSelectedShapeIds();
        if (selected.length > 0) {
            editor.setCurrentTool('crop');
        } else {
            // 默认选中背景图进行裁剪
            const imageShape = editor.getCurrentPageShapes().find(s => s.type === 'image');
            if (imageShape) {
                editor.select(imageShape.id);
                editor.setCurrentTool('crop');
            }
        }
    };

    const handleDownload = async () => {
        const selectedIds = editor.getSelectedShapeIds();
        const idsToExport = selectedIds.length > 0 ? selectedIds : Array.from(editor.getCurrentPageShapeIds());
        await exportAs(editor, idsToExport, { format: 'png', name: 'tldraw-export' } as unknown as Parameters<typeof exportAs>[2]);
    };

    return (
        <>
            <div className="absolute z-[105] pointer-events-auto" style={{ left: imageScreenBounds.centerX, top: imageScreenBounds.top - 64, transform: 'translateX(-50%)' }}>
                <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100 p-1.5">
                    <div className="flex items-center gap-0.5 px-1 border-r border-gray-100">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleUploadMedia}
                            className="h-9 w-9 rounded-xl text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
                        >
                            <ImageIcon className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCrop}
                            className="h-9 w-9 rounded-xl text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
                        >
                            <Crop className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDownload}
                            className="h-9 w-9 rounded-xl text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                // Tldraw 内置的链接/ALT 编辑通常对应 props.link
                                // 这里我们模拟触发一个简单的 prompt 或切换元数据编辑
                                const selected = editor.getSelectedShapeIds();
                                if (selected.length > 0) {
                                    const shape = editor.getShape(selected[0]);
                                    const currentLink = (shape?.props as { link?: string })?.link || '';
                                    const newLink = window.prompt('编辑 ALT/链接:', currentLink);
                                    if (newLink !== null) {
                                        editor.updateShapes([{
                                            id: selected[0],
                                            props: { link: newLink }
                                        } as unknown as Parameters<typeof editor.updateShapes>[0][number]]);
                                    }
                                }
                            }}
                            className="h-9 px-2 rounded-xl text-[10px] font-bold text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
                        >
                            ALT
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                        <Button
                            size="sm"
                            variant={currentToolId === 'annotation' ? "default" : "ghost"}
                            onClick={() => editor.setCurrentTool('annotation')}
                            className={`h-9 px-3 rounded-xl font-medium transition-all ${currentToolId === 'annotation'
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-200'
                                : 'text-gray-600 hover:text-black hover:bg-gray-50'
                                }`}
                        >
                            <MessageSquarePlus className="w-4 h-4 mr-1.5" />
                            标注区域
                        </Button>
                        {annotations.length > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{annotations.length}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {annotations.length > 0 && (
                <div className="absolute z-[110] pointer-events-auto" style={{ left: imageScreenBounds.centerX, top: imageScreenBounds.bottom + 12, transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 400px)' }}>
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border justify-center border-gray-200 p-1 min-w-[200px]">
                        <div className="flex items-center gap-3 flex-wrap w-full">
                            {annotations.map((ann) => (
                                <div key={ann.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-200">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{ann.label}:</span>
                                    </div>
                                    <input className="w-full max-w-[400px] bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none" value={ann.description} onChange={(e) => {
                                        const newDesc = e.target.value;
                                        setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, description: newDesc } : a));
                                        editor.updateShape({ id: ann.id as TLShapeId, type: 'annotation', props: { content: newDesc } } as any);
                                    }} placeholder="输入修改说明..." />
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-400" onClick={() => deleteAnnotationWithRenumber(ann.id)}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export const TldrawEditorView = ({
    imageUrl,
    onSave,
    inputSectionProps,
    localPrompt,
    setLocalPrompt,
}: TldrawEditorViewProps) => {
    const [editor, setEditor] = useState<Editor | null>(null);
    const refImageInputRef = useRef<HTMLInputElement>(null);
    const [referenceImages, setReferenceImages] = useState<Array<{ id: string; dataUrl: string; label: string }>>([]);
    const [annotations, setAnnotations] = useState<TldrawAnnotation[]>([]);
    const selectedModel = usePlaygroundStore(s => s.selectedModel);
    const setSelectedModel = usePlaygroundStore(s => s.setSelectedModel);

    const tldrawOverrides = useMemo(() => ({
        translations: {
            'zh-cn': {
                'fill-style.lined-fill': '线条填充',
                'tool.annotation': '标注区域'
            },
            'zh-CN': {
                'fill-style.lined-fill': '线条填充',
                'tool.annotation': '标注区域'
            }
        },
        tools(editor: any, tools: any) {
            const t = tools as Record<string, any>;
            t.annotation = {
                id: 'annotation',
                icon: 'tool-note',
                label: '标注区域',
                kbd: 'a',
                onSelect: () => {
                    editor.setCurrentTool('annotation');
                },
            };
            return tools;
        },
    }), []);

    // Tracks current annotation count for naming, though create listener handles it too
    // Keeping it for consistent id generation if needed, but TldrawShapes handles it mostly
    const annotationCountRef = useRef(0);
    const { handleGenerate } = useGenerationService();
    const [imageScreenBounds, setImageScreenBounds] = useState<{ left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null>(null);

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

    const [localizedImageUrl, setLocalizedImageUrl] = useState<string>('');

    // Pre-localize image to avoid Tainted Canvas error
    useEffect(() => {
        if (!imageUrl) return;
        const localize = async () => {
            try {
                const resp = await fetch(imageUrl);
                const blob = await resp.blob();
                const reader = new FileReader();
                const dataUrl = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                setLocalizedImageUrl(dataUrl);
            } catch (err) {
                console.error('[TldrawEditor] Failed to localize image:', err);
                setLocalizedImageUrl(imageUrl); // Fallback to raw URL
            }
        };
        localize();
    }, [imageUrl]);

    useEffect(() => {
        if (editor && localizedImageUrl) {
            const setupImage = async () => {
                editor.selectAll().deleteShapes(editor.getSelectedShapeIds());
                const assetId = AssetRecordType.createId();
                const shapeId = createShapeId();
                const img = new Image();
                img.src = localizedImageUrl;
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
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
                            src: localizedImageUrl,
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
                        props: { assetId, w, h },
                        isLocked: false,
                    },
                ]);
                editor.zoomToFit();
            };
            setupImage();
        }
    }, [editor, localizedImageUrl]);

    useEffect(() => {
        if (!editor) return;
        const updateImageBounds = () => {
            const shapes = editor.getCurrentPageShapes();
            const imageShape = shapes.find(s => s.type === 'image');
            if (imageShape) {
                const bounds = editor.getShapePageBounds(imageShape.id);
                if (bounds) {
                    const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
                    const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY });
                    const screenWidth = bottomRight.x - topLeft.x;
                    const screenHeight = bottomRight.y - topLeft.y;
                    setImageScreenBounds({
                        left: topLeft.x,
                        top: topLeft.y,
                        width: screenWidth,
                        height: screenHeight,
                        bottom: bottomRight.y,
                        centerX: topLeft.x + screenWidth / 2,
                    });
                }
            }
        };
        updateImageBounds();
        const unsubscribe = editor.store.listen(() => {
            updateImageBounds();
        }, { scope: 'session' });
        return () => unsubscribe();
    }, [editor]);

    // Simplified: Just sync annotations state from editor shapes
    useEffect(() => {
        if (!editor) return;
        const unsubscribe = editor.store.listen(() => {
            const shapes = editor.getCurrentPageShapes();
            const annos = shapes.filter(s => s && (s.type as string) === 'annotation') as unknown as AnnotationShape[];

            // Sync local annotations state
            const newAnnotations = annos.map((s) => ({
                id: s.id,
                type: 'geo' as const,
                text: s.props.name,
                description: s.props.content || '',
                color: '#ef4444',
                label: s.props.name
            })).sort((a, b) => {
                const aIdx = parseInt(a.label.replace('标注', '')) || 0;
                const bIdx = parseInt(b.label.replace('标注', '')) || 0;
                return aIdx - bIdx;
            });

            // Avoid infinite loops by relaxed comparison or just setting it if length/content changed
            // Here we just set it, React diffing should handle it or we can optimize if needed
            setAnnotations(newAnnotations);
            annotationCountRef.current = newAnnotations.length;

        }, { scope: 'all' });
        return () => unsubscribe();
    }, [editor]);


    const deleteAnnotationWithRenumber = useCallback((id: string) => {
        if (!editor) return;
        editor.deleteShape(id as TLShapeId);
        setAnnotations(prev => {
            const remaining = prev.filter(a => a.id !== id);
            return remaining.map((ann, index) => {
                const newLabel = `标注${index + 1}`;
                editor.updateShape({
                    id: ann.id as TLShapeId,
                    type: 'annotation',
                    props: { name: newLabel }
                } as any);
                return { ...ann, label: newLabel };
            });
        });
        annotationCountRef.current = Math.max(0, annotationCountRef.current - 1);
    }, [editor]);

    const handleExport = useCallback(async (shouldGenerate = false) => {
        if (!editor) return;
        if (shouldGenerate && annotations.length > 0) {
            const emptyAnno = annotations.find(ann => !ann.description.trim());
            if (emptyAnno) {
                alert(`请填写「${emptyAnno.label}」的标注说明`);
                return;
            }
        }
        const basePrompt = inputSectionProps?.config.prompt || localPrompt;
        const annotationPrompts = annotations
            .filter(ann => ann.description.trim() !== '')
            .map(ann => `[${ann.label}]: ${ann.description}`)
            .join('\n');
        const finalPrompt = annotationPrompts ? `${basePrompt}\n\nRegion Instructions:\n${annotationPrompts}` : basePrompt;


        let referenceImageUrl = localizedImageUrl || imageUrl;
        if (shouldGenerate) {
            try {
                // Logic aligned with handleDownload (exportAs)
                // Use all shapes if none selected
                const shapeIds = editor.getCurrentPageShapes().length > 0 ? Array.from(editor.getCurrentPageShapeIds()) : [];

                if (shapeIds.length > 0) {
                    // Use Tldraw's native getSvg which handles asset embedding better than manual fetching
                    // @ts-ignore - getSvg exists at runtime but missing in some type definitions
                    const svg = await (editor as any).getSvg(shapeIds, {
                        scale: 1,
                        background: true,
                    });

                    if (svg) {
                        // Serialize SVG to string
                        const s = new XMLSerializer();
                        const svgString = s.serializeToString(svg);
                        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
                        const svgUrl = URL.createObjectURL(svgBlob);

                        const img = new Image();
                        // Wait for image to load
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = svgUrl;
                        });

                        const canvas = document.createElement('canvas');
                        canvas.width = parseFloat(svg.getAttribute('width') || '1024');
                        canvas.height = parseFloat(svg.getAttribute('height') || '1024');
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);
                            referenceImageUrl = canvas.toDataURL('image/png');
                        }
                        URL.revokeObjectURL(svgUrl);
                    }
                }
            } catch (err) {
                console.error('[TldrawEditor] Export failed, falling back to original:', err);
                referenceImageUrl = localizedImageUrl || imageUrl;
            }
        }

        if (shouldGenerate && (!referenceImageUrl || referenceImageUrl.trim() === '')) {
            console.warn('[TldrawEditor] Reference image is empty, aborting generation');
            alert('无法生成：画布为空或导出失败 (Canvas is empty or export failed)');
            return;
        }

        if (!shouldGenerate) {
            onSave(referenceImageUrl, finalPrompt, [], false);
            return;
        }

        if (shouldGenerate) {
            const resultId = createShapeId();
            const imageShape = editor.getCurrentPageShapes().find(s => s.type === 'image');

            if (imageShape) {
                const bounds = editor.getShapePageBounds(imageShape.id);
                if (bounds) {
                    const spacing = 100;
                    const arrowWidth = 80;
                    const arrowId = createShapeId();

                    editor.createShapes([{
                        id: arrowId,
                        type: 'arrow',
                        x: bounds.maxX + 10,
                        y: bounds.center.y,
                        props: { start: { x: 0, y: 0 }, end: { x: arrowWidth, y: 0 }, arrowheadEnd: 'arrow', color: 'black', dash: 'draw', size: 'm' }
                    }]);

                    editor.createShapes([{
                        id: resultId,
                        type: 'result' as any,
                        x: bounds.maxX + 10 + arrowWidth + spacing,
                        y: bounds.minY,
                        props: { isLoading: true, version: 1, w: bounds.width, h: bounds.height }
                    }]);
                    editor.zoomToFit();
                }
            }
            try {
                const generationOptions = {
                    configOverride: {
                        prompt: finalPrompt,
                        isEdit: true,
                        model: inputSectionProps?.config.model || selectedModel, // 优先使用局部配置，兜底使用全局选中模型
                        imageSize: inputSectionProps?.config.imageSize,
                    },
                    sourceImageUrls: [referenceImageUrl],
                };

                console.log('[TldrawEditor] Generating with params:', {
                    inputConfigModel: inputSectionProps?.config.model,
                    storeSelectedModel: selectedModel,
                    finalModel: generationOptions.configOverride.model
                });

                const result = await handleGenerate(generationOptions as any);

                if (result && typeof result !== 'string' && 'outputUrl' in result && result.outputUrl) {
                    editor.updateShapes([{
                        id: resultId,
                        type: 'result' as any,
                        props: {
                            isLoading: false,
                            url: result.outputUrl,
                            version: 1,
                        } as any
                    }]);
                } else {
                    editor.deleteShape(resultId);
                    console.error('[TldrawEditor] 生成返回结果无效');
                }
            } catch (err) {
                console.error('[TldrawEditor] 生图接口执行失败:', err);
                editor.deleteShape(resultId);
            }
        }
    }, [editor, localPrompt, inputSectionProps, annotations, onSave, handleGenerate, imageUrl, localizedImageUrl, selectedModel]);

    return (
        <main className="flex-1 relative flex overflow-hidden">
            <input type="file" ref={refImageInputRef} className="hidden" accept="image/*" multiple onChange={handleRefInputChange} />

            {/* Left Panel */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                className="w-[320px] h-full bg-white/95 backdrop-blur-2xl p-4 flex flex-col shrink-0 overflow-hidden border-r border-gray-200 shadow-xl"
            >
                <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                    <div className="flex flex-col gap-6 pb-4">
                        <div className="flex flex-col gap-3 p-1">
                            <div className="text-sm font-semibold text-gray-900">Modification</div>
                            <div className="relative">
                                <Textarea
                                    value={inputSectionProps?.config.prompt || localPrompt}
                                    onChange={(e) => {
                                        if (inputSectionProps) {
                                            inputSectionProps.setConfig((prev: PlaygroundInputSectionProps['config']) => ({ ...prev, prompt: e.target.value }));
                                        } else {
                                            setLocalPrompt(e.target.value);
                                        }
                                    }}
                                    placeholder="Describe how to modify the image..."
                                    className="min-h-[100px] w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-400 resize-none"
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {referenceImages.map((_, i) => (
                                        <button
                                            key={`ref-${i}`}
                                            onClick={() => {
                                                const current = inputSectionProps?.config.prompt || localPrompt;
                                                const newPrompt = current + ` [Image ${i + 1}] `;
                                                if (inputSectionProps) inputSectionProps.setConfig(prev => ({ ...prev, prompt: newPrompt }));
                                                else setLocalPrompt(newPrompt);
                                            }}
                                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                                        >
                                            + [Image {i + 1}]
                                        </button>
                                    ))}
                                    <button onClick={() => refImageInputRef.current?.click()} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors">
                                        <Upload className="w-3 h-3 mr-1" /> Add Ref
                                    </button>
                                </div>
                            </div>

                            {referenceImages.length > 0 && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Reference Images</div>
                                    <div className="flex flex-wrap gap-2">
                                        {referenceImages.map((img) => (
                                            <div key={img.id} className="relative group cursor-pointer" onClick={() => {
                                                const current = inputSectionProps?.config.prompt || localPrompt;
                                                const newPrompt = current + ` [${img.label}] `;
                                                if (inputSectionProps) inputSectionProps.setConfig(prev => ({ ...prev, prompt: newPrompt }));
                                                else setLocalPrompt(newPrompt);
                                            }} title={`Click to insert: [${img.label}]`}>
                                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group-hover:border-blue-400 transition-colors">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={img.dataUrl} alt={img.label} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/80 px-1 py-0.5 rounded text-[9px] text-white whitespace-nowrap">{img.label}</div>
                                                <button onClick={(e) => { e.stopPropagation(); removeReferenceImage(img.id); }} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[10]">
                                                    <X className="w-2.5 h-2.5 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {annotations.length > 0 && (
                                <div className="flex flex-col gap-4 mt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">区域标注</div>
                                        <div className="text-[10px] text-gray-400">{annotations.length} 个区域</div>
                                    </div>
                                    <div className="space-y-3">
                                        {annotations.map((ann) => (
                                            <div key={ann.id} className="space-y-1.5 p-2.5 rounded-xl bg-red-50/50 border border-red-100 transition-all hover:bg-red-50 hover:border-red-200">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                                    <span className="text-[11px] font-semibold text-gray-700 truncate flex-1">{ann.label}</span>
                                                    <button onClick={() => deleteAnnotationWithRenumber(ann.id)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                                                </div>
                                                <Textarea value={ann.description} onChange={(e) => setAnnotations((prev: TldrawAnnotation[]) => prev.map(a => a.id === ann.id ? { ...a, description: e.target.value } : a))} placeholder="输入对此区域的修改说明..." className="min-h-[60px] text-xs text-gray-600 bg-white border-gray-200 rounded-lg resize-none focus-visible:ring-1 focus-visible:ring-red-500/30" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="space-y-1.5">
                                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide z-[110]">Model</div>
                                    <div className="relative group">
                                        <select
                                            value={inputSectionProps?.config.model || selectedModel}
                                            onChange={(e) => {
                                                const newVal = e.target.value;
                                                console.log('[TldrawEditor] User selected model:', newVal);
                                                if (inputSectionProps) {
                                                    inputSectionProps.setConfig((prev: PlaygroundInputSectionProps['config']) => ({ ...prev, model: newVal }));
                                                } else {
                                                    setSelectedModel(newVal);
                                                }
                                            }}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className="w-full h-9 pl-2 pr-8 bg-white border border-gray-200 rounded-md text-gray-700 text-xs hover:border-gray-300 focus:outline-none appearance-none cursor-pointer"
                                        >
                                            {AVAILABLE_MODELS.map(m => (
                                                <option key={m.id} value={m.id}>{m.displayName}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Size</div>
                                    <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
                                        {['1K', '2K', '4K'].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => inputSectionProps?.setConfig((prev: PlaygroundInputSectionProps['config']) => ({ ...prev, imageSize: s as "1K" | "2K" | "4K" }))}
                                                className={`flex-1 h-8 rounded-md text-[10px] font-bold transition-all ${inputSectionProps?.config.imageSize === s
                                                    ? 'bg-white text-black shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 pt-4 mt-auto border-t border-gray-100">
                    <Button variant="secondary" size="sm" onClick={() => handleExport(false)} className="w-full h-9 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 bg-white border border-gray-200 text-xs transition-colors"><Save className="w-3.5 h-3.5 mr-2" />Sync Prompt</Button>
                    <Button className="w-full h-11 bg-black hover:bg-black/90 text-white rounded-xl font-semibold shadow-lg shadow-black/5 transition-all active:scale-[0.98]" onClick={() => handleExport(true)}><Wand2 className="w-4 h-4 mr-2" />Generate</Button>
                </div>
            </motion.div>

            {/* Canvas Panel */}
            <div className="flex-1 relative bg-[#F3F4F6] flex flex-col overflow-hidden">
                <Tldraw
                    onMount={setEditor}
                    autoFocus
                    hideUi={true}
                    shapeUtils={[AnnotationShapeUtil, ResultShapeUtil]}
                    tools={[AnnotationTool]}
                    overrides={tldrawOverrides}
                >
                    <ToolbarComponent
                        imageScreenBounds={imageScreenBounds}
                        annotations={annotations}
                        deleteAnnotationWithRenumber={deleteAnnotationWithRenumber}
                        setAnnotations={setAnnotations}
                    />
                </Tldraw>
            </div>
        </main>
    );
};
