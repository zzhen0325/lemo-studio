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
exports.ProjectsService = void 0;
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
let ProjectsService = class ProjectsService {
    projectModel;
    async getProjects(userId) {
        try {
            const filter = userId ? { $or: [{ userId }, { userId: { $exists: false } }] } : {};
            const projects = await this.projectModel.find(filter).sort({ createdAt: -1 }).lean();
            return { projects };
        }
        catch (error) {
            console.error('Failed to load projects', error);
            throw new http_error_1.HttpError(500, 'Failed to load projects');
        }
    }
    async saveProjects(userId, projects) {
        if (!Array.isArray(projects)) {
            throw new http_error_1.HttpError(400, 'Invalid payload');
        }
        try {
            if (!userId) {
                await this.projectModel.deleteMany({});
                await this.projectModel.insertMany(projects);
                return;
            }
            await this.projectModel.deleteMany({ userId });
            const docs = projects.map((p) => ({ ...p, userId }));
            if (docs.length > 0) {
                await this.projectModel.insertMany(docs);
            }
        }
        catch (error) {
            console.error('Failed to save projects', error);
            throw new http_error_1.HttpError(500, 'Failed to save projects');
        }
    }
};
exports.ProjectsService = ProjectsService;
__decorate([
    (0, gulux_1.Inject)(db_1.Project),
    __metadata("design:type", Object)
], ProjectsService.prototype, "projectModel", void 0);
exports.ProjectsService = ProjectsService = __decorate([
    (0, gulux_1.Injectable)()
], ProjectsService);
