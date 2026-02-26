import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Tldraw,
    Editor,
    createShapeId,
    createBindingId,
    AssetRecordType,
    TLShapeId,
    type TLEditorSnapshot,
    type StoreSnapshot,
    type TLRecord,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { useGenerationService, AVAILABLE_MODELS } from "@studio/playground/_components/hooks/useGenerationService";
import { useToast } from "@/hooks/common/use-toast";
import { PlaygroundInputSectionProps } from '../PlaygroundInputSection';
import { AnnotationShapeUtil, ResultShapeUtil, AnnotationTool, AnnotationShape, ResultShape } from './TldrawShapes';
import { getApiBase } from '@/lib/api-base';
import { EditPresetConfig } from '../types';
import { ToolbarComponent, type TldrawAnnotationItem } from './TldrawEditorWidgets';
import { IntegratedInput, SavePresetDialog } from './TldrawEditorPanels';
import {
    DefaultMainMenu,
    DefaultMainMenuContent,
    TldrawUiMenuItem,
    TldrawUiMenuGroup,
} from 'tldraw';
import {
    DEFAULT_ANNOTATION_LABEL_CONFIG,
    compareAnnotationLabels,
    formatAnnotationLabel,
    setAnnotationLabelConfig,
    type AnnotationLabelConfig,
} from '@/lib/utils/annotation-label';
import {
    localizeImageUrl,
    prepareSnapshotForSave as prepareSnapshotForSaveUtil,
    stripRegionInstructions,
    TLDRAW_CUSTOM_STYLE_CSS,
    uploadImageBase64ToServer,
    zoomToFitWithUiAvoidance,
} from './tldraw-editor-helpers';

interface TldrawEditorViewProps {
    imageUrl: string;
    onSave: (editedImageUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean, snapshot?: TLEditorSnapshot, keepOpen?: boolean, taskId?: string) => void;
    inputSectionProps?: PlaygroundInputSectionProps;
    localPrompt: string;
    setLocalPrompt: (prompt: string) => void;
    initialSnapshot?: TLEditorSnapshot;
    editorRef?: React.MutableRefObject<{ getSnapshot: () => TLEditorSnapshot | null; getTaskId: () => string } | null>;
    onSaveAsPreset?: (editConfig: EditPresetConfig, name?: string) => void;
    editorMode?: 'default' | 'banner';
    annotationLabelConfig?: AnnotationLabelConfig;
}

