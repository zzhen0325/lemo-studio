import { Inject } from '@gulux/gulux';
import { Controller, Get } from '@gulux/gulux/application-http';
import { LorasService } from '../service/loras.service';

/**
 * Lora 模型列表：
 * - GET /api/loras
 */
@Controller('/loras')
export default class LorasController {
  @Inject()
  private readonly service!: LorasService;

  @Get()
  public async getLoras() {
    return this.service.listLoras();
  }
}
