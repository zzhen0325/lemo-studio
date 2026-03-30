import { File, FormData, Headers, fetch, Agent } from 'undici';
import type { BodyInit } from 'undici';
import type { ReadableStream } from 'stream/web';
import { HttpError } from '../utils/http-error';
import { toFileLike } from '../utils/formdata';

// 忽略 TLS 证书错误（用于自签名证书的 ComfyUI）
// 注意：仅在开发环境或内网环境使用
const insecureAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

export interface ComfyProxyRequest {
  method: string;
  path?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  files?: Record<string, unknown>;
  apiKey?: string;
  // Deprecated: endpoint is now unified to COMFYUI_API_URL.
  comfyUrl?: string;
  authorization?: string;
}

export interface ComfyProxyResponse {
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
}

export class ComfyProxyService {
  private buildBaseUrl() {
    let url = process.env.COMFYUI_API_URL || '127.0.0.1:8188';
    let secure = false;
    if (url.startsWith('https://')) {
      secure = true;
      url = url.replace('https://', '');
    } else if (url.startsWith('http://')) {
      secure = false;
      url = url.replace('http://', '');
    } else {
      secure = process.env.COMFYUI_SECURE === 'true';
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    return `${secure ? 'https://' : 'http://'}${url}`;
  }

  private buildTargetUrl(baseUrl: string, path?: string, query?: Record<string, string | string[] | undefined>) {
    const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '/';
    const target = new URL(normalizedPath, baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (!value) continue;
        if (key === 'path' || key === 'comfyUrl' || key === 'apiKey' || key === 'comfyApiKey') continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            if (v !== undefined) target.searchParams.append(key, v);
          }
        } else {
          target.searchParams.append(key, value);
        }
      }
    }
    return target.toString();
  }

  private async buildBody(body?: unknown, files?: Record<string, unknown>): Promise<BodyInit | undefined> {
    if (files && Object.keys(files).length > 0) {
      const formData = new FormData();
      if (body && typeof body === 'object') {
        for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
          if (value === undefined || value === null) continue;
          if (typeof value === 'string') {
            formData.append(key, value);
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            formData.append(key, String(value));
          } else {
            formData.append(key, JSON.stringify(value));
          }
        }
      }
      for (const [key, value] of Object.entries(files)) {
        const fileLike = toFileLike(value as never);
        if (!fileLike) continue;
        const buffer = await fileLike.arrayBuffer();
        const file = new File([new Uint8Array(buffer)], fileLike.name, { type: fileLike.type });
        formData.append(key, file);
      }
      return formData;
    }
    if (body === undefined || body === null) return undefined;
    if (typeof body === 'string') return body;
    return JSON.stringify(body);
  }

  public async proxyRequest(request: ComfyProxyRequest): Promise<ComfyProxyResponse> {
    const baseUrl = this.buildBaseUrl();
    const targetUrl = this.buildTargetUrl(baseUrl, request.path, request.query);
    const headers = new Headers();
    if (request.apiKey) {
      headers.set('Authorization', `Bearer ${request.apiKey}`);
    } else if (request.authorization) {
      headers.set('Authorization', request.authorization);
    }

    const body = await this.buildBody(request.body, request.files);
    if (body && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
        dispatcher: insecureAgent,
      });
      return {
        status: response.status,
        headers: response.headers,
        body: response.body as ReadableStream<Uint8Array> | null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proxy request failed';
      throw new HttpError(502, message);
    }
  }
}
