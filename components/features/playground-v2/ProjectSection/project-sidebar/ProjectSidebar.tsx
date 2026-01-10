"use client";

import React, { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Project, projectStore } from "@/lib/store/project-store";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, Folder, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { usePlaygroundStore } from "@/lib/store/playground-store";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `project-${project.id}`,
    data: {
      type: 'project',
      projectId: project.id,
    },
  });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
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
    projectStore.selectProject(project.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm",
        isSelected
          ? "bg-white/5 text-white border border-white/10"
          : "text-white/60 hover:bg-black/10 hover:text-white",
        isOver && "bg-primary/20 ring-1 ring-primary/50 text-white scale-[1.02]"
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <Folder className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary" : "text-white/40")} />

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

      {!isEditing && (
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          <Edit2 className="w-3 h-3 text-white/40" />
        </button>
      )}
    </div>
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
          currentProjectId === null
            ? "bg-white/5 text-white border border-white/10"
            : "text-white/60 hover:bg-black/10 hover:text-white"
        )}
        onClick={() => projectStore.selectProject(null)}
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
  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <div className="bg-white/5 border border-white/10 rounded-3xl flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 flex flex-col gap-4 flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center px-2 justify-between shrink-0">
            <span className="text-2xl text-white"
              style={{ fontFamily: "'InstrumentSerif', serif" }}>Projects</span>
            <div className="flex gap-1">
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
            </div>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ProjectList />
          </div>
        </div>
      </div>
    </div>
  );
});
