import React from "react";
import { observer } from "mobx-react-lite";
import { projectStore } from "@/lib/store/project-store";
import { ProjectList } from "./ProjectList";
import { Button } from "@/components/ui/button";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { Plus, X, LayoutGrid } from "lucide-react";
interface ProjectSidebarProps {
  onShowAllProjects: () => void;
}


export const ProjectSidebar = observer(({ onShowAllProjects }: ProjectSidebarProps) => {

  return (
    <div className="relative shrink-0 mt-10 mb-10 flex flex-col z-30 h-[calc(100%-80px)] w-[240px]">
      <div className="bg-black/20 border border-white/10 rounded-3xl h-full flex flex-col overflow-hidden backdrop-blur-md">
        <div className="px-4 pt-4 pb-4 flex flex-col gap-4 h-full">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Projects</h2>
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

          {/* List */}
          <ProjectList />
        </div>
      </div>
    </div>
  );
});
