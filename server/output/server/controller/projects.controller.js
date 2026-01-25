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
const projects_service_1 = require("../service/projects.service");
const http_error_1 = require("../utils/http-error");
/**
 * 项目管理：
 * - GET  /api/projects
 * - POST /api/projects
 */
let ProjectsController = class ProjectsController {
    service;
    async getProjects(userId) {
        return this.service.getProjects(userId);
    }
    async postProjects(userId, projects) {
        if (!Array.isArray(projects)) {
            throw new http_error_1.HttpError(400, 'projects must be an array');
        }
        await this.service.saveProjects(userId, projects);
        return { success: true };
    }
};
__decorate([
    (0, gulux_1.Inject)(),
    __metadata("design:type", projects_service_1.ProjectsService)
], ProjectsController.prototype, "service", void 0);
__decorate([
    (0, application_http_1.Get)(),
    __param(0, (0, application_http_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getProjects", null);
__decorate([
    (0, application_http_1.Post)(),
    __param(0, (0, application_http_1.Body)('userId')),
    __param(1, (0, application_http_1.Body)('projects')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "postProjects", null);
ProjectsController = __decorate([
    (0, application_http_1.Controller)('/projects')
], ProjectsController);
exports.default = ProjectsController;
