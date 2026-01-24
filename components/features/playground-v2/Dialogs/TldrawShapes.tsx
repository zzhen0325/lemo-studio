import React from 'react';
import {
    BaseBoxShapeUtil,
    HTMLContainer,
    TLShapeId,
    JsonObject,
    StateNode,
    createShapeId,
} from 'tldraw';
import { Loader2 } from 'lucide-react';

// --- Result View Components ---

const SweepLoading = () => (
    <div className="relative w-full h-full min-h-[400px] bg-gray-50 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-gray-200">
        <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-sweep" />
        </div>
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-4" />
        <span className="text-sm font-medium text-gray-500">正在生成，请稍候...</span>
        {/* @ts-expect-error - style jsx is not recognized by TS in this context */}
        <style jsx>{`
            @keyframes sweep {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            .animate-sweep {
                animation: sweep 2s infinite linear;
            }
        `}</style>
    </div>
);

// --- Annotation Shape Definition ---

export interface AnnotationShape {
    id: TLShapeId
    type: string
    typeName: 'shape'
    x: number
    y: number
    rotation: number
    index: string
    parentId: TLShapeId
    isLocked: boolean
    opacity: number
    meta: JsonObject
    props: {
        name: string
        content: string
        w: number
        h: number
    }
}

// @ts-expect-error - Custom shapes may not be in the default TLShape union
export class AnnotationShapeUtil extends BaseBoxShapeUtil<AnnotationShape> {
    static override type = 'annotation' as const;

    override canBind = () => false;
    override canResize = () => true;

    override getDefaultProps() {
        return {
            name: '',
            content: '',
            w: 100,
            h: 100,
        };
    }

    override component(shape: AnnotationShape) {
        return (
            <HTMLContainer
                id={shape.id}
                style={{
                    border: '2px solid #ff0000',
                    pointerEvents: 'none' as const,
                    width: shape.props.w,
                    height: shape.props.h,
                    position: 'relative',
                    boxSizing: 'border-box'
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: -24,
                        left: -2,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px 4px 0 0',
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold',
                        pointerEvents: 'none' as const,
                        zIndex: 10,
                    }}
                >
                    {shape.props.name}
                </div>
            </HTMLContainer>
        );
    }

    override indicator(shape: AnnotationShape) {
        return <rect width={shape.props.w} height={shape.props.h} fill="none" stroke="#ff0000" strokeWidth={2} />;
    }
}

// --- Annotation Tool Definition ---

export class AnnotationTool extends StateNode {
    static override id = 'annotation';

    private createdShapeId: TLShapeId | null = null;
    private initialPoint: { x: number, y: number } | null = null;

    override onEnter() {
        this.editor.setCursor({ type: 'cross', rotation: 0 });
    }

    override onPointerDown() {
        const { currentPagePoint } = this.editor.inputs;
        this.initialPoint = currentPagePoint;
        this.createdShapeId = createShapeId();

        // 查找光标下的图片作为父级
        const hitShape = this.editor.getShapeAtPoint(currentPagePoint);
        const imageShape = hitShape && hitShape.type === 'image' ? hitShape : this.editor.getCurrentPageShapes().find(s => s.type === 'image');

        // 计算当前名称
        const annotations = this.editor.getCurrentPageShapes().filter(s => s.type === 'annotation');
        const nextIndex = annotations.length + 1;

        let x = currentPagePoint.x;
        let y = currentPagePoint.y;
        let parentId: TLShapeId | undefined;

        if (imageShape) {
            const pointInShape = this.editor.getPointInShapeSpace(imageShape, currentPagePoint);
            x = pointInShape.x;
            y = pointInShape.y;
            parentId = imageShape.id;
        }

        this.editor.createShape({
            id: this.createdShapeId,
            type: 'annotation',
            x,
            y,
            parentId,
            props: { w: 1, h: 1, name: `标注${nextIndex}`, content: '' },
        });
    }

