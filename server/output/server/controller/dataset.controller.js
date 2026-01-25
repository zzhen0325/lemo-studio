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
const dataset_service_1 = require("../service/dataset.service");
const formdata_1 = require("../utils/formdata");
const http_error_1 = require("../utils/http-error");
const dataset_1 = require("../../lib/schemas/dataset");
/**
 * 数据集管理：
 * - GET    /api/dataset
 * - POST   /api/dataset
 * - DELETE /api/dataset
 * - PUT    /api/dataset
 */
let DatasetController = class DatasetController {
    service;
    async getDataset(query) {
        const parsed = dataset_1.DatasetQuerySchema.safeParse(query);
        if (!parsed.success) {
            throw new http_error_1.HttpError(400, 'Invalid query', parsed.error.flatten());
        }
        return this.service.getDataset(parsed.data);
    }
    async postDataset(body, files) {
        const parsed = dataset_1.DatasetPostSchema.safeParse({
            collection: body?.collection,
            mode: body?.mode,
            newName: body?.newName,
        });
        if (!parsed.success) {
            throw new http_error_1.HttpError(400, 'Invalid payload', parsed.error.flatten());
        }
        const fileLike = (0, formdata_1.toFileLike)(files?.file);
        const params = {
            file: fileLike
                ? {
                    name: fileLike.name,
                    arrayBuffer: fileLike.arrayBuffer,
                }
                : null,
            collection: parsed.data.collection,
            mode: parsed.data.mode,
            newName: parsed.data.newName ?? undefined,
        };
        return this.service.postDataset(params);
    }
    async deleteDataset(params) {
        const parsed = dataset_1.DatasetDeleteSchema.safeParse(params);
        if (!parsed.success) {
            throw new http_error_1.HttpError(400, 'Invalid query', parsed.error.flatten());
        }
        return this.service.deleteDataset(parsed.data);
    }
    async putDataset(body) {
        const parsed = dataset_1.DatasetUpdateSchema.safeParse(body);
        if (!parsed.success) {
            throw new http_error_1.HttpError(400, 'Invalid payload', parsed.error.flatten());
        }
        return this.service.updateDataset(parsed.data);
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", dataset_service_1.DatasetService)
], DatasetController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)(),
    __param(0, (0, application_http_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DatasetController.prototype, "getDataset", null);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)()),
    __param(1, (0, application_http_1.Files)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DatasetController.prototype, "postDataset", null);
__decorate([
    (0, application_http_1.Delete)(),
    __param(0, (0, application_http_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DatasetController.prototype, "deleteDataset", null);
__decorate([
    (0, application_http_1.Put)(),
    __param(0, (0, application_http_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DatasetController.prototype, "putDataset", null);
DatasetController = __decorate([
    (0, application_http_1.Controller)('/dataset')
], DatasetController);
exports.default = DatasetController;
