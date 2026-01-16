import { Inject } from '@gulux/gulux';
import { Controller, Get } from '@gulux/gulux/application-http';
import { CheckGoogleApiService } from '../service/check-google-api.service';

/**
 * Google 可用性检查
 * - GET /api/check-google-api
 */
@Controller('/check-google-api')
export default class CheckGoogleApiController {
  @Inject()
  private readonly service!: CheckGoogleApiService;

  @Get()
  public async getStatus() {
    return this.service.check();
  }
}
