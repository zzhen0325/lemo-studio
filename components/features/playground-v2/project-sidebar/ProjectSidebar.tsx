import React from "react";
import { observer } from "mobx-react-lite";
import { projectStore } from "@/lib/store/project-store";
import { ProjectList } from "./ProjectList";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";

interface ProjectSidebarProps {
  onShowAllProjects: () => void;
}

export const ProjectSidebar = observer(({ onShowAllProjects }: ProjectSidebarProps) => {
  const isExpanded = projectStore.isSidebarExpanded;

  return (
    <motion.div
      initial={false}
      animate={{ 
        width: isExpanded ? 240 : 0,
        opacity: isExpanded ? 1 : 0
      }}
      transition={{ duration: 0.3 }}
      className="relative h-full shrink-0 py-6 flex flex-col overflow-hidden z-30"
    >
      <div className="bg-black/20 border border-white/10 rounded-3xl h-full flex flex-col overflow-hidden backdrop-blur-md min-w-[240px]">
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
    </motion.div>
  );
});
