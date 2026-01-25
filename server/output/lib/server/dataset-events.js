"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATASET_SYNC_EVENT = exports.datasetEvents = void 0;
const events_1 = require("events");
// 单例模式：确保在 Next.js 开发环境下热更新不会导致创建多个发射器
const globalForEvents = global;
exports.datasetEvents = globalForEvents.datasetEvents || new events_1.EventEmitter();
if (process.env.NODE_ENV !== 'production') {
    globalForEvents.datasetEvents = exports.datasetEvents;
}
// 定义事件类型常量
exports.DATASET_SYNC_EVENT = 'sync';
