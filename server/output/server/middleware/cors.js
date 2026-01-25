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
/**
 * 简单 CORS 处理中间件，允许前端在不同端口访问本服务。
 */
let CorsMiddleware = class CorsMiddleware extends gulux_1.GuluXMiddleware {
    async use(req, res, next) {
        const origin = req.get('Origin');
        if (origin) {
            res.set('Access-Control-Allow-Origin', origin);
            res.set('Access-Control-Allow-Credentials', 'true');
        }
        else {
            res.set('Access-Control-Allow-Origin', '*');
        }
        res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-tt-logid');
        res.set('Access-Control-Expose-Headers', 'x-tt-logid');
        res.set('Access-Control-Max-Age', '86400');
        if (req.method === 'OPTIONS') {
            res.status = 204;
            res.body = '';
            return;
        }
        await next();
    }
};
__decorate([
    __param(0, (0, application_http_1.Req)()),
    __param(1, (0, application_http_1.Res)()),
    __param(2, (0, application_http_1.Next)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], CorsMiddleware.prototype, "use", null);
CorsMiddleware = __decorate([
    (0, gulux_1.Injectable)({ scope: gulux_1.ScopeEnum.SINGLETON })
], CorsMiddleware);
exports.default = CorsMiddleware;
