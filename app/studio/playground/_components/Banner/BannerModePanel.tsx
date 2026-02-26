"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import {
    BANNER_ALLOWED_MODELS,
    BANNER_TEMPLATES,
    DEFAULT_BANNER_TEMPLATE_ID,
    getBannerTemplateById,
} from '@/config/banner-templates';
import type {
    BannerModelId,
    BannerTextPositionInstruction,
    BannerTextPositionType,
} from '@/lib/playground/types';
import { BANNER_REGION_LABEL_CONFIG } from '@/lib/prompt/banner-prompt';
import { cn } from '@/lib/utils';
import { formatAnnotationLabel } from '@/lib/utils/annotation-label';
import { MapPin, RotateCcw, Trash2 } from 'lucide-react';
import { formatImageUrl, getApiBase } from '@/lib/api-base';

const MODEL_LABEL_MAP: Record<BannerModelId, string> = {
    flux_klein: 'FluxKlein',
    'gemini-2.5-flash-image': 'Nano banana',
    'gemini-3-pro-image-preview': 'Nano banana pro',
};

interface BannerModePanelProps {
    isGenerating: boolean;
    onGenerate: (options?: BannerGenerateOptions) => void;
    sessionHistory: BannerSessionHistoryItem[];
}

interface BannerGenerateOptions {
    sourceImageUrls?: string[];
}

interface BannerSessionHistoryItem {
    id: string;
    outputUrl: string;
    createdAt: string;
    templateId: string;
}

