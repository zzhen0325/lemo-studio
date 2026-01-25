import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { Project } from '../db';

@Injectable()
export class ProjectsService {
  @Inject(Project)
  private projectModel!: ModelType<Project>;

  public async getProjects(userId?: string | null): Promise<{ projects: any[] }> {
    try {
      const filter = userId ? { $or: [{ userId }, { userId: { $exists: false } }] } : {};
      const projects = await this.projectModel.find(filter).sort({ createdAt: -1 }).lean();
      return { projects };
    } catch (error) {
      console.error('Failed to load projects', error);
      throw new HttpError(500, 'Failed to load projects');
    }
  }

  public async saveProjects(userId: string | null, projects: any[]): Promise<void> {
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
      const docs = projects.map((p: any) => ({ ...p, userId }));
      if (docs.length > 0) {
        await this.projectModel.insertMany(docs);
      }
    } catch (error) {
      console.error('Failed to save projects', error);
      throw new HttpError(500, 'Failed to save projects');
    }
  }
}
