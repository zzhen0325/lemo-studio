import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { projectStore, Project } from "@/lib/store/project-store";
import { X, Search, Folder } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
interface AllProjectsViewProps {
  onClose: () => void;
}

const ProjectGridItem = observer(({ project, onClick }: { project: Project; onClick: () => void }) => {
  return (
    <div
      className="group relative aspect-[4/3] rounded-xl border border-white/10 bg-white/5 overflow-hidden cursor-pointer hover:border-white/20 transition-all hover:shadow-2xl"
      onClick={onClick}
    >
      {project.thumbnailUrl ? (
        <img
          src={project.thumbnailUrl}
          alt={project.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/5">
          <Folder className="w-12 h-12 text-white/20" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
        <h3 className="text-white font-medium truncate">{project.name}</h3>
        <p className="text-white/40 text-xs mt-1">
          {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur-sm group-hover:opacity-0 transition-opacity">
        <h3 className="text-white/80 text-sm truncate text-center">{project.name}</h3>
      </div>
    </div>
  )
})

export const AllProjectsView = observer(({ onClose }: AllProjectsViewProps) => {
  const [search, setSearch] = useState("");
  const projects = projectStore.sortedProjects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col"
    >
      {/* Header */}
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-8">
        <h1 className="text-2xl font-light text-white">All Projects</h1>

        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {projects.map(project => (
            <ProjectGridItem
              key={project.id}
              project={project}
              onClick={() => {
                projectStore.selectProject(project.id);
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
});
