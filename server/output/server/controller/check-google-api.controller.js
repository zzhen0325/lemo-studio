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
const gulux_1 = require("@gulux/gulux");
const application_http_1 = require("@gulux/gulux/application-http");
const check_google_api_service_1 = require("../service/check-google-api.service");
/**
 * Google 可用性检查
 * - GET /api/check-google-api
 */
let CheckGoogleApiController = class CheckGoogleApiController {
    service;
    async getStatus() {
        return this.service.check();
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", check_google_api_service_1.CheckGoogleApiService)
], CheckGoogleApiController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CheckGoogleApiController.prototype, "getStatus", null);
CheckGoogleApiController = __decorate([
    (0, application_http_1.Controller)('/check-google-api')
], CheckGoogleApiController);
exports.default = CheckGoogleApiController;