interface DraftRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PointerPosition {
    x: number;
    y: number;
    boundsWidth: number;
    boundsHeight: number;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface RegionInteraction {
    pointerId: number;
    regionId: string;
    mode: 'move' | 'resize';
    handle?: ResizeHandle;
    startPointer: { x: number; y: number };
    startRect: DraftRect;
    minWidth: number;
    minHeight: number;
}

interface TextPositionInteraction {
    pointerId: number;
    textPositionId: string;
    startPointer: { x: number; y: number };
    startPosition: { x: number; y: number };
}

const MIN_DRAW_SIZE_PX = 12;
const RESIZE_HANDLE_DEFS: Array<{ handle: ResizeHandle; className: string }> = [
    { handle: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { handle: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { handle: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
    { handle: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const TEMPLATE_BASE_PREVIEW_ID = '__template_base__';
const DEFAULT_TEXT_POSITION_TYPE_SEQUENCE: BannerTextPositionType[] = ['mainTitle', 'subTitle', 'timeText'];
const TEXT_POSITION_TYPE_LABEL_MAP: Record<BannerTextPositionType, string> = {
    mainTitle: '主标题',
    subTitle: '副标题',
    timeText: '时间',
    custom: '自定义',
};

export function BannerModePanel({ isGenerating, onGenerate, sessionHistory }: BannerModePanelProps) {
    const activeBannerData = usePlaygroundStore((state) => state.activeBannerData);
    const initBannerData = usePlaygroundStore((state) => state.initBannerData);
    const updateBannerFields = usePlaygroundStore((state) => state.updateBannerFields);
    const updateBannerRegions = usePlaygroundStore((state) => state.updateBannerRegions);
    const updateBannerTextPositions = usePlaygroundStore((state) => state.updateBannerTextPositions);
    const updateBannerPromptFinal = usePlaygroundStore((state) => state.updateBannerPromptFinal);
    const resetBannerPromptFinal = usePlaygroundStore((state) => state.resetBannerPromptFinal);
    const setBannerModel = usePlaygroundStore((state) => state.setBannerModel);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const regionInteractionRef = useRef<RegionInteraction | null>(null);
    const textPositionInteractionRef = useRef<TextPositionInteraction | null>(null);
    const [isTextPositionMode, setIsTextPositionMode] = useState(false);
    const [isPreparingBannerGuideImage, setIsPreparingBannerGuideImage] = useState(false);
    const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
    const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
    const [interactionRect, setInteractionRect] = useState<DraftRect | null>(null);
    const [activeTextPositionId, setActiveTextPositionId] = useState<string | null>(null);
    const [interactionTextPosition, setInteractionTextPosition] = useState<{ x: number; y: number } | null>(null);
    const [activePreviewResultId, setActivePreviewResultId] = useState<string | null>(null);
    const [previewSweepKey, setPreviewSweepKey] = useState(0);
    const latestAutoPreviewIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!activeBannerData) {
            initBannerData(DEFAULT_BANNER_TEMPLATE_ID);
        }
    }, [activeBannerData, initBannerData]);

    const template = useMemo(() => {
        return getBannerTemplateById(activeBannerData?.templateId || DEFAULT_BANNER_TEMPLATE_ID);
    }, [activeBannerData?.templateId]);

    const templateWidth = template?.width || 1;
    const templateHeight = template?.height || 1;
    const activeTemplateId = activeBannerData?.templateId || DEFAULT_BANNER_TEMPLATE_ID;
    const regions = useMemo(() => activeBannerData?.regions || [], [activeBannerData?.regions]);
    const textPositions = useMemo(() => activeBannerData?.textPositions || [], [activeBannerData?.textPositions]);
    const nextRegionLabel = formatAnnotationLabel(regions.length + 1, BANNER_REGION_LABEL_CONFIG);
    const templateHistory = useMemo(
        () => sessionHistory.filter((item) => item.templateId === activeTemplateId),
        [activeTemplateId, sessionHistory]
    );
    const latestTemplateHistoryId = templateHistory[0]?.id || null;
    const activePreviewHistoryItem = useMemo(
        () => templateHistory.find((item) => item.id === activePreviewResultId) || null,
        [activePreviewResultId, templateHistory]
    );
    const previewImageSrc = useMemo(() => (
        activePreviewHistoryItem
            ? formatImageUrl(activePreviewHistoryItem.outputUrl)
            : (template?.baseImageUrl || '')
    ), [activePreviewHistoryItem, template?.baseImageUrl]);

    useEffect(() => {
        if (!latestTemplateHistoryId) {
            latestAutoPreviewIdRef.current = null;
            if (activePreviewResultId !== null) {
                setActivePreviewResultId(null);
            }
            return;
        }

        if (latestAutoPreviewIdRef.current !== latestTemplateHistoryId) {
            latestAutoPreviewIdRef.current = latestTemplateHistoryId;
            setActivePreviewResultId(latestTemplateHistoryId);
            return;
        }

        if (activePreviewResultId && templateHistory.some((item) => item.id === activePreviewResultId)) {
            return;
        }

        if (activePreviewResultId === TEMPLATE_BASE_PREVIEW_ID) {
            return;
        }

        setActivePreviewResultId(latestTemplateHistoryId);
    }, [activePreviewResultId, latestTemplateHistoryId, templateHistory]);

    useEffect(() => {
        if (!activeTextPositionId) return;
        if (!textPositions.some((item) => item.id === activeTextPositionId)) {
            setActiveTextPositionId(null);
            setInteractionTextPosition(null);
        }
    }, [activeTextPositionId, textPositions]);

    const getPointerPosition = useCallback((event: ReactPointerEvent<Element>): PointerPosition | null => {
        const element = previewRef.current;
        if (!element) return null;

        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return null;

        const x = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
        const y = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height);

        return {
            x: (x / bounds.width) * templateWidth,
            y: (y / bounds.height) * templateHeight,
            boundsWidth: bounds.width,
            boundsHeight: bounds.height,
        };
    }, [templateHeight, templateWidth]);

    const clearDraftState = useCallback(() => {
        pointerStartRef.current = null;
        setDraftRect(null);
    }, []);

    const clearRegionInteraction = useCallback(() => {
        regionInteractionRef.current = null;
        setInteractionRect(null);
    }, []);

    const clearTextPositionInteraction = useCallback(() => {
        textPositionInteractionRef.current = null;
        setInteractionTextPosition(null);
    }, []);

    const loadImageElement = useCallback((src: string) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new window.Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            image.src = src;
        });
    }, []);

    const createAnnotatedBannerGuideImage = useCallback(async (): Promise<string | null> => {
        if (!template) return null;

        try {
            const resolvedTemplateSrc = formatImageUrl(template.baseImageUrl);
            const templateImage = await loadImageElement(resolvedTemplateSrc);
            const canvas = document.createElement('canvas');
            canvas.width = template.width;
            canvas.height = template.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(templateImage, 0, 0, template.width, template.height);

            const regionLineWidth = Math.max(2, Math.round(Math.min(template.width, template.height) * 0.0032));
            const regionFontSize = Math.max(12, Math.round(Math.min(template.width, template.height) * 0.02));
            const markerRadius = Math.max(11, Math.round(Math.min(template.width, template.height) * 0.015));
            const markerFontSize = Math.max(11, Math.round(markerRadius * 0.95));

            regions.forEach((region) => {
                if (
                    typeof region.x !== 'number'
                    || typeof region.y !== 'number'
                    || typeof region.width !== 'number'
                    || typeof region.height !== 'number'
                ) {
                    return;
                }

                ctx.save();
                ctx.fillStyle = 'rgba(255, 77, 79, 0.2)';
                ctx.strokeStyle = '#FF4D4F';
                ctx.lineWidth = regionLineWidth;
                ctx.fillRect(region.x, region.y, region.width, region.height);
                ctx.strokeRect(region.x, region.y, region.width, region.height);

                const label = region.label || '?';
                ctx.font = `${regionFontSize}px sans-serif`;
                ctx.textBaseline = 'middle';
                const textWidth = Math.ceil(ctx.measureText(label).width);
                const labelPaddingX = 6;
                const labelPaddingY = 4;
                const labelWidth = textWidth + (labelPaddingX * 2);
                const labelHeight = regionFontSize + (labelPaddingY * 2);
                const labelX = region.x;
                const labelY = Math.max(0, region.y - labelHeight - 2);

                ctx.fillStyle = '#FF4D4F';
                ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(label, labelX + labelPaddingX, labelY + (labelHeight / 2));
                ctx.restore();
            });

            textPositions.forEach((textPosition) => {
                if (typeof textPosition.x !== 'number' || typeof textPosition.y !== 'number') return;

                ctx.save();
                ctx.fillStyle = '#9BD6FF';
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(textPosition.x, textPosition.y, markerRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.font = `700 ${markerFontSize}px sans-serif`;
                ctx.fillStyle = '#0B1A2A';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(textPosition.label || '?', textPosition.x, textPosition.y + 0.5);
                ctx.restore();
            });

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/png');
            });

            if (!blob) return null;

            const formData = new FormData();
            formData.append('file', new File([blob], `banner-guide-${Date.now()}.png`, { type: 'image/png' }));
            const uploadResp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: formData });
            if (!uploadResp.ok) return null;
            const uploadJson = await uploadResp.json();
            return typeof uploadJson?.path === 'string' ? uploadJson.path : null;
        } catch (error) {
            console.error('[BannerModePanel] Failed to build/upload guide image', error);
            return null;
        }
    }, [loadImageElement, regions, template, textPositions]);

    const releasePreviewPointerCapture = useCallback((pointerId: number) => {
        const preview = previewRef.current;
        if (!preview) return;
        if (preview.hasPointerCapture(pointerId)) {
            preview.releasePointerCapture(pointerId);
        }
    }, []);

    const ensurePreviewPointerCapture = useCallback((pointerId: number) => {
        const preview = previewRef.current;
        if (!preview) return;
        if (!preview.hasPointerCapture(pointerId)) {
            preview.setPointerCapture(pointerId);
        }
    }, []);

    const toRegionRect = useCallback((region: { x?: number; y?: number; width?: number; height?: number }): DraftRect | null => {
        if (
            typeof region.x !== 'number'
            || typeof region.y !== 'number'
            || typeof region.width !== 'number'
            || typeof region.height !== 'number'
        ) {
            return null;
        }
        return {
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
        };
    }, []);

    const buildMoveRect = useCallback((startRect: DraftRect, deltaX: number, deltaY: number): DraftRect => {
        const x = clamp(startRect.x + deltaX, 0, templateWidth - startRect.width);
        const y = clamp(startRect.y + deltaY, 0, templateHeight - startRect.height);
        return {
            ...startRect,
            x,
            y,
        };
    }, [templateHeight, templateWidth]);

    const buildResizeRect = useCallback((
        startRect: DraftRect,
        deltaX: number,
        deltaY: number,
        handle: ResizeHandle,
        minWidth: number,
        minHeight: number,
    ): DraftRect => {
        let left = startRect.x;
        let right = startRect.x + startRect.width;
        let top = startRect.y;
        let bottom = startRect.y + startRect.height;

        if (handle.includes('w')) {
            left = clamp(startRect.x + deltaX, 0, right - minWidth);
        }
        if (handle.includes('e')) {
            right = clamp(startRect.x + startRect.width + deltaX, left + minWidth, templateWidth);
        }
        if (handle.includes('n')) {
            top = clamp(startRect.y + deltaY, 0, bottom - minHeight);
        }
        if (handle.includes('s')) {
            bottom = clamp(startRect.y + startRect.height + deltaY, top + minHeight, templateHeight);
        }

        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };
    }, [templateHeight, templateWidth]);

    const startRegionInteraction = useCallback((
        event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>,
        regionId: string,
        mode: 'move' | 'resize',
        handle?: ResizeHandle,
    ) => {
        const region = regions.find((item) => item.id === regionId);
        if (!region) return;

        const point = getPointerPosition(event);
        const rect = toRegionRect(region);
        if (!point || !rect) return;

        const minWidth = (MIN_DRAW_SIZE_PX / point.boundsWidth) * templateWidth;
        const minHeight = (MIN_DRAW_SIZE_PX / point.boundsHeight) * templateHeight;

        regionInteractionRef.current = {
            pointerId: event.pointerId,
            regionId,
            mode,
            handle,
            startPointer: { x: point.x, y: point.y },
            startRect: rect,
            minWidth,
            minHeight,
        };
        setActiveRegionId(regionId);
        setInteractionRect(rect);
        ensurePreviewPointerCapture(event.pointerId);

        event.preventDefault();
        event.stopPropagation();
    }, [ensurePreviewPointerCapture, getPointerPosition, regions, templateHeight, templateWidth, toRegionRect]);

    const appendTextPositionAtPoint = useCallback((point: { x: number; y: number }) => {
        const nextType = DEFAULT_TEXT_POSITION_TYPE_SEQUENCE[textPositions.length] || 'custom';
        const newTextPositionId = `banner-text-position-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const nextTextPositions: BannerTextPositionInstruction[] = [
            ...textPositions,
            {
                id: newTextPositionId,
                label: '',
                type: nextType,
                x: Math.round(point.x),
                y: Math.round(point.y),
                note: '',
            },
        ];

        updateBannerTextPositions(nextTextPositions);
        setActiveTextPositionId(newTextPositionId);
    }, [textPositions, updateBannerTextPositions]);

    const startTextPositionInteraction = useCallback((
        event: ReactPointerEvent<HTMLButtonElement>,
        textPositionId: string,
    ) => {
        const target = textPositions.find((item) => item.id === textPositionId);
        if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') return;

        const point = getPointerPosition(event);
        if (!point) return;

        textPositionInteractionRef.current = {
            pointerId: event.pointerId,
            textPositionId,
            startPointer: { x: point.x, y: point.y },
            startPosition: { x: target.x, y: target.y },
        };
        setActiveTextPositionId(textPositionId);
        setInteractionTextPosition({ x: target.x, y: target.y });
        ensurePreviewPointerCapture(event.pointerId);

        event.preventDefault();
        event.stopPropagation();
    }, [ensurePreviewPointerCapture, getPointerPosition, textPositions]);

    const handlePreviewPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (isTextPositionMode) {
            const point = getPointerPosition(event);
            if (!point) return;
            appendTextPositionAtPoint(point);
            return;
        }

        const point = getPointerPosition(event);
        if (!point) return;

        pointerStartRef.current = { x: point.x, y: point.y };
        setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
        ensurePreviewPointerCapture(event.pointerId);
    }, [appendTextPositionAtPoint, ensurePreviewPointerCapture, getPointerPosition, isTextPositionMode]);

    const handlePreviewPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const textInteraction = textPositionInteractionRef.current;
        if (textInteraction) {
            const point = getPointerPosition(event);
            if (!point) return;

            const deltaX = point.x - textInteraction.startPointer.x;
            const deltaY = point.y - textInteraction.startPointer.y;
            const nextX = clamp(textInteraction.startPosition.x + deltaX, 0, templateWidth);
            const nextY = clamp(textInteraction.startPosition.y + deltaY, 0, templateHeight);
            setInteractionTextPosition({ x: nextX, y: nextY });
            return;
        }

        const interaction = regionInteractionRef.current;
        if (interaction) {
            const point = getPointerPosition(event);
            if (!point) return;

            const deltaX = point.x - interaction.startPointer.x;
            const deltaY = point.y - interaction.startPointer.y;

            const nextRect = interaction.mode === 'move'
                ? buildMoveRect(interaction.startRect, deltaX, deltaY)
                : buildResizeRect(
                    interaction.startRect,
                    deltaX,
                    deltaY,
                    interaction.handle || 'se',
                    interaction.minWidth,
                    interaction.minHeight,
                );

            setInteractionRect(nextRect);
            return;
        }

        if (!pointerStartRef.current) return;
        const point = getPointerPosition(event);
        if (!point) return;

        const start = pointerStartRef.current;
        const x = Math.min(start.x, point.x);
        const y = Math.min(start.y, point.y);
        const width = Math.abs(point.x - start.x);
        const height = Math.abs(point.y - start.y);

        setDraftRect({ x, y, width, height });
    }, [buildMoveRect, buildResizeRect, getPointerPosition, templateHeight, templateWidth]);

    const handlePreviewPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const textInteraction = textPositionInteractionRef.current;
        if (textInteraction) {
            const finalPosition = interactionTextPosition || textInteraction.startPosition;
            const nextTextPositions = textPositions.map((item) => (
                item.id === textInteraction.textPositionId
                    ? {
                        ...item,
                        x: Math.round(finalPosition.x),
                        y: Math.round(finalPosition.y),
                    }
                    : item
            ));

            updateBannerTextPositions(nextTextPositions);
            clearTextPositionInteraction();
            releasePreviewPointerCapture(textInteraction.pointerId);
            return;
        }

        const interaction = regionInteractionRef.current;
        if (interaction) {
            const finalRect = interactionRect || interaction.startRect;
            const nextRegions = regions.map((region) => (
                region.id === interaction.regionId
                    ? {
                        ...region,
                        x: Math.round(finalRect.x),
                        y: Math.round(finalRect.y),
                        width: Math.round(finalRect.width),
                        height: Math.round(finalRect.height),
                    }
                    : region
            ));

            updateBannerRegions(nextRegions);
            clearRegionInteraction();
            releasePreviewPointerCapture(interaction.pointerId);
            return;
        }

        if (!pointerStartRef.current) return;
        const point = getPointerPosition(event);
        const start = pointerStartRef.current;

        if (!point) {
            releasePreviewPointerCapture(event.pointerId);
            clearDraftState();
            return;
        }

        const x = Math.min(start.x, point.x);
        const y = Math.min(start.y, point.y);
        const width = Math.abs(point.x - start.x);
        const height = Math.abs(point.y - start.y);
        const minWidth = (MIN_DRAW_SIZE_PX / point.boundsWidth) * templateWidth;
        const minHeight = (MIN_DRAW_SIZE_PX / point.boundsHeight) * templateHeight;

        if (width >= minWidth && height >= minHeight) {
            const newRegionId = `banner-region-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            updateBannerRegions([
                ...regions,
                {
                    id: newRegionId,
                    label: nextRegionLabel,
                    description: '',
                    x: Math.round(x),
                    y: Math.round(y),
                    width: Math.round(width),
                    height: Math.round(height),
                },
            ]);
            setActiveRegionId(newRegionId);
        }

        releasePreviewPointerCapture(event.pointerId);
        clearDraftState();
    }, [
        clearDraftState,
        clearRegionInteraction,
        clearTextPositionInteraction,
        getPointerPosition,
        interactionTextPosition,
        interactionRect,
        nextRegionLabel,
        regions,
        releasePreviewPointerCapture,
        textPositions,
        templateHeight,
        templateWidth,
        updateBannerRegions,
        updateBannerTextPositions,
    ]);

    const handlePreviewPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (textPositionInteractionRef.current) {
            releasePreviewPointerCapture(textPositionInteractionRef.current.pointerId);
        } else if (regionInteractionRef.current) {
            releasePreviewPointerCapture(regionInteractionRef.current.pointerId);
        } else {
            releasePreviewPointerCapture(event.pointerId);
        }
        clearTextPositionInteraction();
        clearRegionInteraction();
        clearDraftState();
    }, [clearDraftState, clearRegionInteraction, clearTextPositionInteraction, releasePreviewPointerCapture]);

    const handleRegionDescriptionChange = useCallback((regionId: string, description: string) => {
        const nextRegions = regions.map((region) => (
            region.id === regionId
                ? { ...region, description }
                : region
        ));
        updateBannerRegions(nextRegions);
    }, [regions, updateBannerRegions]);

    const handleRemoveRegion = useCallback((regionId: string) => {
        const nextRegions = regions.filter((region) => region.id !== regionId);
        updateBannerRegions(nextRegions);
        if (activeRegionId === regionId) {
            setActiveRegionId(null);
        }
    }, [activeRegionId, regions, updateBannerRegions]);

    const handleClearRegions = useCallback(() => {
        if (regions.length === 0) return;
        updateBannerRegions([]);
        setActiveRegionId(null);
        clearRegionInteraction();
    }, [clearRegionInteraction, regions.length, updateBannerRegions]);

    const handleTextPositionTypeChange = useCallback((textPositionId: string, type: BannerTextPositionType) => {
        const nextTextPositions = textPositions.map((item) => (
            item.id === textPositionId
                ? { ...item, type }
                : item
        ));
        updateBannerTextPositions(nextTextPositions);
    }, [textPositions, updateBannerTextPositions]);

    const handleTextPositionNoteChange = useCallback((textPositionId: string, note: string) => {
        const nextTextPositions = textPositions.map((item) => (
            item.id === textPositionId
                ? { ...item, note }
                : item
        ));
        updateBannerTextPositions(nextTextPositions);
    }, [textPositions, updateBannerTextPositions]);

    const handleRemoveTextPosition = useCallback((textPositionId: string) => {
        const nextTextPositions = textPositions.filter((item) => item.id !== textPositionId);
        updateBannerTextPositions(nextTextPositions);
        if (activeTextPositionId === textPositionId) {
            setActiveTextPositionId(null);
            clearTextPositionInteraction();
        }
    }, [activeTextPositionId, clearTextPositionInteraction, textPositions, updateBannerTextPositions]);

    const handleClearTextPositions = useCallback(() => {
        if (textPositions.length === 0) return;
        updateBannerTextPositions([]);
        setActiveTextPositionId(null);
        clearTextPositionInteraction();
    }, [clearTextPositionInteraction, textPositions.length, updateBannerTextPositions]);

    const toggleTextPositionMode = useCallback(() => {
        setIsTextPositionMode((prev) => {
            const next = !prev;
            if (next) {
                setActiveRegionId(null);
                clearDraftState();
                clearRegionInteraction();
            } else {
                clearTextPositionInteraction();
            }
            return next;
        });
    }, [clearDraftState, clearRegionInteraction, clearTextPositionInteraction]);

    const handleSwitchTemplate = useCallback((templateId: string) => {
        if (templateId === activeTemplateId) return;
        setIsTextPositionMode(false);
        setActiveRegionId(null);
        setActiveTextPositionId(null);
        setActivePreviewResultId(null);
        latestAutoPreviewIdRef.current = null;
        clearDraftState();
        clearRegionInteraction();
        clearTextPositionInteraction();
        initBannerData(templateId);
    }, [activeTemplateId, clearDraftState, clearRegionInteraction, clearTextPositionInteraction, initBannerData]);

    const handleGenerateClick = useCallback(async () => {
        if (isGenerating || isPreparingBannerGuideImage) return;
        setPreviewSweepKey((prev) => prev + 1);
        setIsPreparingBannerGuideImage(true);
        const annotatedSourceUrl = await createAnnotatedBannerGuideImage();
        setIsPreparingBannerGuideImage(false);
        onGenerate(annotatedSourceUrl ? { sourceImageUrls: [annotatedSourceUrl] } : undefined);
    }, [createAnnotatedBannerGuideImage, isGenerating, isPreparingBannerGuideImage, onGenerate]);

    const shouldShowPreviewSweep = isGenerating || isPreparingBannerGuideImage || previewSweepKey > 0;
    const previewSweepAnimation = (isGenerating || isPreparingBannerGuideImage)
        ? 'banner-preview-sweep 950ms cubic-bezier(0.22, 1, 0.36, 1) infinite'
        : 'banner-preview-sweep 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards';

    const handlePreviewSweepAnimationEnd = useCallback(() => {
        if (!isGenerating && !isPreparingBannerGuideImage) {
            setPreviewSweepKey(0);
        }
    }, [isGenerating, isPreparingBannerGuideImage]);

    if (!activeBannerData || !template) {
        return null;
    }

    const renderPositionItem = (p: BannerTextPositionInstruction) => (
        <div key={p.id} className="flex items-center gap-2 bg-black/20 rounded-lg p-1.5 border border-white/5">
            <div className="h-6 min-w-6 px-1.5 rounded-full bg-[#9BD6FF] text-black text-[11px] font-semibold flex items-center justify-center shrink-0">
                {p.label}
            </div>
            <Select
                value={p.type}
                onValueChange={(val) => handleTextPositionTypeChange(p.id, val as BannerTextPositionType)}
            >
                <SelectTrigger className="h-7 w-[90px] bg-transparent border-none focus:ring-0 text-white text-xs px-2 shrink-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-white/20">
                    {(Object.keys(TEXT_POSITION_TYPE_LABEL_MAP) as BannerTextPositionType[]).map((t) => (
                        <SelectItem key={t} value={t} className="text-white text-xs">
                            {TEXT_POSITION_TYPE_LABEL_MAP[t]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Input
                className="h-7 bg-white/5 border-white/10 text-white text-[11px] hover:border-white/20 focus-visible:ring-0 focus-visible:border-white/30"
                placeholder="可选备注（例如：居中对齐、贴左留白）"
                value={p.note || ''}
                onChange={(e) => handleTextPositionNoteChange(p.id, e.target.value)}
            />
            <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 shrink-0"
                onClick={() => handleRemoveTextPosition(p.id)}
            >
                <Trash2 className="w-3.5 h-3.5" />
            </Button>
        </div>
    );

    const renderFieldBlock = (
        label: string,
        value: string,
        onChange: (val: string) => void,
        placeholder: string,
        type: BannerTextPositionType
    ) => {
        const typePositions = textPositions.filter(p => p.type === type);
        return (
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-white/60 flex items-center gap-2">
                        {label}
                        {typePositions.length > 0 && (
                            <div className="flex gap-1">
                                {typePositions.map(p => (
                                    <div key={p.id} className="h-4 min-w-4 px-1 rounded-full bg-[#9BD6FF] text-black text-[9px] font-semibold flex items-center justify-center" title="已在左侧定位">
                                        {p.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </label>
                </div>
                <Input
                    className="bg-white/5 border-white/15 text-white"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
                {typePositions.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                        {typePositions.map(renderPositionItem)}
                    </div>
                )}
            </div>
        );
    };

    const customPositions = textPositions.filter(p => p.type === 'custom');

    return (
        <div className="w-full h-full overflow-y-auto pl-20 md:pl-28 lg:pl-32 pr-6 pb-6">
            <div className="w-full max-w-[1320px] mx-auto pt-10">
                <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1.35fr)_420px] gap-5">
                    <section className="rounded-3xl border border-white/20 bg-black/40 backdrop-blur-xl p-3 h-fit">
                        <div className="text-xs text-white/70 px-1 pb-2">Banner Templates</div>
                        <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                            {BANNER_TEMPLATES.map((item) => {
                                const isActiveTemplate = item.id === activeBannerData.templateId;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={cn(
                                            "w-full rounded-2xl border p-2 text-left transition-all",
                                            isActiveTemplate
                                                ? "border-[#E6FFD1] bg-[#E6FFD1]/10 shadow-[0_0_0_1px_rgba(230,255,209,0.25)]"
                                                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]"
                                        )}
                                        onClick={() => handleSwitchTemplate(item.id)}
                                    >
                                        <div
                                            className="relative w-full rounded-xl overflow-hidden border border-white/10"
                                            style={{ aspectRatio: `${item.width}/${item.height}` }}
                                        >
                                            <Image
                                                src={item.thumbnailUrl}
                                                alt={item.name}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                        <div className={cn(
                                            "text-xs mt-2 truncate",
                                            isActiveTemplate ? "text-white" : "text-white/70"
                                        )}>
                                            {item.name}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/20 bg-black/40 backdrop-blur-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-medium text-white">Template Preview</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-white/60">
                                    固定尺寸 {template.width} x {template.height}
                                </span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className={cn(
                                        "h-8 rounded-xl text-white",
                                        isTextPositionMode
                                            ? "bg-[#9BD6FF] text-black hover:bg-[#8cc8f1]"
                                            : "bg-white/15 hover:bg-white/20"
                                    )}
                                    onClick={toggleTextPositionMode}
                                >
                                    <MapPin className="w-3.5 h-3.5 mr-1.5" />
                                    {isTextPositionMode ? '结束定位' : '文字定位'}
                                </Button>
                                {activePreviewHistoryItem && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-white/20 text-white hover:bg-white/10"
                                        onClick={() => setActivePreviewResultId(TEMPLATE_BASE_PREVIEW_ID)}
                                    >
                                        返回原始模版
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div
                            ref={previewRef}
                            className={cn(
                                "relative w-full overflow-hidden rounded-2xl border border-white/15 bg-black/30",
                                "cursor-crosshair select-none"
                            )}
                            style={{ aspectRatio: `${template.width}/${template.height}` }}
                            onDragStart={(event) => event.preventDefault()}
                            onPointerDown={handlePreviewPointerDown}
                            onPointerMove={handlePreviewPointerMove}
                            onPointerUp={handlePreviewPointerUp}
                            onPointerCancel={handlePreviewPointerCancel}
                        >
                            <Image
                                src={previewImageSrc || template.baseImageUrl}
                                alt={activePreviewHistoryItem ? `${template.name} - 生成结果` : template.name}
                                fill
                                className="object-cover pointer-events-none select-none"
                                draggable={false}
                                unoptimized
                            />
                            {shouldShowPreviewSweep && (
                                <div
                                    key={previewSweepKey}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/65 to-transparent mix-blend-screen"
                                    style={{ animation: previewSweepAnimation }}
                                    onAnimationEnd={handlePreviewSweepAnimationEnd}
                                />
                            )}
                            {textPositions.map((textPosition) => {
                                if (typeof textPosition.x !== 'number' || typeof textPosition.y !== 'number') return null;
                                const isActiveTextPosition = activeTextPositionId === textPosition.id;
                                const displayX = isActiveTextPosition && interactionTextPosition
                                    ? interactionTextPosition.x
                                    : textPosition.x;
                                const displayY = isActiveTextPosition && interactionTextPosition
                                    ? interactionTextPosition.y
                                    : textPosition.y;

                                return (
                                    <button
                                        key={textPosition.id}
                                        type="button"
                                        className={cn(
                                            "absolute z-20 -translate-x-1/2 -translate-y-1/2 h-7 min-w-7 px-2 rounded-full border font-semibold text-[11px] shadow transition",
                                            isActiveTextPosition
                                                ? "border-[#9BD6FF] bg-[#9BD6FF] text-black"
                                                : "border-[#8DCBFF]/80 bg-[#1D2A3A]/90 text-[#CFEAFF]",
                                            isTextPositionMode ? "pointer-events-none opacity-80" : "pointer-events-auto hover:border-[#B9E2FF]"
                                        )}
                                        style={{
                                            left: `${(displayX / template.width) * 100}%`,
                                            top: `${(displayY / template.height) * 100}%`,
                                        }}
                                        title={`${textPosition.label} - ${TEXT_POSITION_TYPE_LABEL_MAP[textPosition.type]}`}
                                        onPointerDown={(event) => startTextPositionInteraction(event, textPosition.id)}
                                    >
                                        {textPosition.label}
                                    </button>
                                );
                            })}
                            {regions.map((region) => {
                                const hasBounds = typeof region.x === 'number'
                                    && typeof region.y === 'number'
                                    && typeof region.width === 'number'
                                    && typeof region.height === 'number';

                                if (!hasBounds) return null;

                                const isActive = activeRegionId === region.id;
                                const displayRect = isActive && interactionRect ? interactionRect : region;

                                return (
                                    <div
                                        key={region.id}
                                        className={cn(
                                            "absolute border-2 bg-red-500/0",
                                            isTextPositionMode ? "pointer-events-none border-red-500/90" : "pointer-events-auto border-red-400/90"
                                        )}
                                        style={{
                                            left: `${((displayRect.x || 0) / template.width) * 100}%`,
                                            top: `${((displayRect.y || 0) / template.height) * 100}%`,
                                            width: `${((displayRect.width || 0) / template.width) * 100}%`,
                                            height: `${((displayRect.height || 0) / template.height) * 100}%`,
                                        }}
                                        onPointerDown={(event) => startRegionInteraction(event, region.id, 'move')}
                                    >
                                        <span className="absolute -top-5 left-0 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">
                                            {region.label}
                                        </span>
                                        {!isTextPositionMode && RESIZE_HANDLE_DEFS.map(({ handle, className }) => (
                                            <button
                                                key={`${region.id}-${handle}`}
                                                type="button"
                                                className={cn(
                                                    "absolute z-10 w-3.5 h-3.5 rounded-full bg-white border border-red-400/90 shadow",
                                                    className
                                                )}
                                                onPointerDown={(event) => startRegionInteraction(event, region.id, 'resize', handle)}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                            {draftRect && (
                                <div
                                    className="pointer-events-none absolute border-2 border-dashed border-[#E6FFD1] bg-[#E6FFD1]/10"
                                    style={{
                                        left: `${(draftRect.x / template.width) * 100}%`,
                                        top: `${(draftRect.y / template.height) * 100}%`,
                                        width: `${(draftRect.width / template.width) * 100}%`,
                                        height: `${(draftRect.height / template.height) * 100}%`,
                                    }}
                                >
                                    <span className="absolute -top-5 left-0 text-[10px] bg-[#E6FFD1] text-black px-1.5 py-0.5 rounded-sm">
                                        {nextRegionLabel}
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/20 bg-black/40 backdrop-blur-xl p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">图文内容</span>
                            {textPositions.length > 0 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 rounded-xl text-[#CFEAFF] hover:text-white hover:bg-white/10"
                                    onClick={handleClearTextPositions}
                                >
                                    清空定位
                                </Button>
                            )}
                        </div>

                        {renderFieldBlock('主标题', activeBannerData.fields.mainTitle, (val) => updateBannerFields({ mainTitle: val }), '输入主标题', 'mainTitle')}
                        {renderFieldBlock('副标题', activeBannerData.fields.subTitle, (val) => updateBannerFields({ subTitle: val }), '输入副标题', 'subTitle')}
                        {renderFieldBlock('时间', activeBannerData.fields.timeText, (val) => updateBannerFields({ timeText: val }), '输入时间文案', 'timeText')}

                        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                            <label className="text-xs text-white/60">补充描述</label>
                            <Textarea
                                className="bg-white/5 border-white/15 text-white min-h-[72px]"
                                value={activeBannerData.fields.extraDesc}
                                onChange={(event) => updateBannerFields({ extraDesc: event.target.value })}
                                placeholder="描述材质、颜色、风格等补充要求"
                            />
                        </div>

                        {customPositions.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                                <label className="text-xs text-white/60">自定义文字定位</label>
                                <div className="flex flex-col gap-2 mt-1">
                                    {customPositions.map(renderPositionItem)}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs text-white/60">模型</label>
                            <Select
                                value={activeBannerData.model}
                                onValueChange={(value) => setBannerModel(value as BannerModelId)}
                            >
                                <SelectTrigger className="bg-white/5 border-white/15 text-white">
                                    <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent className="bg-black/90 border-white/20">
                                    {BANNER_ALLOWED_MODELS.map((modelId) => (
                                        <SelectItem key={modelId} value={modelId} className="text-white">
                                            {MODEL_LABEL_MAP[modelId]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-white/60">区域标注</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
                                    onClick={handleClearRegions}
                                    disabled={regions.length === 0}
                                >
                                    清空
                                </Button>
                            </div>
                            <div className="text-[11px] text-white/45 mb-2">
                                在左侧预览图直接拖拽即可框选，拖动框体可移动，拖动四角可调整大小。
                            </div>
                            <div className={cn("space-y-2", regions.length === 0 && "text-white/40 text-xs")}>
                                {regions.length === 0 && <div>暂无区域，请先框选。</div>}
                                {regions.map((region) => (
                                    <div key={region.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="text-xs text-white/70">[{region.label}]</span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                                                onClick={() => handleRemoveRegion(region.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <Textarea
                                            className="bg-white/5 border-white/15 text-white min-h-[72px]"
                                            placeholder={`描述 ${region.label} 需要修改的内容`}
                                            value={region.description}
                                            onChange={(event) => handleRegionDescriptionChange(region.id, event.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <label className="text-xs text-white/60">最终 Prompt</label>
                            <Textarea
                                className="bg-white/5 border-white/15 text-white min-h-[160px]"
                                value={activeBannerData.promptFinal}
                                onChange={(event) => updateBannerPromptFinal(event.target.value)}
                                placeholder="可手动编辑最终 Prompt"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <Button
                                variant="outline"
                                className="border-white/20 text-white hover:bg-white/10"
                                onClick={resetBannerPromptFinal}
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                重置模板 Prompt
                            </Button>
                            <Button
                                className="bg-[#E6FFD1] text-black hover:bg-[#dcf6c8] rounded-2xl px-8"
                                onClick={handleGenerateClick}
                                disabled={isGenerating || isPreparingBannerGuideImage}
                            >
                                {isPreparingBannerGuideImage ? '准备标注图...' : (isGenerating ? '生成中...' : 'Generate')}
                            </Button>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/20 bg-black/40 backdrop-blur-xl p-4 xl:col-start-2 xl:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-white">本次生成缩略图</h3>
                            <span className="text-[11px] text-white/60">{templateHistory.length} 张</span>
                        </div>
                        {templateHistory.length === 0 ? (
                            <div className="h-24 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center px-4 text-xs text-white/45">
                                当前模版还没有生成记录，点击 Generate 后会在这里展示缩略图。
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 overflow-x-auto pb-1">
                                {templateHistory.map((item) => {
                                    const isActive = item.id === activePreviewResultId;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={cn(
                                                "group shrink-0 w-[120px] rounded-xl border p-1.5 text-left transition-all",
                                                isActive
                                                    ? "border-[#E6FFD1] bg-[#E6FFD1]/10"
                                                    : "border-white/15 bg-white/[0.03] hover:bg-white/[0.08]"
                                            )}
                                            onClick={() => setActivePreviewResultId(item.id)}
                                        >
                                            <div
                                                className="relative w-full overflow-hidden rounded-lg border border-white/10"
                                                style={{ aspectRatio: `${template.width}/${template.height}` }}
                                            >
                                                <Image
                                                    src={formatImageUrl(item.outputUrl)}
                                                    alt="Banner 生成缩略图"
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            </div>
                                            <div className="mt-1 text-[10px] text-white/70 truncate">
                                                {new Date(item.createdAt).toLocaleTimeString()}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </div>
            <style jsx global>{bannerPreviewSweepStyle}</style>
        </div>
    );
}

// Sweep highlight shown on generate click, as visual loading feedback.
const bannerPreviewSweepStyle = `
@keyframes banner-preview-sweep {
    0% {
        transform: translateX(-130%);
        opacity: 0;
    }
    18% {
        opacity: 1;
    }
    100% {
        transform: translateX(430%);
        opacity: 0;
    }
}
`;

export default BannerModePanel;
