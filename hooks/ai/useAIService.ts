"use client";

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/common/use-toast';
import {
    generateText as clientGenerateText,
    describeImage as clientDescribeImage,
    generateImage as clientGenerateImage,
    ClientGenerationParams,
    ClientDescribeParams,
    ClientImageParams
} from '@/lib/ai/client';
import { useAPIConfigStore } from '@/lib/store/api-config-store';
import { ServiceType, serviceSupportsSystemPrompt } from '@/lib/api-config/types';
import { selectModelsForContext } from '@/lib/model-center';

// 硬编码的默认值，确保即使store还没加载完也有fallback
const FALLBACK_DEFAULTS: Record<ServiceType, string> = {
    imageGeneration: 'gemini-3-pro-image-preview',
    translate: 'doubao-seed-2-0-lite-260215',
    describe: 'coze-prompt',
    optimize: 'coze-prompt',
    datasetLabel: 'doubao-seed-2-0-lite-260215',
};

export function useAIService() {
    const { toast } = useToast();
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const isLoading = pendingRequestCount > 0;
    const startLoading = useCallback(() => {
        setPendingRequestCount((current) => current + 1);
    }, []);
    const stopLoading = useCallback(() => {
        setPendingRequestCount((current) => (current > 0 ? current - 1 : 0));
    }, []);

    // 直接订阅整个store状态
    const settings = useAPIConfigStore(state => state.settings);
    const providers = useAPIConfigStore(state => state.providers);
    const fetchConfig = useAPIConfigStore(state => state.fetchConfig);

    // 初始化时获取配置
    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const resolveSystemPrompt = useCallback(
        (service: ServiceType, modelId: string, systemPrompt?: string) => {
            if (!serviceSupportsSystemPrompt(service, { providerId: '', modelId })) {
                return undefined;
            }

            const normalizedPrompt = systemPrompt?.trim();
            return normalizedPrompt ? normalizedPrompt : undefined;
        },
        []
    );

    // 获取指定服务的模型ID和系统提示词
    const getServiceConfig = useCallback((service: ServiceType): { modelId: string; systemPrompt?: string } => {
        const serviceConfig = settings.services?.[service];
        const servicePrompt = serviceConfig && 'systemPrompt' in serviceConfig
            ? serviceConfig.systemPrompt
            : undefined;

        if (serviceConfig?.binding?.modelId) {
            return {
                modelId: serviceConfig.binding.modelId,
                systemPrompt: resolveSystemPrompt(service, serviceConfig.binding.modelId, servicePrompt)
            };
        }

        if (service === 'imageGeneration') {
            const model = selectModelsForContext(providers, 'service:imageGeneration', { requiredTask: 'image' })[0];
            if (model?.modelId) {
                return { modelId: model.modelId, systemPrompt: resolveSystemPrompt(service, model.modelId, servicePrompt) };
            }
        }
        if (service === 'describe') {
            const model = selectModelsForContext(providers, 'service:describe', { requiredTask: 'vision' })[0];
            if (model?.modelId) {
                return { modelId: model.modelId, systemPrompt: resolveSystemPrompt(service, model.modelId, servicePrompt) };
            }
        }
        if (service === 'optimize') {
            const model = selectModelsForContext(providers, 'service:optimize', { requiredTask: 'text' })[0];
            if (model?.modelId) {
                return { modelId: model.modelId, systemPrompt: resolveSystemPrompt(service, model.modelId, servicePrompt) };
            }
        }
        if (service === 'datasetLabel') {
            const model = selectModelsForContext(providers, 'service:datasetLabel', { requiredTask: 'vision' })[0];
            if (model?.modelId) {
                return { modelId: model.modelId };
            }
        }

        // 最终fallback
        const modelId = FALLBACK_DEFAULTS[service];
        return { modelId, systemPrompt: resolveSystemPrompt(service, modelId, servicePrompt) };
    }, [settings, providers, resolveSystemPrompt]);

    const callText = async (params: Partial<ClientGenerationParams> & { input: string }) => {
        startLoading();
        try {
            // 获取优化服务的配置
            const optimizeConfig = getServiceConfig('optimize');
            const model = params.model || optimizeConfig.modelId;
            const systemPrompt = resolveSystemPrompt(
                'optimize',
                model,
                params.systemPrompt ?? optimizeConfig.systemPrompt
            );

            const result = await clientGenerateText({
                ...params,
                model,
                systemPrompt
            });
            return result;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            toast({ title: 'AI 文本服务错误', description: msg, variant: 'destructive' });
            throw error;
        } finally {
            stopLoading();
        }
    };

    const callVision = async (params: Partial<ClientDescribeParams> & { image: string }) => {
        startLoading();
        try {
            const targetService: ServiceType = params.context === 'service:datasetLabel' ? 'datasetLabel' : 'describe';
            const describeConfig = getServiceConfig(targetService);
            const model = params.model || describeConfig.modelId;
            const systemPrompt = resolveSystemPrompt(
                targetService,
                model,
                params.systemPrompt ?? describeConfig.systemPrompt
            );

            const result = await clientDescribeImage({
                ...params,
                model,
                systemPrompt
            } as ClientDescribeParams);
            return result;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            toast({ title: 'AI 视觉服务错误', description: msg, variant: 'destructive' });
            throw error;
        } finally {
            stopLoading();
        }
    };

    const callImage = async (
        params: ClientImageParams,
        onStream?: (chunk: { text?: string; images?: string[] }) => void
    ) => {
        startLoading();
        try {
            const result = await clientGenerateImage(params, onStream);
            return result;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            toast({ title: 'AI 图像服务错误', description: msg, variant: 'destructive' });
            throw error;
        } finally {
            stopLoading();
        }
    };

    return {
        callText,
        callVision,
        callImage,
        isLoading,
        getServiceConfig
    };
}
