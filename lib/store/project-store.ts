import { makeAutoObservable, reaction } from "mobx";
import { Generation } from "../../types/database";
import { userStore } from "./user-store";
import { getApiBase } from "../api-base";

export interface Project {
  id: string;
  userId?: string;
  name: string;
  thumbnailUrl?: string;
  createdAt: number;
  history: Generation[];
}

class ProjectStore {
  projects: Project[] = [];
  currentProjectId: string | null = null;
  isSidebarExpanded: boolean = false;

  // Batch selection state
  isBatchMode: boolean = false;
  selectedProjectIds: Set<string> = new Set();

  constructor() {
    makeAutoObservable(this);
    this.loadProjects();

    // Reload projects when user changes
    reaction(
      () => userStore.currentUser?.id,
      () => {
        this.loadProjects();
        this.currentProjectId = null;
      }
    );
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
    const currentUser = userStore.currentUser;
    if (!currentUser) return;

    try {
      const userId = currentUser.id;
      const res = await fetch(`${getApiBase()}/projects?userId=${userId}`);
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
    const currentUser = userStore.currentUser;
    if (!currentUser) return;

    try {
      const userId = currentUser.id;
      // Don't save full history in projects.json to keep it small
      // The history is already linked by projectId in the generation metadata
      const projectsToSave = this.projects.map(p => ({
        ...p,
        userId: p.userId || userId, // Ensure userId is set
        history: [] // Clear history when saving project list
      }));

      await fetch(`${getApiBase()}/projects?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: projectsToSave }),
      });
    } catch (error) {
      console.error("Failed to save projects", error);
    }
  }

  addProject(name: string = "Untitled") {
    const currentUser = userStore.currentUser;
    if (!currentUser) throw new Error("No current user");

    const newProject: Project = {
      id: this.generateId(),
      userId: currentUser.id,
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

  deleteProject(id: string) {
    this.projects = this.projects.filter(p => p.id !== id);
    if (this.currentProjectId === id) {
      this.currentProjectId = null;
    }
    this.selectedProjectIds.delete(id);
    this.saveProjects();
  }

  deleteProjects(ids: string[]) {
    const idsToDelete = new Set(ids);
    this.projects = this.projects.filter(p => !idsToDelete.has(p.id));
    if (this.currentProjectId && idsToDelete.has(this.currentProjectId)) {
      this.currentProjectId = null;
    }
    // Clean up selected state
    ids.forEach(id => this.selectedProjectIds.delete(id));
    if (this.projects.length === 0) {
      this.isBatchMode = false;
    }
    this.saveProjects();
  }

  selectProject(id: string | null) {
    this.currentProjectId = id;
  }

  toggleSidebar(expanded?: boolean) {
    this.isSidebarExpanded = expanded ?? !this.isSidebarExpanded;
  }

  // Batch operations
  toggleBatchMode(enabled?: boolean) {
    this.isBatchMode = enabled ?? !this.isBatchMode;
    if (!this.isBatchMode) {
      this.selectedProjectIds.clear();
    }
  }

  toggleProjectSelection(id: string) {
    if (this.selectedProjectIds.has(id)) {
      this.selectedProjectIds.delete(id);
    } else {
      this.selectedProjectIds.add(id);
    }
  }

  toggleSelectAll() {
    if (this.selectedProjectIds.size === this.projects.length) {
      this.selectedProjectIds.clear();
    } else {
      this.projects.forEach(p => this.selectedProjectIds.add(p.id));
    }
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
        await fetch(`${getApiBase()}/history`, {
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
