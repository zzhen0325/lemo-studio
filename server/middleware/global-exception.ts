import { GuluXMiddleware, Injectable, ScopeEnum } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';
import { Next, Req, Res } from '@gulux/gulux/application-http';
import type { HTTPRequest, HTTPResponse } from '@gulux/gulux/application-http';
import type { NextFunction } from '@gulux/application';

/**
 * 全局异常处理中间件：
 * - 统一将未捕获异常转成 JSON 响应
 * - 控制台输出错误日志
 */
@Injectable({ scope: ScopeEnum.SINGLETON })
export default class GlobalExceptionMiddleware extends GuluXMiddleware {
  public async use(
    @Req() req: HTTPRequest,
    @Res() res: HTTPResponse,
    @Next() next: NextFunction,
  ) {
    try {
      await next();
    } catch (error) {
      const err = error as unknown;

      if (err instanceof HttpError) {
        console.error(
          `[HttpError] ${req?.method ?? ''} ${req?.url ?? ''} -> ${err.status}:`,
          err.message,
          err.details,
        );
        if (res) {
          res.status = err.status;
          res.body = {
            error: err.message,
            details: err.details ?? null,
          };
        }
        return;
      }

      const message = err instanceof Error ? err.message : 'Internal Server Error';
      console.error(`[Error] ${req?.method ?? ''} ${req?.url ?? ''}:`, err);

      if (res) {
        res.status = 500;
        res.body = {
          error: message,
        };
      }
    }
  }
}
