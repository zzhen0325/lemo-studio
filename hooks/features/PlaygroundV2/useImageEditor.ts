import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';

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

// 标注信息 - 用于生成 prompt
export interface AnnotationInfo {
    colorName: string;
    text: string;
    referenceImageLabel?: string; // 关联的参考图标签
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
}

export const useImageEditor = (imageUrl: string) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const [imageObj, setImageObj] = useState<fabric.FabricImage | null>(null);

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
    });

    // 使用 ref 保存 editorState，避免事件回调依赖 state 导致重新创建
    const editorStateRef = useRef(editorState);
    editorStateRef.current = editorState;

    // 标注计数器，用于生成“标注一、标注二”等名称
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
        // select 和 annotate 工具都允许选择对象
        canvas.selection = tool === 'select' || tool === 'annotate';

        if (tool === 'brush') {
            const brush = new fabric.PencilBrush(canvas);
            brush.color = editorStateRef.current.brushColor;
            brush.width = editorStateRef.current.brushWidth;
            canvas.freeDrawingBrush = brush;
        }

        // 设置对象可选性：select 和 annotate 工具都允许选中标注对象
        const allowSelect = tool === 'select' || tool === 'annotate';
        const bgImage = canvas.getObjects()[0]; // 背景图

        canvas.forEachObject(obj => {
            // 排除背景图
            if (obj === bgImage) return;

            // 检查是否是名称标签本身（通过检查特征：不可选、有背景色、没有 annotationMeta）
            const isNameLabel = obj instanceof fabric.IText &&
                obj.selectable === false &&
                obj.backgroundColor !== undefined &&
                !(obj as fabric.IText & { annotationMeta?: unknown }).annotationMeta;

            if (isNameLabel) return; // 名称标签始终不可选

            // 对于其他对象（包括标注框、形状、文字、标注文本），根据工具类型设置可选性
            obj.selectable = allowSelect;
            obj.evented = allowSelect;
        });

        canvas.renderAll();
    }, []);

    // 触发标注编辑模式
    const triggerAnnotationEdit = useCallback((target: any) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // 识别标注矩形框或标注文本
        const rect = (target.parentRect || (target.nameLabel ? target : null)) as fabric.Rect;
        if (!rect) return;

        const textLabel = (rect as any).textLabel as fabric.IText & { annotationMeta?: AnnotationInfo };
        if (!textLabel) return;

        // 计算边界
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

        const pointer = canvas.getScenePoint(opt.e);

        // 限制在图片范围内开始绘制
        if (imageObj) {
            const scaleX = imageObj.scaleX || 1;
            const scaleY = imageObj.scaleY || 1;
            const w = (imageObj.width || 0) * scaleX;
            const h = (imageObj.height || 0) * scaleY;
            const rectLeft = (imageObj.left || 0) - w / 2;
            const rectTop = (imageObj.top || 0) - h / 2;

            const isInBounds = (
                pointer.x >= rectLeft &&
                pointer.x <= rectLeft + w &&
                pointer.y >= rectTop &&
                pointer.y <= rectTop + h
            );

            if (!isInBounds) {
                // 如果是画笔模式，暂时关闭以便不产生笔触点
                if (state.activeTool === 'brush') {
                    canvas.isDrawingMode = false;
                    setTimeout(() => {
                        if (editorStateRef.current.activeTool === 'brush') {
                            canvas.isDrawingMode = true;
                        }
                    }, 50);
                }
                return;
            }
        }

        if (!['rect', 'circle', 'arrow', 'annotate'].includes(state.activeTool)) return;

        // 如果点击到了现有对象（包括其控制锚点），则不进行新图形的绘制
        if (opt.target && opt.target !== imageObj) {
            return;
        }

        // === 标注工具：先检查是否点击了已有的标注 ===
        if (state.activeTool === 'annotate') {
            // 查找点击位置的对象
            const clickedObjects = canvas.getObjects().filter(obj => {
                if (obj === imageObj) return false; // 排除背景图
                const objBounds = obj.getBoundingRect();
                return (
                    pointer.x >= objBounds.left &&
                    pointer.x <= objBounds.left + objBounds.width &&
                    pointer.y >= objBounds.top &&
                    pointer.y <= objBounds.top + objBounds.height
                );
            });

            // 查找标注文本（带 annotationMeta 的 IText）
            const annotationLabel = clickedObjects.find(obj =>
                obj instanceof fabric.IText &&
                (obj as fabric.IText & { annotationMeta?: unknown }).annotationMeta
            ) as (fabric.IText & { annotationMeta?: { colorName: string; text: string; referenceImageLabel?: string } }) | undefined;

            // 或者查找虚线标注框
            const annotationRect = clickedObjects.find(obj =>
                obj instanceof fabric.Rect &&
                obj.strokeDashArray &&
                obj.strokeDashArray.length > 0
            ) as fabric.Rect | undefined;

            // 查找名称标签
            const nameLabel = clickedObjects.find(obj =>
                obj instanceof fabric.IText &&
                !(obj as fabric.IText & { annotationMeta?: unknown }).annotationMeta &&
                obj.selectable === false
            ) as fabric.IText | undefined;

            if (annotationLabel || annotationRect || nameLabel) {
                // 选中标注对象，而不是立即进入编辑模式
                // 用户可以移动/调整大小，双击文字可编辑
                const targetObject = annotationRect || annotationLabel;
                if (targetObject) {
                    canvas.setActiveObject(targetObject);
                    canvas.renderAll();
                }
                return; // 不创建新标注
            }
        }

        isDrawingRef.current = true;
        startPointRef.current = { x: pointer.x, y: pointer.y };

        const common = {
            left: pointer.x,
            top: pointer.y,
            fill: 'rgba(255, 255, 255, 0.00001)', // 近乎透明但可点击
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
            // 标注工具：使用与形状工具相同的实现方式，仅增加虚线描边
            activeObjectRef.current = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'transparent',
                stroke: state.brushColor,
                strokeWidth: state.brushWidth,
                strokeDashArray: [8, 4],
                selectable: false,
                evented: false,
            });
        }

        if (activeObjectRef.current) {
            canvas.add(activeObjectRef.current);
            canvas.renderAll();
        }
    }, [imageObj]);

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
                const rectWidth = (rect.width || 0) * (rect.scaleX || 1);
                const rectHeight = (rect.height || 0) * (rect.scaleY || 1);

                // 最小尺寸检查：太小的框视为单击，不创建标注
                const MIN_SIZE = 10;
                if (rectWidth < MIN_SIZE || rectHeight < MIN_SIZE) {
                    canvas.remove(rect);
                    canvas.renderAll();
                    activeObjectRef.current = null;
                    startPointRef.current = null;
                    return;
                }

                // 计算标注框在屏幕上的位置（用于定位输入框）
                const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
                const zoom = canvas.getZoom();
                const rectLeft = rect.left || 0;
                const rectTop = rect.top || 0;

                const screenLeft = rectLeft * zoom + vpt[4];
                const screenTop = rectTop * zoom + vpt[5];
                const screenWidth = rectWidth * zoom;
                const screenHeight = rectHeight * zoom;

                setEditorState(prev => ({
                    ...prev,
                    pendingAnnotation: {
                        rect: rect,
                        color: prev.brushColor,
                        bounds: {
                            left: screenLeft,
                            top: screenTop,
                            right: screenLeft + screenWidth,
                            bottom: screenTop + screenHeight,
                            width: screenWidth,
                            height: screenHeight
                        }
                    }
                }));

                // activeObjectRef.current = null; // 移除此行，因为标注框需要保留在画布上等待确认
                startPointRef.current = null;
                return;
            }

            activeObjectRef.current.set({
                selectable: true,
                evented: true
            });
            canvas.setActiveObject(activeObjectRef.current);
            saveHistory();
            // 使用 setTimeout 避免在事件回调中直接切换工具导致的状态同步问题
            setTimeout(() => {
                const currentState = editorStateRef.current;
                if (currentState.activeTool !== 'select') {
                    setTool('select');
                }
            }, 0);
        }

        activeObjectRef.current = null;
        startPointRef.current = null;
    }, [saveHistory, setTool]);

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

        // 全局自定义控制点样式，增加清晰度
        fabric.Object.prototype.transparentCorners = false;
        fabric.Object.prototype.cornerColor = '#ff0000';
        fabric.Object.prototype.cornerStrokeColor = '#ffffff';
        fabric.Object.prototype.cornerSize = 4;
        fabric.Object.prototype.cornerStyle = 'circle';
        fabric.Object.prototype.borderColor = '#ffffff';
        fabric.Object.prototype.borderScaleFactor = 2; // 边框粗细为2
        fabric.Object.prototype.borderDashArray = []; // 实线边框

        // 自定义控制点渲染函数：实现圆形控制点，带白色外描边
        const renderModernCircleCorner = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object) => {
            const size = fabricObject.cornerSize || 12;
            const radius = size / 2;

            ctx.save();

            // 绘制主色圆形 (#1079BB)
            ctx.beginPath();
            ctx.arc(left, top, radius, 0, Math.PI * 2, false);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // 绘制白色外描边 (1px)
            // ctx.stroke() 会在路径两侧绘制，这里设为 1px 的 lineWidth 会有 0.5px 在圆内，0.5px 在圆外
            // 为了视觉上更接近 1px 且更清晰，我们使用 1px 的宽度并在填充后绘制
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        };

        // 应用自定义渲染到所有标注和标准控制点
        const controls = fabric.Object.prototype.controls;
        if (controls) {
            // 包含所有标准控制点和旋转点
            Object.keys(controls).forEach(key => {
                controls[key].render = renderModernCircleCorner;
            });
        }

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

            // 设置全画布剪裁路径，限制绘图在这个范围内
            const clipRect = new fabric.Rect({
                left: width / 2,
                top: height / 2,
                width: imgWidth * initialZoom,
                height: imgHeight * initialZoom,
                originX: 'center',
                originY: 'center',
                absolutePositioned: true,
            });
            canvas.clipPath = clipRect;

            canvas.renderAll();

            setEditorState(prev => ({ ...prev, zoom: 1 })); // 这里的 1 指的是 canvas 当前状态

            callbackRefs.current.saveHistory();
        });

        // 使用包装器函数确保调用最新的回调引用
        // 边界框描边和角点大小
        canvas.on('mouse:wheel', (opt) => callbackRefs.current.handleMouseWheel(opt));
        canvas.on('mouse:down', (opt) => callbackRefs.current.onMouseDown(opt));
        canvas.on('mouse:move', (opt) => callbackRefs.current.onMouseMove(opt));
        canvas.on('mouse:up', () => callbackRefs.current.onMouseUp());
        canvas.on('path:created', () => callbackRefs.current.saveHistory());
        canvas.on('object:added', (opt) => {
            const obj = opt.target;
            if (obj && obj !== imageObj) {
                obj.set({
                    borderColor: '#ffffff',
                    borderScaleFactor: 2,
                    cornerColor: '#1079BB',
                    cornerStrokeColor: '#ffffff',
                    transparentCorners: false,
                    cornerSize: 8,
                    cornerStyle: 'circle'
                });

                // 确保自定义渲染也被应用（以防 prototype 没生效）
                if (obj.controls) {
                    Object.keys(obj.controls).forEach(key => {
                        obj.controls[key].render = renderModernCircleCorner;
                    });
                }
            }
            callbackRefs.current.saveHistory();
        });
        canvas.on('object:modified', () => callbackRefs.current.saveHistory());

        // 选中标注触发编辑
        canvas.on('selection:created', (opt) => {
            const state = editorStateRef.current;
            if ((state.activeTool === 'select' || state.activeTool === 'annotate') && opt.selected?.length === 1) {
                const target = opt.selected[0];
                if ((target as any).parentRect || (target as any).nameLabel) {
                    triggerAnnotationEdit(target);
                }
            }
        });

        canvas.on('selection:updated', (opt) => {
            const state = editorStateRef.current;
            if ((state.activeTool === 'select' || state.activeTool === 'annotate') && opt.selected?.length === 1) {
                const target = opt.selected[0];
                if ((target as any).parentRect || (target as any).nameLabel) {
                    triggerAnnotationEdit(target);
                }
            }
        });

        // 联动移动处理
        canvas.on('object:moving', (opt) => {
            const obj = opt.target as any;
            if (!obj) return;

            // 如果是标注框移动，联动其标签
            if (obj.nameLabel || obj.textLabel) {
                const rect = obj as fabric.Rect;
                const rectLeft = rect.left || 0;
                const rectTop = rect.top || 0;
                const rectHeight = (rect.height || 0) * (rect.scaleY || 1);

                if (obj.nameLabel) {
                    obj.nameLabel.set({
                        left: rectLeft,
                        top: rectTop - 18
                    });
                }
                if (obj.textLabel) {
                    obj.textLabel.set({
                        left: rectLeft + 5,
                        top: rectTop + rectHeight + 5
                    });
                }
            }

            // 如果是文本标签移动，更新其相对于父框的关系（可选，暂时只做单向联动）
        });

        // 联动缩放处理
        canvas.on('object:scaling', (opt) => {
            const obj = opt.target as any;
            if (obj && (obj.nameLabel || obj.textLabel)) {
                const rect = obj as fabric.Rect;
                const rectLeft = rect.left || 0;
                const rectTop = rect.top || 0;
                const rectHeight = (rect.height || 0) * (rect.scaleY || 1);

                if (obj.nameLabel) {
                    obj.nameLabel.set({
                        left: rectLeft,
                        top: rectTop - 18
                    });
                }
                if (obj.textLabel) {
                    obj.textLabel.set({
                        left: rectLeft + 5,
                        top: rectTop + rectHeight + 5
                    });
                }
            }
        });

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



    const addText = useCallback(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !imageObj) return;
        const center = { x: imageObj.left, y: imageObj.top };
        const text = new fabric.IText('Double click', {
            left: center.x,
            top: center.y,
            fontFamily: 'sans-serif',
            fontSize: editorState.fontSize,
            fill: editorState.brushColor,
            originX: 'center',
            originY: 'center',
            editable: false,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        setTool('select');
    }, [editorState.brushColor, editorState.fontSize, setTool, imageObj]);

    const addShape = useCallback((type: 'rect' | 'circle' | 'arrow') => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !imageObj) return;
        let shape: fabric.Object;
        const center = { x: imageObj.left, y: imageObj.top };
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
                strokeWidth: 1,
            });
        }

        canvas.add(shape);
        canvas.setActiveObject(shape);
        setTool('select');
        canvas.renderAll();
    }, [editorState.brushColor, editorState.brushWidth, setTool, imageObj]);

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

        const canvas = fabricCanvasRef.current;
        const originalZoom = canvas.getZoom();
        const originalVP = canvas.viewportTransform ? [...canvas.viewportTransform] : null;

        // 临时恢复 1:1 用于计算精确位置
        canvas.setZoom(1);
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

        // 计算图片在 zoom=1 情况下的实际像素位置
        const scale = imageObj.scaleX || 1;
        const w = imageObj.width * scale;
        const h = imageObj.height * scale;
        const l = imageObj.left - w / 2;
        const t = imageObj.top - h / 2;

        const dataUrl = canvas.toDataURL({
            format: 'png',
            left: l,
            top: t,
            width: w,
            height: h,
            multiplier: 1 / scale,
        });

        // 恢复状态
        canvas.setZoom(originalZoom);
        if (originalVP) canvas.viewportTransform = originalVP as fabric.TMat2D;

        return dataUrl;
    }, [imageObj]);

    const updateBrushColor = (color: EditorColor) => {
        setEditorState(prev => ({ ...prev, brushColor: color }));
        if (fabricCanvasRef.current?.freeDrawingBrush) {
            fabricCanvasRef.current.freeDrawingBrush.color = color;
        }
    };

    const updateBrushWidth = (width: number) => {
        setEditorState(prev => ({ ...prev, brushWidth: width }));

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // 更新自由画笔宽度
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = width;
        }

        // 同步修改选中对象的状态
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
            activeObjects.forEach(obj => {
                // 如果对象支持描边且不是背景图
                if (obj.stroke !== undefined && obj !== canvas.getObjects()[0]) {
                    obj.set('strokeWidth', width);
                }
            });
            canvas.renderAll();
            saveHistory();
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

        // 收集所有需要删除的对象（包括联动对象）
        const objectsToRemove = new Set<fabric.Object>();

        activeObjects.forEach(obj => {
            if (obj === bgImage) return;

            objectsToRemove.add(obj);

            // 处理标注组联动
            const objWithRefs = obj as any;

            // 如果选中了主矩形框，添加其关联的标签
            if (objWithRefs.nameLabel) objectsToRemove.add(objWithRefs.nameLabel);
            if (objWithRefs.textLabel) objectsToRemove.add(objWithRefs.textLabel);

            // 如果选中了标签，添加其主矩形框及其它标签
            if (objWithRefs.parentRect) {
                const rect = objWithRefs.parentRect;
                objectsToRemove.add(rect);
                if (rect.nameLabel) objectsToRemove.add(rect.nameLabel);
                if (rect.textLabel) objectsToRemove.add(rect.textLabel);
            }
        });

        objectsToRemove.forEach(obj => {
            canvas.remove(obj);
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

    // 确认标注：添加或更新文本标签
    const confirmAnnotation = useCallback((text: string, referenceImageLabel?: string) => {
        const canvas = fabricCanvasRef.current;
        const annotation = editorState.pendingAnnotation;
        if (!canvas || !annotation) return;

        const rect = annotation.rect;
        const rectLeft = rect.left || 0;
        const rectTop = rect.top || 0;
        const rectHeight = (rect.height || 0) * (rect.scaleY || 1);
        const annotationColor = annotation.color;

        // 获取颜色名称
        const colorInfo = EDITOR_COLORS.find(c => c.hex === annotationColor);
        const colorName = colorInfo?.name || 'Red';

        // 如果是编辑模式，删除旧的标注文本和名称标签
        if (annotation.existingLabel) {
            canvas.remove(annotation.existingLabel);
        }
        // 删除旧的名称标签（如果有）
        if ((rect as fabric.Rect & { nameLabel?: fabric.IText }).nameLabel) {
            canvas.remove((rect as fabric.Rect & { nameLabel?: fabric.IText }).nameLabel!);
        }

        // 生成标注名称（新建模式时增加计数器）
        let annotationName: string;
        if (!annotation.existingLabel && !annotation.existingText) {
            annotationCountRef.current++;
            annotationName = `标注${annotationCountRef.current}`;
        } else {
            // 编辑模式保留原有名称
            annotationName = (rect as fabric.Rect & { annotationName?: string }).annotationName || `标注${annotationCountRef.current}`;
        }
        // 存储名称到 rect 上
        (rect as fabric.Rect & { annotationName?: string }).annotationName = annotationName;

        // 在矩形框左上角添加名称标签
        const nameLabel = new fabric.IText(annotationName, {
            left: rectLeft,
            top: rectTop - 18,
            fontFamily: 'sans-serif',
            fontSize: 12,
            fill: '#ffffff',
            backgroundColor: annotationColor,
            padding: 2,
            selectable: false,
            evented: false,
        });
        canvas.add(nameLabel);
        // 关联名称标签到 rect
        (rect as fabric.Rect & { nameLabel?: fabric.IText }).nameLabel = nameLabel;

        // 构建标注文本：包含颜色信息和可选的参考图引用
        let labelText = text.trim();
        if (referenceImageLabel) {
            labelText = labelText ? `${labelText} (${referenceImageLabel})` : referenceImageLabel;
        }

        // 在框下方添加文本标签
        if (labelText) {
            const label = new fabric.IText(labelText, {
                left: rectLeft + 5,
                top: rectTop + rectHeight + 5,
                fontFamily: 'sans-serif',
                fontSize: 14,
                fill: annotationColor,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: 4,
                selectable: true,
                evented: true,
                editable: false,
            });
            // 存储标注元数据用于导出
            (label as fabric.IText & { annotationMeta?: { colorName: string; text: string; referenceImageLabel?: string; annotationName?: string } }).annotationMeta = {
                colorName,
                text: text.trim(),
                referenceImageLabel,
                annotationName,
            };
            canvas.add(label);
        }

        // 让矩形框可选
        rect.set({
            selectable: true,
            evented: true,
        });

        // 建立双向引用，以便联动移动
        // 使用 type-safe 的方式扩展属性（虽然 Fabric v6 属性扩展稍显复杂，这里先用 type cast 解决）
        const rectObj = rect as fabric.Rect & { nameLabel?: fabric.Object; textLabel?: fabric.Object };
        rectObj.nameLabel = nameLabel;
        (nameLabel as any).parentRect = rect;

        const labels = canvas.getObjects();
        const lastLabel = labels[labels.length - 1];
        if (labelText && lastLabel && lastLabel !== rect && lastLabel !== nameLabel) {
            rectObj.textLabel = lastLabel;
            (lastLabel as any).parentRect = rect;
        }

        canvas.setActiveObject(rect);
        canvas.renderAll();
        callbackRefs.current.saveHistory();

        // 确保在确认或取消标注后，如果工具还是 annotate，依然能看到剪裁效果
        canvas.renderAll();

        // 清除待确认状态，并自动轮换到下一个颜色
        const currentColorIndex = EDITOR_COLORS.findIndex(c => c.hex === annotationColor);
        const nextColorIndex = (currentColorIndex + 1) % EDITOR_COLORS.length;
        const nextColor = EDITOR_COLORS[nextColorIndex].hex;

        setEditorState(prev => ({
            ...prev,
            pendingAnnotation: null,
            brushColor: nextColor,
        }));
    }, [editorState.pendingAnnotation]);

    // 取消标注（新建模式删除矩形框，编辑模式保留）
    const cancelAnnotation = useCallback(() => {
        const canvas = fabricCanvasRef.current;
        const annotation = editorState.pendingAnnotation;
        if (!canvas || !annotation) return;

        // 只有新建模式（没有 existingLabel）才删除矩形框
        if (!annotation.existingLabel && !annotation.existingText) {
            canvas.remove(annotation.rect);
        }
        canvas.renderAll();

        setEditorState(prev => ({
            ...prev,
            pendingAnnotation: null,
        }));
    }, [editorState.pendingAnnotation]);

    // 添加参考图
    const addReferenceImage = useCallback((dataUrl: string) => {
        setEditorState(prev => {
            const newIndex = prev.referenceImages.length + 1;
            const newRef: ReferenceImage = {
                id: `ref-${Date.now()}-${newIndex}`,
                dataUrl,
                label: `Image ${newIndex}`,
            };
            return {
                ...prev,
                referenceImages: [...prev.referenceImages, newRef],
            };
        });
    }, []);

    // 删除参考图
    const removeReferenceImage = useCallback((id: string) => {
        setEditorState(prev => {
            const filtered = prev.referenceImages.filter(img => img.id !== id);
            // 重新编号
            const renumbered = filtered.map((img, idx) => ({
                ...img,
                label: `Image ${idx + 1}`,
            }));
            return {
                ...prev,
                referenceImages: renumbered,
            };
        });
    }, []);

    // 获取所有标注信息（用于生成 prompt）
    const getAnnotationsInfo = useCallback((): AnnotationInfo[] => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return [];

        const annotations: AnnotationInfo[] = [];
        canvas.getObjects().forEach(obj => {
            if (obj.type === 'i-text') {
                const textObj = obj as fabric.IText & { annotationMeta?: { colorName: string; text: string; referenceImageLabel?: string } };
                if (textObj.annotationMeta) {
                    annotations.push(textObj.annotationMeta);
                }
            }
        });
        return annotations;
    }, []);

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
        addReferenceImage,
        removeReferenceImage,
        getAnnotationsInfo,
        fabricCanvasRef,
    };
};
