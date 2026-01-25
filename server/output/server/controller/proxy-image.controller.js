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
const application_http_1 = require("@gulux/gulux/application-http");
const undici_1 = require("undici");
const http_error_1 = require("../utils/http-error");
let ProxyImageController = class ProxyImageController {
    async getProxyImage(url, res) {
        if (!url) {
            throw new http_error_1.HttpError(400, 'url is required');
        }
        try {
            const decodedUrl = decodeURIComponent(url);
            const response = await (0, undici_1.fetch)(decodedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!response.ok) {
                throw new http_error_1.HttpError(response.status, `Failed to fetch image: ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (contentType) {
                res.set('Content-Type', contentType);
            }
            // 允许跨域
            res.set('Access-Control-Allow-Origin', '*');
            const arrayBuffer = await response.arrayBuffer();
            res.body = Buffer.from(arrayBuffer);
        }
        catch (err) {
            console.error('[ProxyImage] Error:', err);
            if (err instanceof http_error_1.HttpError)
                throw err;
            throw new http_error_1.HttpError(500, err instanceof Error ? err.message : 'Unknown error');
        }
    }
};
__decorate([
    (0, application_http_1.Get)(),
    __param(0, (0, application_http_1.Query)('url')),
    __param(1, (0, application_http_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProxyImageController.prototype, "getProxyImage", null);
ProxyImageController = __decorate([
    (0, application_http_1.Controller)('/proxy-image')
], ProxyImageController);
exports.default = ProxyImageController;
