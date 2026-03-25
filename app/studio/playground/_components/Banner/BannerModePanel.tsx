"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/common/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import {
    createBannerTemplateDraft,
    DEFAULT_BANNER_TEMPLATE_ID,
    deleteCustomBannerTemplate,
    getBannerTemplates,
    getBannerTemplateById,
    isBuiltinBannerTemplate,
    upsertCustomBannerTemplate,
} from '@/config/banner-templates';
import type {
    BannerModelId,
    BannerRegionInstruction,
    BannerTemplateConfig,
} from '@/lib/playground/types';
import {
    BANNER_REGION_LABEL_CONFIG,
    clearBannerTemplatePresetRegions,
    extractBannerRegionTargetText,
    isBannerTextRegion,
    saveBannerTemplatePresetRegions,
} from '@/lib/prompt/banner-prompt';
import { cn } from '@/lib/utils';
import { formatAnnotationLabel, parseAnnotationLabelIndex } from '@/lib/utils/annotation-label';
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatImageUrl, getApiBase } from '@/lib/api-base';
import { useAPIConfigStore } from '@/lib/store/api-config-store';
import { getContextModelOptions } from '@/lib/model-center-ui';

const MODEL_LABEL_MAP: Record<string, string> = {
    flux_klein: 'FluxKlein',
    'gemini-2.5-flash-image': 'Nano banana',
    'gemini-3-pro-image-preview': 'Nano banana pro',
    'gemini-3.1-flash-image-preview': 'Nano banana 2',
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

const MIN_DRAW_SIZE_PX = 12;
const RESIZE_HANDLE_DEFS: Array<{ handle: ResizeHandle; className: string }> = [
    { handle: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { handle: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { handle: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
    { handle: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const TEMPLATE_BASE_PREVIEW_ID = '__template_base__';

const parseTemplateTagsInput = (raw: string): string[] => {
    const parts = raw.split(/[，,]/).map((part) => part.trim()).filter(Boolean);
    return Array.from(new Set(parts)).slice(0, 10);
};

const resolveRegionDisplayName = (region: BannerRegionInstruction, fallbackIndex: number): string => {
    return (region.name || (region.role === 'mainTitle'
        ? '主标题'
        : (region.role === 'subTitle' ? '副标题' : (region.role === 'timeText' ? '时间' : `文字${fallbackIndex}`)))).trim();
};

export function BannerModePanel({ isGenerating, onGenerate, sessionHistory }: BannerModePanelProps) {
    const { toast } = useToast();
    const providers = useAPIConfigStore((state) => state.providers);
    const activeBannerData = usePlaygroundStore((state) => state.activeBannerData);
    const initBannerData = usePlaygroundStore((state) => state.initBannerData);
    const updateBannerFields = usePlaygroundStore((state) => state.updateBannerFields);
    const updateBannerRegions = usePlaygroundStore((state) => state.updateBannerRegions);
    const updateBannerPromptFinal = usePlaygroundStore((state) => state.updateBannerPromptFinal);
    const resetBannerPromptFinal = usePlaygroundStore((state) => state.resetBannerPromptFinal);
    const setBannerModel = usePlaygroundStore((state) => state.setBannerModel);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const regionInteractionRef = useRef<RegionInteraction | null>(null);
    const [isPreparingBannerGuideImage, setIsPreparingBannerGuideImage] = useState(false);
    const [isTemplateMakerMode, setIsTemplateMakerMode] = useState(false);
    const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
    const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
    const [interactionRect, setInteractionRect] = useState<DraftRect | null>(null);
    const [activePreviewResultId, setActivePreviewResultId] = useState<string | null>(null);
    const [previewSweepKey, setPreviewSweepKey] = useState(0);
    const [templateListVersion, setTemplateListVersion] = useState(0);
    const [templateTagFilter, setTemplateTagFilter] = useState('all');
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
    const [templateEditorMode, setTemplateEditorMode] = useState<'create' | 'edit'>('create');
    const [templateDraft, setTemplateDraft] = useState<BannerTemplateConfig | null>(null);
    const [templateTagsInput, setTemplateTagsInput] = useState('');
    const latestAutoPreviewIdRef = useRef<string | null>(null);
    const bannerModelOptions = useMemo(() => {
        const options = getContextModelOptions(providers, 'banner', 'image');
        if (options.length > 0) {
            return options;
        }
        const fallbackIds = Array.from(new Set(
            getBannerTemplates().flatMap((item) => item.allowedModels || [])
        ));
        return fallbackIds.map((id) => ({ id, displayName: MODEL_LABEL_MAP[id] || id }));
    }, [providers]);
    const bannerModelIds = useMemo(
        () => bannerModelOptions.map((option) => option.id as BannerModelId),
        [bannerModelOptions]
    );
    const resolveModelLabel = useCallback(
        (modelId: string) => bannerModelOptions.find((model) => model.id === modelId)?.displayName || MODEL_LABEL_MAP[modelId] || modelId,
        [bannerModelOptions]
    );

    useEffect(() => {
        if (!activeBannerData) {
            initBannerData(DEFAULT_BANNER_TEMPLATE_ID);
        }
    }, [activeBannerData, initBannerData]);

    useEffect(() => {
        if (!activeBannerData || bannerModelIds.length === 0) return;
        if (!bannerModelIds.includes(activeBannerData.model)) {
            setBannerModel(bannerModelIds[0]);
        }
    }, [activeBannerData, bannerModelIds, setBannerModel]);

    const allTemplates = useMemo(() => {
        void templateListVersion;
        return getBannerTemplates();
    }, [templateListVersion]);

    const template = useMemo(() => {
        void templateListVersion;
        return getBannerTemplateById(activeBannerData?.templateId || DEFAULT_BANNER_TEMPLATE_ID);
    }, [activeBannerData?.templateId, templateListVersion]);
    const availableTemplateTags = useMemo(() => {
        const tags = new Set<string>();
        allTemplates.forEach((item) => {
            (item.tags || []).forEach((tag) => {
                const normalized = tag.trim();
                if (normalized) tags.add(normalized);
            });
        });
        return Array.from(tags).sort((a, b) => a.localeCompare(b));
    }, [allTemplates]);
    const filteredTemplates = useMemo(() => {
        if (templateTagFilter === 'all') return allTemplates;
        return allTemplates.filter((item) => (item.tags || []).includes(templateTagFilter));
    }, [allTemplates, templateTagFilter]);

    const templateWidth = template?.width || 1;
    const templateHeight = template?.height || 1;
    const activeTemplateId = activeBannerData?.templateId || DEFAULT_BANNER_TEMPLATE_ID;
    const regions = useMemo(() => activeBannerData?.regions || [], [activeBannerData?.regions]);
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
        if (templateTagFilter === 'all') return;
        if (availableTemplateTags.includes(templateTagFilter)) return;
        setTemplateTagFilter('all');
    }, [availableTemplateTags, templateTagFilter]);

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
    }, [loadImageElement, regions, template]);

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

    const handlePreviewPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const point = getPointerPosition(event);
        if (!point) return;

        pointerStartRef.current = { x: point.x, y: point.y };
        setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
        ensurePreviewPointerCapture(event.pointerId);
    }, [ensurePreviewPointerCapture, getPointerPosition]);

    const handlePreviewPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
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
    }, [buildMoveRect, buildResizeRect, getPointerPosition]);

    const handlePreviewPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
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
                    role: 'custom',
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
        getPointerPosition,
        interactionRect,
        nextRegionLabel,
        regions,
        releasePreviewPointerCapture,
        templateHeight,
        templateWidth,
        updateBannerRegions,
    ]);

    const handlePreviewPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (regionInteractionRef.current) {
            releasePreviewPointerCapture(regionInteractionRef.current.pointerId);
        } else {
            releasePreviewPointerCapture(event.pointerId);
        }
        clearRegionInteraction();
        clearDraftState();
    }, [clearDraftState, clearRegionInteraction, releasePreviewPointerCapture]);

    const handleRegionDescriptionChange = useCallback((regionId: string, description: string) => {
        const targetRegion = regions.find((region) => region.id === regionId);
        if (!targetRegion) return;

        const isTextMode = isBannerTextRegion(targetRegion);
        const targetContent = extractBannerRegionTargetText(description);
        const regionIndex = parseAnnotationLabelIndex(targetRegion.label || '', BANNER_REGION_LABEL_CONFIG) || 1;
        const regionName = (targetRegion.name || (targetRegion.role === 'mainTitle'
            ? '主标题'
            : (targetRegion.role === 'subTitle' ? '副标题' : (targetRegion.role === 'timeText' ? '时间' : '文字')))).trim() || `文字${regionIndex}`;
        const nextDescription = isTextMode
            ? `${regionName}（区域${regionIndex}）：${targetContent}`
            : description;

        const nextRegions = regions.map((region) => (
            region.id === regionId
                ? { ...region, description: nextDescription }
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

    const handleRegionModeChange = useCallback((regionId: string, mode: 'text' | 'region') => {
        const nextRegions: BannerRegionInstruction[] = regions.map((region, index) => {
            if (region.id !== regionId) return region;
            const regionIndex = parseAnnotationLabelIndex(region.label || '', BANNER_REGION_LABEL_CONFIG) || (index + 1);
            const defaultName = resolveRegionDisplayName(region, regionIndex);
            const target = extractBannerRegionTargetText(region.description) || region.sourceText || '';
            return mode === 'text'
                ? {
                    ...region,
                    mode: 'text' as const,
                    name: defaultName,
                    description: `${defaultName}（区域${regionIndex}）：${target}`,
                  }
                : {
                    ...region,
                    mode: 'region' as const,
                  };
        });
        updateBannerRegions(nextRegions);
    }, [regions, updateBannerRegions]);

    const handleRegionNameChange = useCallback((regionId: string, name: string) => {
        const nextRegions = regions.map((region, index) => {
            if (region.id !== regionId) return region;
            const regionIndex = parseAnnotationLabelIndex(region.label || '', BANNER_REGION_LABEL_CONFIG) || (index + 1);
            const nextName = (name || '').trim();
            if (!isBannerTextRegion(region)) {
                return { ...region, name: nextName };
            }
            const target = extractBannerRegionTargetText(region.description) || region.sourceText || '';
            return {
                ...region,
                name: nextName,
                description: `${nextName || `文字${regionIndex}`}（区域${regionIndex}）：${target}`,
            };
        });
        updateBannerRegions(nextRegions);
    }, [regions, updateBannerRegions]);

    const handleRegionSourceTextChange = useCallback((regionId: string, sourceText: string) => {
        const nextRegions = regions.map((region, index) => {
            if (region.id !== regionId) return region;
            const regionIndex = parseAnnotationLabelIndex(region.label || '', BANNER_REGION_LABEL_CONFIG) || (index + 1);
            const nextSource = sourceText;
            if (!isBannerTextRegion(region)) {
                return { ...region, sourceText: nextSource };
            }
            const name = (region.name || `文字${regionIndex}`).trim();
            const currentTarget = extractBannerRegionTargetText(region.description) || nextSource;
            return {
                ...region,
                sourceText: nextSource,
                description: `${name || `文字${regionIndex}`}（区域${regionIndex}）：${currentTarget}`,
            };
        });
        updateBannerRegions(nextRegions);
    }, [regions, updateBannerRegions]);

    const handleAddTemplateTextRegion = useCallback(() => {
        const nextIndex = regions.length + 1;
        const label = formatAnnotationLabel(nextIndex, BANNER_REGION_LABEL_CONFIG);
        const name = `文字${nextIndex}`;
        const newRegionId = `banner-template-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        updateBannerRegions([
            ...regions,
            {
                id: newRegionId,
                label,
                role: 'custom',
                mode: 'text',
                name,
                sourceText: '',
                description: `${name}（区域${nextIndex}）：请输入文字内容`,
                x: Math.round(templateWidth * 0.12),
                y: Math.round(templateHeight * 0.18),
                width: Math.round(templateWidth * 0.55),
                height: Math.round(templateHeight * 0.12),
            },
        ]);
    }, [regions, templateHeight, templateWidth, updateBannerRegions]);

    const handleSaveTemplatePreset = useCallback(() => {
        if (!template) {
            toast({ title: '保存失败', description: '当前模板不可用', variant: 'destructive' });
            return;
        }

        const success = saveBannerTemplatePresetRegions(template.id, regions);
        if (success) {
            toast({ title: '保存成功', description: '已保存当前模板的标注配置' });
        } else {
            toast({ title: '保存失败', description: '请检查浏览器存储权限后重试', variant: 'destructive' });
        }
    }, [regions, template, toast]);

    const handleResetTemplatePreset = useCallback(() => {
        if (!template) {
            toast({ title: '恢复失败', description: '当前模板不可用', variant: 'destructive' });
            return;
        }

        const success = clearBannerTemplatePresetRegions(template.id);
        if (!success) {
            toast({ title: '恢复失败', description: '请检查浏览器存储权限后重试', variant: 'destructive' });
            return;
        }

        initBannerData(template.id);
        toast({ title: '已恢复默认', description: '模板标注配置已恢复默认值' });
    }, [initBannerData, template, toast]);

    const touchTemplateListVersion = useCallback(() => {
        setTemplateListVersion((prev) => prev + 1);
    }, []);

    const handleSwitchTemplate = useCallback((templateId: string) => {
        if (templateId === activeTemplateId) return;
        setIsTemplateMakerMode(false);
        setIsTemplateEditorOpen(false);
        setActiveRegionId(null);
        setActivePreviewResultId(null);
        latestAutoPreviewIdRef.current = null;
        clearDraftState();
        clearRegionInteraction();
        initBannerData(templateId);
    }, [activeTemplateId, clearDraftState, clearRegionInteraction, initBannerData]);

    const handleCreateTemplate = useCallback(() => {
        const draft = createBannerTemplateDraft(template);
        setTemplateEditorMode('create');
        setTemplateDraft(draft);
        setTemplateTagsInput((draft.tags || []).join(', '));
        setIsTemplateEditorOpen(true);
    }, [template]);

    const handleEditTemplate = useCallback(() => {
        if (!template) return;

        const builtin = isBuiltinBannerTemplate(template.id);
        if (builtin) {
            const copyDraft = createBannerTemplateDraft(template);
            setTemplateEditorMode('create');
            setTemplateDraft(copyDraft);
            setTemplateTagsInput((copyDraft.tags || []).join(', '));
            setIsTemplateEditorOpen(true);
            toast({ title: '内置模板不可直接修改', description: '已按副本模式打开，保存后会生成新模板。' });
            return;
        }

        setTemplateEditorMode('edit');
        setTemplateDraft({
            ...template,
            tags: [...(template.tags || [])],
            allowedModels: [...(template.allowedModels || bannerModelIds)],
            defaultFields: {
                mainTitle: template.defaultFields.mainTitle || '',
                subTitle: template.defaultFields.subTitle || '',
                timeText: template.defaultFields.timeText || '',
                extraDesc: template.defaultFields.extraDesc || '',
            },
        });
        setTemplateTagsInput((template.tags || []).join(', '));
        setIsTemplateEditorOpen(true);
    }, [template, toast, bannerModelIds]);

    const handleDeleteTemplate = useCallback(() => {
        if (!template) return;
        if (isBuiltinBannerTemplate(template.id)) {
            toast({ title: '删除失败', description: '内置模板不允许删除', variant: 'destructive' });
            return;
        }
        const confirmed = window.confirm(`确认删除模板「${template.name}」吗？该操作不可撤销。`);
        if (!confirmed) return;

        const removed = deleteCustomBannerTemplate(template.id);
        if (!removed) {
            toast({ title: '删除失败', description: '模板不存在或存储失败', variant: 'destructive' });
            return;
        }

        clearBannerTemplatePresetRegions(template.id);
        touchTemplateListVersion();
        setIsTemplateEditorOpen(false);
        setTemplateTagFilter('all');
        initBannerData(DEFAULT_BANNER_TEMPLATE_ID);
        setActivePreviewResultId(null);
        latestAutoPreviewIdRef.current = null;
        toast({ title: '删除成功', description: '模板已删除' });
    }, [initBannerData, template, toast, touchTemplateListVersion]);

    const handleSaveTemplate = useCallback(() => {
        if (!templateDraft) return;

        const trimmedName = (templateDraft.name || '').trim();
        const trimmedBaseImageUrl = (templateDraft.baseImageUrl || '').trim();
        const width = Math.round(Number(templateDraft.width));
        const height = Math.round(Number(templateDraft.height));
        const promptTemplate = (templateDraft.promptTemplate || '').trim();

        if (!trimmedName) {
            toast({ title: '保存失败', description: '模板名称不能为空', variant: 'destructive' });
            return;
        }
        if (!trimmedBaseImageUrl) {
            toast({ title: '保存失败', description: '底图地址不能为空', variant: 'destructive' });
            return;
        }
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
            toast({ title: '保存失败', description: '宽高必须是大于 0 的数字', variant: 'destructive' });
            return;
        }
        if (!promptTemplate) {
            toast({ title: '保存失败', description: 'Prompt 模板不能为空', variant: 'destructive' });
            return;
        }

        const tags = parseTemplateTagsInput(templateTagsInput);
        const normalizedTemplate: BannerTemplateConfig = {
            ...templateDraft,
            name: trimmedName,
            tags,
            baseImageUrl: trimmedBaseImageUrl,
            thumbnailUrl: (templateDraft.thumbnailUrl || '').trim() || trimmedBaseImageUrl,
            width,
            height,
            promptTemplate,
            allowedModels: [...bannerModelIds],
            defaultFields: {
                mainTitle: templateDraft.defaultFields.mainTitle || '',
                subTitle: templateDraft.defaultFields.subTitle || '',
                timeText: templateDraft.defaultFields.timeText || '',
                extraDesc: templateDraft.defaultFields.extraDesc || '',
            },
        };

        const result = upsertCustomBannerTemplate(normalizedTemplate);
        if (!result.ok || !result.template) {
            const reason = result.error === 'builtin-template-readonly'
                ? '内置模板不允许直接覆盖，请使用副本保存'
                : '模板存储失败，请检查浏览器存储空间';
            toast({ title: '保存失败', description: reason, variant: 'destructive' });
            return;
        }

        touchTemplateListVersion();
        setTemplateDraft(result.template);
        setTemplateTagsInput((result.template.tags || []).join(', '));
        setIsTemplateEditorOpen(false);
        initBannerData(result.template.id);
        setActivePreviewResultId(null);
        latestAutoPreviewIdRef.current = null;
        toast({
            title: templateEditorMode === 'edit' ? '模板已更新' : '模板已创建',
            description: `已保存模板「${result.template.name}」`,
        });
    }, [initBannerData, templateDraft, templateEditorMode, templateTagsInput, toast, touchTemplateListVersion, bannerModelIds]);

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

    const getRegionNumber = (regionLabel: string, fallbackIndex: number): number => {
        return parseAnnotationLabelIndex(regionLabel || '', BANNER_REGION_LABEL_CONFIG) || fallbackIndex;
    };

    const getRegionTitle = (region: typeof regions[number], fallbackIndex: number): string => {
        const regionNumber = getRegionNumber(region.label, fallbackIndex);
        if (isBannerTextRegion(region)) {
            const regionName = resolveRegionDisplayName(region, regionNumber);
            return `${regionName || `文字${regionNumber}`}（区域${regionNumber}）`;
        }
        return `区域说明（区域${regionNumber}）`;
    };

    const getRegionPlaceholder = (region: typeof regions[number], fallbackIndex: number): string => {
        const regionNumber = getRegionNumber(region.label, fallbackIndex);
        if (isBannerTextRegion(region)) {
            const regionName = resolveRegionDisplayName(region, regionNumber);
            return `${regionName || `文字${regionNumber}`}（区域${regionNumber}）：请输入文字内容`;
        }
        return `描述 ${region.label} 需要修改的内容`;
    };

    return (
        <div className="w-full h-full overflow-hidden pl-[72px] md:pl-[84px] lg:pl-[100px] pr-4 pb-4 pt-4 flex flex-col">
            <div className="w-full max-w-[1440px] mx-auto flex-1 min-h-0 flex flex-col">
                <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1.2fr)_340px] gap-4 h-full min-h-0">
                    <section className="flex flex-col rounded-2xl border border-[#2e2e2e] bg-[#161616] p-3 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-1 pb-2">
                            <div className="text-xs text-white/70">Banner Templates</div>
                            <div className="text-[10px] text-white/40">{allTemplates.length} 个模板</div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl border-[#3a3a3a] bg-[#1a1a1a] text-zinc-300 hover:text-white hover:bg-[#2a2a2a]"
                                onClick={handleCreateTemplate}
                            >
                                新建
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl border-[#3a3a3a] bg-[#1a1a1a] text-zinc-300 hover:text-white hover:bg-[#2a2a2a]"
                                onClick={handleEditTemplate}
                                disabled={!template}
                            >
                                修改
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl border-red-400/40 text-red-200 hover:bg-red-500/10"
                                onClick={handleDeleteTemplate}
                                disabled={!template || isBuiltinBannerTemplate(template.id)}
                            >
                                删除
                            </Button>
                        </div>

                        <div className="mb-2">
                            <Select value={templateTagFilter} onValueChange={setTemplateTagFilter}>
                                <SelectTrigger className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50">
                                    <SelectValue placeholder="按标签筛选" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1C1C1C] border-[#2e2e2e]">
                                    <SelectItem value="all" className="text-white">全部标签</SelectItem>
                                    {availableTemplateTags.map((tag) => (
                                        <SelectItem key={tag} value={tag} className="text-white">{tag}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {isTemplateEditorOpen && templateDraft && (
                            <div className="mb-3 rounded-2xl border border-[#E6FFD1]/30 bg-[#E6FFD1]/10 p-3 space-y-2">
                                <div className="text-xs text-[#E6FFD1]">
                                    {templateEditorMode === 'edit' ? '编辑模板' : '新建模板'}
                                </div>
                                <div className="text-[10px] text-white/45 truncate" title={templateDraft.id}>
                                    ID: {templateDraft.id}
                                </div>
                                <Input
                                    className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                    value={templateDraft.name}
                                    placeholder="模板名称"
                                    onChange={(event) => setTemplateDraft((prev) => (
                                        prev ? { ...prev, name: event.target.value } : prev
                                    ))}
                                />
                                <Input
                                    className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                    value={templateTagsInput}
                                    placeholder="标签，逗号分隔，如：电商, 横版, 促销"
                                    onChange={(event) => setTemplateTagsInput(event.target.value)}
                                />
                                <Input
                                    className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                    value={templateDraft.baseImageUrl}
                                    placeholder="底图 URL 或相对路径"
                                    onChange={(event) => setTemplateDraft((prev) => (
                                        prev ? { ...prev, baseImageUrl: event.target.value } : prev
                                    ))}
                                />
                                <Input
                                    className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                    value={templateDraft.thumbnailUrl}
                                    placeholder="缩略图 URL（留空则使用底图）"
                                    onChange={(event) => setTemplateDraft((prev) => (
                                        prev ? { ...prev, thumbnailUrl: event.target.value } : prev
                                    ))}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                        value={templateDraft.width}
                                        onChange={(event) => {
                                            const width = Math.round(Number(event.target.value));
                                            setTemplateDraft((prev) => (
                                                prev ? { ...prev, width: Number.isFinite(width) && width > 0 ? width : prev.width } : prev
                                            ));
                                        }}
                                    />
                                    <Input
                                        type="number"
                                        min={1}
                                        className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                        value={templateDraft.height}
                                        onChange={(event) => {
                                            const height = Math.round(Number(event.target.value));
                                            setTemplateDraft((prev) => (
                                                prev ? { ...prev, height: Number.isFinite(height) && height > 0 ? height : prev.height } : prev
                                            ));
                                        }}
                                    />
                                </div>
                                <Select
                                    value={templateDraft.defaultModel}
                                    onValueChange={(value) => setTemplateDraft((prev) => (
                                        prev ? { ...prev, defaultModel: value as BannerModelId } : prev
                                    ))}
                                >
                                    <SelectTrigger className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50">
                                        <SelectValue placeholder="默认模型" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1C1C1C] border-[#2e2e2e]">
                                        {bannerModelIds.map((modelId) => (
                                            <SelectItem key={modelId} value={modelId} className="text-white">
                                                {resolveModelLabel(modelId)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Textarea
                                    className="bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50 min-h-[90px]"
                                    value={templateDraft.promptTemplate}
                                    placeholder="模板 Prompt（支持 {{extraDesc}} 等占位符）"
                                    onChange={(event) => setTemplateDraft((prev) => (
                                        prev ? { ...prev, promptTemplate: event.target.value } : prev
                                    ))}
                                />
                                <div className="grid grid-cols-1 gap-2">
                                    <Input
                                        className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                        value={templateDraft.defaultFields.mainTitle}
                                        placeholder="默认主标题"
                                        onChange={(event) => setTemplateDraft((prev) => (
                                            prev
                                                ? {
                                                    ...prev,
                                                    defaultFields: { ...prev.defaultFields, mainTitle: event.target.value },
                                                }
                                                : prev
                                        ))}
                                    />
                                    <Input
                                        className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                        value={templateDraft.defaultFields.subTitle}
                                        placeholder="默认副标题"
                                        onChange={(event) => setTemplateDraft((prev) => (
                                            prev
                                                ? {
                                                    ...prev,
                                                    defaultFields: { ...prev.defaultFields, subTitle: event.target.value },
                                                }
                                                : prev
                                        ))}
                                    />
                                    <Input
                                        className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                        value={templateDraft.defaultFields.timeText}
                                        placeholder="默认时间"
                                        onChange={(event) => setTemplateDraft((prev) => (
                                            prev
                                                ? {
                                                    ...prev,
                                                    defaultFields: { ...prev.defaultFields, timeText: event.target.value },
                                                }
                                                : prev
                                        ))}
                                    />
                                    <Textarea
                                        className="bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50 min-h-[50px]"
                                        value={templateDraft.defaultFields.extraDesc}
                                        placeholder="默认补充描述"
                                        onChange={(event) => setTemplateDraft((prev) => (
                                            prev
                                                ? {
                                                    ...prev,
                                                    defaultFields: { ...prev.defaultFields, extraDesc: event.target.value },
                                                }
                                                : prev
                                        ))}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-white/30 text-white hover:bg-white/10"
                                        onClick={() => setIsTemplateEditorOpen(false)}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-8 rounded-xl bg-[#E6FFD1] text-black hover:bg-[#dff7cb]"
                                        onClick={handleSaveTemplate}
                                    >
                                        保存模板
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2 mt-2">
                            {filteredTemplates.length === 0 && (
                                <div className="rounded-xl border border-[#2e2e2e] bg-[#161616] p-3 text-xs text-white/45">
                                    当前标签下没有模板。
                                </div>
                            )}
                            {filteredTemplates.map((item) => {
                                const isActiveTemplate = item.id === activeBannerData.templateId;
                                const isBuiltin = isBuiltinBannerTemplate(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={cn(
                                            "w-full rounded-2xl border p-2 text-left transition-all",
                                            isActiveTemplate
                                                ? "border-teal-500 bg-teal-500/10 ring-1 ring-teal-500/50"
                                                : "border-[#2e2e2e] bg-[#1a1a1a] hover:bg-[#222]"
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
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <div className={cn(
                                                "text-xs truncate",
                                                isActiveTemplate ? "text-white" : "text-white/70"
                                            )}>
                                                {item.name}
                                            </div>
                                            <span className={cn(
                                                "text-[10px] px-1.5 py-0.5 rounded border",
                                                isBuiltin
                                                    ? "border-white/25 text-zinc-400"
                                                    : "border-teal-500/40 text-teal-500"
                                            )}>
                                                {isBuiltin ? '内置' : '自定义'}
                                            </span>
                                        </div>
                                        {(item.tags || []).length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {(item.tags || []).slice(0, 3).map((tag) => (
                                                    <span
                                                        key={`${item.id}-${tag}`}
                                                        className="text-[10px] text-white/70 border border-white/15 rounded-full px-2 py-0.5 bg-white/[0.03]"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <div className="flex flex-col gap-4 overflow-hidden min-h-0">
                        <section className="flex-1 rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-3 flex flex-col min-h-0 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-medium text-white">Template Preview</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-zinc-400">
                                    固定尺寸 {template.width} x {template.height}
                                </span>
                                {activePreviewHistoryItem && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-[#3a3a3a] bg-[#1a1a1a] text-zinc-300 hover:text-white hover:bg-[#2a2a2a]"
                                        onClick={() => setActivePreviewResultId(TEMPLATE_BASE_PREVIEW_ID)}
                                    >
                                        返回原始模版
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 relative w-full overflow-hidden rounded-xl border border-[#2e2e2e] bg-[#0e0e0e] shadow-inner mt-2 flex items-center justify-center">
                            <div
                                ref={previewRef}
                                className={cn(
                                    "relative overflow-hidden shadow-sm",
                                    "cursor-crosshair select-none"
                                )}
                                style={{ 
                                    aspectRatio: `${template.width}/${template.height}`,
                                    height: '100%',
                                    width: 'auto',
                                    maxHeight: '100%',
                                    maxWidth: '100%',
                                }}
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
                                        className="absolute border-2 bg-red-500/0 pointer-events-auto border-red-400/90"
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
                                        {RESIZE_HANDLE_DEFS.map(({ handle, className }) => (
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

                        </div>
                    </section>

                    <section className="shrink-0 rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-3 shadow-sm h-[120px] flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-white">本次生成缩略图</h3>
                            <span className="text-[11px] text-zinc-400">{templateHistory.length} 张</span>
                        </div>
                        {templateHistory.length === 0 ? (
                            <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center px-4 text-xs text-white/45">
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

                    <section className="flex flex-col rounded-2xl border border-[#2e2e2e] bg-[#1C1C1C] overflow-hidden shadow-sm">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">内容设置</span>
                            <Button
                                size="sm"
                                variant="secondary"
                                className={cn(
                                    "h-8 rounded-xl",
                                    isTemplateMakerMode
                                        ? "bg-[#E6FFD1] text-black hover:bg-[#dff7cb]"
                                        : "bg-white/15 text-white hover:bg-white/25"
                                )}
                                onClick={() => setIsTemplateMakerMode((prev) => !prev)}
                            >
                                {isTemplateMakerMode ? '退出模板制作' : '模板制作模式'}
                            </Button>
                        </div>

                        {isTemplateMakerMode && (
                            <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[#E6FFD1]/40 bg-[#E6FFD1]/10 p-3">
                                <div className="text-[11px] text-[#E6FFD1]">
                                    可在此模式下定义当前模板的默认标注数量、名称与位置，保存后下次进入该模板自动加载。
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 rounded-xl text-white hover:bg-white/10"
                                        onClick={handleAddTemplateTextRegion}
                                    >
                                        新增文字标注
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-8 rounded-xl bg-[#E6FFD1] text-black hover:bg-[#dff7cb]"
                                        onClick={handleSaveTemplatePreset}
                                    >
                                        保存为模板默认
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-white/30 text-white hover:bg-white/10"
                                        onClick={handleResetTemplatePreset}
                                    >
                                        恢复模板默认
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[#2e2e2e] bg-[#161616] p-3">
                            <label className="text-xs text-zinc-400">补充描述</label>
                            <Textarea
                                className="bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50 min-h-[50px]"
                                value={activeBannerData.fields.extraDesc}
                                onChange={(event) => updateBannerFields({ extraDesc: event.target.value })}
                                placeholder="描述材质、颜色、风格等补充要求"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-zinc-400">模型</label>
                            <Select
                                value={activeBannerData.model}
                                onValueChange={(value) => setBannerModel(value as BannerModelId)}
                            >
                                <SelectTrigger className="bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50">
                                    <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1C1C1C] border-[#2e2e2e]">
                                    {bannerModelIds.map((modelId) => (
                                        <SelectItem key={modelId} value={modelId} className="text-white">
                                            {resolveModelLabel(modelId)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-zinc-400">区域标注</span>
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
                                用左侧红色标注框框定文字或局部修改区域。拖动框体可移动，拖动四角可调整大小。
                            </div>
                            <div className={cn("space-y-2", regions.length === 0 && "text-white/40 text-xs")}>
                                {regions.length === 0 && <div>暂无区域，请先框选。</div>}
                                {regions.map((region, index) => (
                                    <div key={region.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="text-xs text-white/70">{getRegionTitle(region, index + 1)}</span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10"
                                                onClick={() => handleRemoveRegion(region.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        {isTemplateMakerMode && (
                                            <div className="mb-2 grid grid-cols-1 gap-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Select
                                                        value={isBannerTextRegion(region) ? 'text' : 'region'}
                                                        onValueChange={(value) => handleRegionModeChange(region.id, value as 'text' | 'region')}
                                                    >
                                                        <SelectTrigger className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-[#1C1C1C] border-[#2e2e2e]">
                                                            <SelectItem value="text" className="text-white">文字标注</SelectItem>
                                                            <SelectItem value="region" className="text-white">区域标注</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                                        value={region.name || ''}
                                                        placeholder="标注名称"
                                                        onChange={(event) => handleRegionNameChange(region.id, event.target.value)}
                                                    />
                                                </div>
                                                {isBannerTextRegion(region) && (
                                                    <Input
                                                        className="h-8 bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                                                        value={region.sourceText || ''}
                                                        placeholder="原始文字（用于“修改前”）"
                                                        onChange={(event) => handleRegionSourceTextChange(region.id, event.target.value)}
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <Textarea
                                            className="bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50 min-h-[50px]"
                                            placeholder={getRegionPlaceholder(region, index + 1)}
                                            value={region.description}
                                            onChange={(event) => handleRegionDescriptionChange(region.id, event.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <label className="text-xs text-zinc-400">最终 Prompt</label>
                            <Textarea
                                className="bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50 min-h-[100px]"
                                value={activeBannerData.promptFinal}
                                onChange={(event) => updateBannerPromptFinal(event.target.value)}
                                placeholder="可手动编辑最终 Prompt"
                            />
                        </div>

                        </div>
                    <div className="shrink-0 p-4 border-t border-[#2e2e2e] bg-[#161616] flex flex-col gap-3">
                        <Button className="w-full h-[42px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm font-semibold transition-colors border-0" onClick={handleGenerateClick} disabled={isGenerating || isPreparingBannerGuideImage}>
                            {isPreparingBannerGuideImage || isGenerating ? 'Thinking...' : 'Generate Banner'}
                        </Button>
                        <Button variant="outline" className="w-full h-8 rounded-lg border-transparent text-zinc-400 hover:text-white hover:bg-[#2a2a2a] text-xs" onClick={resetBannerPromptFinal}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> 重置模板 Prompt
                        </Button>
                    </div>
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
