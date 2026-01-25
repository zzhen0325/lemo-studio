import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Tldraw,
    Editor,
    createShapeId,
    createBindingId,
    AssetRecordType,
    TLShapeId,
    exportAs,
    type TLEditorSnapshot,
    type StoreSnapshot,
    type TLRecord,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { MessageSquarePlus, X, Image as ImageIcon, Crop, Download, ArrowRight, Layers } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from 'framer-motion';
import { useGenerationService, AVAILABLE_MODELS } from "@/components/features/playground-v2/hooks/useGenerationService";
import { useToast } from "@/hooks/common/use-toast";
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';
import { AnnotationShapeUtil, ResultShapeUtil, AnnotationTool, AnnotationShape, ResultShape } from './TldrawShapes';
import { getApiBase } from '@/lib/api-base';
import { EditPresetConfig } from '../types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DefaultMainMenu,
    DefaultMainMenuContent,
    TldrawUiMenuItem,
    TldrawUiMenuGroup,
} from 'tldraw';

interface TldrawAnnotation {
    id: string;
    type: 'text' | 'note' | 'geo';
    text: string;
    description: string;
    referenceImageUrl: string;
    color: string;
    label: string;
}

interface TldrawEditorViewProps {
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean, snapshot?: TLEditorSnapshot, keepOpen?: boolean, taskId?: string) => void;
    inputSectionProps?: PlaygroundInputSectionProps;
    localPrompt: string;
    setLocalPrompt: (prompt: string) => void;
    initialSnapshot?: TLEditorSnapshot;
    editorRef?: React.MutableRefObject<{ getSnapshot: () => TLEditorSnapshot | null; getTaskId: () => string } | null>;
    onSaveAsPreset?: (editConfig: EditPresetConfig, name?: string) => void;
}

interface ToolbarComponentProps {
    editor: Editor | null;
    imageScreenBounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null;
    annotations: TldrawAnnotation[];
    imageId: TLShapeId;
}

const ToolbarComponent = ({
    editor,
    imageScreenBounds,
    annotations,
    imageId,
    isVisible,
}: ToolbarComponentProps & { isVisible: boolean }) => {
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

    if (!imageScreenBounds || !editor || !isVisible) return null;

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
        editor.select(imageId);
        editor.setCurrentTool('crop');
    };

    const handleDownload = async () => {
        await exportAs(editor, [imageId], { format: 'png', name: 'tldraw-export' } as Parameters<typeof exportAs>[2]);
    };

    return (
        <div className="absolute z-[100] pointer-events-none" style={{ left: imageScreenBounds.centerX, top: imageScreenBounds.top - 64, transform: 'translateX(-50%)' }}>
            <div className="flex items-center gap-1.5 bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 p-1.5 pointer-events-auto">
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
                </div>
                <div className="flex items-center gap-2 pl-1">
                    <Button
                        size="sm"
                        variant={currentToolId === 'annotation' ? "default" : "ghost"}
                        onClick={() => {
                            editor.select(imageId);
                            editor.setCurrentTool('annotation');
                        }}
                        className={`h-9 px-3 rounded-xl font-medium transition-all ${currentToolId === 'annotation' && editor.getSelectedShapeIds().includes(imageId)
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-200'
                            : 'text-gray-600 hover:text-black hover:bg-gray-50'
                            }`}
                    >
                        <MessageSquarePlus className="w-4 h-4 mr-1.5" />
                        标注
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
    deleteAnnotation: (id: string) => void;
    onGenerate: () => void;
    isVisible: boolean;
    editor: Editor | null;
    selectedModel: string;
    setSelectedModel: (m: string) => void;
    batchSize: number;
    setBatchSize: (n: number) => void;
}

