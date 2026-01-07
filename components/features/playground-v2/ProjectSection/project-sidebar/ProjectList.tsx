import React from "react";
import { observer } from "mobx-react-lite";
import { Project, projectStore } from "@/lib/store/project-store";
import { ProjectItem } from "./ProjectItem";

export const ProjectList = observer(() => {
  const projects = projectStore.sortedProjects || [];
  // Subscribe to currentProjectId changes to trigger re-render
  const currentProjectId = projectStore.currentProjectId;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
      <div className="flex flex-col gap-1">
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
