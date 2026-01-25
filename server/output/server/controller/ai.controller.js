"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const gulux_1 = require("@gulux/gulux");
const application_http_1 = require("@gulux/gulux/application-http");
const ai_service_1 = require("../service/ai.service");
const node_stream_1 = require("node:stream");
const http_error_1 = require("../utils/http-error");
const ai_1 = require("../../lib/schemas/ai");
/**
 * AI 相关接口（GuluX）
 *
 * - POST /api/ai/describe
 * - POST /api/ai/image
 * - POST /api/ai/text
 */
let AiController = class AiController {
    aiService;
    async postDescribe(body) {
        const parsed = ai_1.DescribeRequestSchema.safeParse(body);
        if (!parsed.success) {
            throw new http_error_1.HttpError(400, 'Invalid request payload', parsed.error.flatten());
        }
        return this.aiService.describe(parsed.data);
    }
    async postImage(body, res) {
        const parsed = ai_1.ImageRequestSchema.safeParse(body);
        if (!parsed.success) {
            throw new http_error_1.HttpError(400, 'Invalid request payload', parsed.error.flatten());
        }
        const result = await this.aiService.generateImage(parsed.data);
        if (result.stream) {
            res.set('Content-Type', 'text/event-stream');
            res.set('Cache-Control', 'no-cache, no-transform');
            res.set('Connection', 'keep-alive');
            res.set('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            res.body = node_stream_1.Readable.fromWeb(result.stream);
            // 强制再次设置 Content-Type，确保框架不会因为 body 赋值而重写它
            res.set('Content-Type', 'text/event-stream');
            return;
        }
        return result;
    }
    async postText(body, res) {
        const parsed = ai_1.TextRequestSchema.safeParse(body);
        if (!parsed.success) {
            throw new http_error_1.HttpError(400, 'Invalid request payload', parsed.error.flatten());
        }
        const result = await this.aiService.generateText(parsed.data);
        if (result.stream) {
            res.set('Content-Type', 'text/event-stream');
            res.set('Cache-Control', 'no-cache, no-transform');
            res.set('Connection', 'keep-alive');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            res.body = node_stream_1.Readable.fromWeb(result.stream);
            res.set('Content-Type', 'text/event-stream');
            return;
        }
        return result;
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", ai_service_1.AiService)
], AiController.prototype, "aiService", void 0);
__decorate([
    (0, application_http_1.Post)('/describe'),
    __param(0, (0, application_http_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "postDescribe", null);
__decorate([
    (0, application_http_1.Post)('/image'),
    __param(0, (0, application_http_1.Body)()),
    __param(1, (0, application_http_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "postImage", null);
__decorate([
    (0, application_http_1.Post)('/text'),
    __param(0, (0, application_http_1.Body)()),
    __param(1, (0, application_http_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "postText", null);
AiController = __decorate([
    (0, application_http_1.Controller)('/ai')
], AiController);
exports.default = AiController;
