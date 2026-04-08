import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ToolComponentProps } from '../tool-configs';
import { GridParams, PixelShape, ScaleMode, MediaType } from '@/pixelGRID/types';

// Dynamic import of MediaCanvas (similar to SpiralToolAdapter strategy)
// Assuming pixelGRID/MediaCanvas is a client component or relies on browser APIs (canvas, video, etc.)
const MediaCanvas = dynamic(() => import('@/pixelGRID/MediaCanvas'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-red-500 animate-spin" />
                <span className="text-xs text-zinc-500 font-mono tracking-widest uppercase">Initializing Grid...</span>
            </div>
        </div>
    )
});

const PixelGridAdapter: React.FC<ToolComponentProps> = (props) => {
    // 1. Map ToolComponentProps (flat key-value from ToolsView) to GridParams
    const params: GridParams = useMemo(() => {
        // PixelShape mapping: 0 -> SQUARE, 1 -> CIRCLE, 2 -> TRIANGLE
        let shape = PixelShape.SQUARE;
        if (Number(props.pixelShape) === 1) shape = PixelShape.CIRCLE;
        if (Number(props.pixelShape) === 2) shape = PixelShape.TRIANGLE;

        // ScaleMode mapping: 0 -> FIT, 1 -> FILL
        let scaleMode = ScaleMode.FIT;
        if (Number(props.imageScaleMode) === 1) scaleMode = ScaleMode.FILL;

        return {
            masterSpeed: Number(props.masterSpeed) || 1.0,
            gridDensity: Number(props.gridDensity) || 80,
            clusterThreshold: Number(props.clusterThreshold) || 0.5,
            sizeScale: Number(props.sizeScale) || 1.0,
            minPixelFilter: Number(props.minPixelFilter) || 0.1,
            rotationChaos: Number(props.rotationChaos) || 0.0,
            redNoiseIntensity: Number(props.redNoiseIntensity) || 0.0,
            pixelShape: shape,
            imageScaleMode: scaleMode,
            // These might not be exposed in tool-configs yet, but required by GridParams
            // Providing defaults or mapping if added later
            colorPalette: [],
            backgroundColor: '#000000',
        };
    }, [
        props.masterSpeed,
        props.gridDensity,
        props.clusterThreshold,
        props.sizeScale,
        props.minPixelFilter,
        props.rotationChaos,
        props.redNoiseIntensity,
        props.pixelShape,
        props.imageScaleMode
    ]);

    // 2. Determine Media Type and URL
    const mediaUrl = props.mediaUrl as string | undefined;

    // Auto-detect type based on extension if possible, or fallback
    // Since we only have 'image' type in tool-configs, we assume it's mostly images, 
    // but if the user uploads a video / selects a video url, we might want to support it.
    // For now, let's just check extension strictly.
    const mediaType = useMemo(() => {
        if (!mediaUrl) return MediaType.IMAGE;
        const lower = mediaUrl.toLowerCase();
        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
            return MediaType.VIDEO;
        }
        return MediaType.IMAGE;
    }, [mediaUrl]);

    if (!mediaUrl) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">No Signal Input</h3>
                <p className="text-xs text-white/20 mt-2 max-w-xs">Select or upload a media source from the parameters panel to initialize the grid system.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black">
            <MediaCanvas
                mediaUrl={mediaUrl}
                mediaType={mediaType}
                params={params}
                renderWidth={props.renderWidth}
                renderHeight={props.renderHeight}
            />
        </div>
    );
};

export default PixelGridAdapter;
