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
const api_config_service_1 = require("../service/api-config.service");
const http_error_1 = require("../utils/http-error");
/**
 * API 配置：
 * - GET    /api/api-config
 * - POST   /api/api-config
 * - DELETE /api/api-config?id=xxx
 */
let ApiConfigController = class ApiConfigController {
    service;
    async getConfig(res) {
        const data = await this.service.getAll();
        if (res) {
            res.set('Content-Type', 'application/json');
            res.body = data;
            return;
        }
        return data;
    }
    async postConfig(body) {
        return this.service.handlePost(body);
    }
    async deleteProvider(id) {
        if (!id) {
            throw new http_error_1.HttpError(400, 'Missing provider ID');
        }
        await this.service.deleteProvider(id);
        return { success: true };
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", api_config_service_1.ApiConfigService)
], ApiConfigController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)(),
    __param(0, (0, application_http_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApiConfigController.prototype, "getConfig", null);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApiConfigController.prototype, "postConfig", null);
__decorate([
    (0, application_http_1.Delete)(),
    __param(0, (0, application_http_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApiConfigController.prototype, "deleteProvider", null);
ApiConfigController = __decorate([
    (0, application_http_1.Controller)('/api-config')
], ApiConfigController);
exports.default = ApiConfigController;
