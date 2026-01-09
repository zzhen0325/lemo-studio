import React from "react";
import { observer } from "mobx-react-lite";
import { Project, projectStore } from "@/lib/store/project-store";
import { ProjectItem } from "./ProjectItem";
import { LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { usePlaygroundStore } from "@/lib/store/playground-store";

export const ProjectList = observer(() => {
  const projects = projectStore.sortedProjects || [];
  // Subscribe to currentProjectId changes to trigger re-render
  const currentProjectId = projectStore.currentProjectId;
  const { isSelectionMode } = usePlaygroundStore();

  const { setNodeRef: setNewProjectRef, isOver: isOverNewProject } = useDroppable({
    id: 'new-project',
    data: {
      type: 'new-project',
    },
  });

  return (
    <div className="flex-1 overflow-y-auto  mt-2">
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
    </div>
  );
});
