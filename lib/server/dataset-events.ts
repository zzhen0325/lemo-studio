import { EventEmitter } from 'events';

// 单例模式：确保在 Next.js 开发环境下热更新不会导致创建多个发射器
const globalForEvents = global as unknown as { datasetEvents: EventEmitter };

export const datasetEvents = globalForEvents.datasetEvents || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
    globalForEvents.datasetEvents = datasetEvents;
}

// 定义事件类型常量
export const DATASET_SYNC_EVENT = 'sync';
