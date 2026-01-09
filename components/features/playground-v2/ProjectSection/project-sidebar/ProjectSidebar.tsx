import React from "react";
import { observer } from "mobx-react-lite";
import { projectStore } from "@/lib/store/project-store";
import { ProjectList } from "./ProjectList";
import { Button } from "@/components/ui/button";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { Plus, LayoutGrid } from "lucide-react";
interface ProjectSidebarProps {
  onShowAllProjects: () => void;
}


export const ProjectSidebar = observer(({ onShowAllProjects }: ProjectSidebarProps) => {

  return (
    <div className="relative shrink-0   flex flex-col z-30 flex-1 w-[12vw] min-h-0">
      <div className="bg-white/5 border border-white/10 rounded-3xl h-full flex flex-col overflow-hidden ">
        <div className="p-4 flex flex-col gap-4 flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center px-2 justify-between">
            <span className="text-2xl  text-white"
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

          {/* List */}
          <div className="flex-1 min-h-0">
            <ProjectList />
          </div>
        </div>
      </div>
    </div>
  );
});
