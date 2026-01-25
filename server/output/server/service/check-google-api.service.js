"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckGoogleApiService = void 0;
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const modelRegistry_1 = require("../../lib/ai/modelRegistry");
let CheckGoogleApiService = class CheckGoogleApiService {
    async check() {
        const apiKey = (0, modelRegistry_1.getGoogleApiKey)();
        if (!apiKey) {
            // 保持与原实现一致的语义：视为 500 场景
            throw new http_error_1.HttpError(500, 'Missing API Key', {
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
            const errorData = (await response.json().catch(() => ({})));
            return {
                status: 'blocked',
                message: errorData.error?.message || 'API rejected',
                code: response.status,
            };
        }
        catch {
            return {
                status: 'offline',
                message: 'Network connection failed',
            };
        }
    }
};
exports.CheckGoogleApiService = CheckGoogleApiService;
exports.CheckGoogleApiService = CheckGoogleApiService = __decorate([
    (0, gulux_1.Injectable)()
], CheckGoogleApiService);
