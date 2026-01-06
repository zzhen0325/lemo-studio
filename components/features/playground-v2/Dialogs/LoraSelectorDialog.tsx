import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Search, ServerCrash, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

interface LoraMeta {
  model_name: string;
  preview_url: string;
  trainedWords: string[];
}

export interface SelectedLora {
  model_name: string;
  strength: number;
}

interface LoraSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: SelectedLora[];
  onConfirm: (list: SelectedLora[]) => void;
}

export default function LoraSelectorDialog({ open, onOpenChange, value, onConfirm }: LoraSelectorDialogProps) {
  const [list, setList] = useState<LoraMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const map: Record<string, number> = {};
    value.forEach(v => { map[v.model_name] = v.strength; });
    setSelected(map);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const fetchList = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/loras');
        if (!res.ok) throw new Error('获取模型失败');
        const data = (await res.json()) as LoraMeta[];
        setList(data);
      } catch (error) {
        console.error("Failed to fetch loras", error);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [open]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (name in next) delete next[name]; else next[name] = 1.0;
      return next;
    });
  };

  const setStrength = (name: string, v: number) => { setSelected(prev => ({ ...prev, [name]: v })); };

  const confirm = () => {
    const result: SelectedLora[] = Object.entries(selected).map(([k, v]) => ({ model_name: k, strength: v }));
    onConfirm(result);
  };

  const filteredList = list.filter(item =>
    item.model_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col rounded-3xl bg-zinc-950/90 backdrop-blur-xl border-white/10 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-light text-white">Select LoRA Model</DialogTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 bg-white/5 border-white/10 rounded-full text-sm text-white focus-visible:ring-indigo-500/50 placeholder:text-white/30"
              />
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredList.map(item => {
              const isSelected = item.model_name in selected;
              return (
                <div
                  key={item.model_name}
                  className={cn(
                    "group relative flex flex-col rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
                    isSelected
                      ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  )}
                  onClick={() => toggle(item.model_name)}
                >
                  {/* Image Aspect Keeper */}
                  <div className="aspect-[2/3] w-full relative overflow-hidden bg-black/20">
                    {item.preview_url ? (
                      <Image
                        src={item.preview_url}
                        alt={item.model_name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className={cn(
                          "object-cover transition-transform duration-500",
                          isSelected ? "scale-105" : "group-hover:scale-105"
                        )}
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <ServerCrash className="w-8 h-8" />
                      </div>
                    )}

                    {/* Selection Indicator Overlay */}
                    <div className={cn(
                      "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg backdrop-blur-md",
                      isSelected
                        ? "bg-indigo-500 text-white scale-100 opacity-100"
                        : "bg-black/40 text-white/50 scale-90 opacity-0 group-hover:opacity-100 border border-white/20"
                    )}>
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white/90 truncate" title={item.model_name}>
                        {item.model_name}
                      </span>
                    </div>

                    {/* Animated Slider Container */}
                    <div className={cn(
                      "grid transition-all duration-300 ease-out",
                      isSelected ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0"
                    )}>
                      <div className="overflow-hidden space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-indigo-200/80 px-0.5">
                          <span>Strength</span>
                          <span>{selected[item.model_name]?.toFixed(2)}</span>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Slider
                            value={[selected[item.model_name] || 1.0]}
                            min={0}
                            max={2} // Allowed max strength often > 1
                            step={0.05}
                            onValueChange={(vals) => setStrength(item.model_name, vals[0] ?? 0)}
                            className="py-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredList.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-white/30 gap-2">
              <Search className="w-8 h-8 opacity-50" />
              <p>No LoRA models found matching &quot;{searchQuery}&quot;</p>
            </div>
          )}
        </ScrollArea>

        <div className="px-6 py-4 border-t border-white/10 flex justify-between items-center bg-black/20 backdrop-blur-xl">
          <span className="text-sm text-white/40">
            {Object.keys(selected).length} selected
          </span>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={() => { confirm(); onOpenChange(false); }}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)]"
            >
              Confirm Selection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
