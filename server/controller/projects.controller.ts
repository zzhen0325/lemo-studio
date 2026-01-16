import { Inject } from '@gulux/gulux';
import { Body, Controller, Get, Post, Query } from '@gulux/gulux/application-http';
import { ProjectsService } from '../service/projects.service';
import { HttpError } from '../utils/http-error';

/**
 * 项目管理：
 * - GET  /api/projects
 * - POST /api/projects
 */
@Controller('/projects')
export default class ProjectsController {
  @Inject()
  private readonly service!: ProjectsService;

  @Get()
  public async getProjects(@Query('userId') userId?: string | null) {
    return this.service.getProjects(userId);
  }

  @Post()
  public async postProjects(@Body('userId') userId: string | null, @Body('projects') projects: any[]) {
    if (!Array.isArray(projects)) {
      throw new HttpError(400, 'projects must be an array');
    }
    await this.service.saveProjects(userId, projects);
    return { success: true };
  }
}
