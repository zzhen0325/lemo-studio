import { Controller, Get, Query, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { fetch } from 'undici';
import { HttpError } from '../utils/http-error';

@Controller('/proxy-image')
export default class ProxyImageController {
    @Get()
    public async getProxyImage(@Query('url') url: string, @Res() res: HTTPResponse) {
        if (!url) {
            throw new HttpError(400, 'url is required');
        }

        try {
            const decodedUrl = decodeURIComponent(url);
            const response = await fetch(decodedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new HttpError(response.status, `Failed to fetch image: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType) {
                res.set('Content-Type', contentType);
            }

            // 允许跨域
            res.set('Access-Control-Allow-Origin', '*');

            const arrayBuffer = await response.arrayBuffer();
            res.body = Buffer.from(arrayBuffer);
        } catch (err) {
            console.error('[ProxyImage] Error:', err);
            if (err instanceof HttpError) throw err;
            throw new HttpError(500, err instanceof Error ? err.message : 'Unknown error');
        }
    }
}
