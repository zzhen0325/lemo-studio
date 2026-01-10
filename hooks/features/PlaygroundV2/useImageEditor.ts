import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';

export type EditorTool = 'select' | 'brush' | 'text' | 'rect' | 'circle' | 'arrow' | 'eraser' | 'annotate';

export interface AnnotationData {
    rect: fabric.Rect;
    position: { x: number; y: number };
}

export interface EditorState {
    brushColor: string;
    brushWidth: number;
    fontSize: number;
    activeTool: EditorTool;
    canUndo: boolean;
    canRedo: boolean;
    zoom: number;
    pendingAnnotation: AnnotationData | null;
}

export const useImageEditor = (imageUrl: string) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const [imageObj, setImageObj] = useState<fabric.FabricImage | null>(null);

    const [editorState, setEditorState] = useState<EditorState>({
        brushColor: '#40cf8f',
        brushWidth: 5,
        fontSize: 32,
        activeTool: 'select',
        canUndo: false,
        canRedo: false,
        zoom: 1,
        pendingAnnotation: null,
    });

    // 使用 ref 保存 editorState，避免事件回调依赖 state 导致重新创建
    const editorStateRef = useRef(editorState);
    editorStateRef.current = editorState;

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

    const onMouseDown = useCallback((opt: fabric.TPointerEventInfo) => {
        const canvas = fabricCanvasRef.current;
        const state = editorStateRef.current;
        if (!canvas) return;

        // select 工具：开始平移画布
        if (state.activeTool === 'select') {
            const evt = opt.e as MouseEvent;
            // 只在点击空白区域时启用平移（非对象区域）
            if (!canvas.getActiveObject()) {
                isPanningRef.current = true;
                lastPanPointRef.current = { x: evt.clientX, y: evt.clientY };
                canvas.selection = false;
            }
            return;
        }

        if (!['rect', 'circle', 'arrow', 'annotate'].includes(state.activeTool)) return;

        const pointer = canvas.getScenePoint(opt.e);
        isDrawingRef.current = true;
        startPointRef.current = { x: pointer.x, y: pointer.y };

        const common = {
            left: pointer.x,
            top: pointer.y,
            fill: 'transparent',
            stroke: state.brushColor,
            strokeWidth: state.brushWidth,
            selectable: false,
            evented: false,
        };

        if (state.activeTool === 'rect') {
            activeObjectRef.current = new fabric.Rect({
                ...common,
                width: 0,
                height: 0,
            });
        } else if (state.activeTool === 'circle') {
            activeObjectRef.current = new fabric.Circle({
                ...common,
                radius: 0,
            });
        } else if (state.activeTool === 'arrow') {
            activeObjectRef.current = new fabric.Path(`M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y}`, {
                ...common,
                fill: 'transparent',
            });
        } else if (state.activeTool === 'annotate') {
            // 标注工具：红色虚线框
            activeObjectRef.current = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(239, 68, 68, 0.1)',
                stroke: '#ef4444',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
            });
        }

        if (activeObjectRef.current) {
            canvas.add(activeObjectRef.current);
            canvas.renderAll();
        }
    }, []);

    const onMouseMove = useCallback((opt: fabric.TPointerEventInfo) => {
        const canvas = fabricCanvasRef.current;
        const state = editorStateRef.current;
        if (!canvas) return;

        // 处理画布平移
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

        if (state.activeTool === 'rect') {
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
        } else if (state.activeTool === 'annotate') {
            const width = pointer.x - start.x;
            const height = pointer.y - start.y;
            activeObjectRef.current.set({
                width: Math.abs(width),
                height: Math.abs(height),
                left: width > 0 ? start.x : pointer.x,
                top: height > 0 ? start.y : pointer.y,
            });
        }

        canvas.renderAll();
    }, []);

    const onMouseUp = useCallback(() => {
        // 结束画布平移
        if (isPanningRef.current) {
            isPanningRef.current = false;
            lastPanPointRef.current = null;
            const canvas = fabricCanvasRef.current;
            if (canvas) {
                canvas.selection = editorStateRef.current.activeTool === 'select';
            }
            return;
        }

        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        const state = editorStateRef.current;
        const canvas = fabricCanvasRef.current;

        if (activeObjectRef.current && canvas) {
            // 标注工具：设置待确认状态，不立即保存
            if (state.activeTool === 'annotate') {
                const rect = activeObjectRef.current as fabric.Rect;
                // 计算标注框在屏幕上的位置（用于定位输入框）
                const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
                const zoom = canvas.getZoom();
                const rectLeft = rect.left || 0;
                const rectTop = rect.top || 0;
                const rectHeight = (rect.height || 0) * (rect.scaleY || 1);

                const screenX = rectLeft * zoom + vpt[4];
                const screenY = (rectTop + rectHeight) * zoom + vpt[5] + 10; // 在框下方

                setEditorState(prev => ({
                    ...prev,
                    pendingAnnotation: {
                        rect: rect,
                        position: { x: screenX, y: screenY }
                    }
                }));

                activeObjectRef.current = null;
                startPointRef.current = null;
                return;
            }

            activeObjectRef.current.set({
                selectable: true,
                evented: true
            });
            saveHistory();
        }

        activeObjectRef.current = null;
        startPointRef.current = null;
    }, [saveHistory]);

    // 使用 ref 保存事件回调最新引用，避免闭包问题
    const callbackRefs = useRef({
        handleMouseWheel,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        saveHistory,
    });
    callbackRefs.current = {
        handleMouseWheel,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        saveHistory,
    };

    // Initialize Canvas
    useEffect(() => {
        if (!canvasRef.current || !imageUrl) return;

        // 获取外部容器尺寸
        const container = canvasRef.current.parentElement;
        const width = container?.clientWidth || 800;
        const height = container?.clientHeight || 600;

        const canvas = new fabric.Canvas(canvasRef.current, {
            width: width,
            height: height,
            backgroundColor: '#0F0F15',
            enableRetinaScaling: true,
        });
        fabricCanvasRef.current = canvas;

        fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
            const imgWidth = img.width || 1;
            const imgHeight = img.height || 1;

            // 初始缩放比例：适应容器
            const scaleX = width / imgWidth;
            const scaleY = height / imgHeight;
            const initialZoom = Math.min(scaleX, scaleY, 0.9); // 留点边距

            img.set({
                left: width / 2,
                top: height / 2,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                scaleX: initialZoom,
                scaleY: initialZoom,
            });

            canvas.add(img);
            canvas.sendObjectToBack(img);
            setImageObj(img);
            canvas.renderAll();

            setEditorState(prev => ({ ...prev, zoom: 1 })); // 这里的 1 指的是 canvas 当前状态

            callbackRefs.current.saveHistory();
        });

        // 使用包装器函数确保调用最新的回调引用
        canvas.on('mouse:wheel', (opt) => callbackRefs.current.handleMouseWheel(opt));
        canvas.on('mouse:down', (opt) => callbackRefs.current.onMouseDown(opt));
        canvas.on('mouse:move', (opt) => callbackRefs.current.onMouseMove(opt));
        canvas.on('mouse:up', () => callbackRefs.current.onMouseUp());
        canvas.on('path:created', () => callbackRefs.current.saveHistory());
        canvas.on('object:added', () => callbackRefs.current.saveHistory());
        canvas.on('object:modified', () => callbackRefs.current.saveHistory());

        // 处理窗口缩放
        const handleResize = () => {
            if (!container || !fabricCanvasRef.current) return;
            fabricCanvasRef.current.setDimensions({
                width: container.clientWidth,
                height: container.clientHeight
            });
            fabricCanvasRef.current.renderAll();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.dispose();
            fabricCanvasRef.current = null;
        };
        // 注意：这里故意只依赖 imageUrl，避免因回调变化导致画布重建
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageUrl]);

    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0 || !fabricCanvasRef.current) return;
        historyIndexRef.current--;
        const json = historyRef.current[historyIndexRef.current];
        fabricCanvasRef.current.loadFromJSON(json).then(() => {
            fabricCanvasRef.current?.renderAll();
            setEditorState(prev => ({
                ...prev,
                canUndo: historyIndexRef.current > 0,
                canRedo: true,
            }));
        });
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1 || !fabricCanvasRef.current) return;
        historyIndexRef.current++;
        const json = historyRef.current[historyIndexRef.current];
        fabricCanvasRef.current.loadFromJSON(json).then(() => {
            fabricCanvasRef.current?.renderAll();
            setEditorState(prev => ({
                ...prev,
                canUndo: true,
                canRedo: historyIndexRef.current < historyRef.current.length - 1,
            }));
        });
    }, []);

    const setTool = useCallback((tool: EditorTool) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        setEditorState(prev => ({ ...prev, activeTool: tool }));

        canvas.isDrawingMode = tool === 'brush';
        canvas.selection = tool === 'select';

        if (tool === 'brush') {
            const brush = new fabric.PencilBrush(canvas);
            brush.color = editorState.brushColor;
            brush.width = editorState.brushWidth;
            canvas.freeDrawingBrush = brush;
        }

        // 当处于形状绘制模式时，也不允许选中已有对象

        canvas.forEachObject(obj => {
            if (obj.get('selectable') !== false) {
                obj.selectable = tool === 'select';
            }
        });

        canvas.renderAll();
    }, [editorState.brushColor, editorState.brushWidth]);

    const addText = useCallback(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const center = canvas.getVpCenter();
        const text = new fabric.IText('Double click', {
            left: center.x,
            top: center.y,
            fontFamily: 'sans-serif',
            fontSize: editorState.fontSize,
            fill: editorState.brushColor,
            originX: 'center',
            originY: 'center',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        setTool('select');
    }, [editorState.brushColor, editorState.fontSize, setTool]);

    const addShape = useCallback((type: 'rect' | 'circle' | 'arrow') => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        let shape: fabric.Object;
        const center = canvas.getVpCenter();
        const common = {
            left: center.x,
            top: center.y,
            fill: 'transparent',
            stroke: editorState.brushColor,
            strokeWidth: editorState.brushWidth / (canvas.getZoom() || 1),
            originX: 'center',
            originY: 'center',
        } as const;

        if (type === 'rect') {
            shape = new fabric.Rect({ ...common, width: 100, height: 100 });
        } else if (type === 'circle') {
            shape = new fabric.Circle({ ...common, radius: 50 });
        } else {
            shape = new fabric.Path('M 0 0 L 50 0 L 40 -10 M 50 0 L 40 10', {
                ...common,
                stroke: editorState.brushColor,
                strokeWidth: 2,
            });
        }

        canvas.add(shape);
        canvas.setActiveObject(shape);
        setTool('select');
        canvas.renderAll();
    }, [editorState.brushColor, editorState.brushWidth, setTool]);

    const rotateCanvas = useCallback((degrees: number) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            activeObject.set('angle', (activeObject.angle || 0) + degrees);
            canvas.renderAll();
            saveHistory();
        } else {
            const bg = canvas.getObjects()[0];
            if (bg) {
                bg.set('angle', (bg.angle || 0) + degrees);
                canvas.renderAll();
                saveHistory();
            }
        }
    }, [saveHistory]);

    const applyFilter = useCallback((filterType: 'grayscale' | 'sepia' | 'invert' | 'brightness' | 'contrast', value?: number) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const bg = canvas.getObjects()[0] as fabric.FabricImage;
        if (!bg || !(bg instanceof fabric.FabricImage)) return;
        let filter;
        switch (filterType) {
            case 'grayscale': filter = new fabric.filters.Grayscale(); break;
            case 'sepia': filter = new fabric.filters.Sepia(); break;
            case 'invert': filter = new fabric.filters.Invert(); break;
            case 'brightness': filter = new fabric.filters.Brightness({ brightness: value || 0 }); break;
            case 'contrast': filter = new fabric.filters.Contrast({ contrast: value || 0 }); break;
        }
        if (filter) {
            const filters = bg.filters || [];
            const existingIdx = filters.findIndex(f => f.type === filter.type);
            if (existingIdx > -1) filters[existingIdx] = filter;
            else filters.push(filter);
            bg.applyFilters();
            canvas.renderAll();
            saveHistory();
        }
    }, [saveHistory]);

    const exportImage = useCallback((): string | null => {
        if (!fabricCanvasRef.current || !imageObj) return null;

        // 为了高质量导出，我们需要创建一个临时 canvas 以原图尺寸导出
        const canvas = fabricCanvasRef.current;
        const originalZoom = canvas.getZoom();
        const originalVP = canvas.viewportTransform?.slice();

        // 临时恢复到 1:1 且居中
        canvas.setZoom(1);
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

        const dataUrl = canvas.toDataURL({
            multiplier: 1 / (imageObj.scaleX || 1), // 还原比例
            format: 'png',
        });

        // 恢复状态
        canvas.setZoom(originalZoom);
        if (originalVP) canvas.viewportTransform = originalVP as fabric.TMat2D;

        return dataUrl;
    }, [imageObj]);

    const updateBrushColor = (color: string) => {
        setEditorState(prev => ({ ...prev, brushColor: color }));
        if (fabricCanvasRef.current?.freeDrawingBrush) {
            fabricCanvasRef.current.freeDrawingBrush.color = color;
        }
    };

    const updateBrushWidth = (width: number) => {
        setEditorState(prev => ({ ...prev, brushWidth: width }));
        if (fabricCanvasRef.current?.freeDrawingBrush) {
            fabricCanvasRef.current.freeDrawingBrush.width = width;
        }
    };

    // 删除选中的对象
    const deleteSelected = useCallback(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) return;

        // 不删除背景图片（第一个添加的对象）
        const bgImage = canvas.getObjects()[0];
        activeObjects.forEach(obj => {
            if (obj !== bgImage) {
                canvas.remove(obj);
            }
        });

        canvas.discardActiveObject();
        canvas.renderAll();
        saveHistory();
    }, [saveHistory]);

    // 添加图片到画布
    const addImage = useCallback((imageUrl: string) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
            const center = canvas.getVpCenter();

            // 限制图片最大尺寸，避免太大
            const maxSize = 300;
            const scale = Math.min(maxSize / (img.width || 1), maxSize / (img.height || 1), 1);

            img.set({
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center',
                scaleX: scale,
                scaleY: scale,
                selectable: true,
                evented: true,
            });

            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
            saveHistory();
            setTool('select');
        });
    }, [saveHistory, setTool]);

    // 确认标注：添加文本标签
    const confirmAnnotation = useCallback((text: string) => {
        const canvas = fabricCanvasRef.current;
        const annotation = editorState.pendingAnnotation;
        if (!canvas || !annotation) return;

        const rect = annotation.rect;
        const rectLeft = rect.left || 0;
        const rectTop = rect.top || 0;
        const rectHeight = (rect.height || 0) * (rect.scaleY || 1);

        // 在框内添加文本
        if (text.trim()) {
            const label = new fabric.IText(text, {
                left: rectLeft + 5,
                top: rectTop + rectHeight + 5,
                fontFamily: 'sans-serif',
                fontSize: 14,
                fill: '#ef4444',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: 4,
                selectable: true,
                evented: true,
            });
            canvas.add(label);
        }

        // 让矩形框可选
        rect.set({
            selectable: true,
            evented: true,
        });

        canvas.renderAll();
        saveHistory();

        // 清除待确认状态
        setEditorState(prev => ({
            ...prev,
            pendingAnnotation: null,
        }));
    }, [editorState.pendingAnnotation, saveHistory]);

    // 取消标注
    const cancelAnnotation = useCallback(() => {
        const canvas = fabricCanvasRef.current;
        const annotation = editorState.pendingAnnotation;
        if (!canvas || !annotation) return;

        canvas.remove(annotation.rect);
        canvas.renderAll();

        setEditorState(prev => ({
            ...prev,
            pendingAnnotation: null,
        }));
    }, [editorState.pendingAnnotation]);

    return {
        canvasRef,
        editorState,
        setTool,
        addText,
        addShape,
        addImage,
        undo,
        redo,
        rotateCanvas,
        applyFilter,
        exportImage,
        updateBrushColor,
        updateBrushWidth,
        deleteSelected,
        confirmAnnotation,
        cancelAnnotation,
        fabricCanvasRef,
    };
};
