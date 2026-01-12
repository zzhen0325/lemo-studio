"use client";

import React, { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Project, projectStore } from "@/lib/store/project-store";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, Folder, Edit2, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import GradualBlur from "@/components/GradualBlur";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";





interface ProjectSidebarProps {
  onShowAllProjects: () => void;
}

// ========== ProjectItem ==========
interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  style?: React.CSSProperties;
}


const ProjectItem = observer(({ project, isSelected, style }: ProjectItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBatchMode = projectStore.isBatchMode;
  const isChecked = projectStore.selectedProjectIds.has(project.id);

  const { setNodeRef, isOver } = useDroppable({
    id: `project-${project.id}`,
    data: {
      type: 'project',
      projectId: project.id,
    },
    disabled: isBatchMode, // Disable drag/drop in batch mode
  });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (isBatchMode) return;
    setIsEditing(true);
    setEditName(project.name);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editName.trim()) {
      projectStore.updateProjectName(project.id, editName.trim());
    } else {
      setEditName(project.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditName(project.name);
    }
  };

  const handleClick = () => {
    if (isBatchMode) {
      projectStore.toggleProjectSelection(project.id);
    } else {
      projectStore.selectProject(project.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    projectStore.deleteProject(project.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all text-sm relative",
          isSelected && !isBatchMode
            ? "bg-white/5 text-white border border-white/10"
            : "text-white/60 hover:bg-black/10 hover:text-white",
          isOver && "bg-primary/20 ring-1 ring-primary/50 text-white scale-[1.02]",
          isBatchMode && isChecked && "bg-primary/10 text-white border border-primary/20"
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isBatchMode ? (
          <div
            className="shrink-0 mr-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => projectStore.toggleProjectSelection(project.id)}
              className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        ) : (
          <Folder className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary" : "text-white/40")} />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            maxLength={20}
            className="bg-transparent border border-blue-500/50 rounded px-1 outline-none text-white w-full h-6 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1 select-none">{project.name}</span>
        )}

        {!isEditing && !isBatchMode && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1 hover:bg-black/10 rounded"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="Rename"
            >
              <Edit2 className="w-3 h-3 text-white/40 hover:text-white" />
            </button>
            <button
              className="p-1 hover:bg-red-500/20 rounded"
              onClick={handleDelete}
              title="Delete"
            >
              <Trash2 className="w-3 h-3 text-red-500/60 hover:text-red-500" />
            </button>
          </div>
        )}
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription className="text-white/60">
              Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-white/60 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

// ========== ProjectList ==========
const ProjectList = observer(() => {
  const projects = projectStore.sortedProjects || [];
  const currentProjectId = projectStore.currentProjectId;
  const { isSelectionMode } = usePlaygroundStore();

  const { setNodeRef: setNewProjectRef, isOver: isOverNewProject } = useDroppable({
    id: 'new-project',
    data: {
      type: 'new-project',
    },
  });

  return (
    <div className="flex flex-col gap-1">
      {isSelectionMode && (
        <div
          ref={setNewProjectRef}
          className={cn(
            "flex items-center gap-2 px-2 py-2 rounded-lg border border-dashed border-white/20 text-white/40 transition-all mb-2",
            isOverNewProject && "bg-primary/20 border-primary/50 text-white scale-[1.02]"
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">Drop to New Project</span>
        </div>
      )}

      <button
        className={cn(
          "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm w-full text-left",
          currentProjectId === null && !projectStore.isBatchMode
            ? "bg-white/5 text-white border border-white/10"
            : "text-white/60 hover:bg-black/10 hover:text-white",
          projectStore.isBatchMode && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !projectStore.isBatchMode && projectStore.selectProject(null)}
        disabled={projectStore.isBatchMode}
      >
        <LayoutGrid className={cn("w-4 h-4 shrink-0", currentProjectId === null ? "text-primary" : "text-white/40")} />
        <span className="truncate flex-1 select-none">All History</span>
      </button>

      {projects.map((project: Project) => (
        <ProjectItem
          key={project.id}
          project={project}
          isSelected={project.id === currentProjectId}
        />
      ))}
    </div>
  );
});

// ========== ProjectSidebar (Main Export) ==========
export const ProjectSidebar = observer(({ onShowAllProjects }: ProjectSidebarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full  w-full min-h-0">
      <div className="bg-black/10 border border-white/10 rounded-3xl flex-1 flex flex-col min-h-0  relative overflow-hidden">

        <GradualBlur
          target="parent"
          position="top"
          height="100px"
          strength={6}
          divCount={5}
          curve="bezier"
          exponential={true}
          zIndex={10}
          opacity={1}
          borderRadius="1.5rem"
          animate={{
            type: 'scroll',
            targetRef: scrollRef,
            startOffset: 0,
            endOffset: 80
          }}
        />


        <div className="p-4 flex flex-col gap-4 flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center px-2 justify-between z-20 shrink-0">
            <span className="text-2xl text-white"
              style={{ fontFamily: "'InstrumentSerif', serif" }}>
              {projectStore.isBatchMode ? "Select Projects" : "Projects"}
            </span>
            <div className="flex gap-1">
              {!projectStore.isBatchMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/60 hover:text-white"
                    onClick={() => projectStore.toggleBatchMode()}
                    title="Batch Management"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/60 hover:text-white"
                    onClick={onShowAllProjects}
                    title="All Projects"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/60 hover:text-white"
                    onClick={() => projectStore.addProject()}
                    title="New Project"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/5"
                  onClick={() => projectStore.toggleBatchMode(false)}
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Scrollable List */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <ProjectList />
          </div>

          {/* Batch Actions Bar */}
          {projectStore.isBatchMode && (
            <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between px-2 text-xs text-white/40">
                <span>{projectStore.selectedProjectIds.size} selected</span>
                <button
                  onClick={() => projectStore.toggleSelectAll()}
                  className="hover:text-white transition-colors"
                >
                  {projectStore.selectedProjectIds.size === projectStore.projects.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <Button
                variant="destructive"
                className="w-full h-9 bg-red-500/80 hover:bg-red-500 text-white rounded-xl"
                disabled={projectStore.selectedProjectIds.size === 0}
                onClick={() => {
                  if (confirm(`Delete ${projectStore.selectedProjectIds.size} projects?`)) {
                    projectStore.deleteProjects(Array.from(projectStore.selectedProjectIds));
                  }
                }}
              >
                Delete Selected
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
