import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';

export interface GoogleApiCheckResult {
  status: 'connected' | 'blocked' | 'offline';
  message?: string;
  code?: number;
}

@Injectable()
export class CheckGoogleApiService {
  public async check(): Promise<GoogleApiCheckResult> {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
      // 保持与原实现一致的语义：视为 500 场景
      throw new HttpError(500, 'Missing API Key', {
        status: 'error',
        message: 'Missing API Key',
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { status: 'connected', message: 'ok' };
      }

      const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        status: 'blocked',
        message: errorData.error?.message || 'API rejected',
        code: response.status,
      };
    } catch {
      return {
        status: 'offline',
        message: 'Network connection failed',
      };
    }
  }
}
