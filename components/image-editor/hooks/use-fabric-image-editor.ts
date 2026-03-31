"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sansFontFamily } from '@/lib/fonts';
import { compareAnnotationLabels, formatAnnotationLabel, parseAnnotationLabelIndex } from '@/lib/utils/annotation-label';
import { IMAGE_EDITOR_ANNOTATION_LABEL, IMAGE_EDITOR_THEME } from '../theme';
import type {
  ImageEditorAnnotation,
  ImageEditorCrop,
  ImageEditorSessionSnapshot,
  ImageEditorStroke,
  ImageEditorStrokePath,
  ImageEditorTool,
} from '../types';

interface UseFabricImageEditorOptions {
  imageUrl: string;
  initialSession?: ImageEditorSessionSnapshot;
  enabled?: boolean;
}

interface UseFabricImageEditorResult {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  setCanvasRef: (element: HTMLCanvasElement | null) => void;
  isReady: boolean;
  loadError?: string;
  imageSize: { width: number; height: number };
  tool: ImageEditorTool;
  setTool: (tool: ImageEditorTool) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushWidth: number;
  setBrushWidth: (width: number) => void;
  annotations: ImageEditorAnnotation[];
  crop?: ImageEditorCrop;
  setAnnotationDescription: (annotationId: string, description: string) => void;
  removeAnnotation: (annotationId: string) => void;
  clearCrop: () => void;
  buildSessionSnapshot: (plainPrompt: string) => ImageEditorSessionSnapshot;
  exportMergedImageDataUrl: () => string;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

type Selection =
  | { kind: 'annotation'; id: string }
  | { kind: 'crop' }
  | { kind: 'stroke'; id: string }
  | null;

interface Point {
  x: number;
  y: number;
}

interface InternalStroke {
  id: string;
  color: string;
  width: number;
  points: Point[];
}

type Interaction =
  | { type: 'draw-annotation'; start: Point; current: Point }
  | { type: 'draw-crop'; start: Point; current: Point }
  | { type: 'move-annotation'; id: string; startPointer: Point; startRect: ImageEditorCrop }
  | { type: 'resize-annotation'; id: string; handle: ResizeHandle; startPointer: Point; startRect: ImageEditorCrop }
  | { type: 'move-crop'; startPointer: Point; startRect: ImageEditorCrop }
  | { type: 'resize-crop'; handle: ResizeHandle; startPointer: Point; startRect: ImageEditorCrop }
  | { type: 'draw-stroke'; stroke: InternalStroke }
  | null;

const DEFAULT_BRUSH_COLOR: string = IMAGE_EDITOR_THEME.action;
const DEFAULT_BRUSH_WIDTH = 4;
const BANNER_ANNOTATION_BORDER_COLOR = IMAGE_EDITOR_THEME.annotation.border;
const BANNER_ANNOTATION_LABEL_BACKGROUND = IMAGE_EDITOR_THEME.annotation.labelBackground;
const BANNER_ANNOTATION_LABEL_TEXT_COLOR = IMAGE_EDITOR_THEME.annotation.labelText;
const BANNER_ANNOTATION_LABEL_FONT = `400 10px ${sansFontFamily}`;
const BANNER_ANNOTATION_LABEL_OFFSET_Y = 20;
const MIN_DRAW_SIZE = 8;
const HANDLE_HIT_SIZE = 10;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseAnnotationOrder(label: string): number {
  const parsed = parseAnnotationLabelIndex(label, IMAGE_EDITOR_ANNOTATION_LABEL);
  return parsed === null ? Number.POSITIVE_INFINITY : parsed;
}

function sortAnnotationsByLabel(annotations: ImageEditorAnnotation[]): ImageEditorAnnotation[] {
  return [...annotations].sort((a, b) => {
    const orderDelta = parseAnnotationOrder(a.label) - parseAnnotationOrder(b.label);
    if (orderDelta !== 0) return orderDelta;
    return compareAnnotationLabels(a.label, b.label, IMAGE_EDITOR_ANNOTATION_LABEL);
  });
}

function relabelAnnotations(annotations: ImageEditorAnnotation[]): ImageEditorAnnotation[] {
  return sortAnnotationsByLabel(annotations).map((annotation, index) => ({
    ...annotation,
    label: formatAnnotationLabel(index + 1, IMAGE_EDITOR_ANNOTATION_LABEL),
  }));
}

function toRect(annotation: ImageEditorAnnotation): ImageEditorCrop {
  return {
    x: annotation.x,
    y: annotation.y,
    width: annotation.width,
    height: annotation.height,
  };
}

function normalizeRect(rect: ImageEditorCrop, boundsWidth: number, boundsHeight: number, minSize = MIN_DRAW_SIZE): ImageEditorCrop {
  const x = clamp(rect.x, 0, Math.max(0, boundsWidth - minSize));
  const y = clamp(rect.y, 0, Math.max(0, boundsHeight - minSize));
  const maxWidth = Math.max(minSize, boundsWidth - x);
  const maxHeight = Math.max(minSize, boundsHeight - y);
  return {
    x: round(x),
    y: round(y),
    width: round(clamp(rect.width, minSize, maxWidth)),
    height: round(clamp(rect.height, minSize, maxHeight)),
  };
}

function rectFromPoints(start: Point, current: Point, boundsWidth: number, boundsHeight: number): ImageEditorCrop {
  const x1 = clamp(start.x, 0, boundsWidth);
  const y1 = clamp(start.y, 0, boundsHeight);
  const x2 = clamp(current.x, 0, boundsWidth);
  const y2 = clamp(current.y, 0, boundsHeight);

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return {
    x: round(left),
    y: round(top),
    width: round(width),
    height: round(height),
  };
}

function pointInRect(point: Point, rect: ImageEditorCrop): boolean {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function getHandlePoint(rect: ImageEditorCrop, handle: ResizeHandle): Point {
  if (handle === 'nw') return { x: rect.x, y: rect.y };
  if (handle === 'ne') return { x: rect.x + rect.width, y: rect.y };
  if (handle === 'sw') return { x: rect.x, y: rect.y + rect.height };
  return { x: rect.x + rect.width, y: rect.y + rect.height };
}

function getResizeHandle(point: Point, rect: ImageEditorCrop, hitSize = HANDLE_HIT_SIZE): ResizeHandle | null {
  const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];

  for (const handle of handles) {
    const anchor = getHandlePoint(rect, handle);
    if (Math.abs(point.x - anchor.x) <= hitSize && Math.abs(point.y - anchor.y) <= hitSize) {
      return handle;
    }
  }

  return null;
}

function resizeRectFromHandle(
  startRect: ImageEditorCrop,
  handle: ResizeHandle,
  startPointer: Point,
  currentPointer: Point,
  boundsWidth: number,
  boundsHeight: number,
): ImageEditorCrop {
  const dx = currentPointer.x - startPointer.x;
  const dy = currentPointer.y - startPointer.y;

  let left = startRect.x;
  let right = startRect.x + startRect.width;
  let top = startRect.y;
  let bottom = startRect.y + startRect.height;

  if (handle.includes('n')) {
    top = clamp(startRect.y + dy, 0, bottom - MIN_DRAW_SIZE);
  }
  if (handle.includes('s')) {
    bottom = clamp(startRect.y + startRect.height + dy, top + MIN_DRAW_SIZE, boundsHeight);
  }
  if (handle.includes('w')) {
    left = clamp(startRect.x + dx, 0, right - MIN_DRAW_SIZE);
  }
  if (handle.includes('e')) {
    right = clamp(startRect.x + startRect.width + dx, left + MIN_DRAW_SIZE, boundsWidth);
  }

  return normalizeRect({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }, boundsWidth, boundsHeight);
}

function getPointFromEvent(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = bounds.width ? (canvas.width / bounds.width) : 1;
  const scaleY = bounds.height ? (canvas.height / bounds.height) : 1;

  return {
    x: clamp((event.clientX - bounds.left) * scaleX, 0, canvas.width),
    y: clamp((event.clientY - bounds.top) * scaleY, 0, canvas.height),
  };
}

function getAnnotationLabelText(label: string): string {
  return ` ${label} `;
}

function strokePointsFromPath(stroke: ImageEditorStroke, scaleX: number, scaleY: number): Point[] {
  const baseLeft = Number.isFinite(stroke.left) ? stroke.left : 0;
  const baseTop = Number.isFinite(stroke.top) ? stroke.top : 0;
  const localScaleX = Number.isFinite(stroke.scaleX) && stroke.scaleX > 0 ? stroke.scaleX : 1;
  const localScaleY = Number.isFinite(stroke.scaleY) && stroke.scaleY > 0 ? stroke.scaleY : 1;

  const points: Point[] = [];
  stroke.path.forEach((segment) => {
    if (!Array.isArray(segment) || segment.length < 3 || typeof segment[0] !== 'string') {
      return;
    }

    const command = String(segment[0]).toUpperCase();

    let rawX: number | null = null;
    let rawY: number | null = null;

    if ((command === 'M' || command === 'L') && segment.length >= 3) {
      rawX = Number(segment[1]);
      rawY = Number(segment[2]);
    } else if (command === 'Q' && segment.length >= 5) {
      rawX = Number(segment[3]);
      rawY = Number(segment[4]);
    } else if (command === 'C' && segment.length >= 7) {
      rawX = Number(segment[5]);
      rawY = Number(segment[6]);
    }

    if (rawX === null || rawY === null || !Number.isFinite(rawX) || !Number.isFinite(rawY)) {
      return;
    }

    points.push({
      x: round((baseLeft + (rawX * localScaleX)) * scaleX),
      y: round((baseTop + (rawY * localScaleY)) * scaleY),
    });
  });

  return points;
}

function distancePointToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / ((dx * dx) + (dy * dy)), 0, 1);
  const projectionX = start.x + (t * dx);
  const projectionY = start.y + (t * dy);
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function findStrokeAtPoint(strokes: InternalStroke[], point: Point): string | null {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    const stroke = strokes[i];
    const threshold = Math.max(6, (stroke.width / 2) + 4);

    for (let segmentIndex = 1; segmentIndex < stroke.points.length; segmentIndex += 1) {
      const prev = stroke.points[segmentIndex - 1];
      const next = stroke.points[segmentIndex];
      if (distancePointToSegment(point, prev, next) <= threshold) {
        return stroke.id;
      }
    }
  }

  return null;
}