export const TldrawEditorView = ({
    imageUrl,
    onSave,
    inputSectionProps,
    localPrompt: propsLocalPrompt,
    initialSnapshot,
    editorRef,
    onSaveAsPreset,
    editorMode = 'default',
    annotationLabelConfig = DEFAULT_ANNOTATION_LABEL_CONFIG
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

    useEffect(() => {
        setAnnotationLabelConfig(annotationLabelConfig);
        return () => {
            setAnnotationLabelConfig(DEFAULT_ANNOTATION_LABEL_CONFIG);
        };
    }, [annotationLabelConfig]);

    const [internalPrompt, setInternalPrompt] = useState(() => stripRegionInstructions(propsLocalPrompt || ""));

    useEffect(() => {
        setInternalPrompt(stripRegionInstructions(propsLocalPrompt || ""));
    }, [propsLocalPrompt]);

    // 统一的图片上传逻辑
    const uploadImageToCDN = useCallback(async (imageBase64: string) => {
        return uploadImageBase64ToServer(getApiBase(), imageBase64, 'png', 'uploads');
    }, []);

    const { handleGenerate, executeGeneration } = useGenerationService();

    const annotationToolLabel = `${annotationLabelConfig.prefix}标注`;

    const tldrawOverrides = useMemo(() => ({
        translations: {
            'zh-cn': {
                'fill-style.lined-fill': '线条填充',
                'tool.annotation': annotationToolLabel
            },
            'zh-CN': {
                'fill-style.lined-fill': '线条填充',
                'tool.annotation': annotationToolLabel
            }
        },
        tools(editor: Editor, tools: import('tldraw').TLUiToolsContextType) {
            tools.annotation = {
                id: 'annotation',
                icon: 'tool-note',
                label: annotationToolLabel,
                kbd: 'a',
                onSelect: () => {
                    editor.setCurrentTool('annotation');
                },
            };
            return tools;
        },
        actions(editor: Editor, actions: import('tldraw').TLUiActionsContextType) {
            if (editorMode !== 'banner' && onSaveAsPreset) {
                actions['save-as-preset'] = {
                    id: 'save-as-preset',
                    label: '存为预设',
                    icon: 'bookmark',
                    onSelect: () => {
                        setIsNamingDialogOpen(true);
                    },
                };
            }
            return actions;
        }
    }), [annotationToolLabel, editorMode, onSaveAsPreset]);

    const annotationCountRef = useRef(0);
    const [imagesInfo, setImagesInfo] = useState<Array<{
        id: TLShapeId;
        bounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number };
        annotations: TldrawAnnotationItem[];
        isSelected: boolean;
    }>>([]);
    const [localizedImageUrl, setLocalizedImageUrl] = useState<string>('');

    useEffect(() => {
        if (!imageUrl) return;
        const localize = async () => {
            const localizedUrl = await localizeImageUrl(imageUrl);
            setLocalizedImageUrl(localizedUrl);
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
    }, [editor, localizedImageUrl, initialSnapshot]);

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
                        label: s.props.name,
                        displayName: s.props.displayName
                    }))
                    .sort((a, b) => compareAnnotationLabels(a.label, b.label, annotationLabelConfig));

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
                annotations: TldrawAnnotationItem[];
                isSelected: boolean;
            }>;

            setImagesInfo(infos);

            const allAnnoCount = annotationShapes.length;
            annotationCountRef.current = allAnnoCount;
        };

        updateImagesInfo();
        const unsubscribe = editor.store.listen((history) => {
            updateImagesInfo();

            const changes = history.changes;
            if (changes.added) {
                const addedRecords = Object.values(changes.added);

                // 1. 监听新图片添加逻辑（原有缩放逻辑）
                const hasNewImage = addedRecords.some(
                    record => record.typeName === 'shape' && (record as import('tldraw').TLShape).type === 'image'
                );
                if (hasNewImage) {
                    setTimeout(() => {
                        zoomToFitWithUiAvoidance(editor, 200);
                    }, 100);
                }

                // 2. 即加即传：监听新资产添加，如果是 Base64 则立即上传
                addedRecords.forEach(record => {
                    const recordWithSrc = record as { props?: { src?: string } };
                    if (record.typeName === 'asset' && record.type === 'image' && typeof recordWithSrc.props?.src === 'string' && recordWithSrc.props.src.startsWith('data:')) {
                        const asset = record as import('tldraw').TLAsset;
                        const src = asset.props.src;
                        if (typeof src !== 'string') return;
                        uploadImageToCDN(src).then(path => {
                            if (path) {
                                editor.updateAssets([{
                                    id: asset.id,
                                    typeName: 'asset',
                                    type: 'image',
                                    props: { src: path }
                                } as unknown as import('tldraw').TLAsset]);
                            }
                        });
                    }
                });
            }
        }, { scope: 'all', source: 'user' });
        return () => unsubscribe();
    }, [editor, uploadImageToCDN, annotationLabelConfig]);

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
            const newLabel = formatAnnotationLabel(index + 1, annotationLabelConfig);
            editor.updateShape({ id: ann.id, type: 'annotation', props: { name: newLabel } } as unknown as import('tldraw').TLShape);
        });

        annotationCountRef.current = Math.max(0, annotationCountRef.current - 1);
    }, [editor, annotationLabelConfig]);

    const prepareSnapshotForSave = useCallback(
        async (snapshot: TLEditorSnapshot) => prepareSnapshotForSaveUtil(snapshot, getApiBase()),
        []
    );

    const handleSaveAsPreset = useCallback(async (name?: string) => {
        if (!editor || !onSaveAsPreset) {
            console.error('[handleSaveAsPreset] editor or onSaveAsPreset is missing', { editor: !!editor, onSaveAsPreset: !!onSaveAsPreset });
            return;
        }

        setIsSaving(true);
        try {
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
                        const path = await uploadImageBase64ToServer(getApiBase(), src, 'png', 'uploads');
                        if (path) originalImageUrl = path;
                    } else {
                        originalImageUrl = src;
                    }
                }
            }

            // 2. 收集所有标注 (针对整个画布)
            const allAnnos = (editor.getCurrentPageShapes()
                .filter(s => (s.type as unknown as string) === 'annotation') as unknown as AnnotationShape[])
                .sort((a, b) => compareAnnotationLabels(a.props.name || '', b.props.name || '', annotationLabelConfig));

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
            toast({ title: "正在处理预设", description: "正在优化并上传快照资产..." });

            const rawSnapshot = editor.getSnapshot();
            const cleanSnapshot = await prepareSnapshotForSave(rawSnapshot);
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

            await onSaveAsPreset(editConfig, name);
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
    }, [editor, imageUrl, onSaveAsPreset, prepareSnapshotForSave, toast, annotationLabelConfig]);

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
            .sort((a, b) => compareAnnotationLabels(a.props.name || '', b.props.name || '', annotationLabelConfig));

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

        // --- UI 优先逻辑开始 ---
        const resultId = createShapeId();
        let arrowId: import('tldraw').TLShapeId | undefined = undefined;

        if (shouldGenerate && imageShape) {
            const bounds = editor.getShapePageBounds(imageShape.id);
            if (bounds) {
                arrowId = createShapeId();
                const gap = 150;
                const resultX = bounds.maxX + gap;
                const resultY = bounds.minY;

                const startX = bounds.maxX;
                const startY = bounds.center.y;
                const endX = resultX;
                const endY = bounds.minY + bounds.height / 2;

                // 立即创建 Loading 形状
                editor.createShapes([
                    { id: resultId, type: 'result', x: resultX, y: resultY, props: { isLoading: true, version: 1, w: bounds.width, h: bounds.height } } as unknown as import('tldraw').TLShape
                ]);

                // 立即创建箭头
                editor.createShapes([
                    {
                        id: arrowId,
                        type: 'arrow',
                        x: startX,
                        y: startY,
                        props: {
                            start: { x: 0, y: 0 },
                            end: { x: endX - startX, y: endY - startY },
                            arrowheadStart: 'none',
                            arrowheadEnd: 'none',
                            color: 'grey',
                            size: 's',
                        }
                    }
                ]);

                // 异步处理绑定和视图缩放
                setTimeout(() => {
                    const arrowShape = editor.getShape(arrowId!);
                    const resultShape = editor.getShape(resultId);
                    if (arrowShape && resultShape && imageShape) {
                        try {
                            editor.createBindings([
                                {
                                    id: createBindingId(),
                                    type: 'arrow',
                                    fromId: arrowId!,
                                    toId: imageShape.id,
                                    props: {
                                        terminal: 'start',
                                        normalizedAnchor: { x: 1, y: 0.5 },
                                        isPrecise: true,
                                        isExact: false
                                    }
                                },
                                {
                                    id: createBindingId(),
                                    type: 'arrow',
                                    fromId: arrowId!,
                                    toId: resultId,
                                    props: {
                                        terminal: 'end',
                                        normalizedAnchor: { x: 0, y: 0.5 },
                                        isPrecise: true,
                                        isExact: false
                                    }
                                }
                            ]);
                        } catch (e) {
                            console.error('Failed to create arrow bindings:', e);
                        }
                    }
                }, 50);
                zoomToFitWithUiAvoidance(editor, 200);
                (window as { __lastArrowId?: TLShapeId } & Window).__lastArrowId = arrowId;
            }
        }
        // --- UI 优先逻辑结束 ---

        // 接下来执行耗时的异步任务
        if (referenceImageUrls.some(url => url.startsWith('data:'))) {
            try {
                const uploadPromises = referenceImageUrls.map(async (url, idx) => {
                    if (url.startsWith('data:')) {
                        const path = await uploadImageBase64ToServer(getApiBase(), url, 'png', 'uploads');
                        if (path) referenceImageUrls[idx] = path;
                    }
                });
                await Promise.all(uploadPromises);
            } catch (e) {
                console.error('[TldrawEditor] Failed to upload reference images:', e);
            }
        }

        const cleanSnapshot = await prepareSnapshotForSave(editor.getSnapshot());

        if (!shouldGenerate) {
            onSave(referenceImageUrls[0], stripRegionInstructions(internalPrompt), referenceImageUrls.slice(1), false, cleanSnapshot as TLEditorSnapshot, false, localTaskId);
            return;
        }

        try {
            const startTime = new Date().toISOString();
            const batchSizeToUse = localBatchSize;

            const genPromises = Array.from({ length: batchSizeToUse }).map(async (_, i) => {
                const uniqueId = await handleGenerate({
                    configOverride: {
                        prompt: finalPrompt,
                        isEdit: true,
                        model: localModel,
                        loras: [],
                        isPreset: false,
                        presetName: undefined,
                        imageSize: inputSectionProps?.config.imageSize,
                        taskId: localTaskId,
                        width: inputSectionProps?.config.width || 1024,
                        height: inputSectionProps?.config.height || 1024,
                        tldrawSnapshot: i === 0 ? (cleanSnapshot as unknown as Record<string, unknown>) : undefined,
                    },
                    sourceImageUrls: referenceImageUrls,
                    localSourceIds: referenceImageUrls.map((_, i) => `ref-${i}`),
                    fixedCreatedAt: startTime,
                    isBackground: true,
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
    }, [editor, internalPrompt, localModel, localBatchSize, localTaskId, localizedImageUrl, imageUrl, onSave, handleGenerate, executeGeneration, inputSectionProps, prepareSnapshotForSave, annotationLabelConfig]);

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
                {editorMode !== 'banner' && onSaveAsPreset ? (
                    // @ts-expect-error - Tldraw UI component type incompatibility
                    <TldrawUiMenuGroup id="custom-save">
                        <TldrawUiMenuItem
                            id="save-as-preset"
                            label="存为预设"
                            icon="bookmark"
                            onSelect={() => setIsNamingDialogOpen(true)}
                        />
                    </TldrawUiMenuGroup>
                ) : null}
                <DefaultMainMenuContent />
            </DefaultMainMenu>
        )
    }), [setIsNamingDialogOpen, editorMode, onSaveAsPreset]);

    return (
        <main className="flex-1 relative flex overflow-hidden">
            {/* Override Tldraw right panel position to make room for close button */}
            <style dangerouslySetInnerHTML={{
                __html: TLDRAW_CUSTOM_STYLE_CSS
            }} />
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
                        {editorMode !== 'banner' ? (
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
                                modelOptions={AVAILABLE_MODELS}
                            />
                        ) : null}
                    </React.Fragment>
                ))}
                <SavePresetDialog
                    open={isNamingDialogOpen}
                    isSaving={isSaving}
                    presetName={presetName}
                    onOpenChange={setIsNamingDialogOpen}
                    onPresetNameChange={setPresetName}
                    onCancel={() => setIsNamingDialogOpen(false)}
                    onConfirm={async () => {
                        if (!presetName.trim()) {
                            toast({ title: "请输入名称", variant: "destructive" });
                            return;
                        }
                        await handleSaveAsPreset(presetName.trim());
                        setIsNamingDialogOpen(false);
                        setPresetName('');
                    }}
                />
            </div>
        </main>
    );
};
