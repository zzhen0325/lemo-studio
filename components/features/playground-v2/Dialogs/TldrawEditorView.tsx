import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Tldraw,
    Editor,
    createShapeId,
    createBindingId,
    AssetRecordType,
    TLShapeId,
    useEditor,
    exportAs,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { MessageSquarePlus, X, Image as ImageIcon, Crop, Download, ArrowRight, Layers } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from 'framer-motion';
import { useGenerationService, AVAILABLE_MODELS } from '@/hooks/features/PlaygroundV2/useGenerationService';
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';
import { AnnotationShapeUtil, ResultShapeUtil, AnnotationTool, AnnotationShape, ResultShape } from './TldrawShapes';
import { getApiBase } from '@/lib/api-base';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    editor: Editor | null;
    imageScreenBounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null;
    annotations: TldrawAnnotation[];
}

const ToolbarComponent = ({
    editor,
    imageScreenBounds,
    annotations,
}: ToolbarComponentProps) => {
    // const editor = useEditor(); // 取消内部 useEditor，改用 prop
    const [currentToolId, setCurrentToolId] = useState(editor?.getCurrentToolId() || 'select');

    useEffect(() => {
        if (!editor) return;
        const unsubscribe = editor.store.listen(() => {
            setCurrentToolId(editor.getCurrentToolId());
        }, { scope: 'session', source: 'user' });
        return () => {
            unsubscribe();
        }
    }, [editor]);

    if (!imageScreenBounds || !editor) return null;

    const handleUploadMedia = () => {
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
        await exportAs(editor, idsToExport, { format: 'png', name: 'tldraw-export' } as Parameters<typeof exportAs>[2]);
    };

    return (
        <div className="absolute z-[9999] pointer-events-auto" style={{ left: imageScreenBounds.centerX, top: imageScreenBounds.top - 64, transform: 'translateX(-50%)' }}>
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
                            const selected = editor.getSelectedShapeIds();
                            if (selected.length > 0) {
                                const shape = editor.getShape(selected[0]);
                                const currentLink = (shape?.props as any)?.link || '';
                                const newLink = window.prompt('编辑 ALT/链接:', currentLink);
                                if (newLink !== null) {
                                    editor.updateShapes([{
                                        id: selected[0],
                                        props: { link: newLink }
                                    } as { id: TLShapeId, props: { link: string } }]);
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
    );
};

interface IntegratedInputProps {
    imageScreenBounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null;
    annotations: TldrawAnnotation[];
    localPrompt: string;
    setLocalPrompt: (p: string) => void;
    setAnnotations: React.Dispatch<React.SetStateAction<TldrawAnnotation[]>>;
    deleteAnnotation: (id: string) => void;
    onGenerate: () => void;
    isVisible: boolean;
    editor: Editor | null;
    selectedModel: string;
    setSelectedModel: (m: string) => void;
    batchSize: number;
    setBatchSize: (n: number) => void;
}

const IntegratedInput = ({
    imageScreenBounds,
    annotations,
    localPrompt,
    setLocalPrompt,
    setAnnotations,
    deleteAnnotation,
    onGenerate,
    isVisible,
    editor,
    selectedModel,
    setSelectedModel,
    batchSize,
    setBatchSize
}: IntegratedInputProps) => {
    if (!isVisible || !imageScreenBounds) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: '-50%', scale: 0.98 }}
            animate={{ opacity: 1, x: '-50%', scale: 1 }}
            className="absolute z-[9999] pointer-events-auto"
            style={{
                left: imageScreenBounds.centerX,
                top: imageScreenBounds.bottom + 16,
                width: Math.min(700, window.innerWidth - 64)
            }}
        >
            <div className="relative bg-white rounded-3xl shadow-xl shadow-black/10 border border-white/40 p-1 flex flex-col gap-2">
                {/* 标注列表 */}
                {annotations.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar px-2 py-1">
                        {annotations.map((ann) => (
                            <div key={ann.id} className="group flex items-center gap-2 bg-gray-50/80 hover:bg-white transition-all rounded-xl pl-2.5 pr-1.5 py-1.5 border border-gray-100 hover:border-red-200">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">{ann.label}:</span>
                                </div>
                                <input
                                    className="bg-transparent border-none p-0 text-xs text-gray-900 focus:outline-none placeholder:text-gray-400 min-w-[100px]"
                                    value={ann.description}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, description: newVal } : a));
                                        if (editor) {
                                            editor.updateShape({
                                                id: ann.id as TLShapeId,
                                                type: 'annotation',
                                                props: { content: newVal }
                                            } as AnnotationShape);
                                        }
                                    }}
                                    placeholder="输入修改说明..."
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-300 transition-colors"
                                    onClick={() => deleteAnnotation(ann.id)}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* 主输入框与生成按钮 */}
                <div className="relative flex flex-col gap-2 bg-gray-50/50 rounded-2xl border border-gray-100 p-2 focus-within:bg-white focus-within:border-gray-200 focus-within:ring-4 focus-within:ring-gray-100/50 transition-all">
                    <Textarea
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                        placeholder="输入额外的修改要求..."
                        className="flex-1 min-h-[40px] max-h-[120px] bg-transparent border-none shadow-none focus-visible:ring-0 text-sm py-2 px-1 resize-none overflow-y-auto custom-scrollbar"
                    />

                    <div className="flex items-center justify-between gap-2 px-1 pb-1">
                        <div className="flex items-center gap-2">
                            {/* 模型选择 */}
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="h-8 px-2 bg-white/50 border-gray-100 rounded-xl text-[11px] font-bold text-gray-600 hover:bg-white hover:border-gray-200 transition-all w-[140px] shadow-none focus:ring-0 pointer-events-auto">
                                    <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-gray-100 shadow-xl overflow-hidden z-[100000]">
                                    {AVAILABLE_MODELS.map(m => (
                                        <SelectItem key={m.id} value={m.id} className="text-[11px] font-bold py-2 focus:bg-gray-50 cursor-pointer">
                                            {m.displayName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* 数量选择 */}
                            <div className="flex items-center bg-white/50 border border-gray-100 rounded-xl overflow-hidden h-8">
                                <div className="px-2 border-r border-gray-100 h-full flex items-center">
                                    <Layers className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <select
                                    value={batchSize}
                                    onChange={(e) => setBatchSize(Number(e.target.value))}
                                    className="bg-transparent border-none text-[11px] font-bold text-gray-600 px-2 h-full outline-none cursor-pointer hover:bg-white transition-colors"
                                >
                                    {[1, 2, 4, 8].map(n => (
                                        <option key={n} value={n}>{n} 张</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <Button
                            onClick={onGenerate}
                            className="shrink-0 h-8 px-4 bg-black hover:bg-black/90 text-white rounded-xl font-bold shadow-xl shadow-black/10 transition-all active:scale-[0.95] flex items-center justify-center group gap-1.5"
                        >
                            <span className="text-[11px] font-black uppercase tracking-wider">生成</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export const TldrawEditorView = ({
    imageUrl,
    onSave,
    inputSectionProps,
    localPrompt: propsLocalPrompt,
}: TldrawEditorViewProps) => {
    const [editor, setEditor] = useState<Editor | null>(null);
    const [annotations, setAnnotations] = useState<TldrawAnnotation[]>([]);
    const [isInputVisible, setIsInputVisible] = useState(false);

    // 模型和数量本地状态，默认模型设为 gemini-3-pro-image-preview (Nano banana pro)
    const [localModel, setLocalModel] = useState('gemini-3-pro-image-preview');
    const [localBatchSize, setLocalBatchSize] = useState(1);

    // 引入内部 prompt 状态，与 props 解耦，防止污染回写
    const stripRegionInstructions = useCallback((p: string) => {
        if (!p) return "";
        return p.replace(/\n*Region Instructions:[\s\S]*/g, "").trim();
    }, []);

    const [internalPrompt, setInternalPrompt] = useState(() => stripRegionInstructions(propsLocalPrompt || ""));

    useEffect(() => {
        setInternalPrompt(stripRegionInstructions(propsLocalPrompt || ""));
    }, [propsLocalPrompt, stripRegionInstructions]);

    useEffect(() => {
        (window as any).__setIsInputVisible = setIsInputVisible;
    }, []);

    const { handleGenerate } = useGenerationService();

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
        tools(editor: Editor, tools: any) {
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

    const annotationCountRef = useRef(0);
    const [imageScreenBounds, setImageScreenBounds] = useState<{ left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null>(null);
    const [localizedImageUrl, setLocalizedImageUrl] = useState<string>('');

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
                setLocalizedImageUrl(imageUrl);
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
                editor.createAssets([{
                    id: assetId,
                    type: 'image',
                    typeName: 'asset',
                    props: { name: 'base-image', src: localizedImageUrl, w, h, mimeType: 'image/png', isAnimated: false },
                    meta: {},
                }]);
                editor.createShapes([{
                    id: shapeId,
                    type: 'image',
                    x: 0,
                    y: 0,
                    props: { assetId, w, h },
                    isLocked: false,
                }]);
                editor.zoomToFit();
            };
            setupImage();
        }
    }, [editor, localizedImageUrl]);

    useEffect(() => {
        if (!editor) return;
        const updateImageBounds = () => {
            const imageShape = editor.getCurrentPageShapes().find(s => s.type === 'image');
            if (imageShape) {
                const bounds = editor.getShapePageBounds(imageShape.id);
                if (bounds) {
                    const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
                    const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY });
                    setImageScreenBounds({
                        left: topLeft.x,
                        top: topLeft.y,
                        width: bottomRight.x - topLeft.x,
                        height: bottomRight.y - topLeft.y,
                        bottom: bottomRight.y,
                        centerX: topLeft.x + (bottomRight.x - topLeft.x) / 2,
                    });
                }
            }
        };
        updateImageBounds();
        const unsubscribe = editor.store.listen(updateImageBounds, { scope: 'session' });
        return () => unsubscribe();
    }, [editor]);

    useEffect(() => {
        if (!editor) return;
        const unsubscribe = editor.store.listen(() => {
            const shapes = editor.getCurrentPageShapes();
            const annos = shapes.filter(s => s && (s.type as string) === 'annotation') as unknown as AnnotationShape[];
            const newAnnotations = annos.map((s) => ({
                id: s.id,
                type: 'geo' as const,
                text: s.props.name,
                description: s.props.content || '',
                color: '#ef4444',
                label: s.props.name
            })).sort((a, b) => parseInt(a.label.replace('标注', '')) - parseInt(b.label.replace('标注', '')));

            setAnnotations(prev => {
                if (newAnnotations.length > prev.length && !isInputVisible) setIsInputVisible(true);
                return newAnnotations;
            });
            annotationCountRef.current = newAnnotations.length;
        }, { scope: 'all' });
        return () => unsubscribe();
    }, [editor, isInputVisible]);

    const deleteAnnotationWithRenumber = useCallback((id: string) => {
        if (!editor) return;
        editor.deleteShape(id as TLShapeId);
        setAnnotations(prev => {
            const remaining = prev.filter(a => a.id !== id);
            return remaining.map((ann, index) => {
                const newLabel = `标注${index + 1}`;
                editor.updateShape({ id: ann.id as TLShapeId, type: 'annotation', props: { name: newLabel } } as any);
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
        const finalPrompt = annotations.length > 0
            ? `${internalPrompt}\n\n根据图中的标注修改图片，并移除所有的标注元素\n\nRegion Instructions:\n${annotations.map(ann => `[${ann.label}]: ${ann.description}`).join('\n')}`.trim()
            : internalPrompt;

        let referenceImageUrl = localizedImageUrl || imageUrl;
        const shapes = editor.getCurrentPageShapes();
        const imageShape = shapes.find(s => s.type === 'image');
        if (imageShape) {
            const asset = editor.getAsset((imageShape.props as any).assetId);
            if (asset?.props.src) referenceImageUrl = asset.props.src;
        }

        if (shouldGenerate && referenceImageUrl.startsWith('data:')) {
            try {
                const resp = await fetch(`${getApiBase()}/save-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: referenceImageUrl, ext: 'png', subdir: 'uploads' })
                });
                const json = await resp.json();
                if (json?.path) referenceImageUrl = json.path;
            } catch (e) {
                console.error(e);
            }
        }

        if (!shouldGenerate) {
            onSave(referenceImageUrl, stripRegionInstructions(internalPrompt), [], false);
            return;
        }

        const resultId = createShapeId();
        if (imageShape) {
            const bounds = editor.getShapePageBounds(imageShape.id);
            if (bounds) {
                const arrowId = createShapeId();
                editor.createShapes([
                    { id: arrowId, type: 'arrow', x: bounds.maxX + 10, y: bounds.center.y, props: { start: { x: 0, y: 0 }, end: { x: 80, y: 0 }, arrowheadEnd: 'arrow' } },
                    { id: resultId, type: 'result' as any, x: bounds.maxX + 10 + 80 + 100, y: bounds.minY, props: { isLoading: true, version: 1, w: bounds.width, h: bounds.height } }
                ]);
                editor.createBindings([
                    { id: createBindingId(), type: 'arrow', fromId: arrowId, toId: imageShape.id, props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 } } },
                    { id: createBindingId(), type: 'arrow', fromId: arrowId, toId: resultId, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 } } }
                ]);
                editor.zoomToFit();
                (window as any).__lastArrowId = arrowId;
            }
        }

        try {
            const result = await handleGenerate({
                configOverride: { prompt: finalPrompt, isEdit: true, model: localModel, batchSize: localBatchSize, imageSize: inputSectionProps?.config.imageSize },
                sourceImageUrls: [referenceImageUrl],
            } as any);

            if (result && typeof result !== 'string' && (result as any).outputUrl) {
                const outputUrl = (result as any).outputUrl;
                const assetId = AssetRecordType.createId();
                const img = new Image();
                img.src = outputUrl;
                await img.decode();
                editor.createAssets([{ id: assetId, type: 'image', typeName: 'asset', props: { name: 'gen', src: outputUrl, w: img.width, h: img.height, mimeType: 'image/png', isAnimated: false }, meta: {} }]);
                const resultShape = editor.getShape(resultId) as ResultShape | undefined;
                const finalImageId = createShapeId();
                if (resultShape) {
                    editor.createShapes([{ id: finalImageId, type: 'image', x: resultShape.x, y: resultShape.y, props: { assetId, w: resultShape.props.w, h: resultShape.props.h } }]);
                    const arrowId = (window as any).__lastArrowId;
                    if (arrowId && editor.getShape(arrowId)) {
                        editor.createBindings([{ id: createBindingId(), type: 'arrow', fromId: arrowId, toId: finalImageId, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 } } }]);
                    }
                }
                editor.deleteShape(resultId);
            } else {
                editor.deleteShape(resultId);
            }
        } catch (err) {
            console.error(err);
            editor.deleteShape(resultId);
        }
    }, [editor, internalPrompt, annotations, localModel, localBatchSize, localizedImageUrl, imageUrl, onSave, handleGenerate, stripRegionInstructions, inputSectionProps]);

    return (
        <main className="flex-1 relative flex overflow-hidden">
            <div className="flex-1 relative bg-white flex flex-col overflow-hidden">
                <Tldraw
                    onMount={(editor) => {
                        setEditor(editor);
                        editor.updateInstanceState({ isGridMode: true });
                        // 监听点击事件，点击在图片上时显示输入框
                        editor.on('event', (info) => {
                            if (info.name === 'pointer_down') {
                                const shape = editor.getShapeAtPoint(editor.inputs.currentPagePoint);
                                if (shape?.type === 'image') {
                                    setIsInputVisible(true);
                                }
                            }
                        });
                    }}
                    autoFocus
                    hideUi
                    shapeUtils={[AnnotationShapeUtil, ResultShapeUtil]}
                    tools={[AnnotationTool]}
                    overrides={tldrawOverrides}
                />

                {editor && (
                    <>
                        <ToolbarComponent
                            editor={editor}
                            imageScreenBounds={imageScreenBounds}
                            annotations={annotations}
                        />
                        <IntegratedInput
                            editor={editor}
                            imageScreenBounds={imageScreenBounds}
                            annotations={annotations}
                            localPrompt={internalPrompt}
                            setLocalPrompt={setInternalPrompt}
                            setAnnotations={setAnnotations}
                            deleteAnnotation={deleteAnnotationWithRenumber}
                            onGenerate={() => handleExport(true)}
                            isVisible={isInputVisible || annotations.length > 0}
                            selectedModel={localModel}
                            setSelectedModel={setLocalModel}
                            batchSize={localBatchSize}
                            setBatchSize={setLocalBatchSize}
                        />
                    </>
                )}
            </div>
        </main>
    );
};
