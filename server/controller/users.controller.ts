import { Inject } from '@gulux/gulux';
import { Body, Controller, Get, Post, Put, Query } from '@gulux/gulux/application-http';
import { UsersService } from '../service/users.service';

/**
 * 用户管理：
 * - GET  /api/users
 * - POST /api/users
 * - PUT  /api/users
 */
@Controller('/users')
export default class UsersController {
  @Inject()
  private readonly service!: UsersService;

  @Get()
  public async getUsers(@Query('id') id?: string | null) {
    return this.service.getUsers(id ?? undefined);
  }

  @Post()
  public async postUsers(@Body() body: any) {
    return this.service.handlePost(body);
  }

  @Put()
  public async putUsers(@Body() body: any) {
    return this.service.updateUser(body);
  }
}
