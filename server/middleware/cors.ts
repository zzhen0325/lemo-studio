import { GuluXMiddleware, Injectable, ScopeEnum } from '@gulux/gulux';
import { Next, Req, Res } from '@gulux/gulux/application-http';
import type { HTTPRequest, HTTPResponse } from '@gulux/gulux/application-http';
import type { NextFunction } from '@gulux/application';

/**
 * 简单 CORS 处理中间件，允许前端在不同端口访问本服务。
 */
@Injectable({ scope: ScopeEnum.SINGLETON })
export default class CorsMiddleware extends GuluXMiddleware {
  public async use(
    @Req() req: HTTPRequest,
    @Res() res: HTTPResponse,
    @Next() next: NextFunction,
  ) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-tt-logid');
    res.set('Access-Control-Expose-Headers', 'x-tt-logid');
    res.set('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status = 204;
      res.body = '';
      return;
    }

    await next();
  }
}

