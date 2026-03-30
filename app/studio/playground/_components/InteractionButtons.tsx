'use client';

import React, { useState, useCallback } from 'react';
import { Heart, BookmarkPlus, Download, Pencil } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { InteractionStats, ViewerState } from '@/types/database';
import { likeGeneration, formatInteractionCount, formatLastTime } from '@/lib/interaction-tracking';

interface InteractionButtonsProps {
  generationId: string;
  interactionStats?: InteractionStats;
  viewerState?: ViewerState;
  onInteractionUpdate?: (stats: InteractionStats, state: ViewerState) => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onAddToMoodboard?: () => void;
}

export function InteractionButtons({
  generationId,
  interactionStats,
  viewerState,
  onInteractionUpdate,
}: InteractionButtonsProps) {
  const [isLiking, setIsLiking] = useState(false);
  const [localStats, setLocalStats] = useState(interactionStats);
  const [localViewerState, setLocalViewerState] = useState(viewerState);

  const stats = localStats || interactionStats || {
    likeCount: 0,
    moodboardAddCount: 0,
    downloadCount: 0,
    editCount: 0,
  };
  const viewer = localViewerState || viewerState || { hasLiked: false };

  const handleLike = useCallback(async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      const result = await likeGeneration(generationId);
      if (result.success && result.interactionStats && result.viewerState) {
        setLocalStats(result.interactionStats);
        setLocalViewerState(result.viewerState);
        onInteractionUpdate?.(result.interactionStats, result.viewerState);
      }
    } catch (error) {
      console.error('Failed to like:', error);
    } finally {
      setIsLiking(false);
    }
  }, [generationId, isLiking, onInteractionUpdate]);

  return (
    <div className="flex items-center gap-1">
      {/* Like Button */}
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-3 rounded-xl transition-all gap-1.5 ${
          viewer.hasLiked 
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
            : 'hover:bg-white/10 text-white/70 hover:text-white'
        }`}
        onClick={handleLike}
        disabled={isLiking || viewer.hasLiked}
      >
        {viewer.hasLiked ? (
          <Heart className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Heart className="w-3.5 h-3.5" />
        )}
        <span className="text-xs tabular-nums">{formatInteractionCount(stats.likeCount)}</span>
      </Button>
    </div>
  );
}

interface InteractionStatsDisplayProps {
  interactionStats?: InteractionStats;
}

export function InteractionStatsDisplay({ interactionStats }: InteractionStatsDisplayProps) {
  const stats = interactionStats || {
    likeCount: 0,
    moodboardAddCount: 0,
    downloadCount: 0,
    editCount: 0,
  };

  const items = [
    { icon: Heart, label: 'Likes', count: stats.likeCount, lastTime: stats.lastLikedAt },
    { icon: BookmarkPlus, label: 'Moodboard', count: stats.moodboardAddCount, lastTime: stats.lastMoodboardAddedAt },
    { icon: Download, label: 'Downloads', count: stats.downloadCount, lastTime: stats.lastDownloadedAt },
    { icon: Pencil, label: 'Edits', count: stats.editCount, lastTime: stats.lastEditedAt },
  ];

  return (
    <div className="space-y-3">
      <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Interactions</span>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, count, lastTime }) => (
          <div 
            key={label}
            className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5">
              <Icon className="w-3 h-3 text-white/40" />
              <span className="text-white text-sm font-medium tabular-nums">{formatInteractionCount(count)}</span>
            </div>
            <span className="text-[9px] text-white/30 uppercase font-mono">{label}</span>
            {lastTime && (
              <span className="text-[8px] text-white/20">{formatLastTime(lastTime)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
