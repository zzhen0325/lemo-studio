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
const dataset_sync_service_1 = require("../service/dataset-sync.service");
/**
 * 数据集变更 SSE：
 * - GET /api/dataset/sync
 */
let DatasetSyncController = class DatasetSyncController {
    service;
    async getSyncStream(res) {
        const stream = this.service.createSyncStream();
        res.set('Content-Type', 'text/event-stream');
        res.set('Cache-Control', 'no-cache, no-transform');
        res.set('Connection', 'keep-alive');
        res.body = stream;
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", dataset_sync_service_1.DatasetSyncService)
], DatasetSyncController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)('/sync'),
    __param(0, (0, application_http_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DatasetSyncController.prototype, "getSyncStream", null);
DatasetSyncController = __decorate([
    (0, application_http_1.Controller)('/dataset')
], DatasetSyncController);
exports.default = DatasetSyncController;