    override onPointerMove() {
        if (!this.createdShapeId || !this.initialPoint) return;

        const { currentPagePoint } = this.editor.inputs;
        const currentPoint = currentPagePoint;
        const shape = this.editor.getShape(this.createdShapeId);

        const offset = {
            x: currentPoint.x - this.initialPoint.x,
            y: currentPoint.y - this.initialPoint.y,
        };

        const w = Math.abs(offset.x);
        const h = Math.abs(offset.y);

        // 无论是否有父级，宽高都是绝对差值
        // 但起始点需要处理：如果是父级坐标系，起点固定为初始计算出的局部坐标
        // 更加稳健的方式是：重新计算当前两个点在目标父级空间内的坐标包围盒

        let newX = 0;
        let newY = 0;

        if (shape?.parentId) {
            const parent = this.editor.getShape(shape.parentId);
            if (parent) {
                const startInInfo = this.editor.getPointInShapeSpace(parent, this.initialPoint);
                const endInInfo = this.editor.getPointInShapeSpace(parent, currentPoint);
                newX = Math.min(startInInfo.x, endInInfo.x);
                newY = Math.min(startInInfo.y, endInInfo.y);
            }
        } else {
            newX = Math.min(this.initialPoint.x, currentPoint.x);
            newY = Math.min(this.initialPoint.y, currentPoint.y);
        }

        this.editor.updateShape({
            id: this.createdShapeId,
            type: 'annotation',
            x: newX,
            y: newY,
            props: { w: Math.max(1, w), h: Math.max(1, h) },
        } as any);
    }

    override onPointerUp() {
        if (this.createdShapeId && this.initialPoint) {
            const { currentPagePoint } = this.editor.inputs;
            const dist = Math.hypot(currentPagePoint.x - this.initialPoint.x, currentPagePoint.y - this.initialPoint.y);
            // 如果拖拽距离过小，判定为点击，创建一个默认大小的框
            if (dist < 5) {
                this.editor.updateShape({
                    id: this.createdShapeId,
                    type: 'annotation',
                    props: { w: 200, h: 200 }
                } as any);
            }
        }
        this.createdShapeId = null;
        this.initialPoint = null;
        this.editor.setCurrentTool('select');
    }

    override onExit() {
        // 重编号逻辑
        const annotations = Array.from(this.editor.getCurrentPageShapeIds())
            .map(sid => this.editor.getShape(sid))
            .filter(s => s && (s.type as string) === 'annotation')
            .sort((a, b) => (a!.index > b!.index ? 1 : -1));

        annotations.forEach((ann, i) => {
            if (ann && (ann.props as { name?: string }).name !== `标注${i + 1}`) {
                this.editor.updateShape({
                    id: ann.id as TLShapeId,
                    type: 'annotation',
                    props: { name: `标注${i + 1}` }
                } as any);
            }
        });
    }
}

// --- Result Shape Definition ---

export interface ResultShape {
    id: TLShapeId
    type: string
    typeName: 'shape'
    x: number
    y: number
    rotation: number
    index: string
    parentId: TLShapeId
    isLocked: boolean
    opacity: number
    meta: JsonObject
    props: {
        url: string
        isLoading: boolean
        version: number
        w: number
        h: number
    }
}

// @ts-expect-error - Custom shapes may not be in the default TLShape union
export class ResultShapeUtil extends BaseBoxShapeUtil<ResultShape> {
    static override type = 'result' as const;

    override canBind = () => false;
    override canResize = () => true;

    override getDefaultProps() {
        return {
            url: '',
            isLoading: true,
            version: 1,
            w: 400,
            h: 400,
        };
    }

    override component(shape: ResultShape) {
        if (shape.props.isLoading) {
            return (
                <HTMLContainer
                    id={shape.id}
                    style={{
                        width: shape.props.w,
                        height: shape.props.h,
                        pointerEvents: 'all' as const,
                    }}
                >
                    <SweepLoading />
                </HTMLContainer>
            );
        }

        return (
            <HTMLContainer
                id={shape.id}
                style={{
                    width: shape.props.w,
                    height: shape.props.h,
                    pointerEvents: 'all' as const,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb',
                    backgroundColor: 'white',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                }}
            >
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={shape.props.url}
                        alt={`Result ${shape.props.version}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '16px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        Version {shape.props.version}
                    </div>
                </div>
            </HTMLContainer>
        );
    }

    override indicator(shape: ResultShape) {
        return <rect width={shape.props.w} height={shape.props.h} rx={16} ry={16} fill="none" stroke="#3b82f6" strokeWidth={2} />;
    }
}
