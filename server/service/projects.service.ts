import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { Project } from '../db';

@Injectable()
export class ProjectsService {
  @Inject(Project)
  private projectModel!: ModelType<Project>;

  public async getProjects(userId?: string | null): Promise<{ projects: Record<string, unknown>[] }> {
    try {
      const filter = userId ? { $or: [{ userId }, { userId: { $exists: false } }] } : {};
      const projects = await this.projectModel.find(filter).sort({ createdAt: -1 }).lean() as unknown as Record<string, unknown>[];
      return { projects };
    } catch (error) {
      console.error('Failed to load projects', error);
      throw new HttpError(500, 'Failed to load projects');
    }
  }

  public async saveProjects(userId: string | null, projects: Record<string, unknown>[]): Promise<void> {
    if (!Array.isArray(projects)) {
      throw new HttpError(400, 'Invalid payload');
    }

    try {
      if (!userId) {
        await this.projectModel.deleteMany({});
        await this.projectModel.insertMany(projects);
        return;
      }

      await this.projectModel.deleteMany({ userId });
      const docs = projects.map((p) => ({ ...p, userId }));
      if (docs.length > 0) {
        await this.projectModel.insertMany(docs);
      }
    } catch (error) {
      console.error('Failed to save projects', error);
      throw new HttpError(500, 'Failed to save projects');
    }
  }
}
