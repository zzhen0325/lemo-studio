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
const styles_service_1 = require("../service/styles.service");
const http_error_1 = require("../utils/http-error");
/**
 * 风格样式栈：
 * - GET    /api/styles
 * - POST   /api/styles
 * - DELETE /api/styles?id=xxx
 */
let StylesController = class StylesController {
    service;
    async getStyles() {
        return this.service.listStyles();
    }
    async postStyle(style) {
        return this.service.saveStyle(style);
    }
    async deleteStyle(id) {
        if (!id) {
            throw new http_error_1.HttpError(400, 'Missing ID');
        }
        await this.service.deleteStyle(id);
        return { success: true };
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", styles_service_1.StylesService)
], StylesController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StylesController.prototype, "getStyles", null);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StylesController.prototype, "postStyle", null);
__decorate([
    (0, application_http_1.Delete)(),
    __param(0, (0, application_http_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StylesController.prototype, "deleteStyle", null);
StylesController = __decorate([
    (0, application_http_1.Controller)('/styles')
], StylesController);
exports.default = StylesController;
