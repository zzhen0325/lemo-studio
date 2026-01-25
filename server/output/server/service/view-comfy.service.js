"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewComfyConfigService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
let ViewComfyConfigService = class ViewComfyConfigService {
    getWorkflowsDir() {
        return path_1.default.join(process.cwd(), 'workflows');
    }
    getIndexPath() {
        return path_1.default.join(this.getWorkflowsDir(), 'index.json');
    }
    async getConfig() {
        const workflowsDir = this.getWorkflowsDir();
        const indexPath = this.getIndexPath();
        try {
            const indexContent = await fs_1.promises.readFile(indexPath, 'utf-8');
            const indexData = JSON.parse(indexContent);
            const viewComfys = [];
            for (const workflow of indexData.workflows) {
                const workflowDir = path_1.default.join(workflowsDir, workflow.folder);
                const configPath = path_1.default.join(workflowDir, 'config.json');
                const workflowApiPath = path_1.default.join(workflowDir, 'workflow.json');
                try {
                    const [configContent, workflowApiContent] = await Promise.all([
                        fs_1.promises.readFile(configPath, 'utf-8'),
                        fs_1.promises.readFile(workflowApiPath, 'utf-8'),
                    ]);
                    const config = JSON.parse(configContent);
                    const workflowApi = JSON.parse(workflowApiContent);
                    viewComfys.push({
                        viewComfyJSON: config,
                        workflowApiJSON: workflowApi,
                    });
                }
                catch (workflowError) {
                    console.error(`Failed to load workflow ${workflow.folder}:`, workflowError);
                }
            }
            return {
                appTitle: indexData.appTitle,
                appImg: indexData.appImg,
                viewComfys,
            };
        }
        catch (error) {
            const fallbackPath = path_1.default.join(process.cwd(), 'view_comfy.json');
            try {
                const fileContent = await fs_1.promises.readFile(fallbackPath, 'utf-8');
                return JSON.parse(fileContent);
            }
            catch (fallbackError) {
                console.error('Failed to load workflow configuration', error, fallbackError);
                throw new http_error_1.HttpError(500, 'Failed to load workflow configuration', {
                    error,
                    fallbackError,
                });
            }
        }
    }
    async saveConfig(payload) {
        const workflowsDir = this.getWorkflowsDir();
        const indexPath = this.getIndexPath();
        try {
            await fs_1.promises.mkdir(workflowsDir, { recursive: true });
            const indexData = {
                appTitle: payload.appTitle,
                appImg: payload.appImg,
                workflows: [],
            };
            for (const viewComfy of payload.viewComfys) {
                const config = viewComfy.viewComfyJSON;
                const workflowApi = viewComfy.workflowApiJSON;
                const folderName = config.title.replace(/[<>:"/\\|?*]/g, '_').trim();
                const workflowDir = path_1.default.join(workflowsDir, folderName);
                await fs_1.promises.mkdir(workflowDir, { recursive: true });
                const workflowId = `wf_${folderName.toLowerCase()}`;
                config.id = workflowId;
                await Promise.all([
                    fs_1.promises.writeFile(path_1.default.join(workflowDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8'),
                    fs_1.promises.writeFile(path_1.default.join(workflowDir, 'workflow.json'), JSON.stringify(workflowApi, null, 2), 'utf-8'),
                ]);
                indexData.workflows.push({
                    title: config.title,
                    folder: folderName,
                    id: workflowId,
                });
            }
            await fs_1.promises.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
            return { message: 'Workflow configuration saved successfully' };
        }
        catch (error) {
            const fallbackPath = path_1.default.join(process.cwd(), 'view_comfy.json');
            try {
                await fs_1.promises.writeFile(fallbackPath, JSON.stringify(payload, null, 2), 'utf-8');
                return { message: 'Configuration saved to view_comfy.json (fallback)' };
            }
            catch (fallbackError) {
                console.error('Failed to save workflow configuration', error, fallbackError);
                throw new http_error_1.HttpError(500, 'Failed to save workflow configuration', {
                    error,
                    fallbackError,
                });
            }
        }
    }
};
exports.ViewComfyConfigService = ViewComfyConfigService;
exports.ViewComfyConfigService = ViewComfyConfigService = __decorate([
    (0, gulux_1.Injectable)()
], ViewComfyConfigService);
