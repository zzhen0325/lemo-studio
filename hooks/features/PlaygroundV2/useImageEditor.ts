import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';

import { AnnotationInfo } from '@/types/database';

export type EditorTool = 'select' | 'brush' | 'text' | 'rect' | 'circle' | 'arrow' | 'eraser' | 'annotate';

// 统一颜色配置 - 画笔和标注框共用
export const EDITOR_COLORS = [
    { hex: '#40cf8f', name: 'Emerald' },
    { hex: '#ffffff', name: 'White' },
    { hex: '#000000', name: 'Black' },
    { hex: '#ef4444', name: 'Red' },
    { hex: '#3b82f6', name: 'Blue' },
    { hex: '#eab308', name: 'Yellow' },
    { hex: '#a855f7', name: 'Purple' },
    { hex: '#f97316', name: 'Orange' },
] as const;

export type EditorColor = typeof EDITOR_COLORS[number]['hex'];

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
    existingLabel?: fabric.IText;
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
        brushColor: '#40cf8f',
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

    const editorStateRef = useRef(editorState);
    editorStateRef.current = editorState;

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

    const handleMouseWheel = useCallback((opt: fabric.TPointerEventInfo<WheelEvent>) => {
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
        const bgObjects = [imageObj, canvasBackgroundRef.current];

        canvas.forEachObject(obj => {
            if (bgObjects.includes(obj as any)) return;
            const isNameLabel = obj instanceof fabric.IText && obj.selectable === false && obj.backgroundColor !== undefined;
            if (isNameLabel) return;

            obj.selectable = allowSelect;
            obj.evented = allowSelect;
        });

        canvas.renderAll();
    }, [imageObj]);

    const triggerAnnotationEdit = useCallback((target: any) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const rect = (target.parentRect || (target.nameLabel ? target : null)) as fabric.Rect;
        if (!rect) return;

        const textLabel = (rect as any).textLabel as fabric.IText & { annotationMeta?: AnnotationInfo };
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

        if (state.activeTool === 'select') {
            const evt = opt.e as MouseEvent;
            if (!canvas.getActiveObject()) {
                isPanningRef.current = true;
                lastPanPointRef.current = { x: evt.clientX, y: evt.clientY };
                canvas.selection = false;
            }
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
        if (opt.target && ![imageObj, canvasBackgroundRef.current].includes(opt.target as any)) return;

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

        if (isPanningRef.current && lastPanPointRef.current) {
            const evt = opt.e as MouseEvent;
            const vpt = canvas.viewportTransform;
            if (vpt) {
                vpt[4] += evt.clientX - lastPanPointRef.current.x;
                vpt[5] += evt.clientY - lastPanPointRef.current.y;
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
            if (fabricCanvasRef.current) fabricCanvasRef.current.selection = editorStateRef.current.activeTool === 'select';
            return;
        }

        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        const canvas = fabricCanvasRef.current;

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
    }, [saveHistory, setTool]);

    const callbackRefs = useRef({ handleMouseWheel, onMouseDown, onMouseMove, onMouseUp, saveHistory });
    callbackRefs.current = { handleMouseWheel, onMouseDown, onMouseMove, onMouseUp, saveHistory };

    useEffect(() => {
        if (!canvasRef.current) return;
        const container = canvasRef.current.parentElement;
        if (!container) return;

        let canvas: fabric.Canvas | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const init = (w: number, h: number) => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
            }

            canvas = new fabric.Canvas(canvasRef.current!, {
                width: w,
                height: h,
                backgroundColor: '#1a1a20',
                enableRetinaScaling: true,
            });

            fabric.Object.prototype.transparentCorners = false;
            fabric.Object.prototype.cornerSize = 4;
            fabric.Object.prototype.cornerStyle = 'circle';
            fabric.Object.prototype.borderColor = '#4AA8FF';
            fabric.Object.prototype.borderScaleFactor = 2;

            const renderCircle = (ctx: CanvasRenderingContext2D, left: number, top: number, style: any, obj: fabric.Object) => {
                const r = (obj.cornerSize || 12) / 2;
                ctx.save(); ctx.beginPath(); ctx.arc(left, top, r, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
                ctx.strokeStyle = '#56AEFF'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
            };

            // 安全地设置默认控制点样式
            const defaultControls = fabric.Object.prototype.controls;
            if (defaultControls) {
                Object.keys(defaultControls).forEach(k => {
                    if (defaultControls[k]) {
                        defaultControls[k].render = renderCircle;
                    }
                });
            }

            fabricCanvasRef.current = canvas;

            const runSetup = async () => {
                const initialW = 1024, initialH = 1024;

                if (imageUrl) {
                    try {
                        const img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
                        const iw = img.width || 1, ih = img.height || 1;
                        const fitZ = Math.min(w / iw, h / ih) * 0.9; // 移除额外边距计算，让图片尽可能大

                        // 图片模式：精准根据图片尺寸创建背景矩形
                        const bgRect = new fabric.Rect({
                            left: w / 2, top: h / 2, width: iw, height: ih, // 移除 40px Padding
                            originX: 'center', originY: 'center', fill: editorStateRef.current.backgroundColor,
                            selectable: false, evented: false, scaleX: fitZ, scaleY: fitZ,
                            name: 'canvas-background',
                            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 20, offsetX: 0, offsetY: 0 })
                        });

                        canvas!.add(bgRect);
                        canvas!.sendObjectToBack(bgRect);
                        canvasBackgroundRef.current = bgRect;

                        img.set({
                            left: w / 2, top: h / 2, originX: 'center', originY: 'center',
                            selectable: false, evented: false, scaleX: fitZ, scaleY: fitZ
                        });

                        canvas!.add(img);
                        setImageObj(img);
                        setEditorState(prev => ({ ...prev, canvasWidth: iw, canvasHeight: ih, zoom: 1 }));

                        canvas!.clipPath = new fabric.Rect({
                            left: w / 2, top: h / 2, width: iw * fitZ, height: ih * fitZ,
                            originX: 'center', originY: 'center', absolutePositioned: true
                        });
                    } catch (err) {
                        console.error("Failed to load image:", err);
                    }
                } else {
                    // 无图模式：创建默认背景矩形
                    const initialZoom = Math.min(w / initialW, h / initialH) * 0.9;
                    const bgRect = new fabric.Rect({
                        left: w / 2, top: h / 2, width: initialW, height: initialH,
                        originX: 'center', originY: 'center', fill: editorStateRef.current.backgroundColor,
                        selectable: false, evented: false, scaleX: initialZoom, scaleY: initialZoom,
                        name: 'canvas-background',
                        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 20, offsetX: 0, offsetY: 0 })
                    });

                    canvas!.add(bgRect);
                    canvas!.sendObjectToBack(bgRect);
                    canvasBackgroundRef.current = bgRect;

                    setEditorState(prev => ({ ...prev, canvasWidth: initialW, canvasHeight: initialH, zoom: 1 }));
                    canvas!.clipPath = new fabric.Rect({
                        left: w / 2, top: h / 2, width: initialW * initialZoom, height: initialH * initialZoom,
                        originX: 'center', originY: 'center', absolutePositioned: true
                    });
                }

                canvas!.requestRenderAll();
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
                    if (t.controls) Object.keys(t.controls).forEach(k => t.controls[k].render = renderCircle);
                }
                callbackRefs.current.saveHistory();
            });
            canvas.on('object:modified', () => callbackRefs.current.saveHistory());
            canvas.on('selection:created', (o) => { if (o.selected?.length === 1 && ((o.selected[0] as any).parentRect || (o.selected[0] as any).nameLabel)) triggerAnnotationEdit(o.selected[0]); });
            canvas.on('selection:updated', (o) => { if (o.selected?.length === 1 && ((o.selected[0] as any).parentRect || (o.selected[0] as any).nameLabel)) triggerAnnotationEdit(o.selected[0]); });
            canvas.on('object:moving', (o) => {
                const t = o.target as any; if (!t || (!t.nameLabel && !t.textLabel)) return;
                const r = t as fabric.Rect, rl = r.left || 0, rt = r.top || 0, rh = (r.height || 0) * (r.scaleY || 1);
                if (t.nameLabel) t.nameLabel.set({ left: rl, top: rt - 18 });
                if (t.textLabel) t.textLabel.set({ left: rl + 5, top: rt + rh + 5 });
            });
            canvas.on('object:scaling', (o) => {
                const t = o.target as any; if (!t || (!t.nameLabel && !t.textLabel)) return;
                const r = t as fabric.Rect, rl = r.left || 0, rt = r.top || 0, rh = (r.height || 0) * (r.scaleY || 1);
                if (t.nameLabel) t.nameLabel.set({ left: rl, top: rt - 18 });
                if (t.textLabel) t.textLabel.set({ left: rl + 5, top: rt + rh + 5 });
            });
        };

        resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0 && !fabricCanvasRef.current) {
                    init(width, height);
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
    }, [imageUrl, triggerAnnotationEdit]); // 移除 imageObj 等状态依赖，防止初始化死循环

    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0 || !fabricCanvasRef.current) return;
        historyIndexRef.current--;
        fabricCanvasRef.current.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
            const obs = fabricCanvasRef.current?.getObjects() || [];
            canvasBackgroundRef.current = obs.find(o => (o as any).name === 'canvas-background') as fabric.Rect || null;
            fabricCanvasRef.current?.renderAll();
            setEditorState(prev => ({ ...prev, canUndo: historyIndexRef.current > 0, canRedo: true }));
        });
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1 || !fabricCanvasRef.current) return;
        historyIndexRef.current++;
        fabricCanvasRef.current.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
            const obs = fabricCanvasRef.current?.getObjects() || [];
            canvasBackgroundRef.current = obs.find(o => (o as any).name === 'canvas-background') as fabric.Rect || null;
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
        let f;
        if (ft === 'grayscale') f = new fabric.filters.Grayscale();
        else if (ft === 'sepia') f = new fabric.filters.Sepia();
        else if (ft === 'invert') f = new fabric.filters.Invert();
        else if (ft === 'brightness') f = new fabric.filters.Brightness({ brightness: v || 0 });
        else if (ft === 'contrast') f = new fabric.filters.Contrast({ contrast: v || 0 });
        if (f) {
            const fs = imageObj.filters || []; const idx = fs.findIndex(i => i.type === f.type);
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

    const updateBrushColor = (c: EditorColor) => { setEditorState(p => ({ ...p, brushColor: c })); if (fabricCanvasRef.current?.freeDrawingBrush) fabricCanvasRef.current.freeDrawingBrush.color = c; };
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
        const skip = [imageObj, canvasBackgroundRef.current]; const rem = new Set<fabric.Object>();
        aos.forEach(o => {
            if (skip.includes(o as any)) return;
            rem.add(o); if ((o as any).nameLabel) rem.add((o as any).nameLabel); if ((o as any).textLabel) rem.add((o as any).textLabel);
            if ((o as any).parentRect) { const pr = (o as any).parentRect; rem.add(pr); if (pr.nameLabel) rem.add(pr.nameLabel); if (pr.textLabel) rem.add(pr.textLabel); }
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
        if (a.existingLabel) c.remove(a.existingLabel); if ((r as any).nameLabel) c.remove((r as any).nameLabel);
        let n: string; if (!a.existingLabel && !a.existingText) { annotationCountRef.current++; n = `标注${annotationCountRef.current}`; } else n = (r as any).annotationName || `标注${annotationCountRef.current}`;
        (r as any).annotationName = n;
        const nL = new fabric.IText(n, { left: rl, top: rt - 18, fontFamily: 'sans-serif', fontSize: 12, fill: '#ffffff', backgroundColor: col, padding: 2, selectable: false, evented: false });
        c.add(nL); (r as any).nameLabel = nL; (nL as any).parentRect = r;
        let lT = t.trim(); if (rL) lT = lT ? `${lT} (${rL})` : rL;
        if (lT) {
            const l = new fabric.IText(lT, { left: rl + 5, top: rt + rh + 5, fontFamily: 'sans-serif', fontSize: 14, fill: col, backgroundColor: 'rgba(0,0,0,0.7)', padding: 4, selectable: true, evented: true, editable: false });
            (l as any).annotationMeta = { colorName: EDITOR_COLORS.find(c => c.hex === col)?.name || 'Red', text: t.trim(), referenceImageLabel: rL, annotationName: n };
            c.add(l); (r as any).textLabel = l; (l as any).parentRect = r;
        }
        r.set({ selectable: true, evented: true }); c.setActiveObject(r); c.renderAll(); callbackRefs.current.saveHistory();
        const next = EDITOR_COLORS[(EDITOR_COLORS.findIndex(c => c.hex === col) + 1) % EDITOR_COLORS.length].hex;
        setEditorState(p => ({ ...p, pendingAnnotation: null, brushColor: next }));
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
        c.getObjects().forEach(o => { if (o.type === 'i-text' && (o as any).annotationMeta) res.push((o as any).annotationMeta); });
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

    const loadCanvasState = useCallback((json: any) => {
        if (!fabricCanvasRef.current) return;
        fabricCanvasRef.current.loadFromJSON(json).then(() => {
            const obs = fabricCanvasRef.current?.getObjects() || [];
            canvasBackgroundRef.current = obs.find(o => (o as any).name === 'canvas-background') as fabric.Rect || null;
            
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
        });
    }, []);

    return {
        canvasRef, editorState, setTool, addText, addShape, addImage, undo, redo, rotateCanvas, applyFilter, exportImage,
        updateBrushColor, updateBrushWidth, deleteSelected, confirmAnnotation, cancelAnnotation, addReferenceImage,
        removeReferenceImage, getAnnotationsInfo, updateCanvasBackground, updateCanvasSize, fabricCanvasRef,
        getCanvasState, loadCanvasState, setEditorState
    };
};
