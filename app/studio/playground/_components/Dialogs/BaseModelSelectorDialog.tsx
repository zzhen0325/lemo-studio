import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BaseModelMeta {
  name: string;
  cover: string; // public path e.g. /basemodels/xxx.jpg
}

interface BaseModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onConfirm: (model: string) => void;
}

export default function BaseModelSelectorDialog({ open, onOpenChange, value, onConfirm }: BaseModelSelectorDialogProps) {
  const [selectedName, setSelectedName] = useState<string>(value || '');

  // 静态封面列表（来源于 public/basemodels）
  const list: BaseModelMeta[] = useMemo(() => ([
    { name: 'FLUX_fill', cover: '/basemodels/FLUX_fill.jpg' },
    { name: 'flux1-dev-fp8.safetensors', cover: '/basemodels/flux1-dev-fp8.safetensors.jpg' },
    { name: 'Zimage', cover: '/basemodels/Zimage.jpg' },
    { name: 'qwen', cover: '/basemodels/qwen.jpg' },
  ]), []);

  useEffect(() => { setSelectedName(value || ''); }, [value]);

  const handleConfirm = () => {
    onConfirm(selectedName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl rounded-3xl bg-zinc-950/90 backdrop-blur-xl border-white/10 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-white/10">
          <DialogTitle className="text-xl font-light text-white">Select Base Model</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {list.map(item => {
              const isSelected = selectedName === item.name;
              return (
                <div
                  key={item.name}
                  className={cn(
                    "group relative flex flex-col rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
                    isSelected
                      ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  )}
                  onClick={() => setSelectedName(item.name)}
                >
                  <div className="aspect-square relative w-full overflow-hidden bg-black/20">
                    <Image
                      src={item.cover}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className={cn(
                        "object-cover transition-transform duration-500",
                        isSelected ? "scale-105" : "group-hover:scale-105"
                      )}
                    />

                    {/* Selection Indicator Overlay */}
                    <div className={cn(
                      "absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg backdrop-blur-md",
                      isSelected
                        ? "bg-indigo-500 text-white scale-100 opacity-100"
                        : "bg-black/40 text-white/50 scale-90 opacity-0 group-hover:opacity-100 border border-white/20"
                    )}>
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="p-4 flex items-center justify-center">
                    <span className={cn(
                      "text-sm font-medium truncate transition-colors duration-300",
                      isSelected ? "text-white" : "text-white/70 group-hover:text-white"
                    )}>
                      {item.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20 backdrop-blur-xl">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedName}
            className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)]"
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
