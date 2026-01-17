import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';

import { AnnotationInfo } from '@/types/database';

export type EditorTool = 'select' | 'brush' | 'text' | 'rect' | 'circle' | 'arrow' | 'eraser' | 'annotate';

// 统一颜色配置 - 画笔和标注框共用
export const EDITOR_COLORS = [
    { hex: '#ef4444', name: 'Red' },
    { hex: '#40cf8f', name: 'Emerald' },
    { hex: '#ffffff', name: 'White' },
    { hex: '#000000', name: 'Black' },
    { hex: '#3b82f6', name: 'Blue' },
    { hex: '#eab308', name: 'Yellow' },
    { hex: '#a855f7', name: 'Purple' },
    { hex: '#f97316', name: 'Orange' },
] as const;

export type EditorColor = typeof EDITOR_COLORS[number]['hex'];

export interface AnnotationMeta {
    colorName: string;
    text: string;
    referenceImageLabel?: string;
    annotationName: string;
}

export interface FabricObject extends fabric.Object {
    name?: string;
    annotationMeta?: AnnotationMeta;
    parentRect?: fabric.Rect;
    nameLabel?: fabric.IText;
    textLabel?: fabric.IText;
    annotationName?: string;
    annotationMetaLabel?: string;
    id?: string;
    _prevEvented?: boolean;
}

export interface FabricCanvas extends fabric.Canvas {
    _wasDrawingMode?: boolean;
}

// 参考图数据结构
export interface ReferenceImage {
    id: string;
    dataUrl: string;
    label: string; // "Image 1", "Image 2", etc.
}

// 导出结果
export interface ExportResult {
    imageDataUrl: string;
    annotations: AnnotationInfo[];
    referenceImages: ReferenceImage[];
}

export interface AnnotationData {
    rect: fabric.Rect;
    color: EditorColor;
    bounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
    // 编辑模式下的已有标注信息
    existingLabel?: FabricObject;
    existingText?: string;
    existingRefImageLabel?: string;
}

export interface EditorState {
    brushColor: EditorColor;
    brushWidth: number;
    fontSize: number;
    activeTool: EditorTool;
    canUndo: boolean;
    canRedo: boolean;
    zoom: number;
    pendingAnnotation: AnnotationData | null;
    referenceImages: ReferenceImage[];
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
}