function drawStrokePath(context: CanvasRenderingContext2D, stroke: InternalStroke): void {
  if (stroke.points.length < 2) return;

  context.save();
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    context.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  context.stroke();
  context.restore();
}

function drawHandles(context: CanvasRenderingContext2D, rect: ImageEditorCrop, borderColor: string): void {
  const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
  context.save();

  handles.forEach((handle) => {
    const point = getHandlePoint(rect, handle);
    context.beginPath();
    context.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
    context.fillStyle = borderColor;
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = IMAGE_EDITOR_THEME.annotation.handleStroke;
    context.stroke();
  });

  context.restore();
}

async function loadImageElement(imageUrl: string, signal: AbortSignal): Promise<{ image: HTMLImageElement; revoke?: () => void }> {
  let source = imageUrl;
  let revoke: (() => void) | undefined;

  if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
    const response = await fetch(imageUrl, { cache: 'no-store', signal });
    if (!response.ok) {
      throw new Error(`图片请求失败：${response.status}`);
    }

    const blob = await response.blob();
    source = URL.createObjectURL(blob);
    revoke = () => URL.revokeObjectURL(source);
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const imageElement = new Image();
    imageElement.onload = () => resolve(imageElement);
    imageElement.onerror = () => reject(new Error('图片加载失败'));
    imageElement.src = source;
  });

  return { image, revoke };
}

