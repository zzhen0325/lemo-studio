import { projectStore } from "../project-store";
import { GenerationResult } from "@/components/features/playground-v2/types";
import { userStore } from "../user-store";

describe("ProjectStore", () => {
  beforeEach(() => {
    // Reset store state
    projectStore.projects = [];
    // Provide a fake logged-in user so ProjectStore can create projects
    userStore.currentUser = { id: "u1", name: "Test User" } as unknown as { id: string; name: string; email?: string; avatar?: string };
    projectStore.addProject("Default Project");
  });

  it("should initialize with a default project", () => {
    expect(projectStore.projects.length).toBe(1);
    expect(projectStore.currentProject).toBeDefined();
    expect(projectStore.currentProject?.name).toBe("Default Project");
  });

  it("should add a new project", () => {
    const project = projectStore.addProject("New Project");
    expect(projectStore.projects.length).toBe(2);
    expect(projectStore.currentProjectId).toBe(project.id);
    expect(project.name).toBe("New Project");
  });

  it("should limit project name length", () => {
    const longName = "This name is way too long for the project";
    const project = projectStore.addProject(longName);
    expect(project.name.length).toBe(20);
    expect(project.name).toBe(longName.slice(0, 20));
  });

  it("should update project name", () => {
    const project = projectStore.currentProject!;
    projectStore.updateProjectName(project.id, "Updated Name");
    expect(project.name).toBe("Updated Name");
  });

  it("should select project", () => {
    const p1 = projectStore.currentProject!;
    const p2 = projectStore.addProject("Project 2");

    expect(projectStore.currentProjectId).toBe(p2.id);

    projectStore.selectProject(p1.id);
    expect(projectStore.currentProjectId).toBe(p1.id);
  });

  it("should toggle sidebar", () => {
    projectStore.isSidebarExpanded = false;
    projectStore.toggleSidebar();
    expect(projectStore.isSidebarExpanded).toBe(true);

    projectStore.toggleSidebar(false);
    expect(projectStore.isSidebarExpanded).toBe(false);
  });

  it("should add history to current project", () => {
    const project = projectStore.currentProject!;
    const historyItem: GenerationResult = {
      id: "1",
      userId: "u1",
      projectId: project.id,
      status: 'completed',
      config: { prompt: "test", width: 512, height: 512, model: "test" },
      createdAt: new Date().toISOString(),
      outputUrl: "test.png"
    };

    projectStore.addHistoryToCurrentProject(historyItem);
    expect(project.history.length).toBe(1);
    expect(project.history[0]).toEqual(historyItem);
    expect(project.thumbnailUrl).toBe("test.png");
  });

  it("should set project history and update thumbnail", () => {
    const project = projectStore.currentProject!;
    const historyItem: GenerationResult = {
      id: "1",
      userId: "u1",
      projectId: project.id,
      status: 'completed',
      config: { prompt: "test", width: 512, height: 512, model: "test" },
      createdAt: new Date().toISOString(),
      outputUrl: "thumb.png"
    };

    projectStore.setProjectHistory(project.id, [historyItem]);
    expect(project.history.length).toBe(1);
    expect(project.thumbnailUrl).toBe("thumb.png");
  });
});
