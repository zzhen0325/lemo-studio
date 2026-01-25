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
const tools_presets_service_1 = require("../service/tools-presets.service");
const formdata_1 = require("../utils/formdata");
const http_error_1 = require("../utils/http-error");
/**
 * 工具预设：
 * - GET    /api/tools/presets?toolId=xxx
 * - POST   /api/tools/presets
 * - DELETE /api/tools/presets?id=xxx&toolId=xxx
 */
let ToolsPresetsController = class ToolsPresetsController {
    service;
    async getPresets(toolId) {
        if (!toolId) {
            throw new http_error_1.HttpError(400, 'Missing toolId');
        }
        return this.service.listPresets(toolId);
    }
    async postPreset(body, files) {
        const formData = (0, formdata_1.buildFormDataLike)(body, files);
        return this.service.savePresetFromFormData(formData);
    }
    async deletePreset(id, toolId) {
        if (!id || !toolId) {
            throw new http_error_1.HttpError(400, 'Missing id or toolId');
        }
        await this.service.deletePreset(toolId, id);
        return { success: true };
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", tools_presets_service_1.ToolsPresetsService)
], ToolsPresetsController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)(),
    __param(0, (0, application_http_1.Query)('toolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ToolsPresetsController.prototype, "getPresets", null);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)()),
    __param(1, (0, application_http_1.Files)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ToolsPresetsController.prototype, "postPreset", null);
__decorate([
    (0, application_http_1.Delete)(),
    __param(0, (0, application_http_1.Query)('id')),
    __param(1, (0, application_http_1.Query)('toolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ToolsPresetsController.prototype, "deletePreset", null);
ToolsPresetsController = __decorate([
    (0, application_http_1.Controller)('/tools/presets')
], ToolsPresetsController);
exports.default = ToolsPresetsController;
