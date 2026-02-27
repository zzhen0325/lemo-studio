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
      <div className="flex w-full flex-wrap h-10 min-h-[40px] p-1.5 border border-[#2e2e2e] rounded-xl bg-[#161616] shrink-0 shadow-sm">
        {activeTags.map((tag) => (
          <div
            key={tag}
            className="flex items-center gap-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 px-3 py-1 rounded-lg text-[13px] font-medium animate-in fade-in zoom-in-95 duration-200"
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
          className="flex-1 bg-transparent border-none text-zinc-300 text-[13px] focus-visible:ring-0 h-7"
          placeholder={activeTags.length === 0 ? 'Type prefix and press Enter...' : ''}
        />
      </div>

      <Button
        variant="secondary"
        onClick={onAddPrefix}
        disabled={!batchPrefix.trim()}
        className="w-auto h-10 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-zinc-300 border-[#2e2e2e] rounded-xl shadow-sm hover:text-white shrink-0"
      >
        <Plus className="h-4 w-4" />
        Add Prefix
      </Button>
    </div>
  );
}
