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
exports.HistoryService = void 0;
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
const bytedmongoose_1 = require("@byted/bytedmongoose");
const mongo_1 = require("../utils/mongo");
let HistoryService = class HistoryService {
    generationModel;
    imageAssetModel;
    async getHistory(query) {
        const { page, limit, projectId, userId } = query;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        // 自动清理过期记录：改为概率触发 (1%) 且非阻塞
        if (Math.random() < 0.01) {
            this.cleanupStaleGenerations().catch(err => console.error('Background cleanup failed:', err));
        }
        try {
            const filter = {};
            if (projectId && projectId !== 'null' && projectId !== 'undefined') {
                filter.projectId = projectId;
            }
            if (userId) {
                filter.userId = userId;
            }
            const total = await this.generationModel.countDocuments(filter);
            const items = await this.generationModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .select('-config.editConfig -llmResponse') // 大幅度减少 Payload，列表不需要这些字段
                .populate(['outputImageId', 'sourceImageId'])
                .lean();
            const history = items.map((item) => {
                const restoredItem = (0, mongo_1.restoreMongoKeys)(item);
                const outputImage = restoredItem.outputImageId;
                const sourceImage = restoredItem.sourceImageId;
                const storedSourceUrls = restoredItem.sourceImageUrls;
                const singleSourceUrl = sourceImage?.url || restoredItem.config?.sourceImageUrl;
                // 规范化 sourceImageUrls：统一到 config 内
                const sourceImageUrls = (restoredItem.config?.sourceImageUrls && restoredItem.config.sourceImageUrls.length > 0)
                    ? restoredItem.config.sourceImageUrls
                    : storedSourceUrls && storedSourceUrls.length > 0
                        ? storedSourceUrls
                        : (singleSourceUrl ? [singleSourceUrl] : []);
                // 规范化 localSourceIds：统一到 config 内
                const localSourceIds = (restoredItem.config?.localSourceIds && restoredItem.config.localSourceIds.length > 0)
                    ? restoredItem.config.localSourceIds
                    : restoredItem.localSourceIds ||
                        (restoredItem.config?.localSourceId ? [restoredItem.config.localSourceId] : []);
                return {
                    id: String(restoredItem._id),
                    userId: restoredItem.userId || 'anonymous',
                    projectId: restoredItem.projectId || 'default',
                    outputUrl: outputImage?.url || restoredItem.outputUrl,
                    config: {
                        ...restoredItem.config,
                        sourceImageUrls,
                        localSourceIds,
                    },
                    status: restoredItem.status || 'completed',
                    createdAt: String(restoredItem.createdAt || new Date().toISOString()),
                    progress: restoredItem.progress,
                    progressStage: restoredItem.progressStage,
                    llmResponse: restoredItem.llmResponse,
                };
            });
            return {
                history,
                total,
                hasMore: (pageNum - 1) * limitNum + history.length < total,
            };
        }
        catch (error) {
            console.error('Failed to load history:', error);
            throw new http_error_1.HttpError(500, 'Failed to load history');
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async saveHistory(body) {
        try {
            if (body.action === 'batch-update' && Array.isArray(body.items)) {
                const items = body.items;
                for (const item of items) {
                    if (!item.id || !(0, bytedmongoose_1.isValidObjectId)(item.id))
                        continue;
                    const sanitizedItem = (0, mongo_1.sanitizeMongoKeys)(item);
                    await this.generationModel.updateOne({ _id: item.id }, { $set: { ...sanitizedItem, outputUrl: sanitizedItem.outputUrl } });
                }
                return { success: true };
            }
            if (body.action === 'sync-image' && body.localId && body.path) {
                // 更新所有匹配 localSourceId 的记录
                await this.generationModel.updateMany({ 'config.localSourceId': body.localId }, {
                    $set: { 'config.sourceImageUrl': body.path },
                    // Also update first element of sourceImageUrls if it exists
                });
                // Update sourceImageUrls array - replace first element
                await this.generationModel.updateMany({ 'config.localSourceId': body.localId, 'config.sourceImageUrls.0': { $exists: true } }, { $set: { 'config.sourceImageUrls.0': body.path } });
                return { success: true };
            }
            const item = body;
            if (!item || (!item.outputUrl && !item.id)) {
                throw new http_error_1.HttpError(400, 'Invalid item');
            }
            const cfg = (item.config || {});
            // 优先从 config 中读取 sourceImageUrls，兼容旧数据结构
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const effectiveSourceImageUrls = cfg.sourceImageUrls || item.sourceImageUrls || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const effectiveLocalSourceIds = cfg.localSourceIds || item.localSourceIds || [];
            const record = {
                userId: item.userId || 'anonymous',
                projectId: item.projectId || 'default',
                outputUrl: item.outputUrl,
                config: {
                    ...cfg,
                    sourceImageUrls: effectiveSourceImageUrls,
                    localSourceIds: effectiveLocalSourceIds,
                },
                status: item.status || 'completed',
                progress: item.progress,
                progressStage: item.progressStage,
                llmResponse: item.llmResponse,
                createdAt: item.createdAt || new Date().toISOString(),
            };
            const existing = item.id && (0, bytedmongoose_1.isValidObjectId)(item.id)
                ? await this.generationModel.findById(item.id)
                : item.outputUrl
                    ? await this.generationModel.findOne({ outputUrl: item.outputUrl })
                    : null;
            const sanitizedRecord = (0, mongo_1.sanitizeMongoKeys)(record);
            if (existing) {
                await this.generationModel.updateOne({ _id: existing._id }, { $set: sanitizedRecord });
            }
            else {
                const newDoc = await this.generationModel.create(sanitizedRecord);
                if (item.outputUrl) {
                    await this.imageAssetModel.updateOne({ url: item.outputUrl }, { $set: { type: 'generation', generationId: String(newDoc._id) } }, { upsert: true });
                    const outputImage = await this.imageAssetModel.findOne({ url: item.outputUrl });
                    await this.generationModel.updateOne({ _id: newDoc._id }, { outputImageId: outputImage?._id });
                }
            }
            // 移除原有的在末尾单独更新 editConfig 的逻辑，因为上面已经整合进 record 了
            return { success: true };
        }
        catch (error) {
            console.error('Failed to save history item:', error);
            if (error instanceof http_error_1.HttpError)
                throw error;
            throw new http_error_1.HttpError(500, 'Failed to save history item');
        }
    }
    async deleteHistory(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new http_error_1.HttpError(400, 'Invalid IDs');
            }
            const validIds = ids.filter((id) => (0, bytedmongoose_1.isValidObjectId)(id));
            if (validIds.length === 0) {
                throw new http_error_1.HttpError(400, 'No valid IDs provided');
            }
            await this.generationModel.deleteMany({ _id: { $in: validIds } });
            return { success: true };
        }
        catch (error) {
            console.error('Failed to delete history:', error);
            if (error instanceof http_error_1.HttpError)
                throw error;
            throw new http_error_1.HttpError(500, 'Failed to delete history');
        }
    }
    async cleanupStaleGenerations() {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const result = await this.generationModel.deleteMany({
                status: 'pending',
                createdAt: { $lt: tenMinutesAgo }
            });
            if (result.deletedCount > 0) {
                console.log(`[HistoryService] Cleaned up ${result.deletedCount} stale generation records.`);
            }
        }
        catch (error) {
            console.error('[HistoryService] Failed to cleanup stale generations:', error);
        }
    }
};
exports.HistoryService = HistoryService;
__decorate([
    (0, gulux_1.Inject)(db_1.Generation),
    __metadata("design:type", Object)
], HistoryService.prototype, "generationModel", void 0);
__decorate([
    (0, gulux_1.Inject)(db_1.ImageAsset),
    __metadata("design:type", Object)
], HistoryService.prototype, "imageAssetModel", void 0);
exports.HistoryService = HistoryService = __decorate([
    (0, gulux_1.Injectable)()
], HistoryService);
