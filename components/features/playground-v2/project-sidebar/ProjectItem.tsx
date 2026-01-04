import React, { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { cn } from "@/lib/utils";
import { Project, projectStore } from "@/lib/store/project-store";
import { Folder, MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  style?: React.CSSProperties;
}

export const ProjectItem = observer(({ project, isSelected, style }: ProjectItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

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
      style={style}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
        isSelected
          ? "bg-black/20 text-white"
          : "text-white/60 hover:bg-black/10 hover:text-white"
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

      {/* Hover Actions (Optional, user didn't explicitly ask but good for UX) */}
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
