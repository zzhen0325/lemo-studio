"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewComfyIntegration = void 0;
const viewcomfy_api_services_1 = require("./viewcomfy-api-services");
/**
 * ViewComfy集成类，用于处理工作流执行和结果转换
 */
class ViewComfyIntegration {
    /**
     * 将用户输入转换为ViewComfy API参数格式
     */
    static convertUserInputsToParams(config, userInputs) {
        const params = {};
        config.components.forEach(component => {
            const value = userInputs[component.id];
            if (value !== undefined) {
                // 使用组件的参数名称作为API参数键
                const paramName = component.properties.paramName || component.id;
                // 根据组件类型进行值转换
                switch (component.type) {
                    case "number":
                    case "slider":
                        params[paramName] = Number(value);
                        break;
                    case "switch":
                        params[paramName] = Boolean(value);
                        break;
                    case "file":
                        // 文件类型直接传递File对象
                        if (value instanceof File) {
                            params[paramName] = value;
                        }
                        break;
                    default:
                        params[paramName] = value;
                }
            }
        });
        return params;
    }
    /**
     * 构建工作流覆盖数据
     */
    static buildWorkflowOverride(config, userInputs) {
        if (!config.workflowTemplate) {
            return undefined;
        }
        // 深拷贝工作流模板
        const workflowData = JSON.parse(JSON.stringify(config.workflowTemplate));
        // 应用用户输入到工作流
        config.components.forEach(component => {
            const value = userInputs[component.id];
            if (value !== undefined && component.properties.mappingPath) {
                // 根据映射路径设置工作流数据
                const path = component.properties.mappingPath.split('.');
                let current = workflowData;
                for (let i = 0; i < path.length - 1; i++) {
                    const key = path[i];
                    if (!current[key]) {
                        current[key] = {};
                    }
                    current = current[key];
                }
                // 应用值转换
                let finalValue = value;
                if (component.properties.valueTransform) {
                    try {
                        // 简单的值转换支持
                        const transformFunc = new Function('value', `return ${component.properties.valueTransform}`);
                        finalValue = transformFunc(value);
                    }
                    catch (error) {
                        console.warn(`值转换失败 (${component.id}):`, error);
                    }
                }
                current[path[path.length - 1]] = finalValue;
            }
        });
        return workflowData;
    }
    /**
     * 执行ViewComfy工作流生成
     */
    static async generateWithViewComfy(options) {
        const { config, userInputs, apiUrl, clientId, clientSecret, onProgress, withLogs = false } = options;
        try {
            // 转换用户输入为API参数
            const params = this.convertUserInputsToParams(config, userInputs);
            // 构建工作流覆盖数据
            const overrideWorkflowApi = this.buildWorkflowOverride(config, userInputs);
            let promptResult = null;
            if (withLogs && onProgress) {
                // 使用带日志的流式API
                promptResult = await (0, viewcomfy_api_services_1.inferWithLogsStream)({
                    apiUrl,
                    params,
                    overrideWorkflowApi,
                    clientId,
                    clientSecret,
                    loggingCallback: onProgress
                });
            }
            else {
                // 使用标准API
                const stream = await (0, viewcomfy_api_services_1.infer)({
                    apiUrl,
                    params,
                    overrideWorkflowApi,
                    clientId,
                    clientSecret
                });
                // 处理流式响应
                if (stream) {
                    // 这里需要处理ReadableStream，暂时跳过
                    console.log("收到流式响应，需要进一步处理");
                }
            }
            if (!promptResult) {
                throw new Error("未收到生成结果");
            }
            // 转换结果为统一格式
            const results = promptResult.outputs.map((blob, index) => {
                const url = URL.createObjectURL(blob);
                // 根据MIME类型确定结果类型
                let type = "image";
                if (blob.type.startsWith("image/")) {
                    type = "image";
                }
                else if (blob.type.startsWith("video/")) {
                    type = "video";
                }
                else if (blob.type.startsWith("audio/")) {
                    type = "audio";
                }
                else if (blob.type.startsWith("text/")) {
                    type = "text";
                }
                return {
                    id: `result_${promptResult.prompt_id}_${index}`,
                    type,
                    url,
                    blob,
                    filename: `output_${index + 1}.${this.getFileExtensionFromMimeType(blob.type)}`,
                    metadata: {
                        promptId: promptResult.prompt_id,
                        executionTime: promptResult.execution_time_seconds,
                        mimeType: blob.type,
                        size: blob.size
                    }
                };
            });
            return results;
        }
        catch (error) {
            console.error("ViewComfy生成失败:", error);
            throw error;
        }
    }
    /**
     * 根据MIME类型获取文件扩展名
     */
    static getFileExtensionFromMimeType(mimeType) {
        const mimeToExt = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
            "video/mp4": "mp4",
            "video/webm": "webm",
            "audio/mp3": "mp3",
            "audio/wav": "wav",
            "text/plain": "txt",
            "application/json": "json"
        };
        return mimeToExt[mimeType] || "bin";
    }
    /**
     * 验证ViewComfy配置
     */
    static validateViewComfyConfig(config) {
        const errors = [];
        // 检查必要的配置
        if (!config.viewComfyEndpoint) {
            errors.push("缺少ViewComfy API端点配置");
        }
        // 检查组件映射
        config.components.forEach(component => {
            if (!component.properties.paramName && !component.properties.mappingPath) {
                errors.push(`组件 "${component.label}" 缺少参数映射配置`);
            }
        });
        return {
            valid: errors.length === 0,
            errors
        };
    }
    /**
     * 获取环境变量中的ViewComfy凭据
     */
    static getViewComfyCredentials() {
        return {
            clientId: process.env.NEXT_PUBLIC_VIEWCOMFY_CLIENT_ID,
            clientSecret: process.env.NEXT_PUBLIC_VIEWCOMFY_CLIENT_SECRET
        };
    }
}
exports.ViewComfyIntegration = ViewComfyIntegration;
