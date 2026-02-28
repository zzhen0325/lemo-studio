import { GuluXMiddleware, Injectable, ScopeEnum } from '@gulux/gulux';
import { Next, Req, Res } from '@gulux/gulux/application-http';
import type { HTTPRequest, HTTPResponse } from '@gulux/gulux/application-http';
import type { NextFunction } from '@gulux/application';

/**
 * CORS 中间件：默认仅允许本地开发域名，可通过环境变量扩展。
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function parseAllowedOrigins() {
  const envOrigins = process.env.CORS_ALLOW_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return envOrigins && envOrigins.length > 0 ? envOrigins : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin: string, allowedOrigins: string[]) {
  return allowedOrigins.includes(origin);
}

@Injectable({ scope: ScopeEnum.SINGLETON })
export default class CorsMiddleware extends GuluXMiddleware {
  public async use(
    @Req() req: HTTPRequest,
    @Res() res: HTTPResponse,
    @Next() next: NextFunction,
  ) {
    const origin = req.get('Origin');
    const allowedOrigins = parseAllowedOrigins();
    const allowAll = process.env.CORS_ALLOW_ALL === 'true';
    const isAllowed = Boolean(origin) && (allowAll || isOriginAllowed(origin, allowedOrigins));

    if (origin) {
      if (isAllowed) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      res.set('Access-Control-Allow-Origin', '*');
    }
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-tt-logid,x-request-id');
    res.set('Access-Control-Expose-Headers', 'x-tt-logid,x-request-id');
    res.set('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      if (origin && !isAllowed) {
        res.status = 403;
        res.body = 'CORS origin not allowed';
        return;
      }
      res.status = 204;
      res.body = '';
      return;
    }

    // 对 AI 生成等长耗时接口强制 Connection: close，
    // 防止 Next.js rewrite 代理因复用过期 keep-alive 连接而 ECONNRESET
    const longRunningPaths = ['/api/ai/image', '/api/ai/text', '/api/translate'];
    if (longRunningPaths.some(p => req.path?.startsWith?.(p))) {
      res.set('Connection', 'close');
    }

    await next();
  }
}
