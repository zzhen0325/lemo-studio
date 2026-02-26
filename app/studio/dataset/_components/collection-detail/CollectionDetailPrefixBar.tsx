'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CollectionDetailPrefixBarProps {
  activeTags: string[];
  batchPrefix: string;
  onBatchPrefixChange: (value: string) => void;
  onAddPrefix: () => void;
  onRemoveTag: (tag: string) => void;
}

export function CollectionDetailPrefixBar({
  activeTags,
  batchPrefix,
  onBatchPrefixChange,
  onAddPrefix,
  onRemoveTag,
}: CollectionDetailPrefixBarProps) {
  return (
    <div className="flex gap-3">
      <div className="flex w-full flex-wrap h-12 min-h-[40px] p-2 border border-white/10 rounded-xl bg-background">
        {activeTags.map((tag) => (
          <div
            key={tag}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-sm text-xs font-medium animate-in fade-in zoom-in-95 duration-200"
          >
            {tag}
            <button
              onClick={() => onRemoveTag(tag)}
              className="ml-1 hover:text-red-500 focus:outline-none"
              title="Remove prefix"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        <Input
          value={batchPrefix}
          onChange={(e) => onBatchPrefixChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAddPrefix();
            }
          }}
          className="flex-1 bg-transparent border-none text-foreground text-sm focus-visible:ring-0 h-8"
          placeholder={activeTags.length === 0 ? 'Type prefix and press Enter...' : ''}
        />
      </div>

      <Button
        variant="secondary"
        onClick={onAddPrefix}
        disabled={!batchPrefix.trim()}
        className="w-auto h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-white/10"
      >
        <Plus className="h-4 w-4" />
        Add Prefix
      </Button>
    </div>
  );
}