export const useImageEditor = (imageUrl: string) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const [imageObj, setImageObj] = useState<fabric.FabricImage | null>(null);
    const canvasBackgroundRef = useRef<fabric.Rect | null>(null);

    const [editorState, setEditorState] = useState<EditorState>({
        brushColor: '#ef4444',
        brushWidth: 2,
        fontSize: 32,
        activeTool: 'select',
        canUndo: false,
        canRedo: false,
        zoom: 1,
        pendingAnnotation: null,
        referenceImages: [],
        canvasWidth: 1024,
        canvasHeight: 1024,
        backgroundColor: '#eeeeee', // 默认白色底，更符合“画纸”直觉
    });

    const [isInitialized, setIsInitialized] = useState(false);

    const editorStateRef = useRef(editorState);
    editorStateRef.current = editorState;

    // Control flag for zoom interactions
    const isZoomEnabledRef = useRef(true);
    const setZoomEnabled = useCallback((enabled: boolean) => {
        isZoomEnabledRef.current = enabled;
    }, []);

    const annotationCountRef = useRef(0);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(-1);

    const saveHistory = useCallback(() => {
        if (!fabricCanvasRef.current) return;
        const json = JSON.stringify(fabricCanvasRef.current.toJSON());

        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        }

        historyRef.current.push(json);
        historyIndexRef.current++;

        if (historyRef.current.length > 50) {
            historyRef.current.shift();
            historyIndexRef.current--;
        }

        setEditorState(prev => ({
            ...prev,
            canUndo: historyIndexRef.current > 0,
            canRedo: false,
        }));
    }, []);

    const isDrawingRef = useRef(false);
    const startPointRef = useRef<{ x: number, y: number } | null>(null);
    const activeObjectRef = useRef<fabric.Object | null>(null);
    const isPanningRef = useRef(false);
    const lastPanPointRef = useRef<{ x: number, y: number } | null>(null);
    const isSpacePressedRef = useRef(false);
    const hasMovedRef = useRef(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !isSpacePressedRef.current) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }
                isSpacePressedRef.current = true;
                if (fabricCanvasRef.current) {
                    const canvas = fabricCanvasRef.current;
                    canvas.defaultCursor = 'grab';
                    canvas.hoverCursor = 'grab';
                    // 暂时禁用所有对象的事件，防止它们改变光标
                    canvas.getObjects().forEach(obj => {
                        if (obj !== imageObj && obj !== canvasBackgroundRef.current) {
                            (obj as FabricObject)._prevEvented = obj.evented;
                            obj.evented = false;
                        }
                    });
                    canvas.setCursor('grab');
                    canvas.renderAll();
                }
                // 防止空格键滚动页面
                e.preventDefault();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                isSpacePressedRef.current = false;
                if (fabricCanvasRef.current) {
                    const canvas = fabricCanvasRef.current;
                    canvas.defaultCursor = 'default';
                    canvas.hoverCursor = 'move';
                    // 恢复对象的事件响应
                    canvas.getObjects().forEach(obj => {
                        if (obj !== imageObj && obj !== canvasBackgroundRef.current) {
                            if ((obj as FabricObject)._prevEvented !== undefined) {
                                obj.evented = (obj as FabricObject)._prevEvented!;
                                delete (obj as FabricObject)._prevEvented;
                            }
                        } else {
                            // 默认逻辑
                            const skip: (fabric.Object | null)[] = [imageObj, canvasBackgroundRef.current];
                            const isBg = skip.includes(obj);
                            const isNameLabel = obj instanceof fabric.IText && obj.selectable === false && (obj as FabricObject).backgroundColor !== undefined;
                            obj.evented = !isBg && !isNameLabel;
                        }
                    });
                    canvas.setCursor('default');
                    canvas.renderAll();
                }
            }
        };

        const handleBlur = () => {
            isSpacePressedRef.current = false;
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.defaultCursor = 'default';
                fabricCanvasRef.current.hoverCursor = 'move';
                fabricCanvasRef.current.setCursor('default');
                fabricCanvasRef.current.renderAll();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [imageObj]);

    const handleMouseWheel = useCallback((opt: fabric.TPointerEventInfo<WheelEvent>) => {
        if (!isZoomEnabledRef.current) return;
        const delta = opt.e.deltaY;
        let zoom = fabricCanvasRef.current?.getZoom() || 1;
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;

        fabricCanvasRef.current?.zoomToPoint(
            new fabric.Point(opt.e.offsetX, opt.e.offsetY),
            zoom
        );
        opt.e.preventDefault();
        opt.e.stopPropagation();

        setEditorState(prev => ({ ...prev, zoom }));
    }, []);

    const updateBrushColor = useCallback((col: EditorColor) => {
        const c = fabricCanvasRef.current; if (!c) return;
        if (c.freeDrawingBrush) (c.freeDrawingBrush as fabric.PencilBrush).color = col;
        setEditorState(p => ({ ...p, brushColor: col }));
    }, []);

    const setTool = useCallback((tool: EditorTool) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        setEditorState(prev => ({ ...prev, activeTool: tool }));
        canvas.isDrawingMode = tool === 'brush';
        canvas.selection = tool === 'select' || tool === 'annotate';

        if (tool === 'brush') {
            const brush = new fabric.PencilBrush(canvas);
            brush.color = editorStateRef.current.brushColor;
            brush.width = editorStateRef.current.brushWidth;
            canvas.freeDrawingBrush = brush;
        }

        const allowSelect = tool === 'select' || tool === 'annotate';
        const bgObjects: (fabric.Object | null)[] = [imageObj, canvasBackgroundRef.current];

        canvas.forEachObject(obj => {
            if (bgObjects.includes(obj)) return;

            // Check if object is part of an annotation (Rect with meta, or Label)
            const isAnnotation = (obj as FabricObject).annotationMeta !== undefined ||
                (obj as FabricObject).annotationName !== undefined ||
                (obj as FabricObject).parentRect !== undefined;

            if (tool === 'annotate') {
                if (isAnnotation) {
                    obj.selectable = true;
                    obj.evented = true;
                    obj.lockMovementX = false;
                    obj.lockMovementY = false;
                } else {
                    // Shapes/Stickers/etc in annotate mode: ignore them so we can draw over
                    obj.selectable = false;
                    obj.evented = false;
                }
            } else {
                const isNameLabel = obj instanceof fabric.IText && obj.selectable === false && (obj as FabricObject).backgroundColor !== undefined;
                if (isNameLabel) return;

                obj.selectable = allowSelect;
                obj.evented = allowSelect;
                obj.lockMovementX = false;
                obj.lockMovementY = false;
            }
        });

        canvas.renderAll();
    }, [imageObj]);

    const triggerAnnotationEdit = useCallback((target: FabricObject) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const rect = (target.parentRect || (target.nameLabel ? target : null)) as fabric.Rect;
        if (!rect) return;

        const textLabel = (rect as FabricObject).textLabel as fabric.IText & { annotationMeta?: AnnotationInfo };
        if (!textLabel) return;

        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        const zoom = canvas.getZoom();
        const rectWidth = (rect.width || 0) * (rect.scaleX || 1);
        const rectHeight = (rect.height || 0) * (rect.scaleY || 1);
        const screenLeft = (rect.left || 0) * zoom + vpt[4];
        const screenTop = (rect.top || 0) * zoom + vpt[5];

        setEditorState(prev => ({
            ...prev,
            pendingAnnotation: {
                rect,
                color: (rect.stroke as string) as EditorColor,
                bounds: {
                    left: screenLeft,
                    top: screenTop,
                    right: screenLeft + rectWidth * zoom,
                    bottom: screenTop + rectHeight * zoom,
                    width: rectWidth * zoom,
                    height: rectHeight * zoom
                },
                existingLabel: textLabel,
                existingText: textLabel.annotationMeta?.text || "",
                existingRefImageLabel: textLabel.annotationMeta?.referenceImageLabel
            }
        }));
    }, []);

    const onMouseDown = useCallback((opt: fabric.TPointerEventInfo) => {
        const canvas = fabricCanvasRef.current;
        const state = editorStateRef.current;
        if (!canvas) return;

        const evt = opt.e as MouseEvent;
        // 0: Left, 1: Middle, 2: Right
        const isMiddleButton = evt.button === 1;
        const isSpaceAndLeft = evt.button === 0 && isSpacePressedRef.current;

        if (isMiddleButton || isSpaceAndLeft) {
            isPanningRef.current = true;
            lastPanPointRef.current = { x: evt.clientX, y: evt.clientY };
            canvas.selection = false;

            // 如果处于绘图模式，暂时禁用它
            if (canvas.isDrawingMode) {
                (canvas as FabricCanvas)._wasDrawingMode = true;
                canvas.isDrawingMode = false;
            }

            canvas.defaultCursor = 'grabbing';
            canvas.hoverCursor = 'grabbing';
            canvas.setCursor('grabbing');
            canvas.renderAll();
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }

        hasMovedRef.current = false;

        if (state.activeTool === 'select') {
            return;
        }

        const pointer = canvas.getScenePoint(opt.e);
        const limitObj = imageObj || canvasBackgroundRef.current;

        if (limitObj) {
            const scaleX = limitObj.scaleX || 1;
            const scaleY = limitObj.scaleY || 1;
            const w = (limitObj.width || 0) * scaleX;
            const h = (limitObj.height || 0) * scaleY;
            const rectLeft = (limitObj.left || 0) - w / 2;
            const rectTop = (limitObj.top || 0) - h / 2;

            if (pointer.x < rectLeft || pointer.x > rectLeft + w || pointer.y < rectTop || pointer.y > rectTop + h) {
                if (state.activeTool === 'brush') {
                    canvas.isDrawingMode = false;
                    setTimeout(() => { if (editorStateRef.current.activeTool === 'brush') canvas.isDrawingMode = true; }, 50);
                }
                return;
            }
        }

        if (!['rect', 'circle', 'arrow', 'annotate'].includes(state.activeTool)) return;
        const bgObjects: (fabric.Object | null)[] = [imageObj, canvasBackgroundRef.current];

        // 标注模式下的特殊逻辑
        if (state.activeTool === 'annotate') {
            // Because we set evented=false for non-annotations in setTool,
            // opt.target will only be defined if we clicked an Annotation (or BG/Image, which we filter)
            if (opt.target && !bgObjects.includes(opt.target)) {
                // Clicked an annotation -> Return to let Fabric handle selection/drag
                return;
            }
            // Clicked Empty or Non-Annotation (which are transparent/ignored) -> Start Drawing
        } else {
            // 其他绘制工具：如果点击了非背景对象，则不开始绘制
            if (opt.target && !bgObjects.includes(opt.target)) return;
        }

        isDrawingRef.current = true;
        startPointRef.current = { x: pointer.x, y: pointer.y };

        const common = {
            left: pointer.x,
            top: pointer.y,
            fill: 'rgba(255, 255, 255, 1e-5)',
            stroke: state.brushColor,
            strokeWidth: state.brushWidth,
            selectable: false,
            evented: false,
        };

        if (state.activeTool === 'rect') activeObjectRef.current = new fabric.Rect({ ...common, width: 0, height: 0 });
        else if (state.activeTool === 'circle') activeObjectRef.current = new fabric.Circle({ ...common, radius: 0 });
        else if (state.activeTool === 'arrow') activeObjectRef.current = new fabric.Path(`M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y}`, { ...common, fill: 'transparent' });
        else if (state.activeTool === 'annotate') {
            activeObjectRef.current = new fabric.Rect({
                ...common,
                fill: 'transparent',
                strokeDashArray: [8, 4],
                width: 0,
                height: 0
            });
        }

        if (activeObjectRef.current) {
            canvas.add(activeObjectRef.current);
            canvas.renderAll();
        }
    }, [imageObj]);

    const onMouseMove = useCallback((opt: fabric.TPointerEventInfo) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // 实时强制光标状态，防止 Fabric 内部移动逻辑（如探测到对象）覆盖全局光标
        if (isPanningRef.current) {
            canvas.setCursor('grabbing');
        } else if (isSpacePressedRef.current) {
            canvas.setCursor('grab');
        }

        if (isPanningRef.current && lastPanPointRef.current) {
            const evt = opt.e as MouseEvent;
            const vpt = canvas.viewportTransform;
            if (vpt) {
                vpt[4] += evt.clientX - lastPanPointRef.current.x;
                vpt[5] += evt.clientY - lastPanPointRef.current.y;
                canvas.setCursor('grabbing');
                canvas.requestRenderAll();
                lastPanPointRef.current = { x: evt.clientX, y: evt.clientY };
            }
            return;
        }

        if (!isDrawingRef.current || !activeObjectRef.current || !startPointRef.current) return;

        const pointer = canvas.getScenePoint(opt.e);
        const start = startPointRef.current;
        const state = editorStateRef.current;

        if (state.activeTool === 'rect' || state.activeTool === 'annotate') {
            const width = pointer.x - start.x;
            const height = pointer.y - start.y;
            activeObjectRef.current.set({
                width: Math.abs(width),
                height: Math.abs(height),
                left: width > 0 ? start.x : pointer.x,
                top: height > 0 ? start.y : pointer.y,
            });
        } else if (state.activeTool === 'circle') {
            const radius = Math.sqrt(Math.pow(pointer.x - start.x, 2) + Math.pow(pointer.y - start.y, 2)) / 2;
            activeObjectRef.current.set({
                radius: radius,
                left: (start.x + pointer.x) / 2 - radius,
                top: (start.y + pointer.y) / 2 - radius,
            });
        } else if (state.activeTool === 'arrow') {
            const headlen = 10;
            const angle = Math.atan2(pointer.y - start.y, pointer.x - start.x);
            const pathData = `M ${start.x} ${start.y} 
                             L ${pointer.x} ${pointer.y} 
                             L ${pointer.x - headlen * Math.cos(angle - Math.PI / 6)} ${pointer.y - headlen * Math.sin(angle - Math.PI / 6)}
                             M ${pointer.x} ${pointer.y}
                             L ${pointer.x - headlen * Math.cos(angle + Math.PI / 6)} ${pointer.y - headlen * Math.sin(angle + Math.PI / 6)}`;
            (activeObjectRef.current as fabric.Path).set({ path: new fabric.Path(pathData).path });
        }

        canvas.renderAll();
    }, []);

    const onMouseUp = useCallback(() => {
        if (isPanningRef.current) {
            isPanningRef.current = false;
            lastPanPointRef.current = null;
            if (fabricCanvasRef.current) {
                const canvas = fabricCanvasRef.current;
                canvas.selection = editorStateRef.current.activeTool === 'select' || editorStateRef.current.activeTool === 'annotate';

                // 恢复绘图模式
                if ((canvas as FabricCanvas)._wasDrawingMode) {
                    canvas.isDrawingMode = true;
                    (canvas as FabricCanvas)._wasDrawingMode = false;
                }

                // 恢复光标状态
                const newCursor = isSpacePressedRef.current ? 'grab' : 'default';
                canvas.defaultCursor = newCursor;
                canvas.hoverCursor = isSpacePressedRef.current ? 'grab' : 'move';
                canvas.setCursor(newCursor);
                canvas.renderAll();
            }
            return;
        }

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const state = editorStateRef.current;


        if (!isDrawingRef.current) {
            // If we are in annotate mode, and we didn't draw, check if we clicked an annotation to edit
            if (state.activeTool === 'annotate' && !hasMovedRef.current) {
                const activeObject = canvas.getActiveObject() as FabricObject;
                if (activeObject && (activeObject.annotationMeta || activeObject.annotationName || activeObject.parentRect)) {
                    triggerAnnotationEdit(activeObject);
                }
            }
            return;
        }
        isDrawingRef.current = false;

        if (activeObjectRef.current && canvas) {
            if (editorStateRef.current.activeTool === 'annotate') {
                const rect = activeObjectRef.current as fabric.Rect;
                const rw = (rect.width || 0) * (rect.scaleX || 1);
                const rh = (rect.height || 0) * (rect.scaleY || 1);
                if (rw < 10 || rh < 10) {
                    canvas.remove(rect);
                    canvas.renderAll();
                    activeObjectRef.current = null;
                    return;
                }

                const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
                const zoom = canvas.getZoom();
                const sl = (rect.left || 0) * zoom + vpt[4];
                const st = (rect.top || 0) * zoom + vpt[5];

                setEditorState(prev => ({
                    ...prev,
                    pendingAnnotation: {
                        rect,
                        color: prev.brushColor,
                        bounds: { left: sl, top: st, right: sl + rw * zoom, bottom: st + rh * zoom, width: rw * zoom, height: rh * zoom }
                    }
                }));
                return;
            }

            activeObjectRef.current.set({ selectable: true, evented: true });
            canvas.setActiveObject(activeObjectRef.current);
            saveHistory();
            setTimeout(() => { if (editorStateRef.current.activeTool !== 'select') setTool('select'); }, 0);
        }
        activeObjectRef.current = null;
        startPointRef.current = null;
    }, [saveHistory, setTool, triggerAnnotationEdit]);

    const callbackRefs = useRef({ handleMouseWheel, onMouseDown, onMouseMove, onMouseUp, saveHistory });
    callbackRefs.current = { handleMouseWheel, onMouseDown, onMouseMove, onMouseUp, saveHistory };

    const initFabric = useCallback((w: number, h: number) => {
        if (!canvasRef.current) return null;

        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.dispose();
        }

        const canvas = new fabric.Canvas(canvasRef.current!, {
            width: w,
            height: h,
            backgroundColor: '#1a1a20',
            enableRetinaScaling: true,
            fireMiddleClick: true,
            stopContextMenu: true,
        });

        fabric.Object.prototype.transparentCorners = false;
        fabric.Object.prototype.cornerSize = 4;
        fabric.Object.prototype.cornerStyle = 'circle';
        fabric.Object.prototype.borderColor = '#4AA8FF';
        fabric.Object.prototype.borderScaleFactor = 2;

        const renderCircle = (ctx: CanvasRenderingContext2D, left: number, top: number, style: unknown, obj: fabric.Object) => {
            const r = (obj.cornerSize || 12) / 2;
            ctx.save(); ctx.beginPath(); ctx.arc(left, top, r, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = '#56AEFF'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        };

        const defaultControls = fabric.Object.prototype.controls;
        if (defaultControls) {
            Object.keys(defaultControls).forEach(k => {
                if (defaultControls[k]) {
                    defaultControls[k]!.render = renderCircle;
                }
            });
        }

        fabricCanvasRef.current = canvas;

        const runSetup = async () => {
            if (imageUrl) {
                try {
                    const img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
                    const iw = img.width || 1, ih = img.height || 1;
                    const fitZ = Math.min(w / iw, h / ih) * 0.7;

                    const bgRect = new fabric.Rect({
                        left: w / 2, top: h / 2, width: iw, height: ih,
                        originX: 'center', originY: 'center', fill: editorStateRef.current.backgroundColor,
                        selectable: false, evented: false, scaleX: fitZ, scaleY: fitZ,
                        name: 'canvas-background',
                        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 20, offsetX: 0, offsetY: 0 })
                    });

                    canvas.add(bgRect);
                    canvas.sendObjectToBack(bgRect);
                    canvasBackgroundRef.current = bgRect;

                    img.set({
                        left: w / 2, top: h / 2, originX: 'center', originY: 'center',
                        selectable: false, evented: false, scaleX: fitZ, scaleY: fitZ
                    });

                    canvas.add(img);
                    setImageObj(img);
                    setEditorState(prev => ({ ...prev, canvasWidth: iw, canvasHeight: ih, zoom: 1 }));

                    canvas.clipPath = new fabric.Rect({
                        left: w / 2, top: h / 2, width: iw * fitZ, height: ih * fitZ,
                        originX: 'center', originY: 'center', absolutePositioned: true
                    });
                    setIsInitialized(true);
                } catch (err) {
                    console.error("Failed to load image:", err);
                }
            } else {
                setIsInitialized(false);
            }

            canvas.requestRenderAll();
            callbackRefs.current.saveHistory();
        };

        runSetup();

        canvas.on('mouse:wheel', (o) => callbackRefs.current.handleMouseWheel(o));
        canvas.on('mouse:down', (o) => callbackRefs.current.onMouseDown(o));
        canvas.on('mouse:move', (o) => callbackRefs.current.onMouseMove(o));
        canvas.on('mouse:up', () => callbackRefs.current.onMouseUp());
        canvas.on('path:created', () => callbackRefs.current.saveHistory());
        canvas.on('object:added', (o) => {
            const t = o.target;
            if (t && t !== imageObj && t !== canvasBackgroundRef.current) {
                t.set({ borderColor: '#ffffff', borderScaleFactor: 2, cornerColor: '#1079BB', cornerStrokeColor: '#ffffff', transparentCorners: false, cornerSize: 8, cornerStyle: 'circle' });
                // 使用内部定义的 renderCircle
                if (t.controls) Object.keys(t.controls).forEach(k => t.controls[k]!.render = renderCircle);
            }
            callbackRefs.current.saveHistory();
        });
        canvas.on('object:modified', () => callbackRefs.current.saveHistory());
        canvas.on('selection:created', () => { /* No auto-trigger edit */ });
        canvas.on('selection:updated', () => { /* No auto-trigger edit */ });
        canvas.on('selection:cleared', () => {
            // No need to lock, logic is handled in setTool/object props
        });
        canvas.on('object:moving', (o) => {
            hasMovedRef.current = true;
            const t = o.target as FabricObject; if (!t || (!t.nameLabel && !t.textLabel)) return;
            const r = t as fabric.Rect, rl = r.left || 0, rt = r.top || 0, rh = (r.height || 0) * (r.scaleY || 1);
            if (t.nameLabel) t.nameLabel.set({ left: rl, top: rt - 18 });
            if (t.textLabel) t.textLabel.set({ left: rl + 5, top: rt + rh + 5 });
        });
        canvas.on('object:scaling', (o) => {
            const t = o.target as FabricObject; if (!t || (!t.nameLabel && !t.textLabel)) return;
            const r = t as fabric.Rect, rl = r.left || 0, rt = r.top || 0, rh = (r.height || 0) * (r.scaleY || 1);
            if (t.nameLabel) t.nameLabel.set({ left: rl, top: rt - 18 });
            if (t.textLabel) t.textLabel.set({ left: rl + 5, top: rt + rh + 5 });
        });

        return canvas;
    }, [imageUrl, imageObj]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const container = canvasRef.current.parentElement;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0 && !fabricCanvasRef.current) {
                    initFabric(width, height);
                } else if (fabricCanvasRef.current && width > 0 && height > 0) {
                    fabricCanvasRef.current.setDimensions({ width, height });
                    fabricCanvasRef.current.requestRenderAll();
                }
            }
        });

        resizeObserver.observe(container);

        return () => {
            resizeObserver?.disconnect();
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
                fabricCanvasRef.current = null;
            }
        };
    }, [initFabric]);

    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0 || !fabricCanvasRef.current) return;
        historyIndexRef.current--;
        fabricCanvasRef.current.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
            const obs = fabricCanvasRef.current?.getObjects() || [];
            canvasBackgroundRef.current = obs.find(o => (o as fabric.Object & { name?: string }).name === 'canvas-background') as fabric.Rect || null;
            fabricCanvasRef.current?.renderAll();
            setEditorState(prev => ({ ...prev, canUndo: historyIndexRef.current > 0, canRedo: true }));
        });
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1 || !fabricCanvasRef.current) return;
        historyIndexRef.current++;
        fabricCanvasRef.current.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
            const obs = fabricCanvasRef.current?.getObjects() || [];
            canvasBackgroundRef.current = obs.find(o => (o as fabric.Object & { name?: string }).name === 'canvas-background') as fabric.Rect || null;
            fabricCanvasRef.current?.renderAll();
            setEditorState(prev => ({ ...prev, canUndo: true, canRedo: historyIndexRef.current < historyRef.current.length - 1 }));
        });
    }, []);

    const addText = useCallback(() => {
        const c = fabricCanvasRef.current, t = imageObj || canvasBackgroundRef.current;
        if (!c || !t) return;
        const text = new fabric.IText('Double click', { left: t.left, top: t.top, fontFamily: 'sans-serif', fontSize: editorState.fontSize, fill: editorState.brushColor, originX: 'center', originY: 'center', editable: false });
        c.add(text); c.setActiveObject(text); setTool('select');
    }, [editorState.brushColor, editorState.fontSize, setTool, imageObj]);

    const addShape = useCallback((type: 'rect' | 'circle' | 'arrow') => {
        const c = fabricCanvasRef.current, t = imageObj || canvasBackgroundRef.current;
        if (!c || !t) return;
        let s: fabric.Object;
        const common = { left: t.left, top: t.top, fill: 'transparent', stroke: editorState.brushColor, strokeWidth: editorState.brushWidth / (c.getZoom() || 1), originX: 'center', originY: 'center' } as const;
        if (type === 'rect') s = new fabric.Rect({ ...common, width: 100, height: 100 });
        else if (type === 'circle') s = new fabric.Circle({ ...common, radius: 50 });
        else s = new fabric.Path('M 0 0 L 50 0 L 40 -10 M 50 0 L 40 10', { ...common, strokeWidth: 1 });
        c.add(s); c.setActiveObject(s); setTool('select'); c.renderAll();
    }, [editorState.brushColor, editorState.brushWidth, setTool, imageObj]);

    const rotateCanvas = useCallback((d: number) => {
        const c = fabricCanvasRef.current; if (!c) return;
        const a = c.getActiveObject(), t = a || imageObj || canvasBackgroundRef.current;
        if (t) { t.set('angle', (t.angle || 0) + d); c.renderAll(); saveHistory(); }
    }, [saveHistory, imageObj]);

    const applyFilter = useCallback((ft: string, v?: number) => {
        const c = fabricCanvasRef.current; if (!c || !imageObj) return;
        let f: fabric.filters.BaseFilter<string> | undefined;
        if (ft === 'grayscale') f = new fabric.filters.Grayscale();
        else if (ft === 'sepia') f = new fabric.filters.Sepia();
        else if (ft === 'invert') f = new fabric.filters.Invert();
        else if (ft === 'brightness') f = new fabric.filters.Brightness({ brightness: v || 0 });
        else if (ft === 'contrast') f = new fabric.filters.Contrast({ contrast: v || 0 });
        if (f) {
            const fs = imageObj.filters || []; const idx = fs.findIndex(i => i.type === f!.type);
            if (idx > -1) fs[idx] = f; else fs.push(f);
            imageObj.applyFilters(); c.renderAll(); saveHistory();
        }
    }, [saveHistory, imageObj]);

    const exportImage = useCallback((): string | null => {
        const c = fabricCanvasRef.current; if (!c) return null;
        const oz = c.getZoom(), ovp = c.viewportTransform ? [...c.viewportTransform] : null;
        c.setZoom(1); c.viewportTransform = [1, 0, 0, 1, 0, 0];
        const t = imageObj || canvasBackgroundRef.current; if (!t) return null;
        const sx = t.scaleX || 1, sy = t.scaleY || 1, w = (t.width || 0) * sx, h = (t.height || 0) * sy;
        const dataUrl = c.toDataURL({ format: 'png', left: (t.left || 0) - w / 2, top: (t.top || 0) - h / 2, width: w, height: h, multiplier: 1 / sx });
        c.setZoom(oz); if (ovp) c.viewportTransform = ovp as fabric.TMat2D;
        return dataUrl;
    }, [imageObj]);

    const updateBrushWidth = (w: number) => {
        setEditorState(p => ({ ...p, brushWidth: w }));
        const c = fabricCanvasRef.current; if (!c) return;
        if (c.freeDrawingBrush) c.freeDrawingBrush.width = w;
        c.getActiveObjects().forEach(o => { if (o.stroke !== undefined && o !== imageObj && o !== canvasBackgroundRef.current) o.set('strokeWidth', w); });
        c.renderAll(); saveHistory();
    };

    const deleteSelected = useCallback(() => {
        const c = fabricCanvasRef.current; if (!c) return;
        const aos = c.getActiveObjects(); if (aos.length === 0) return;
        const skip: (fabric.Object | null)[] = [imageObj, canvasBackgroundRef.current]; const rem = new Set<fabric.Object>();
        aos.forEach(o => {
            const isBg = skip.includes(o);
            if (isBg) return;
            rem.add(o); if ((o as FabricObject).nameLabel) rem.add((o as FabricObject).nameLabel!); if ((o as FabricObject).textLabel) rem.add((o as FabricObject).textLabel!);
            if ((o as FabricObject).parentRect) { const pr = (o as FabricObject).parentRect as FabricObject; rem.add(pr); if (pr.nameLabel) rem.add(pr.nameLabel); if (pr.textLabel) rem.add(pr.textLabel); }
        });
        rem.forEach(o => c.remove(o)); c.discardActiveObject(); c.renderAll(); saveHistory();
    }, [saveHistory, imageObj]);

    const addImage = useCallback((url: string) => {
        const c = fabricCanvasRef.current; if (!c) return;
        fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then((img) => {
            const center = c.getVpCenter(), s = Math.min(300 / (img.width || 1), 300 / (img.height || 1), 1);
            img.set({ left: center.x, top: center.y, originX: 'center', originY: 'center', scaleX: s, scaleY: s, selectable: true, evented: true });
            c.add(img); c.setActiveObject(img); c.renderAll(); saveHistory(); setTool('select');
        });
    }, [saveHistory, setTool]);

    const confirmAnnotation = useCallback((t: string, rL?: string) => {
        const c = fabricCanvasRef.current, a = editorState.pendingAnnotation; if (!c || !a) return;
        const r = a.rect, rl = r.left || 0, rt = r.top || 0, rh = (r.height || 0) * (r.scaleY || 1), col = a.color;
        if (a.existingLabel) c.remove(a.existingLabel); if ((r as FabricObject).nameLabel) c.remove((r as FabricObject).nameLabel!);
        let n: string; if (!a.existingLabel && !a.existingText) { annotationCountRef.current++; n = `标注${annotationCountRef.current}`; } else n = (r as FabricObject).annotationName || `标注${annotationCountRef.current}`;
        (r as FabricObject).annotationName = n;
        const nL = new fabric.IText(n, { left: rl, top: rt - 18, fontFamily: 'sans-serif', fontSize: 12, fill: '#ffffff', backgroundColor: col, padding: 2, selectable: false, evented: false });
        c.add(nL); (r as FabricObject).nameLabel = nL; (nL as FabricObject).parentRect = r;
        let lT = t.trim(); if (rL) lT = lT ? `${lT} (${rL})` : rL;
        if (lT) {
            const l = new fabric.IText(lT, { left: rl + 5, top: rt + rh + 5, fontFamily: 'sans-serif', fontSize: 14, fill: col, backgroundColor: 'rgba(0,0,0,0.7)', padding: 4, selectable: true, evented: true, editable: false });
            (l as FabricObject).annotationMeta = { colorName: EDITOR_COLORS.find(c => c.hex === col)?.name || 'Red', text: t.trim(), referenceImageLabel: rL, annotationName: n };
            c.add(l); (r as FabricObject).textLabel = l; (l as FabricObject).parentRect = r;
        }
        r.set({ selectable: true, evented: true, lockMovementX: false, lockMovementY: false }); c.setActiveObject(r); c.renderAll(); callbackRefs.current.saveHistory();
        setEditorState(p => ({ ...p, pendingAnnotation: null }));
    }, [editorState.pendingAnnotation]);

    const cancelAnnotation = useCallback(() => {
        const c = fabricCanvasRef.current, a = editorState.pendingAnnotation; if (!c || !a) return;
        if (!a.existingLabel && !a.existingText) c.remove(a.rect);
        c.renderAll(); setEditorState(p => ({ ...p, pendingAnnotation: null }));
    }, [editorState.pendingAnnotation]);

    const addReferenceImage = useCallback((url: string) => {
        setEditorState(p => {
            const i = p.referenceImages.length + 1;
            const n = { id: `ref-${Date.now()}-${i}`, dataUrl: url, label: `Image ${i}` };
            return { ...p, referenceImages: [...p.referenceImages, n] };
        });
    }, []);

    const removeReferenceImage = useCallback((id: string) => {
        setEditorState(p => {
            const f = p.referenceImages.filter(x => x.id !== id);
            const r = f.map((x, idx) => ({ ...x, label: `Image ${idx + 1}` }));
            return { ...p, referenceImages: r };
        });
    }, []);

    const getAnnotationsInfo = useCallback((): AnnotationInfo[] => {
        const c = fabricCanvasRef.current; if (!c) return [];
        const res: AnnotationInfo[] = [];
        c.getObjects().forEach(o => { if (o.type === 'i-text' && (o as FabricObject).annotationMeta) res.push((o as FabricObject).annotationMeta!); });
        return res;
    }, []);

    const updateCanvasBackground = useCallback((col: string) => {
        const c = fabricCanvasRef.current; if (!c || !canvasBackgroundRef.current) return;
        canvasBackgroundRef.current.set({ fill: col }); c.renderAll();
        setEditorState(p => ({ ...p, backgroundColor: col })); saveHistory();
    }, [saveHistory]);

    const updateCanvasSize = useCallback((w: number, h: number) => {
        const c = fabricCanvasRef.current; if (!c || !canvasBackgroundRef.current) return;
        const cw = c.width || 800, ch = c.height || 600, z = Math.min(cw / w, ch / h) * 0.9;
        canvasBackgroundRef.current.set({ width: w, height: h, scaleX: z, scaleY: z });
        if (imageObj) imageObj.set({ scaleX: (w / imageObj.width) * z, scaleY: (h / imageObj.height) * z });
        c.clipPath = new fabric.Rect({ left: cw / 2, top: ch / 2, width: w * z, height: h * z, originX: 'center', originY: 'center', absolutePositioned: true });
        setEditorState(p => ({ ...p, canvasWidth: w, canvasHeight: h })); c.renderAll(); saveHistory();
    }, [imageObj, saveHistory]);

    const getCanvasState = useCallback(() => {
        if (!fabricCanvasRef.current) return null;
        return fabricCanvasRef.current.toJSON();
    }, []);

    const loadCanvasState = useCallback((json: unknown) => {
        if (!fabricCanvasRef.current || !json) return;
        if (typeof json === 'string' || typeof json === 'object') {
            fabricCanvasRef.current.loadFromJSON(json as string | Record<string, unknown>).then(() => {
                const obs = fabricCanvasRef.current?.getObjects() || [];
                canvasBackgroundRef.current = obs.find(o => (o as FabricObject).name === 'canvas-background') as fabric.Rect || null;

                // Attempt to restore imageObj reference
                // Assuming the main image is the first FabricImage that is not the background (background is Rect)
                const mainImg = obs.find(o => o instanceof fabric.FabricImage) as fabric.FabricImage | null;
                if (mainImg) {
                    setImageObj(mainImg);
                }

                fabricCanvasRef.current?.renderAll();
                // Update history with the loaded state
                const jsonStr = JSON.stringify(fabricCanvasRef.current?.toJSON());
                historyRef.current = [jsonStr];
                historyIndexRef.current = 0;
                setEditorState(prev => ({ ...prev, canUndo: false, canRedo: false }));
                setIsInitialized(true);
            });
        }
    }, []);

    const initCanvas = useCallback((w: number, h: number) => {
        let canvas = fabricCanvasRef.current;

        // 如果 canvas 还没初始化，尝试手动触发一次初始化
        if (!canvas && canvasRef.current) {
            const container = canvasRef.current.parentElement;
            if (container) {
                const rect = container.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    canvas = initFabric(rect.width, rect.height);
                }
            }
        }

        if (!canvas) {
            console.error("Canvas not initialized");
            return;
        }

        const cw = canvas.width || 800, ch = canvas.height || 600;
        const initialZoom = Math.min(cw / w, ch / h) * 0.7;

        const bgRect = new fabric.Rect({
            left: cw / 2, top: ch / 2, width: w, height: h,
            originX: 'center', originY: 'center', fill: editorStateRef.current.backgroundColor,
            selectable: false, evented: false, scaleX: initialZoom, scaleY: initialZoom,
            name: 'canvas-background',
            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 20, offsetX: 0, offsetY: 0 })
        });

        canvas.add(bgRect);
        canvas.sendObjectToBack(bgRect);
        canvasBackgroundRef.current = bgRect;

        setEditorState(prev => ({ ...prev, canvasWidth: w, canvasHeight: h, zoom: 1 }));
        canvas.clipPath = new fabric.Rect({
            left: cw / 2, top: ch / 2, width: w * initialZoom, height: h * initialZoom,
            originX: 'center', originY: 'center', absolutePositioned: true
        });

        canvas.requestRenderAll();
        setIsInitialized(true);
    }, [initFabric]);

    const initCanvasWithImage = useCallback(async (url: string) => {
        let canvas = fabricCanvasRef.current;
        if (!canvas && canvasRef.current) {
            const container = canvasRef.current.parentElement;
            if (container) {
                const rect = container.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    canvas = initFabric(rect.width, rect.height);
                }
            }
        }

        if (!canvas) {
            console.warn("fabricCanvasRef is null during initCanvasWithImage, waiting a bit...");
            // 尝试等待一帧，给 ResizeObserver 机会
            await new Promise(resolve => setTimeout(resolve, 50));
            canvas = fabricCanvasRef.current;
        }

        if (!canvas) {
            console.error("Canvas not initialized for image");
            return;
        }

        const cw = canvas.width || 800, ch = canvas.height || 600;

        try {
            const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
            const iw = img.width || 1, ih = img.height || 1;
            const fitZ = Math.min(cw / iw, ch / ih) * 0.7;

            const bgRect = new fabric.Rect({
                left: cw / 2, top: ch / 2, width: iw, height: ih,
                originX: 'center', originY: 'center', fill: editorStateRef.current.backgroundColor,
                selectable: false, evented: false, scaleX: fitZ, scaleY: fitZ,
                name: 'canvas-background',
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 20, offsetX: 0, offsetY: 0 })
            });

            canvas.add(bgRect);
            canvas.sendObjectToBack(bgRect);
            canvasBackgroundRef.current = bgRect;

            img.set({
                left: cw / 2, top: ch / 2, originX: 'center', originY: 'center',
                selectable: false, evented: false, scaleX: fitZ, scaleY: fitZ
            });

            canvas.add(img);
            setImageObj(img);
            setEditorState(prev => ({ ...prev, canvasWidth: iw, canvasHeight: ih, zoom: 1 }));

            canvas.clipPath = new fabric.Rect({
                left: cw / 2, top: ch / 2, width: iw * fitZ, height: ih * fitZ,
                originX: 'center', originY: 'center', absolutePositioned: true
            });

            canvas.requestRenderAll();
            setIsInitialized(true);
            saveHistory();
        } catch (err) {
            console.error("Failed to load image:", err);
        }
    }, [saveHistory, initFabric]);

    return {
        canvasRef, editorState, setTool, addText, addShape, addImage, undo, redo, rotateCanvas, applyFilter, exportImage,
        updateBrushColor, updateBrushWidth, deleteSelected, confirmAnnotation, cancelAnnotation, addReferenceImage,
        removeReferenceImage, getAnnotationsInfo, updateCanvasBackground, updateCanvasSize, fabricCanvasRef,
        getCanvasState, loadCanvasState, setEditorState, isInitialized, initCanvas, initCanvasWithImage, setZoomEnabled
    };
};