export function useFabricImageEditor(options: UseFabricImageEditorOptions): UseFabricImageEditorResult {
  const { imageUrl, initialSession, enabled = true } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasMountVersion, setCanvasMountVersion] = useState(0);

  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRevokeRef = useRef<(() => void) | undefined>(undefined);

  const annotationsRef = useRef<ImageEditorAnnotation[]>(initialSession?.annotations || []);
  const strokesRef = useRef<InternalStroke[]>([]);
  const cropRef = useRef<ImageEditorCrop | undefined>(initialSession?.crop);

  const toolRef = useRef<ImageEditorTool>('select');
  const brushColorRef = useRef<string>(DEFAULT_BRUSH_COLOR);
  const brushWidthRef = useRef(DEFAULT_BRUSH_WIDTH);
  const isReadyRef = useRef(false);
  const interactionRef = useRef<Interaction>(null);
  const selectionRef = useRef<Selection>(null);
  const pointerIdRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [imageSize, setImageSize] = useState({
    width: initialSession?.imageWidth || 1024,
    height: initialSession?.imageHeight || 1024,
  });
  const [tool, setTool] = useState<ImageEditorTool>('select');
  const [brushColor, setBrushColor] = useState<string>(DEFAULT_BRUSH_COLOR);
  const [brushWidth, setBrushWidth] = useState(DEFAULT_BRUSH_WIDTH);
  const [annotations, setAnnotations] = useState<ImageEditorAnnotation[]>(initialSession?.annotations || []);
  const [crop, setCrop] = useState<ImageEditorCrop | undefined>(initialSession?.crop);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);

  useEffect(() => {
    brushWidthRef.current = brushWidth;
  }, [brushWidth]);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const backgroundImage = backgroundImageRef.current;

    if (!canvas || !backgroundImage) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = IMAGE_EDITOR_THEME.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    strokesRef.current.forEach((stroke) => {
      drawStrokePath(context, stroke);
    });

    const showHandles = toolRef.current === 'select' || toolRef.current === 'annotate' || toolRef.current === 'crop';

    annotationsRef.current.forEach((annotation) => {
      const rect = toRect(annotation);

      context.save();
      context.lineWidth = 2;
      context.strokeStyle = BANNER_ANNOTATION_BORDER_COLOR;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      context.restore();

      const labelText = getAnnotationLabelText(annotation.label);
      context.save();
      context.font = BANNER_ANNOTATION_LABEL_FONT;
      context.textBaseline = 'middle';
      const labelWidth = Math.ceil(context.measureText(labelText).width) + 2;
      const labelHeight = 14;
      const labelX = rect.x;
      const labelY = Math.max(0, rect.y - BANNER_ANNOTATION_LABEL_OFFSET_Y);
      context.fillStyle = BANNER_ANNOTATION_LABEL_BACKGROUND;
      context.fillRect(labelX, labelY, labelWidth, labelHeight);
      context.fillStyle = BANNER_ANNOTATION_LABEL_TEXT_COLOR;
      context.fillText(labelText, labelX + 1, labelY + (labelHeight / 2));
      context.restore();

      if (showHandles && selectionRef.current?.kind === 'annotation' && selectionRef.current.id === annotation.id) {
        drawHandles(context, rect, BANNER_ANNOTATION_BORDER_COLOR);
      }
    });

    if (cropRef.current) {
      const cropRect = cropRef.current;

      context.save();
      context.fillStyle = IMAGE_EDITOR_THEME.actionSurface;
      context.strokeStyle = IMAGE_EDITOR_THEME.action;
      context.lineWidth = 2;
      context.setLineDash([10, 6]);
      context.fillRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
      context.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
      context.restore();

      if (showHandles && selectionRef.current?.kind === 'crop') {
        drawHandles(context, cropRect, IMAGE_EDITOR_THEME.action);
      }
    }

    const interaction = interactionRef.current;
    if (interaction && (interaction.type === 'draw-annotation' || interaction.type === 'draw-crop')) {
      const draftRect = rectFromPoints(interaction.start, interaction.current, canvas.width, canvas.height);
      context.save();
      context.lineWidth = 2;
      context.strokeStyle = interaction.type === 'draw-crop' ? IMAGE_EDITOR_THEME.action : BANNER_ANNOTATION_BORDER_COLOR;
      context.setLineDash(interaction.type === 'draw-crop' ? [10, 6] : [8, 4]);
      context.strokeRect(draftRect.x, draftRect.y, draftRect.width, draftRect.height);
      context.restore();
    }

    if (interaction?.type === 'draw-stroke') {
      drawStrokePath(context, interaction.stroke);
    }
  }, []);

  const updateCanvasCursor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (toolRef.current === 'eraser') {
      canvas.style.cursor = 'cell';
      return;
    }

    if (toolRef.current === 'annotate' || toolRef.current === 'crop') {
      canvas.style.cursor = 'crosshair';
      return;
    }

    canvas.style.cursor = 'default';
  }, []);

  useEffect(() => {
    toolRef.current = tool;
    updateCanvasCursor();
    renderCanvas();
  }, [tool, renderCanvas, updateCanvasCursor]);

  const setCanvasRef = useCallback((element: HTMLCanvasElement | null) => {
    canvasRef.current = element;
    setCanvasMountVersion((value) => value + 1);
  }, []);

  const applyAnnotations = useCallback((nextAnnotations: ImageEditorAnnotation[]) => {
    const normalizedAnnotations = nextAnnotations.map((annotation) => ({
      ...annotation,
      color: BANNER_ANNOTATION_BORDER_COLOR,
    }));
    annotationsRef.current = normalizedAnnotations;
    setAnnotations(normalizedAnnotations);
  }, []);

  const applyCrop = useCallback((nextCrop: ImageEditorCrop | undefined) => {
    cropRef.current = nextCrop;
    setCrop(nextCrop);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!imageUrl) {
      setLoadError('未找到可编辑图片地址。');
      setIsReady(false);
      isReadyRef.current = false;
      return;
    }

    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';

    let cancelled = false;
    const abortController = new AbortController();

    setIsReady(false);
    isReadyRef.current = false;
    setLoadError(undefined);

    const initialize = async () => {
      try {
        const { image, revoke } = await loadImageElement(imageUrl, abortController.signal);
        if (cancelled) {
          revoke?.();
          return;
        }

        objectUrlRevokeRef.current?.();
        objectUrlRevokeRef.current = revoke;
        backgroundImageRef.current = image;

        const width = normalizeDimension(image.naturalWidth || image.width || initialSession?.imageWidth || 1024, 1024);
        const height = normalizeDimension(image.naturalHeight || image.height || initialSession?.imageHeight || 1024, 1024);

        canvas.width = width;
        canvas.height = height;

        const session = initialSession;
        const scaleX = session ? (width / Math.max(1, session.imageWidth)) : 1;
        const scaleY = session ? (height / Math.max(1, session.imageHeight)) : 1;

        const nextAnnotations = (session?.annotations || []).map((annotation, index) => ({
          ...annotation,
          label: annotation.label || formatAnnotationLabel(index + 1, IMAGE_EDITOR_ANNOTATION_LABEL),
          x: round(annotation.x * scaleX),
          y: round(annotation.y * scaleY),
          width: round(annotation.width * scaleX),
          height: round(annotation.height * scaleY),
          color: BANNER_ANNOTATION_BORDER_COLOR,
        }));

        const nextStrokes = (session?.strokes || []).map((stroke) => {
          const points = strokePointsFromPath(stroke, scaleX, scaleY);
          return {
            id: stroke.id || createId(),
            color: stroke.color || DEFAULT_BRUSH_COLOR,
            width: round((Number(stroke.width) || DEFAULT_BRUSH_WIDTH) * ((scaleX + scaleY) / 2)),
            points,
          } satisfies InternalStroke;
        }).filter((stroke) => stroke.points.length >= 2);

        const nextCrop = session?.crop
          ? normalizeRect({
            x: round(session.crop.x * scaleX),
            y: round(session.crop.y * scaleY),
            width: round(session.crop.width * scaleX),
            height: round(session.crop.height * scaleY),
          }, width, height)
          : undefined;

        selectionRef.current = null;
        interactionRef.current = null;
        pointerIdRef.current = null;

        strokesRef.current = nextStrokes;
        setImageSize({ width, height });
        applyAnnotations(nextAnnotations);
        applyCrop(nextCrop);
        updateCanvasCursor();
        setIsReady(true);
        isReadyRef.current = true;
        renderCanvas();
      } catch (error) {
        setLoadError(error instanceof Error ? `图片加载失败：${error.message}` : '图片加载失败，请稍后重试。');
        setIsReady(false);
        isReadyRef.current = false;
      }
    };

    const commitRefState = () => {
      setAnnotations([...annotationsRef.current]);
      setCrop(cropRef.current ? { ...cropRef.current } : undefined);
    };

    const findAnnotationTarget = (point: Point): { annotation: ImageEditorAnnotation; handle: ResizeHandle | null } | null => {
      const allAnnotations = annotationsRef.current;

      for (let index = allAnnotations.length - 1; index >= 0; index -= 1) {
        const annotation = allAnnotations[index];
        const annotationRect = toRect(annotation);
        const handle = getResizeHandle(point, annotationRect);
        if (handle) {
          return { annotation, handle };
        }

        if (pointInRect(point, annotationRect)) {
          return { annotation, handle: null };
        }
      }

      return null;
    };

    const findCropTarget = (point: Point): { handle: ResizeHandle | null } | null => {
      const cropRect = cropRef.current;
      if (!cropRect) return null;

      const handle = getResizeHandle(point, cropRect);
      if (handle) {
        return { handle };
      }

      if (pointInRect(point, cropRect)) {
        return { handle: null };
      }

      return null;
    };

    const removeAnnotationAndRelabel = (annotationId: string) => {
      const filtered = annotationsRef.current.filter((annotation) => annotation.id !== annotationId);
      const relabeled = relabelAnnotations(filtered);
      applyAnnotations(relabeled);
      selectionRef.current = null;
      renderCanvas();
    };

    const removeStrokeById = (strokeId: string) => {
      strokesRef.current = strokesRef.current.filter((stroke) => stroke.id !== strokeId);
      if (selectionRef.current?.kind === 'stroke' && selectionRef.current.id === strokeId) {
        selectionRef.current = null;
      }
      renderCanvas();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!enabled || !isReadyRef.current) return;
      if (pointerIdRef.current !== null) return;

      const point = getPointFromEvent(canvas, event);
      const activeTool = toolRef.current;
      const currentCrop = cropRef.current;

      pointerIdRef.current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);

      if (activeTool === 'brush') {
        const stroke: InternalStroke = {
          id: createId(),
          color: brushColorRef.current,
          width: brushWidthRef.current,
          points: [point],
        };

        interactionRef.current = { type: 'draw-stroke', stroke };
        selectionRef.current = { kind: 'stroke', id: stroke.id };
        renderCanvas();
        return;
      }

      if (activeTool === 'eraser') {
        const annotationTarget = findAnnotationTarget(point);
        if (annotationTarget) {
          removeAnnotationAndRelabel(annotationTarget.annotation.id);
          return;
        }

        const strokeId = findStrokeAtPoint(strokesRef.current, point);
        if (strokeId) {
          removeStrokeById(strokeId);
          return;
        }

        selectionRef.current = null;
        renderCanvas();
        return;
      }

      if (activeTool === 'crop') {
        const cropTarget = findCropTarget(point);
        if (cropTarget && currentCrop) {
          selectionRef.current = { kind: 'crop' };
          interactionRef.current = cropTarget.handle
            ? {
              type: 'resize-crop',
              handle: cropTarget.handle,
              startPointer: point,
              startRect: { ...currentCrop },
            }
            : {
              type: 'move-crop',
              startPointer: point,
              startRect: { ...currentCrop },
            };
          renderCanvas();
          return;
        }

        interactionRef.current = { type: 'draw-crop', start: point, current: point };
        selectionRef.current = null;
        renderCanvas();
        return;
      }

      if (activeTool === 'annotate') {
        const annotationTarget = findAnnotationTarget(point);
        if (annotationTarget) {
          const rect = toRect(annotationTarget.annotation);
          selectionRef.current = { kind: 'annotation', id: annotationTarget.annotation.id };
          interactionRef.current = annotationTarget.handle
            ? {
              type: 'resize-annotation',
              id: annotationTarget.annotation.id,
              handle: annotationTarget.handle,
              startPointer: point,
              startRect: rect,
            }
            : {
              type: 'move-annotation',
              id: annotationTarget.annotation.id,
              startPointer: point,
              startRect: rect,
            };
          renderCanvas();
          return;
        }

        interactionRef.current = { type: 'draw-annotation', start: point, current: point };
        selectionRef.current = null;
        renderCanvas();
        return;
      }

      const annotationTarget = findAnnotationTarget(point);
      if (annotationTarget) {
        const rect = toRect(annotationTarget.annotation);
        selectionRef.current = { kind: 'annotation', id: annotationTarget.annotation.id };
        interactionRef.current = annotationTarget.handle
          ? {
            type: 'resize-annotation',
            id: annotationTarget.annotation.id,
            handle: annotationTarget.handle,
            startPointer: point,
            startRect: rect,
          }
          : {
            type: 'move-annotation',
            id: annotationTarget.annotation.id,
            startPointer: point,
            startRect: rect,
          };
        renderCanvas();
        return;
      }

      const cropTarget = findCropTarget(point);
      if (cropTarget && currentCrop) {
        selectionRef.current = { kind: 'crop' };
        interactionRef.current = cropTarget.handle
          ? {
            type: 'resize-crop',
            handle: cropTarget.handle,
            startPointer: point,
            startRect: { ...currentCrop },
          }
          : {
            type: 'move-crop',
            startPointer: point,
            startRect: { ...currentCrop },
          };
        renderCanvas();
        return;
      }

      const strokeId = findStrokeAtPoint(strokesRef.current, point);
      if (strokeId) {
        selectionRef.current = { kind: 'stroke', id: strokeId };
        interactionRef.current = null;
        renderCanvas();
        return;
      }

      selectionRef.current = null;
      interactionRef.current = null;
      renderCanvas();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerIdRef.current === null || pointerIdRef.current !== event.pointerId) {
        return;
      }

      const interaction = interactionRef.current;
      if (!interaction) return;

      const point = getPointFromEvent(canvas, event);
      const width = canvas.width;
      const height = canvas.height;

      if (interaction.type === 'draw-annotation' || interaction.type === 'draw-crop') {
        interaction.current = point;
        renderCanvas();
        return;
      }

      if (interaction.type === 'draw-stroke') {
        const lastPoint = interaction.stroke.points[interaction.stroke.points.length - 1];
        if (!lastPoint || Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= 0.8) {
          interaction.stroke.points.push(point);
          renderCanvas();
        }
        return;
      }

      if (interaction.type === 'move-annotation') {
        const deltaX = point.x - interaction.startPointer.x;
        const deltaY = point.y - interaction.startPointer.y;

        annotationsRef.current = annotationsRef.current.map((annotation) => {
          if (annotation.id !== interaction.id) return annotation;

          const nextRect = normalizeRect({
            x: interaction.startRect.x + deltaX,
            y: interaction.startRect.y + deltaY,
            width: interaction.startRect.width,
            height: interaction.startRect.height,
          }, width, height);

          return {
            ...annotation,
            x: nextRect.x,
            y: nextRect.y,
            width: nextRect.width,
            height: nextRect.height,
          };
        });

        renderCanvas();
        return;
      }

      if (interaction.type === 'resize-annotation') {
        const resized = resizeRectFromHandle(
          interaction.startRect,
          interaction.handle,
          interaction.startPointer,
          point,
          width,
          height,
        );

        annotationsRef.current = annotationsRef.current.map((annotation) => (
          annotation.id === interaction.id
            ? {
              ...annotation,
              x: resized.x,
              y: resized.y,
              width: resized.width,
              height: resized.height,
            }
            : annotation
        ));

        renderCanvas();
        return;
      }

      if (interaction.type === 'move-crop') {
        const deltaX = point.x - interaction.startPointer.x;
        const deltaY = point.y - interaction.startPointer.y;

        cropRef.current = normalizeRect({
          x: interaction.startRect.x + deltaX,
          y: interaction.startRect.y + deltaY,
          width: interaction.startRect.width,
          height: interaction.startRect.height,
        }, width, height);

        renderCanvas();
        return;
      }

      if (interaction.type === 'resize-crop') {
        cropRef.current = resizeRectFromHandle(
          interaction.startRect,
          interaction.handle,
          interaction.startPointer,
          point,
          width,
          height,
        );

        renderCanvas();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pointerIdRef.current === null || pointerIdRef.current !== event.pointerId) {
        return;
      }

      const interaction = interactionRef.current;
      interactionRef.current = null;
      pointerIdRef.current = null;

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (!interaction) {
        renderCanvas();
        return;
      }

      if (interaction.type === 'draw-annotation') {
        const draft = rectFromPoints(interaction.start, interaction.current, canvas.width, canvas.height);
        if (draft.width >= MIN_DRAW_SIZE && draft.height >= MIN_DRAW_SIZE) {
          const maxLabelIndex = annotationsRef.current.reduce((max, annotation) => {
            const parsed = parseAnnotationLabelIndex(annotation.label, IMAGE_EDITOR_ANNOTATION_LABEL);
            return parsed !== null ? Math.max(max, parsed) : max;
          }, 0);

          const nextAnnotation: ImageEditorAnnotation = {
            id: createId(),
            label: formatAnnotationLabel(maxLabelIndex + 1, IMAGE_EDITOR_ANNOTATION_LABEL),
            description: '',
            x: draft.x,
            y: draft.y,
            width: draft.width,
            height: draft.height,
            color: BANNER_ANNOTATION_BORDER_COLOR,
          };

          const nextAnnotations = [...annotationsRef.current, nextAnnotation];
          applyAnnotations(nextAnnotations);
          selectionRef.current = { kind: 'annotation', id: nextAnnotation.id };
        } else {
          setAnnotations([...annotationsRef.current]);
        }

        renderCanvas();
        return;
      }

      if (interaction.type === 'draw-crop') {
        const draft = rectFromPoints(interaction.start, interaction.current, canvas.width, canvas.height);
        if (draft.width >= MIN_DRAW_SIZE && draft.height >= MIN_DRAW_SIZE) {
          const normalized = normalizeRect(draft, canvas.width, canvas.height);
          applyCrop(normalized);
          selectionRef.current = { kind: 'crop' };
        } else {
          setCrop(cropRef.current ? { ...cropRef.current } : undefined);
        }

        renderCanvas();
        return;
      }

      if (interaction.type === 'draw-stroke') {
        if (interaction.stroke.points.length >= 2) {
          strokesRef.current = [...strokesRef.current, interaction.stroke];
          selectionRef.current = { kind: 'stroke', id: interaction.stroke.id };
        }

        renderCanvas();
        return;
      }

      commitRefState();
      renderCanvas();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (pointerIdRef.current !== event.pointerId) {
        return;
      }

      interactionRef.current = null;
      pointerIdRef.current = null;

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      setAnnotations([...annotationsRef.current]);
      setCrop(cropRef.current ? { ...cropRef.current } : undefined);
      renderCanvas();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    void initialize();

    return () => {
      cancelled = true;
      abortController.abort();

      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);

      interactionRef.current = null;
      pointerIdRef.current = null;
      backgroundImageRef.current = null;
      objectUrlRevokeRef.current?.();
      objectUrlRevokeRef.current = undefined;
      setIsReady(false);
      isReadyRef.current = false;
    };
  }, [
    applyAnnotations,
    applyCrop,
    canvasMountVersion,
    enabled,
    imageUrl,
    initialSession,
    renderCanvas,
    updateCanvasCursor,
  ]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;

      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }

      if (!selectionRef.current) return;
      event.preventDefault();

      if (selectionRef.current.kind === 'annotation') {
        const selectedAnnotationId = selectionRef.current.id;
        const next = annotationsRef.current.filter((annotation) => annotation.id !== selectedAnnotationId);
        applyAnnotations(relabelAnnotations(next));
        selectionRef.current = null;
        renderCanvas();
        return;
      }

      if (selectionRef.current.kind === 'crop') {
        applyCrop(undefined);
        selectionRef.current = null;
        renderCanvas();
        return;
      }

      if (selectionRef.current.kind === 'stroke') {
        const selectedStrokeId = selectionRef.current.id;
        strokesRef.current = strokesRef.current.filter((stroke) => stroke.id !== selectedStrokeId);
        selectionRef.current = null;
        renderCanvas();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [applyAnnotations, applyCrop, enabled, renderCanvas]);

  const setAnnotationDescription = useCallback((annotationId: string, description: string) => {
    const nextAnnotations = annotationsRef.current.map((annotation) => (
      annotation.id === annotationId
        ? { ...annotation, description }
        : annotation
    ));

    applyAnnotations(nextAnnotations);
    renderCanvas();
  }, [applyAnnotations, renderCanvas]);

  const removeAnnotation = useCallback((annotationId: string) => {
    const filtered = annotationsRef.current.filter((annotation) => annotation.id !== annotationId);
    applyAnnotations(relabelAnnotations(filtered));

    if (selectionRef.current?.kind === 'annotation' && selectionRef.current.id === annotationId) {
      selectionRef.current = null;
    }

    renderCanvas();
  }, [applyAnnotations, renderCanvas]);

  const clearCrop = useCallback(() => {
    applyCrop(undefined);
    if (selectionRef.current?.kind === 'crop') {
      selectionRef.current = null;
    }
    renderCanvas();
  }, [applyCrop, renderCanvas]);

  const buildSessionSnapshot = useCallback((plainPrompt: string): ImageEditorSessionSnapshot => {
    const serializedStrokes: ImageEditorStroke[] = strokesRef.current.map((stroke) => ({
      id: stroke.id,
      color: stroke.color,
      width: round(stroke.width),
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      path: stroke.points.map((point, index) => ([
        index === 0 ? 'M' : 'L',
        round(point.x),
        round(point.y),
      ])) as ImageEditorStrokePath,
    }));

    return {
      version: 1,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      plainPrompt: (plainPrompt || '').trim(),
      annotations: sortAnnotationsByLabel(annotationsRef.current).map((annotation) => ({
        ...annotation,
        x: round(annotation.x),
        y: round(annotation.y),
        width: round(annotation.width),
        height: round(annotation.height),
        color: BANNER_ANNOTATION_BORDER_COLOR,
        description: (annotation.description || '').trim(),
      })),
      strokes: serializedStrokes,
      crop: cropRef.current
        ? {
          x: round(cropRef.current.x),
          y: round(cropRef.current.y),
          width: round(cropRef.current.width),
          height: round(cropRef.current.height),
        }
        : undefined,
    };
  }, [imageSize.height, imageSize.width]);

  const exportMergedImageDataUrl = useCallback((): string => {
    const image = backgroundImageRef.current;
    if (!image) {
      throw new Error('编辑画布尚未初始化。');
    }

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = imageSize.width;
    fullCanvas.height = imageSize.height;

    const fullContext = fullCanvas.getContext('2d');
    if (!fullContext) {
      throw new Error('导出编辑图片失败');
    }

    fullContext.drawImage(image, 0, 0, fullCanvas.width, fullCanvas.height);

    strokesRef.current.forEach((stroke) => {
      drawStrokePath(fullContext, stroke);
    });

    annotationsRef.current.forEach((annotation) => {
      const rect = toRect(annotation);

      fullContext.save();
      fullContext.lineWidth = 2;
      fullContext.strokeStyle = BANNER_ANNOTATION_BORDER_COLOR;
      fullContext.strokeRect(rect.x, rect.y, rect.width, rect.height);
      fullContext.restore();

      const labelText = getAnnotationLabelText(annotation.label);
      fullContext.save();
      fullContext.font = BANNER_ANNOTATION_LABEL_FONT;
      fullContext.textBaseline = 'middle';
      const labelWidth = Math.ceil(fullContext.measureText(labelText).width) + 2;
      const labelHeight = 14;
      const labelX = rect.x;
      const labelY = Math.max(0, rect.y - BANNER_ANNOTATION_LABEL_OFFSET_Y);
      fullContext.fillStyle = BANNER_ANNOTATION_LABEL_BACKGROUND;
      fullContext.fillRect(labelX, labelY, labelWidth, labelHeight);
      fullContext.fillStyle = BANNER_ANNOTATION_LABEL_TEXT_COLOR;
      fullContext.fillText(labelText, labelX + 1, labelY + (labelHeight / 2));
      fullContext.restore();
    });

    const cropRect = cropRef.current;
    if (!cropRect) {
      return fullCanvas.toDataURL('image/png', 1);
    }

    const left = Math.max(0, cropRect.x);
    const top = Math.max(0, cropRect.y);
    const width = Math.max(1, Math.min(cropRect.width, imageSize.width - left));
    const height = Math.max(1, Math.min(cropRect.height, imageSize.height - top));

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = round(width);
    croppedCanvas.height = round(height);

    const croppedContext = croppedCanvas.getContext('2d');
    if (!croppedContext) {
      throw new Error('导出编辑图片失败');
    }

    croppedContext.drawImage(
      fullCanvas,
      left,
      top,
      width,
      height,
      0,
      0,
      width,
      height,
    );

    return croppedCanvas.toDataURL('image/png', 1);
  }, [imageSize.height, imageSize.width]);

  const value = useMemo<UseFabricImageEditorResult>(() => ({
    canvasRef,
    setCanvasRef,
    isReady,
    loadError,
    imageSize,
    tool,
    setTool,
    brushColor,
    setBrushColor,
    brushWidth,
    setBrushWidth,
    annotations,
    crop,
    setAnnotationDescription,
    removeAnnotation,
    clearCrop,
    buildSessionSnapshot,
    exportMergedImageDataUrl,
  }), [
    annotations,
    brushColor,
    brushWidth,
    buildSessionSnapshot,
    clearCrop,
    crop,
    exportMergedImageDataUrl,
    imageSize,
    isReady,
    loadError,
    removeAnnotation,
    setAnnotationDescription,
    setCanvasRef,
    tool,
  ]);

  return value;
}
