import { type NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Route Handler for POST /api/ai/image
 *
 * 替代 next.config.mjs 中的 rewrite 代理。
 * 原因：rewrite 代理有 ~30s 的隐式超时，而 Gemini 2K/4K 图片生成需要 ~31s+。
 * Route Handler 使用 Node.js 原生 fetch，无代理超时限制，可通过 maxDuration 配置。
 */

// 最长等待 5 分钟（Vercel 等平台使用；本地 dev 不受此限制）
export const maxDuration = 300;

// 禁用 Next.js 对 Request/Response 的缓存，确保每次都是最新数据
export const dynamic = 'force-dynamic';

const SERVER_BASE = process.env.GULUX_API_BASE?.replace(/\/api$/, '') || 'http://localhost:3000';

async function proxyToServer(req: NextRequest): Promise<NextResponse> {
    const targetUrl = `${SERVER_BASE}/api/ai/image`;
    const body = await req.text();

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': req.headers.get('Content-Type') || 'application/json',
            },
            body,
            // Node.js 原生 fetch 没有隐式超时，使用 AbortSignal 设置 5 分钟
            signal: AbortSignal.timeout(300_000),
        });

        const contentType = response.headers.get('Content-Type') || 'application/json';
        const responseBody = await response.text();

        return new NextResponse(responseBody, {
            status: response.status,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[API Route /api/ai/image] Proxy error:', message);
        return NextResponse.json(
            { error: `Proxy error: ${message}` },
            { status: 502 }
        );
    }
}

export async function POST(req: NextRequest) {
    return proxyToServer(req);
}
