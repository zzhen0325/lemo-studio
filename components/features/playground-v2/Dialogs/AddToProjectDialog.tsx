import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { projectStore } from "@/lib/store/project-store";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { Generation } from '@/types/database';
import { observer } from 'mobx-react-lite';
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: Generation[];
  onSuccess?: () => void;
}

export const AddToProjectDialog = observer(({
  open,
  onOpenChange,
  selectedItems,
  onSuccess
}: AddToProjectDialogProps) => {
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { setGenerationHistory } = usePlaygroundStore();
  const projects = projectStore.sortedProjects;

  const handleConfirm = async () => {
    let targetProjectId = selectedProjectId;
    
    if (mode === 'create') {
      if (!newProjectName.trim()) return;
      const newProject = projectStore.createProjectWithHistory(newProjectName, selectedItems);
      targetProjectId = newProject.id;
    } else {
      if (!selectedProjectId) return;
      projectStore.addGenerationsToProject(selectedProjectId, selectedItems);
    }
    
    // Update global store for immediate UI feedback
    if (targetProjectId) {
      const selectedIds = new Set(selectedItems.map(i => i.id));
      setGenerationHistory(prev => prev.map(item => 
        selectedIds.has(item.id) ? { ...item, projectId: targetProjectId! } : item
      ));
    }

    onOpenChange(false);
    onSuccess?.();
    
    // Reset state
    setMode('select');
    setNewProjectName("");
    setSelectedProjectId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">Add to Project</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
            <button
              className={cn(
                "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                mode === 'select' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
              )}
              onClick={() => setMode('select')}
            >
              Existing Project
            </button>
            <button
              className={cn(
                "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                mode === 'create' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white"
              )}
              onClick={() => setMode('create')}
            >
              New Project
            </button>
          </div>

          {mode === 'select' ? (
            <div className="flex flex-col gap-2 h-[300px]">
               {projects.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-white/40 text-sm">
                   No projects found
                 </div>
               ) : (
                 <ScrollArea className="flex-1 pr-4 -mr-4">
                   <div className="flex flex-col gap-2">
                     {projects.map(project => (
                       <button
                         key={project.id}
                         onClick={() => setSelectedProjectId(project.id)}
                         className={cn(
                           "flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                           selectedProjectId === project.id
                             ? "bg-emerald-500/10 border-emerald-500/50"
                             : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                         )}
                       >
                         <div className="flex flex-col">
                           <span className={cn(
                             "font-medium text-sm",
                             selectedProjectId === project.id ? "text-emerald-400" : "text-white/90"
                           )}>{project.name}</span>
                           <span className="text-xs text-white/40">{project.history.length} items</span>
                         </div>
                         {selectedProjectId === project.id && (
                           <Check className="w-4 h-4 text-emerald-400" />
                         )}
                       </button>
                     ))}
                   </div>
                 </ScrollArea>
               )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white/60">Project Name</label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/20"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={mode === 'select' ? !selectedProjectId : !newProjectName.trim()}
            className="bg-white text-black hover:bg-white/90"
          >
            {mode === 'create' ? 'Create & Add' : 'Add to Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
