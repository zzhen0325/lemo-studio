import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const PROJECTS_FILE = path.join(process.cwd(), 'public', 'outputs', 'projects.json');

async function ensureDir() {
  const dir = path.dirname(PROJECTS_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readProjects() {
  try {
    await fs.access(PROJECTS_FILE);
    const content = await fs.readFile(PROJECTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveProjects(projects: any[]) {
  await ensureDir();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const allProjects = await readProjects();
    
    // If userId is provided, filter projects
    // We also include projects with no userId (legacy) for the first user or default view
    let projects = allProjects;
    if (userId) {
        projects = allProjects.filter((p: any) => !p.userId || p.userId === userId);
    }

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { projects } = await request.json();

    if (!Array.isArray(projects)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (!userId) {
         // If no userId, just save what we got (legacy behavior, risky with multiple users)
         // But to be safe, we should require userId if we want to support multi-user safely.
         // For now, let's assume if no userId, we overwrite everything (legacy mode).
         await saveProjects(projects);
    } else {
        // Read existing projects
        const allProjects = await readProjects();
        
        // Filter out projects for this user
        const otherUserProjects = allProjects.filter((p: any) => p.userId && p.userId !== userId);
        
        // Ensure incoming projects have the userId attached
        const userProjects = projects.map((p: any) => ({ ...p, userId }));
        
        // Combine
        const newAllProjects = [...otherUserProjects, ...userProjects];
        
        await saveProjects(newAllProjects);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save projects' }, { status: 500 });
  }
}
