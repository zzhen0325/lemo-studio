"use strict";
/**
 * API Provider Configuration Types
 * 用于管理模型API的Provider配置
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_METADATA = void 0;
// 服务元信息（用于UI展示）
exports.SERVICE_METADATA = {
    imageGeneration: {
        label: '图像生成',
        description: '生成图像的AI模型',
        requiredTask: 'image',
        hasSystemPrompt: false
    },
    translate: {
        label: '翻译服务',
        description: '将文本翻译为其他语言',
        requiredTask: 'translate',
        hasSystemPrompt: false
    },
    describe: {
        label: '图像描述',
        description: '分析图像并生成描述',
        requiredTask: 'vision',
        hasSystemPrompt: true
    },
    optimize: {
        label: '提示词优化',
        description: '优化用户输入的提示词',
        requiredTask: 'text',
        hasSystemPrompt: true
    }
};