const AnnotationRow = ({
    ann,
    editor,
    deleteAnnotation
}: {
    ann: TldrawAnnotation,
    editor: Editor | null,
    deleteAnnotation: (id: string) => void
}) => {
    const [localValue, setLocalValue] = useState(ann.description);

    // 同步外部更新（例如从其他地方通过 editor 更新了 content）
    useEffect(() => {
        setLocalValue(ann.description);
    }, [ann.description]);

    const handleUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file && editor) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    editor.updateShape({
                        id: ann.id as TLShapeId,
                        type: 'annotation',
                        props: { referenceImageUrl: dataUrl }
                    } as unknown as import('tldraw').TLShape);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleRemoveImg = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editor) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.updateShape({
                id: ann.id as TLShapeId,
                type: 'annotation',
                props: { referenceImageUrl: '' }
            } as unknown as import('tldraw').TLShape);
        }
    };

    return (
        <div key={ann.id} className="group flex items-center gap-2 bg-gray-50/80 hover:bg-white transition-all rounded-xl pl-1.5 pr-1.5 py-1.5 border border-gray-100 hover:border-red-200">
            <div className="flex items-center gap-1.5 shrink-0">
                {/* 参考图上传预览区域 */}
                <div
                    className="relative w-7 h-7 rounded-lg overflow-hidden bg-white border border-gray-200 group/img cursor-pointer flex items-center justify-center shadow-sm"
                    onClick={handleUpload}
                >
                    {ann.referenceImageUrl ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ann.referenceImageUrl} alt="Reference" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <ImageIcon className="w-3 h-3 text-white" />
                            </div>
                            <button
                                onClick={handleRemoveImg}
                                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-black rounded-full flex items-center justify-center text-white scale-0 group-hover/img:scale-100 transition-transform hover:bg-red-500 z-10"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors">
                            <ImageIcon className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 border-l border-gray-100 pl-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">{ann.label}:</span>
                </div>
            </div>
            <input
                className="bg-transparent border-none p-0 text-xs text-gray-900 focus:outline-none placeholder:text-gray-400 min-w-[200px] flex-1"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => {
                    if (editor && localValue !== ann.description) {
                        editor.updateShape({
                            id: ann.id as TLShapeId,
                            type: 'annotation',
                            props: { content: localValue }
                        } as unknown as import('tldraw').TLShape);
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && editor) {
                        (e.target as HTMLInputElement).blur();
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
    );
}

const IntegratedInput = ({
    imageScreenBounds,
    annotations,
    localPrompt,
    setLocalPrompt,
    deleteAnnotation,
    onGenerate,
    isVisible,
    editor,
    selectedModel,
    setSelectedModel,
    batchSize,
    setBatchSize,
}: IntegratedInputProps) => {
    if (!isVisible || !imageScreenBounds) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, x: '-50%', scale: 1 }}
            className="absolute z-[100] pointer-events-none"
            style={{
                left: imageScreenBounds.centerX,
                top: imageScreenBounds.bottom + 16,
                width: Math.min(700, window.innerWidth - 64)
            }}
        >
            <div className="relative bg-white rounded-3xl shadow-2xl shadow-black/10 border border-white/40 p-1 flex flex-col gap-2 pointer-events-auto">
                {/* 标注列表 */}
                {annotations.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto custom-scrollbar px-2 py-1">
                        {annotations.map((ann) => (
                            <AnnotationRow
                                key={ann.id}
                                ann={ann}
                                editor={editor}
                                deleteAnnotation={deleteAnnotation}
                            />
                        ))}
                    </div>
                )}

                {/* 主输入框与生成按钮 */}
                <div className="relative flex flex-col  bg-gray-50/50 rounded-2xl border border-gray-100 p-1 focus-within:bg-white focus-within:border-gray-200   focus-within:ring-4 focus-within:ring-gray-100/50 transition-all">
                    <Textarea
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                        placeholder="输入额外的修改要求..."
                        className="h-4 max-h-[100px] bg-transparent border-none shadow-none focus-visible:ring-0 text-sm py-2 px-1 resize-none overflow-y-auto custom-scrollbar"
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
                                        <SelectItem key={m.id} value={m.id} className="text-[11px] font-bold py-2 focus:bg-gray-50  focus:text-gray-600 cursor-pointer">
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
                            className="shrink-0 h-8 px-4 bg-black hover:bg-black/90 text-white rounded-xl font-bold   transition-all active:scale-[0.95] flex items-center justify-center group gap-1.5"
                        >
                            {/* <span className="text-[11px] font-black uppercase tracking-wider">生成</span> */}
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
    initialSnapshot,
    editorRef,
    onSaveAsPreset
}: TldrawEditorViewProps) => {
    const [editor, setEditor] = useState<Editor | null>(null);
    const { toast } = useToast();

    // 模型和数量本地状态，默认模型设为 gemini-3-pro-image-preview (Nano banana pro)
    const [localModel, setLocalModel] = useState('gemini-3-pro-image-preview');
    const [localBatchSize, setLocalBatchSize] = useState(1);
    const [localTaskId, setLocalTaskId] = useState(() => (Date.now().toString() + Math.random().toString(36).substring(2, 7)));
    const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Expose methods to parent via ref
    useEffect(() => {
        if (editorRef) {
            editorRef.current = {
                getSnapshot: () => editor ? editor.getSnapshot() : null,
                getTaskId: () => localTaskId
            };
        }
    }, [editor, editorRef, localTaskId]);

    // 当切换模型时，更新 taskId 以开启新的历史分组
    useEffect(() => {
        setLocalTaskId(Date.now().toString() + Math.random().toString(36).substring(2, 7));
    }, [localModel]);

    // 引入内部 prompt 状态，与 props 解耦，防止污染回写
    const stripRegionInstructions = useCallback((p: string) => {
        if (!p) return "";
        return p.replace(/\n*Region Instructions:[\s\S]*/g, "").trim();
    }, []);

    const [internalPrompt, setInternalPrompt] = useState(() => stripRegionInstructions(propsLocalPrompt || ""));

    useEffect(() => {
        setInternalPrompt(stripRegionInstructions(propsLocalPrompt || ""));
    }, [propsLocalPrompt, stripRegionInstructions]);

    // 强制避让 UI 的缩放逻辑：将图片居中于顶部工具栏(64px)和底部输入框(~200px)之间的空隙
    const zoomToFitWithUiAvoidance = useCallback((editor: Editor, animationDuration = 0) => {
        editor.zoomToFit();
        const baseZoom = editor.getZoomLevel();
        const bounds = editor.getSelectionPageBounds() || editor.getCurrentPageBounds();
        if (bounds) {
            // 1. 设置缩放级别（保持 0.75 系数，给四周留白）
            const targetZoom = baseZoom * 0.75;

            // 2. 计算理想中心位置
            // 顶部占用 64px, 底部输入框+间距约占用 180px
            // 画面中心需要向下移动：(底部占用 - 顶部占用) / 2
            // 在页面空间中，向上移动相机 = 画面下移
            const offsetInScreen = (180 - 64) / 2;
            const offsetInPage = offsetInScreen / targetZoom;

            editor.zoomToBounds(bounds, {
                targetZoom,
                animation: { duration: animationDuration }
            });

            // 延迟微调相机位置，确保在 zoomToBounds 之后生效
            const camera = editor.getCamera();
            editor.setCamera({
                x: camera.x,
                y: camera.y + offsetInPage, // 向下移动相机 = 画面上移，从而避开底部较高的输入框
                z: targetZoom
            }, { animation: { duration: animationDuration } });
        }
    }, []);

    const { handleGenerate, executeGeneration } = useGenerationService();

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
        tools(editor: Editor, tools: import('tldraw').TLUiToolsContextType) {
            tools.annotation = {
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
        actions(editor: Editor, actions: import('tldraw').TLUiActionsContextType) {
            actions['save-as-preset'] = {
                id: 'save-as-preset',
                label: '存为预设',
                icon: 'bookmark',
                onSelect: () => {
                    setIsNamingDialogOpen(true);
                },
            };
            return actions;
        }
    }), []);

    const annotationCountRef = useRef(0);
    const [imagesInfo, setImagesInfo] = useState<Array<{
        id: TLShapeId;
        bounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number };
        annotations: TldrawAnnotation[];
        isSelected: boolean;
    }>>([]);
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

    // Flag to track if we have already initialized (loaded snapshot or base image)
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!editor || !localizedImageUrl) return;

        // Prevent re-initialization if we already did it
        if (initializedRef.current) return;

        const setupImage = async () => {
            initializedRef.current = true;

            // Priority 1: Load Snapshot if available
            if (initialSnapshot) {
                try {
                    console.log("[TldrawEditor] Loading initial snapshot...");
                    editor.loadSnapshot(initialSnapshot as unknown as StoreSnapshot<TLRecord>);
                    zoomToFitWithUiAvoidance(editor, 0);
                    return;
                } catch (e) {
                    console.error("[TldrawEditor] Failed to load snapshot", e);
                    // If snapshot fails, we might fall through to load image, or just stop.
                    // Fall through to load image as backup
                }
            }

            // Priority 2: Load Base Image (New Edit)
            console.log("[TldrawEditor] Initializing with base image...");
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
            zoomToFitWithUiAvoidance(editor, 0);
        };
        setupImage();
    }, [editor, localizedImageUrl, initialSnapshot, zoomToFitWithUiAvoidance]);

    useEffect(() => {
        if (!editor) return;

        const updateImagesInfo = () => {
            const shapes = editor.getCurrentPageShapes();
            const imageShapes = shapes.filter(s => s.type === 'image');
            const annotationShapes = shapes.filter(s => (s.type as unknown as string) === 'annotation') as unknown as AnnotationShape[];
            const selectedIds = editor.getSelectedShapeIds();

            const infos = imageShapes.map(img => {
                const bounds = editor.getShapePageBounds(img.id);
                let screenBounds = null;
                if (bounds) {
                    const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
                    const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY });
                    screenBounds = {
                        left: topLeft.x,
                        top: topLeft.y,
                        width: bottomRight.x - topLeft.x,
                        height: bottomRight.y - topLeft.y,
                        bottom: bottomRight.y,
                        centerX: topLeft.x + (bottomRight.x - topLeft.x) / 2,
                    };
                }

                const imgAnnos = annotationShapes
                    .filter(s => s.parentId === img.id)
                    .map(s => ({
                        id: s.id,
                        type: 'geo' as const,
                        text: s.props.name,
                        description: s.props.content || '',
                        referenceImageUrl: s.props.referenceImageUrl || '',
                        color: '#ef4444',
                        label: s.props.name
                    }))
                    .sort((a, b) => parseInt(a.label.replace('标注', '')) - parseInt(b.label.replace('标注', '')));

                const isSelected = selectedIds.includes(img.id) || imgAnnos.some(ann => selectedIds.includes(ann.id as TLShapeId));

                return {
                    id: img.id,
                    bounds: screenBounds,
                    annotations: imgAnnos,
                    isSelected
                };
            }).filter(info => info.bounds !== null) as Array<{
                id: TLShapeId;
                bounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number };
                annotations: TldrawAnnotation[];
                isSelected: boolean;
            }>;

            setImagesInfo(infos);

            const allAnnoCount = annotationShapes.length;
            annotationCountRef.current = allAnnoCount;
        };

        updateImagesInfo();
        const unsubscribe = editor.store.listen((history) => {
            updateImagesInfo();

            // 监听是否有新图片添加（例如拖拽上传），如果有则触发一次自动缩放
            const changes = history.changes;
            if (changes.added) {
                const hasNewImage = Object.values(changes.added).some(
                    record => record.typeName === 'shape' && (record as import('tldraw').TLShape).type === 'image'
                );
                if (hasNewImage) {
                    // 稍微延迟一下以确保图片已经上屏，并且让 Tldraw 完成自己的默认处理
                    setTimeout(() => {
                        zoomToFitWithUiAvoidance(editor, 200);
                    }, 100);
                }
            }
        }, { scope: 'all', source: 'user' }); // 仅监听用户操作，避免死循环（不过 added image 通常是用户触发）
        return () => unsubscribe();
    }, [editor, zoomToFitWithUiAvoidance]);

    const deleteAnnotationWithRenumber = useCallback((id: string) => {
        if (!editor) return;
        const shape = editor.getShape(id as TLShapeId);
        if (!shape) return;
        const parentId = shape.parentId;
        editor.deleteShape(id as TLShapeId);

        // 重新编号属于同一父级的标注
        const sisterAnnos = editor.getCurrentPageShapes()
            .filter(s => (s.type as unknown as string) === 'annotation' && s.parentId === parentId) as unknown as AnnotationShape[];

        sisterAnnos.sort((a, b) => (a.index > b.index ? 1 : -1)).forEach((ann, index) => {
            const newLabel = `标注${index + 1}`;
            editor.updateShape({ id: ann.id, type: 'annotation', props: { name: newLabel } } as unknown as import('tldraw').TLShape);
        });

        annotationCountRef.current = Math.max(0, annotationCountRef.current - 1);
    }, [editor]);

    /**
     * 处理 Snapshot 中的 DataURL，将其上传到服务器并替换为路径
     */
    const prepareSnapshotForSave = useCallback(async (snapshot: TLEditorSnapshot) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snapshotAny = snapshot as any;
        // Tldraw 快照结构可能因版本而异，通常包含 store 字段，或者 snapshot 本身就是记录集
        const store = snapshotAny?.store || snapshotAny;

        if (!store || typeof store !== 'object') {
            console.warn('[prepareSnapshotForSave] Invalid snapshot structure:', snapshot);
            return snapshot;
        }

        const assetIds = Object.keys(store).filter(id => {
            const record = store[id];
            return record &&
                record.typeName === 'asset' &&
                record.type === 'image' &&
                record.props?.src?.startsWith('data:');
        });

        if (assetIds.length === 0) return snapshot;

        console.log(`[prepareSnapshotForSave] Found ${assetIds.length} dataURL assets to upload.`);

        const assetUploadPromises = assetIds.map(async (id) => {
            const asset = store[id];
            const src = asset.props?.src;
            try {
                const resp = await fetch(`${getApiBase()}/save-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: src, ext: 'png', subdir: 'uploads' })
                });
                const json = await resp.json() as { path?: string };
                if (json?.path) {
                    store[id] = {
                        ...asset,
                        props: {
                            ...(asset.props || {}),
                            src: json.path
                        }
                    };
                }
            } catch (e) {
                console.error(`[TldrawEditor] Failed to upload asset ${id}:`, e);
            }
        });

        await Promise.all(assetUploadPromises);
        return snapshot;
    }, []);

    const handleSaveAsPreset = useCallback(async (name?: string) => {
        if (!editor || !onSaveAsPreset) {
            console.error('[handleSaveAsPreset] editor or onSaveAsPreset is missing', { editor: !!editor, onSaveAsPreset: !!onSaveAsPreset });
            return;
        }

        setIsSaving(true);
        try {
            console.log('[handleSaveAsPreset] Starting save as preset:', name);
            // 1. 获取主底图 URL (尝试找第一张 image 形状，如果没有则用初始图)
            const imageShapes = editor.getCurrentPageShapes()
                .filter(s => s.type === 'image') as import('tldraw').TLImageShape[];

            const imageShape = imageShapes[0];

            let originalImageUrl = imageUrl;
            if (imageShape?.props?.assetId) {
                const asset = editor.getAsset(imageShape.props.assetId);
                if (asset?.props && 'src' in asset.props) {
                    const src = asset.props.src as string;
                    if (src.startsWith('data:')) {
                        console.log('[handleSaveAsPreset] Uploading original image DataURL...');
                        const resp = await fetch(`${getApiBase()}/save-image`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageBase64: src, ext: 'png', subdir: 'uploads' })
                        });
                        const json = await resp.json();
                        if (json?.path) originalImageUrl = json.path;
                    } else {
                        originalImageUrl = src;
                    }
                }
            }

            // 2. 收集所有标注 (针对整个画布)
            const allAnnos = (editor.getCurrentPageShapes()
                .filter(s => (s.type as unknown as string) === 'annotation') as unknown as AnnotationShape[])
                .sort((a, b) => parseInt(a.props.name.replace('标注', '')) - parseInt(b.props.name.replace('标注', '')));

            const annotations = allAnnos.map(s => ({
                id: s.id,
                colorName: 'red',
                color: '#ef4444',
                text: s.props.name,
                label: s.props.name,
                description: s.props.content || '',
                annotationName: s.props.name
            }));

            // 3. 处理快照资产
            console.log('[handleSaveAsPreset] Preparing snapshot...');
            toast({ title: "正在处理预设", description: "正在优化并上传快照资产..." });

            const rawSnapshot = editor.getSnapshot();
            const cleanSnapshot = await prepareSnapshotForSave(rawSnapshot);
            console.log('[handleSaveAsPreset] Snapshot ready.');

            // 4. 构造 EditPresetConfig
            const editConfig: EditPresetConfig = {
                canvasJson: {}, // 基础图层信息，旧版兼容
                referenceImages: [], // 如果有作为参考图添加的
                originalImageUrl,
                annotations,
                backgroundColor: '#ffffff',
                canvasSize: {
                    width: editor.getInstanceState().screenBounds.w,
                    height: editor.getInstanceState().screenBounds.h
                },
                tldrawSnapshot: cleanSnapshot as unknown as Record<string, unknown>
            };

            console.log('[handleSaveAsPreset] Calling onSaveAsPreset callback');
            await onSaveAsPreset(editConfig, name);
            console.log('[handleSaveAsPreset] Save as preset process completed.');
        } catch (err) {
            console.error('[handleSaveAsPreset] Error saving preset:', err);
            toast({
                title: "保存预设失败",
                description: err instanceof Error ? err.message : String(err),
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    }, [editor, imageUrl, onSaveAsPreset, prepareSnapshotForSave, toast]);

    const handleExport = useCallback(async (shouldGenerate = false, targetImageId?: TLShapeId) => {
        if (!editor) return;

        const imageShape = targetImageId
            ? editor.getShape(targetImageId)
            : editor.getCurrentPageShapes().find(s => s.type === 'image');

        if (!imageShape || imageShape.type !== 'image') {
            // No base image found? Check if we have any content to export as base image (e.g. drawn shapes)
            const allShapes = editor.getCurrentPageShapeIds();
            if (allShapes.size > 0 && !imageShape) {
                // Export entire canvas as base image
                try {
                    const svg = await (editor as unknown as { getSvg: (shapes: TLShapeId[], opts: { scale: number; background: boolean }) => Promise<SVGElement> }).getSvg([...allShapes], { scale: 1, background: true });
                    if (svg) {
                        const svgStr = new XMLSerializer().serializeToString(svg);
                        const img = new Image();
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                        });

                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = '#ffffff'; // Ensure white background if transparent
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);

                            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                            if (blob) {
                                const blobUrl = URL.createObjectURL(blob);
                                if (!shouldGenerate) {
                                    onSave(blobUrl, internalPrompt, [], false, editor.getSnapshot(), false);
                                    return; // Changes: Exit after save
                                } else {
                                    // Handle generate flow if needed
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to export canvas", e);
                }
            }
            return; // Changes: Exit function if no image shape found (whether handled or failed)
        }

        const currentImageAnnos = (editor.getCurrentPageShapes()
            .filter(s => (s.type as unknown as string) === 'annotation' && s.parentId === imageShape.id) as unknown as AnnotationShape[])
            .sort((a, b) => parseInt(a.props.name.replace('标注', '')) - parseInt(b.props.name.replace('标注', '')));

        if (shouldGenerate && currentImageAnnos.length > 0) {
            const emptyAnno = currentImageAnnos.find(ann => !ann.props.content?.trim());
            if (emptyAnno) {
                alert(`请填写「${emptyAnno.props.name}」的标注说明`);
                return;
            }
        }

        // 收集标注说明和参考图序列
        const referenceImageUrls: string[] = [];
        // 主图占位
        let baseReferenceImageUrl = localizedImageUrl || imageUrl;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const asset = editor.getAsset(imageShape.props.assetId as import('tldraw').TLAssetId);
        if (asset?.props.src) baseReferenceImageUrl = asset.props.src;
        referenceImageUrls.push(baseReferenceImageUrl);

        const formattedAnnos = currentImageAnnos.map(s => {
            let desc = s.props.content || '';
            if (s.props.referenceImageUrl) {
                referenceImageUrls.push(s.props.referenceImageUrl);
                const refIndex = referenceImageUrls.length; // 计数：主图是1，第一张参考图是2
                desc = `(参考图${refIndex}) ${desc}`;
            }
            return {
                label: s.props.name,
                description: desc
            };
        });

        const finalPrompt = formattedAnnos.length > 0
            ? `${internalPrompt}\n\n根据图中的标注修改图片，并移除所有的标注元素\n\nRegion Instructions:\n${formattedAnnos.map(ann => `[${ann.label}]: ${ann.description}`).join('\n')}`.trim()
            : internalPrompt;

        if (shouldGenerate && referenceImageUrls.some(url => url.startsWith('data:'))) {
            // 这里为了简单，我们并行处理所有 dataUrl
            try {
                const uploadPromises = referenceImageUrls.map(async (url, idx) => {
                    if (url.startsWith('data:')) {
                        const resp = await fetch(`${getApiBase()}/save-image`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageBase64: url, ext: 'png', subdir: 'uploads' })
                        });
                        const json = await resp.json();
                        if (json?.path) referenceImageUrls[idx] = json.path;
                    }
                });
                await Promise.all(uploadPromises);
            } catch (e) {
                console.error('[TldrawEditor] Failed to upload reference images:', e);
            }
        }

        const cleanSnapshot = await prepareSnapshotForSave(editor.getSnapshot());

        if (!shouldGenerate) {
            onSave(referenceImageUrls[0], stripRegionInstructions(internalPrompt), referenceImageUrls.slice(1), false, cleanSnapshot as unknown as TLEditorSnapshot, false, localTaskId);
            return;
        }

        const resultId = createShapeId();
        if (imageShape) {
            const bounds = editor.getShapePageBounds(imageShape.id);
            if (bounds) {
                const arrowId = createShapeId();
                editor.createShapes([
                    { id: arrowId, type: 'arrow', x: bounds.maxX + 10, y: bounds.center.y, props: { start: { x: 0, y: 0 }, end: { x: 80, y: 0 }, arrowheadEnd: 'arrow' } },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { id: resultId, type: 'result', x: bounds.maxX + 10 + 80 + 100, y: bounds.minY, props: { isLoading: true, version: 1, w: bounds.width, h: bounds.height } } as unknown as import('tldraw').TLShape
                ]);
                editor.createBindings([
                    { id: createBindingId(), type: 'arrow', fromId: arrowId, toId: imageShape.id, props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 } } },
                    { id: createBindingId(), type: 'arrow', fromId: arrowId, toId: resultId, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 } } }
                ]);
                zoomToFitWithUiAvoidance(editor, 200);
                (window as unknown as { __lastArrowId?: TLShapeId } & Window).__lastArrowId = arrowId;
            }
        }

        try {
            // 实现批量生成逻辑，参考 playground.tsx
            const startTime = new Date().toISOString();
            const batchSizeToUse = localBatchSize;

            // 并行触发所有生成的 loading card
            const genPromises = Array.from({ length: batchSizeToUse }).map(async (_, i) => {
                const uniqueId = await handleGenerate({
                    configOverride: {
                        prompt: finalPrompt,
                        isEdit: true,
                        model: localModel,
                        // 根据实施计划，干净启动：清除 loras 和 preset
                        loras: [],
                        isPreset: false,
                        presetName: undefined,
                        imageSize: inputSectionProps?.config.imageSize,
                        taskId: localTaskId, // 使用本地维护的 taskId 实现分组
                        width: inputSectionProps?.config.width || 1024,
                        height: inputSectionProps?.config.height || 1024,
                        tldrawSnapshot: i === 0 ? (cleanSnapshot as unknown as Record<string, unknown>) : undefined, // 仅第一个记录保存快照
                    },
                    sourceImageUrls: referenceImageUrls,
                    localSourceIds: referenceImageUrls.map((_, i) => `ref-${i}`),
                    fixedCreatedAt: startTime,
                    isBackground: true, // 后台生成
                    taskId: localTaskId,
                });

                // 只有第一个生成的结果会尝试显示在 Tldraw 画布上（因为只有一个 resultId）
                if (i === 0) {
                    const result = await executeGeneration(
                        uniqueId as string,
                        localTaskId,
                        {
                            prompt: finalPrompt,
                            model: localModel,
                            isEdit: true,
                            loras: [],
                            isPreset: false,
                            presetName: undefined,
                            taskId: localTaskId,
                            width: inputSectionProps?.config.width || 1024,
                            height: inputSectionProps?.config.height || 1024,
                            tldrawSnapshot: cleanSnapshot as unknown as Record<string, unknown>, // Added snapshot here for persistence
                        },
                        startTime,
                        referenceImageUrls
                    );

                    if (result && typeof result !== 'string' && (result as { outputUrl?: string }).outputUrl) {
                        const outputUrl = (result as { outputUrl: string }).outputUrl;
                        const assetId = AssetRecordType.createId();
                        const img = new Image();
                        img.src = outputUrl;
                        await img.decode();
                        editor.createAssets([{ id: assetId, type: 'image', typeName: 'asset', props: { name: 'gen', src: outputUrl, w: img.width, h: img.height, mimeType: 'image/png', isAnimated: false }, meta: {} }]);
                        const resultShape = editor.getShape(resultId) as ResultShape | undefined;
                        const finalImageId = createShapeId();
                        if (resultShape) {
                            editor.createShapes([{ id: finalImageId, type: 'image', x: resultShape.x, y: resultShape.y, props: { assetId, w: resultShape.props.w, h: resultShape.props.h } }]);
                            const arrowId = (window as { __lastArrowId?: TLShapeId } & Window).__lastArrowId;
                            if (arrowId && editor.getShape(arrowId)) {
                                editor.createBindings([{ id: createBindingId(), type: 'arrow', fromId: arrowId, toId: finalImageId, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 } } }]);
                            }
                        }
                    }
                } else {
                    // 其他生成任务顺序触发执行，带有 staggered delay 避免请求过于密集
                    setTimeout(() => {
                        executeGeneration(
                            uniqueId as string,
                            localTaskId,
                            {
                                prompt: finalPrompt,
                                model: localModel,
                                isEdit: true,
                                loras: [],
                                isPreset: false,
                                presetName: undefined,
                                taskId: localTaskId,
                                width: inputSectionProps?.config.width || 1024,
                                height: inputSectionProps?.config.height || 1024
                            },
                            startTime,
                            referenceImageUrls
                        );
                    }, i * 1100);
                }
            });

            await Promise.all([genPromises[0]]); // 等待第一个（绘制在画布上的）完成
            editor.deleteShape(resultId);

            // 最终调用一次 onSave 更新主界面的参考图，并保持编辑器开启
            onSave(referenceImageUrls[0], stripRegionInstructions(internalPrompt), referenceImageUrls.slice(1), false, editor.getSnapshot(), true);

        } catch (err) {
            console.error(err);
            editor.deleteShape(resultId);
        }
    }, [editor, internalPrompt, localModel, localBatchSize, localTaskId, localizedImageUrl, imageUrl, onSave, handleGenerate, executeGeneration, stripRegionInstructions, inputSectionProps, prepareSnapshotForSave, zoomToFitWithUiAvoidance]);

    const editorComponents = useMemo(() => ({
        PageMenu: null,
        DebugMenu: null,
        HelpMenu: null,
        SharePanel: null,
        ImageToolbar: null,
        VideoToolbar: null,
        QuickActions: null,
        MainMenu: (props: import('tldraw').TLUiMainMenuProps) => (
            <DefaultMainMenu {...props}>
                {/* @ts-expect-error - Tldraw UI component type incompatibility */}
                <TldrawUiMenuGroup id="custom-save">
                    <TldrawUiMenuItem
                        id="save-as-preset"
                        label="存为预设"
                        icon="bookmark"
                        onSelect={() => setIsNamingDialogOpen(true)}
                    />
                </TldrawUiMenuGroup>
                <DefaultMainMenuContent />
            </DefaultMainMenu>
        )
    }), [setIsNamingDialogOpen]);

    return (
        <main className="flex-1 relative flex overflow-hidden">
            {/* Override Tldraw right panel position to make room for close button */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .tldraw-custom-container .tlui-layout__top__right {
                    margin-top: 64px !important;
                    pointer-events: none; /* Ensure the gap is click-through */
                }
                .tldraw-custom-container .tlui-layout__top__right > * {
                    pointer-events: all; /* Restore clicks on children */
                }
            `}} />
            <div className="flex-1 relative bg-white flex flex-col overflow-hidden tldraw-custom-container">
                <Tldraw
                    onMount={(editor) => {
                        setEditor(editor);
                        editor.updateInstanceState({ isGridMode: true });
                    }}
                    autoFocus
                    components={editorComponents}
                    shapeUtils={[AnnotationShapeUtil, ResultShapeUtil]}
                    tools={[AnnotationTool]}
                    overrides={tldrawOverrides}
                />

                {editor && imagesInfo.map(info => (
                    <React.Fragment key={info.id}>
                        <ToolbarComponent
                            editor={editor}
                            imageScreenBounds={info.bounds}
                            annotations={info.annotations}
                            imageId={info.id}
                            isVisible={info.isSelected}
                        />
                        <IntegratedInput
                            editor={editor}
                            imageScreenBounds={info.bounds}
                            annotations={info.annotations}
                            localPrompt={internalPrompt}
                            setLocalPrompt={setInternalPrompt}
                            deleteAnnotation={deleteAnnotationWithRenumber}
                            onGenerate={() => handleExport(true, info.id)}
                            isVisible={info.isSelected}
                            selectedModel={localModel}
                            setSelectedModel={setLocalModel}
                            batchSize={localBatchSize}
                            setBatchSize={setLocalBatchSize}
                        />
                    </React.Fragment>
                ))}

                <Dialog open={isNamingDialogOpen} onOpenChange={(open) => {
                    if (!isSaving) setIsNamingDialogOpen(open);
                }}>
                    <DialogContent className="sm:max-w-[425px] z-[100001] bg-white border border-gray-200">
                        <DialogHeader>
                            <DialogTitle>存为预设</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">预设名称</Label>
                                <Input
                                    id="name"
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                    placeholder="输入预设名称..."
                                    className="col-span-3"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsNamingDialogOpen(false)} disabled={isSaving}>取消</Button>
                            <Button
                                className="bg-black hover:bg-black/90 text-white min-w-[100px]"
                                disabled={isSaving}
                                onClick={async () => {
                                    if (!presetName.trim()) {
                                        toast({ title: "请输入名称", variant: "destructive" });
                                        return;
                                    }
                                    await handleSaveAsPreset(presetName.trim());
                                    setIsNamingDialogOpen(false);
                                    setPresetName('');
                                }}
                            >
                                {isSaving ? "存储中..." : "确认存储"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
};
