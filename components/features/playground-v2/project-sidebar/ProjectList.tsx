import React from "react";
import { observer } from "mobx-react-lite";
import { projectStore } from "@/lib/store/project-store";
import { ProjectItem } from "./ProjectItem";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

export const ProjectList = observer(() => {
  const projects = projectStore.sortedProjects;
  // Subscribe to currentProjectId changes to trigger re-render
  const currentProjectId = projectStore.currentProjectId;

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const project = projects[index];
    return (
      <ProjectItem
        project={project}
        isSelected={project.id === currentProjectId}
        style={{
          ...style,
          top: (style.top as number) + 8, // Add some top padding
          height: (style.height as number) - 4, // Add gap
          width: "95%",
          left: "2.5%"
        }}
      />
    );
  };

  return (
    <div className="flex-1 min-h-0 w-full">
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            width={width}
            itemCount={projects.length}
            itemSize={40}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
});
