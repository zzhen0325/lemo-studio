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
const http_error_1 = require("../utils/http-error");
const application_http_1 = require("@gulux/gulux/application-http");
/**
 * 全局异常处理中间件：
 * - 统一将未捕获异常转成 JSON 响应
 * - 控制台输出错误日志
 */
let GlobalExceptionMiddleware = class GlobalExceptionMiddleware extends gulux_1.GuluXMiddleware {
    async use(req, res, next) {
        try {
            await next();
        }
        catch (error) {
            const err = error;
            if (err instanceof http_error_1.HttpError) {
                console.error(`[HttpError] ${req?.method ?? ''} ${req?.url ?? ''} -> ${err.status}:`, err.message, err.details);
                if (res) {
                    res.status = err.status;
                    res.body = {
                        error: err.message,
                        details: err.details ?? null,
                    };
                }
                return;
            }
            const message = err instanceof Error ? err.message : 'Internal Server Error';
            console.error(`[Error] ${req?.method ?? ''} ${req?.url ?? ''}:`, err);
            if (res) {
                res.status = 500;
                res.body = {
                    error: message,
                };
            }
        }
    }
};
__decorate([
    __param(0, (0, application_http_1.Req)()),
    __param(1, (0, application_http_1.Res)()),
    __param(2, (0, application_http_1.Next)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], GlobalExceptionMiddleware.prototype, "use", null);
GlobalExceptionMiddleware = __decorate([
    (0, gulux_1.Injectable)({ scope: gulux_1.ScopeEnum.SINGLETON })
], GlobalExceptionMiddleware);
exports.default = GlobalExceptionMiddleware;
