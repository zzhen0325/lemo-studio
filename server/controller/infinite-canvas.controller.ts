import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@gulux/gulux/application-http';
import { InfiniteCanvasService } from '../service/infinite-canvas.service';
import type { InfiniteCanvasProject } from '@/types/infinite-canvas';
import { HttpError } from '../utils/http-error';

@Controller('/infinite-canvas/projects')
export default class InfiniteCanvasController {
  @Inject()
  private readonly service!: InfiniteCanvasService;

  @Get()
  public async listProjects() {
    return this.service.listProjects();
  }

  @Post()
  public async createProject(@Body() body: { projectName?: string }) {
    return this.service.createProject(body || {});
  }

  @Get('/:projectId')
  public async getProject(@Param('projectId') projectId: string) {
    return this.service.getProject(projectId);
  }

  @Put('/:projectId')
  public async saveProject(@Param('projectId') projectId: string, @Body() body: InfiniteCanvasProject) {
    return this.service.saveProject(projectId, body);
  }

  @Patch('/:projectId')
  public async renameProject(@Param('projectId') projectId: string, @Body() body: { projectName?: string }) {
    const projectName = body?.projectName?.trim();
    if (!projectName) {
      throw new HttpError(400, 'projectName is required');
    }

    return this.service.renameProject(projectId, projectName);
  }

  @Post('/:projectId/duplicate')
  public async duplicateProject(@Param('projectId') projectId: string) {
    return this.service.duplicateProject(projectId);
  }

  @Delete('/:projectId')
  public async deleteProject(@Param('projectId') projectId: string) {
    return this.service.deleteProject(projectId);
  }
}
