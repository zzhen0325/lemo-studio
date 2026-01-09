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

export async function GET() {
  try {
    const projects = await readProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { projects } = await request.json();
    if (!Array.isArray(projects)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    await saveProjects(projects);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save projects' }, { status: 500 });
  }
}
