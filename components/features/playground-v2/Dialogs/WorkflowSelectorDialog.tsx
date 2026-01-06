import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Edit } from 'lucide-react';
import type { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { cn } from '@/lib/utils';

interface WorkflowSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (workflow: IViewComfy) => void;
  onEdit?: (workflow: IViewComfy) => void;
}

interface ViewComfyResponse {
  appTitle?: string;
  appImg?: string;
  viewComfys: IViewComfy[];
}

export default function WorkflowSelectorDialog({ open, onOpenChange, onSelect, onEdit }: WorkflowSelectorDialogProps) {
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchWorkflows = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/view-comfy');
        if (!res.ok) throw new Error('加载工作流失败');
        const data = (await res.json()) as ViewComfyResponse;
        setWorkflows(data.viewComfys || []);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkflows();
  }, [open]);

  const handleSelect = (workflow: IViewComfy) => {
    setSelectedId(workflow.viewComfyJSON.id);
    onSelect(workflow);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>选择工作流</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workflows.map(item => (
                  <Card
                    key={item.viewComfyJSON.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary relative group",
                      selectedId === item.viewComfyJSON.id ? "border-primary bg-primary/5" : ""
                    )}
                    onClick={() => handleSelect(item)}
                  >
                    <CardHeader className="p-4 pb-2">
                      <CardTitleComponent className="text-lg flex justify-between items-start gap-2">
                        <span className="truncate">{item.viewComfyJSON.title}</span>
                        {selectedId === item.viewComfyJSON.id && <Badge variant="default" className="shrink-0"><Check className="w-3 h-3 mr-1" />已选</Badge>}
                      </CardTitleComponent>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                        {item.viewComfyJSON.description || "暂无描述"}
                      </p>
                      {onEdit && (
                        <div className="mt-4 pt-2 border-t flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); onEdit(item); onOpenChange(false); }}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            编辑映射
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {workflows.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">暂无工作流</div>
              )}
            </ScrollArea>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
