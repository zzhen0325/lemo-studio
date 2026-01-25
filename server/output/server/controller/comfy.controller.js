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
const node_stream_1 = require("node:stream");
const comfy_service_1 = require("../service/comfy.service");
const formdata_1 = require("../utils/formdata");
/**
 * Comfy 工作流接口：
 * - POST /api/comfy
 * 请求体 multipart/form-data：workflow、viewComfy、apiKey、comfyUrl
 * 返回 octet-stream，内容为以 `--BLOB_SEPARATOR--` 分隔的多文件数据
 */
let ComfyController = class ComfyController {
    comfyService;
    async postComfy(body, files, logIdHeader, logIdHeaderUpper, res) {
        const formData = (0, formdata_1.buildFormDataLike)(body, files);
        const logId = logIdHeader ?? logIdHeaderUpper;
        const stream = await this.comfyService.runWorkflowFromFormData(formData, logId);
        if (res) {
            res.set('Content-Type', 'application/octet-stream');
            res.set('Content-Disposition', 'attachment; filename="generated_images.bin"');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            res.body = node_stream_1.Readable.fromWeb(stream);
            return;
        }
        return stream;
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", comfy_service_1.ComfyService)
], ComfyController.prototype, "comfyService", void 0);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)()),
    __param(1, (0, application_http_1.Files)()),
    __param(2, (0, application_http_1.Header)('x-tt-logid')),
    __param(3, (0, application_http_1.Header)('X-TT-LOGID')),
    __param(4, (0, application_http_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ComfyController.prototype, "postComfy", null);
ComfyController = __decorate([
    (0, application_http_1.Controller)('/comfy')
], ComfyController);
exports.default = ComfyController;
