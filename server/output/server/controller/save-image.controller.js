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
const save_image_service_1 = require("../service/save-image.service");
/**
 * 保存图片：
 * - POST /api/save-image
 */
let SaveImageController = class SaveImageController {
    service;
    async postSaveImage(body) {
        return this.service.save(body);
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", save_image_service_1.SaveImageService)
], SaveImageController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SaveImageController.prototype, "postSaveImage", null);
SaveImageController = __decorate([
    (0, application_http_1.Controller)('/save-image')
], SaveImageController);
exports.default = SaveImageController;
