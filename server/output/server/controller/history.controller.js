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
const history_service_1 = require("../service/history.service");
/**
 * 历史记录：
 * - GET  /api/history
 * - POST /api/history
 */
let HistoryController = class HistoryController {
    service;
    async getHistory(query) {
        return this.service.getHistory(query);
    }
    async postHistory(body) {
        return this.service.saveHistory(body);
    }
    async deleteHistory(body) {
        return this.service.deleteHistory(body.ids);
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", history_service_1.HistoryService)
], HistoryController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)(),
    __param(0, (0, application_http_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getHistory", null);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "postHistory", null);
__decorate([
    (0, application_http_1.Delete)(),
    __param(0, (0, application_http_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "deleteHistory", null);
HistoryController = __decorate([
    (0, application_http_1.Controller)('/history')
], HistoryController);
exports.default = HistoryController;
