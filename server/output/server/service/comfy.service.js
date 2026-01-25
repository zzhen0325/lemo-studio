"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyService = void 0;
const comfyui_service_1 = require("../../lib/api/comfyui-service");
const errors_1 = require("../../app/models/errors");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const errorResponseFactory = new errors_1.ErrorResponseFactory();
let ComfyService = class ComfyService {
    async runWorkflowFromFormData(formData, logId) {
        let workflow;
        const workflowStr = formData.get('workflow');
        if (workflowStr && workflowStr !== 'undefined') {
            workflow = JSON.parse(workflowStr);
        }
        let viewComfy = { inputs: [], textOutputEnabled: false };
        const viewComfyStr = formData.get('viewComfy');
        if (viewComfyStr && viewComfyStr !== 'undefined') {
            viewComfy = JSON.parse(viewComfyStr);
        }
        if (!viewComfy) {
            throw new http_error_1.HttpError(400, 'viewComfy is required');
        }
        try {
            const apiKey = formData.get('apiKey');
            const comfyUrl = formData.get('comfyUrl');
            const comfyUIService = new comfyui_service_1.ComfyUIService({ apiKey, comfyUrl });
            const stream = await comfyUIService.runWorkflow({ workflow, viewComfy });
            console.log('[ComfyService] runWorkflow success', { logId: logId ?? '' });
            return stream;
        }
        catch (error) {
            console.error('[ComfyService] runWorkflow failed', { logId: logId ?? '', error });
            const responseError = errorResponseFactory.getErrorResponse(error);
            throw new http_error_1.HttpError(500, responseError.errorMsg, responseError);
        }
    }
};
exports.ComfyService = ComfyService;
exports.ComfyService = ComfyService = __decorate([
    (0, gulux_1.Injectable)()
], ComfyService);
