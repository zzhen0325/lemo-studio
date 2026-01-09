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
    // Initialize with a default project if empty
    // In a real app, this might load from local storage or API
    if (this.projects.length === 0) {
      this.addProject("Default Project");
    }
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

  addProject(name: string = "Untitled") {
    const newProject: Project = {
      id: this.generateId(),
      name: name.slice(0, 20),
      createdAt: Date.now(),
      history: []
    };
    this.projects.push(newProject);
    this.currentProjectId = newProject.id;
    return newProject;
  }

  updateProjectName(id: string, name: string) {
    const project = this.projects.find(p => p.id === id);
    if (project) {
      project.name = name.slice(0, 20);
    }
  }

  selectProject(id: string) {
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

  addGenerationsToProject(projectId: string, generations: Generation[]) {
    const project = this.projects.find(p => p.id === projectId);
    if (project) {
      const existingIds = new Set(project.history.map(h => h.id));
      const newItems = generations.filter(g => !existingIds.has(g.id));
      
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
    }
  }

  createProjectWithHistory(name: string, generations: Generation[]) {
    const newProject = this.addProject(name);
    this.addGenerationsToProject(newProject.id, generations);
    return newProject;
  }
}

export const projectStore = new ProjectStore();
