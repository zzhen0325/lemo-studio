import { makeAutoObservable } from "mobx";
import { Generation } from "@/types/database";

export interface Project {
  id: string;
  name: string;
  thumbnailUrl?: string;
  createdAt: number;
  history: Generation[];
}

class ProjectStore {
  projects: Project[] = [];
  currentProjectId: string | null = null;
  isSidebarExpanded: boolean = false;

  constructor() {
    makeAutoObservable(this);
    this.loadProjects();
  }

  get currentProject() {
    return this.projects.find(p => p.id === this.currentProjectId);
  }

  get sortedProjects() {
    return [...this.projects].sort((a, b) => b.createdAt - a.createdAt);
  }

  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  async loadProjects() {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        if (data.projects) {
          this.projects = data.projects;
        }
      }
    } catch (error) {
      console.error("Failed to load projects", error);
    }
  }

  async saveProjects() {
    try {
      // Don't save full history in projects.json to keep it small
      // The history is already linked by projectId in the generation metadata
      const projectsToSave = this.projects.map(p => ({
        ...p,
        history: [] // Clear history when saving project list
      }));
      
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: projectsToSave }),
      });
    } catch (error) {
      console.error("Failed to save projects", error);
    }
  }

  addProject(name: string = "Untitled") {
    const newProject: Project = {
      id: this.generateId(),
      name: name.slice(0, 20),
      createdAt: Date.now(),
      history: []
    };
    this.projects.push(newProject);
    this.currentProjectId = newProject.id;
    this.saveProjects();
    return newProject;
  }

  updateProjectName(id: string, name: string) {
    const project = this.projects.find(p => p.id === id);
    if (project) {
      project.name = name.slice(0, 20);
      this.saveProjects();
    }
  }

  selectProject(id: string | null) {
    this.currentProjectId = id;
  }

  toggleSidebar(expanded?: boolean) {
    this.isSidebarExpanded = expanded ?? !this.isSidebarExpanded;
  }

  addHistoryToCurrentProject(historyItem: Generation) {
    if (this.currentProject) {
      this.currentProject.history.unshift(historyItem);
      // Update thumbnail if it's the first image
      const image = historyItem.outputUrl;
      if (!this.currentProject.thumbnailUrl && image) {
        this.currentProject.thumbnailUrl = image;
      }
    }
  }

  // Method to sync history from external source (like when loading from local storage)
  setProjectHistory(projectId: string, history: Generation[]) {
    const project = this.projects.find(p => p.id === projectId);
    if (project) {
      project.history = history;
      if (!project.thumbnailUrl && history.length > 0) {
        const firstItem = history[0];
        const image = firstItem.outputUrl;
        if (image) {
          project.thumbnailUrl = image;
        }
      }
    }
  }

  async addGenerationsToProject(projectId: string, generations: Generation[]) {
    const project = this.projects.find(p => p.id === projectId);
    if (project) {
      const updatedGenerations = generations.map(g => ({ ...g, projectId }));
      
      const existingIds = new Set(project.history.map(h => h.id));
      const newItems = updatedGenerations.filter(g => !existingIds.has(g.id));
      
      const combined = [...newItems, ...project.history];
      // Sort by createdAt desc to maintain timeline
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      project.history = combined;

      if (!project.thumbnailUrl && project.history.length > 0) {
        const firstWithImage = project.history.find(h => h.outputUrl);
        if (firstWithImage) {
          project.thumbnailUrl = firstWithImage.outputUrl;
        }
      }

      // Sync with backend
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch-update',
            items: updatedGenerations
          }),
        });
      } catch (error) {
        console.error("Failed to sync moved generations", error);
      }
    }
  }

  async createProjectWithHistory(name: string, generations: Generation[]) {
    const newProject = this.addProject(name);
    await this.addGenerationsToProject(newProject.id, generations);
    return newProject;
  }
}

export const projectStore = new ProjectStore();
