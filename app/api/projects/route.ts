import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectMongo } from '@/server/db';

const PROJECTS_FILE = path.join(process.cwd(), 'public', 'outputs', 'projects.json');

const ProjectSchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional(),
  name: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  createdAt: z.number().or(z.string().transform((v) => Number(v))).optional(),
  history: z.array(z.unknown()).optional(),
}).passthrough();

const PayloadSchema = z.object({
  projects: z.array(ProjectSchema),
});

type StoredProject = z.infer<typeof ProjectSchema> & Record<string, unknown>;

let projectsWriteQueue: Promise<void> = Promise.resolve();

const projectSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userId: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  {
    collection: 'project_snapshots',
    versionKey: false,
  },
);

projectSnapshotSchema.index({ userId: 1, id: 1 }, { unique: true, sparse: true });

const ProjectSnapshotModel =
  (mongoose.models.ProjectSnapshot as mongoose.Model<{
    id: string;
    userId?: string | null;
    payload: StoredProject;
    updatedAt: Date;
  }>) ||
  mongoose.model('ProjectSnapshot', projectSnapshotSchema);

function runWithProjectsWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const run = projectsWriteQueue.then(task, task);
  projectsWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureDir() {
  const dir = path.dirname(PROJECTS_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readProjectsFileFallback(): Promise<StoredProject[]> {
  try {
    await fs.access(PROJECTS_FILE);
    const content = await fs.readFile(PROJECTS_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ProjectSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data as StoredProject);
  } catch {
    return [];
  }
}

async function saveProjectsFileFallback(projects: StoredProject[]) {
  await ensureDir();

  const tmpPath = `${PROJECTS_FILE}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(projects, null, 2), 'utf-8');
  await fs.rename(tmpPath, PROJECTS_FILE);
}

async function withMongo<T>(task: () => Promise<T>): Promise<T | null> {
  try {
    await connectMongo();
    return await task();
  } catch (error) {
    console.warn('[ProjectsAPI] Mongo unavailable, fallback to file storage:', error);
    return null;
  }
}

function normalizeProject(project: StoredProject, userId?: string | null): StoredProject {
  return {
    ...project,
    userId: project.userId || userId || undefined,
    history: [],
    createdAt: typeof project.createdAt === 'number' ? project.createdAt : Number(project.createdAt || Date.now()),
  };
}

async function getProjectsFromMongo(userId?: string | null): Promise<StoredProject[] | null> {
  return withMongo(async () => {
    const query = userId
      ? { $or: [{ userId }, { userId: null }, { userId: { $exists: false } }] }
      : {};

    const docs = await ProjectSnapshotModel.find(query).sort({ 'payload.createdAt': -1 }).lean();

    return docs
      .map((doc) => ProjectSchema.safeParse(doc.payload))
      .filter((result) => result.success)
      .map((result) => normalizeProject(result.data as StoredProject, userId));
  });
}

async function saveProjectsToMongo(userId: string | null, projects: StoredProject[]): Promise<boolean> {
  const success = await withMongo(async () => {
    const normalizedProjects = projects.map((project) => normalizeProject(project, userId));

    const operations: mongoose.mongo.AnyBulkWriteOperation[] = normalizedProjects.map((project) => ({
      updateOne: {
        filter: { userId: project.userId || null, id: project.id },
        update: {
          $set: {
            payload: project,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await ProjectSnapshotModel.bulkWrite(operations, { ordered: false });
    }

    const retainedIds = new Set(normalizedProjects.map((project) => project.id));
    const removeQuery = userId ? { userId } : { userId: null };

    if (retainedIds.size === 0) {
      await ProjectSnapshotModel.deleteMany(removeQuery);
    } else {
      await ProjectSnapshotModel.deleteMany({
        ...removeQuery,
        id: { $nin: Array.from(retainedIds) },
      });
    }

    return true;
  });

  return !!success;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const mongoProjects = await getProjectsFromMongo(userId);
    if (mongoProjects) {
      return NextResponse.json({ projects: mongoProjects });
    }

    const allProjects = await readProjectsFileFallback();
    const projects = userId
      ? allProjects.filter((project) => !project.userId || project.userId === userId)
      : allProjects;

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[ProjectsAPI] Failed to load projects:', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const payload = await request.json();
    const parsed = PayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    return runWithProjectsWriteLock(async () => {
      const projects = parsed.data.projects.map((project) => normalizeProject(project as StoredProject, userId));

      const mongoSaved = await saveProjectsToMongo(userId, projects);
      if (mongoSaved) {
        return NextResponse.json({ success: true });
      }

      if (!userId) {
        await saveProjectsFileFallback(projects);
      } else {
        const allProjects = await readProjectsFileFallback();
        const otherUserProjects = allProjects.filter((project) => project.userId && project.userId !== userId);
        const merged = [...otherUserProjects, ...projects];
        await saveProjectsFileFallback(merged);
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error('[ProjectsAPI] Failed to save projects:', error);
    return NextResponse.json({ error: 'Failed to save projects' }, { status: 500 });
  }
}
