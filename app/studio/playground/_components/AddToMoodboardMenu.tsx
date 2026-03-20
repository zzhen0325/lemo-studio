'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useToast } from '@/hooks/common/use-toast';
import { mergeShortcutMoodboards, getShortcutByMoodboardId } from '@/config/playground-shortcuts';

interface AddToMoodboardMenuProps {
  imagePath: string;
  className?: string;
  label?: string;
  tooltipContent?: string;
}

export function AddToMoodboardMenu({
  imagePath,
  className = "w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10",
  label = "Add to Moodboard",
  tooltipContent = "添加到情绪板",
}: AddToMoodboardMenuProps) {
  const styles = usePlaygroundStore((state) => state.styles);
  const initStyles = usePlaygroundStore((state) => state.initStyles);
  const addImageToStyle = usePlaygroundStore((state) => state.addImageToStyle);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (styles.length === 0) {
      void initStyles();
    }
  }, [initStyles, styles.length]);

  const moodboards = React.useMemo(() => mergeShortcutMoodboards(styles), [styles]);

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <div>
          <TooltipButton
            icon={<Layers className="w-4 h-4" />}
            label={label}
            tooltipContent={tooltipContent}
            tooltipSide="top"
            className={className}
          />
        </div>
      </DropdownMenuTrigger>
      {isOpen && (
        <DropdownMenuContent className="bg-black/90 border-white/10 backdrop-blur-2xl rounded-2xl p-2 min-w-[180px]">
          <DropdownMenuLabel className="text-white/40 text-[10px] uppercase tracking-wider px-2 py-1">
            选择情绪板
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/5" />
          {moodboards.length > 0 ? (
            moodboards.map((moodboard) => {
              const linkedShortcut = getShortcutByMoodboardId(moodboard.id);

              return (
                <DropdownMenuItem
                  key={moodboard.id}
                  className="flex items-center justify-between gap-3 text-white hover:bg-white/10 rounded-xl cursor-pointer"
                  onClick={async () => {
                    await addImageToStyle(moodboard.id, imagePath);
                    toast({
                      title: "已添加",
                      description: `已将图片加入情绪板: ${moodboard.name}`,
                    });
                  }}
                >
                  <span className="truncate">{moodboard.name}</span>
                  {linkedShortcut && (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/45">
                      template
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })
          ) : (
            <DropdownMenuItem disabled className="text-white/20 text-xs">
              暂无可用情绪板
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
