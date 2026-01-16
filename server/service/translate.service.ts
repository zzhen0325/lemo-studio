import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';

export interface TranslateRequestBody {
  text: string;
  target?: string;
}

export interface TranslateResult {
  translatedText: string;
}

@Injectable()
export class TranslateService {
  public async translate(body: TranslateRequestBody): Promise<TranslateResult> {
    const { text, target = 'en' } = body;

    if (!text) {
      throw new HttpError(400, 'Text is required');
    }

    const apiKey = process.env.GOOGLE_TRANS_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'Missing API Key');
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target,
        format: 'text',
      }),
    });

    const data = (await response.json()) as {
      error?: { message?: string };
      data?: { translations?: { translatedText?: string }[] };
    };

    if (!response.ok) {
      throw new HttpError(response.status, data.error?.message || 'Translation failed');
    }

    const translated = data.data?.translations?.[0]?.translatedText;
    if (!translated) {
      throw new HttpError(500, 'No translation returned');
    }

    return { translatedText: translated };
  }
}
