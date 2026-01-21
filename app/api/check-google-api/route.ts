import { NextResponse } from 'next/server';
import { getGoogleApiKey } from '@/lib/ai/modelRegistry';
import { getProxyAgent } from '@/lib/ai/utils';

export async function GET() {
    // 检查 Google API 连通性
    const apiKey = getGoogleApiKey();

    if (!apiKey) {
        return NextResponse.json({ status: 'error', message: 'Missing API Key' }, { status: 500 });
    }

    try {
        // 尝试直接 fetch Google API 的模型列表接口（轻量级检查）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

        const agent = getProxyAgent();
        const fetchOptions: RequestInit & { agent?: unknown } = {
            signal: controller.signal,
            method: 'GET',
        };

        if (agent) {
            fetchOptions.agent = agent;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, fetchOptions);

        clearTimeout(timeoutId);

        if (response.ok) {
            return NextResponse.json({ status: 'connected', latency: 'ok' });
        } else {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json({
                status: 'blocked',
                message: errorData.error?.message || 'API rejected',
                code: response.status
            });
        }
    } catch {
        return NextResponse.json({
            status: 'offline',
            message: 'Network connection failed'
        });
    }
}
