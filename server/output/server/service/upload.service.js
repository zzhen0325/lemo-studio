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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const cdn_1 = require("../utils/cdn");
const db_1 = require("../db");
const AllowedExt = ['png', 'jpg', 'jpeg'];
const FileInfoSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    type: zod_1.z.string().regex(/^image\//),
});
function getExtFromName(name) {
    const idx = name.lastIndexOf('.');
    if (idx !== -1)
        return name.slice(idx + 1).toLowerCase();
    return 'png';
}
let UploadService = class UploadService {
    imageAssetModel;
    async upload(file) {
        const infoParse = FileInfoSchema.safeParse({ name: file.name, type: file.type });
        if (!infoParse.success) {
            throw new http_error_1.HttpError(400, 'Invalid file', infoParse.error.flatten());
        }
        const ext = getExtFromName(file.name);
        if (!AllowedExt.includes(ext)) {
            throw new http_error_1.HttpError(400, 'Unsupported extension');
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        // Generate unique filename to prevent overwrite
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "") || 'image';
        const fileName = `${nameWithoutExt}_${(0, crypto_1.randomUUID)()}.${ext}`;
        const cdnRes = await (0, cdn_1.uploadBufferToCdn)(buffer, {
            fileName,
            dir: 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/upload',
            region: 'SG',
            mimeType: file.type,
        });
        await this.imageAssetModel.create({
            url: cdnRes.url,
            dir: cdnRes.dir,
            fileName: cdnRes.fileName,
            region: 'SG',
            type: 'upload',
        });
        return { path: cdnRes.url };
    }
};
exports.UploadService = UploadService;
__decorate([
    (0, gulux_1.Inject)(db_1.ImageAsset),
    __metadata("design:type", Object)
], UploadService.prototype, "imageAssetModel", void 0);
exports.UploadService = UploadService = __decorate([
    (0, gulux_1.Injectable)()
], UploadService);
