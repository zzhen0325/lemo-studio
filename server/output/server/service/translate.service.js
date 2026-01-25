"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslateService = void 0;
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
let TranslateService = class TranslateService {
    async translate(body) {
        const { text, target = 'en' } = body;
        if (!text) {
            throw new http_error_1.HttpError(400, 'Text is required');
        }
        const apiKey = process.env.GOOGLE_TRANS_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new http_error_1.HttpError(500, 'Missing API Key');
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
        const data = (await response.json());
        if (!response.ok) {
            throw new http_error_1.HttpError(response.status, data.error?.message || 'Translation failed');
        }
        const translated = data.data?.translations?.[0]?.translatedText;
        if (!translated) {
            throw new http_error_1.HttpError(500, 'No translation returned');
        }
        return { translatedText: translated };
    }
};
exports.TranslateService = TranslateService;
exports.TranslateService = TranslateService = __decorate([
    (0, gulux_1.Injectable)()
], TranslateService);
