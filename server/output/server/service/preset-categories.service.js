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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresetCategoriesService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
const CATEGORIES_PATH = path_1.default.join(process.cwd(), 'public/preset/categories.json');
const DEFAULT_CATEGORIES = ['General', 'Portrait', 'Landscape', 'Anime', '3D', 'Architecture', 'Character', 'Workflow', 'Other'];
let PresetCategoriesService = class PresetCategoriesService {
    categoryModel;
    async getCategories() {
        try {
            const doc = await this.categoryModel.findOne({ key: 'default' }).lean();
            if (doc && doc.categories && doc.categories.length > 0) {
                return doc.categories;
            }
            // Try migration
            const fromFile = await this.migrateFromFiles();
            if (fromFile)
                return fromFile;
            return DEFAULT_CATEGORIES;
        }
        catch (error) {
            console.error('Failed to get categories from DB', error);
            return DEFAULT_CATEGORIES;
        }
    }
    async migrateFromFiles() {
        try {
            const content = await promises_1.default.readFile(CATEGORIES_PATH, 'utf-8');
            const categories = JSON.parse(content);
            if (categories && categories.length > 0) {
                await this.saveCategories(categories);
                return categories;
            }
        }
        catch { /* ignore */ }
        return null;
    }
    async saveCategories(categories) {
        try {
            await this.categoryModel.updateOne({ key: 'default' }, { categories }, { upsert: true });
            return categories;
        }
        catch (error) {
            console.error('Failed to save categories to DB', error);
            throw new http_error_1.HttpError(500, 'Failed to save categories');
        }
    }
};
exports.PresetCategoriesService = PresetCategoriesService;
__decorate([
    (0, gulux_1.Inject)(db_1.PresetCategory),
    __metadata("design:type", Object)
], PresetCategoriesService.prototype, "categoryModel", void 0);
exports.PresetCategoriesService = PresetCategoriesService = __decorate([
    (0, gulux_1.Injectable)()
], PresetCategoriesService);
