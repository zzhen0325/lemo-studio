"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const modelRegistry_1 = require("../../lib/ai/modelRegistry");
const system_prompts_1 = require("../../config/system-prompts");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
let AiService = class AiService {
    async describe(body) {
        const { image, model, profileId, systemPrompt: explicitSystemPrompt, prompt, options } = body;
        if (!image) {
            throw new http_error_1.HttpError(400, 'Missing image data');
        }
        if (!model) {
            throw new http_error_1.HttpError(400, 'Missing model ID');
        }
        const providerInstance = (0, modelRegistry_1.getProvider)(model);
        // 仅在运行时做一次特性判断
        if (!("describeImage" in providerInstance)) {
            throw new http_error_1.HttpError(400, `Model ${model} does not support vision tasks`);
        }
        let resolvedSystemPrompt = explicitSystemPrompt;
        if (!resolvedSystemPrompt && profileId) {
            let providerIdForPrompt = 'unknown';
            if (model.includes('gemini') || model.includes('google'))
                providerIdForPrompt = 'google';
            else if (model.includes('doubao'))
                providerIdForPrompt = 'doubao';
            else if (model.includes('deepseek'))
                providerIdForPrompt = 'deepseek';
            resolvedSystemPrompt = (0, system_prompts_1.getSystemPrompt)(profileId, providerIdForPrompt);
        }
        const params = {
            image,
            prompt,
            systemPrompt: resolvedSystemPrompt,
            options,
        };
        const result = await providerInstance.describeImage(params);
        return { text: result.text };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async generateImage(body) {
        const { prompt, model, width, height, batchSize, aspectRatio, image, images, options } = body;
        if (!model) {
            throw new http_error_1.HttpError(400, 'Missing model ID');
        }
        const providerInstance = (0, modelRegistry_1.getProvider)(model);
        if (!("generateImage" in providerInstance)) {
            throw new http_error_1.HttpError(400, `Model ${model} does not support image generation`);
        }
        const params = {
            prompt: prompt ?? '',
            width,
            height,
            batchSize,
            aspectRatio,
            imageSize: body.imageSize, // 使用 imageSize
            image,
            images, // 传递多张参考图
            options: {
                ...options,
                // Ensure stream is true for coze-image models if we are expecting a stream
                stream: options?.stream === true || model === 'coze_seed4'
            },
        };
        const result = await providerInstance.generateImage(params);
        return result;
    }
    // 文本生成，可能返回流式结果，由调用方决定如何包装 HTTP 响应
    async generateText(body) {
        const { input, model, profileId, systemPrompt: explicitSystemPrompt, options } = body;
        if (!input) {
            throw new http_error_1.HttpError(400, 'Missing input text');
        }
        if (!model) {
            throw new http_error_1.HttpError(400, 'Missing model ID');
        }
        const providerInstance = (0, modelRegistry_1.getProvider)(model);
        let resolvedSystemPrompt = explicitSystemPrompt;
        if (!resolvedSystemPrompt && profileId) {
            let providerIdForPrompt = 'unknown';
            if (model.includes('doubao'))
                providerIdForPrompt = 'doubao';
            else if (model.includes('deepseek'))
                providerIdForPrompt = 'deepseek';
            else if (model.includes('gemini'))
                providerIdForPrompt = 'google';
            else if (model.includes('google'))
                providerIdForPrompt = 'google';
            resolvedSystemPrompt = (0, system_prompts_1.getSystemPrompt)(profileId, providerIdForPrompt);
        }
        const params = {
            input,
            systemPrompt: resolvedSystemPrompt,
            options,
        };
        if (!("generateText" in providerInstance)) {
            throw new http_error_1.HttpError(400, `Model ${model} does not support text generation`);
        }
        const result = await providerInstance.generateText(params);
        if (result.stream) {
            return { stream: result.stream };
        }
        return { text: result.text };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, gulux_1.Injectable)()
], AiService);
