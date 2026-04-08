import { useToast } from '@/hooks/common/use-toast';
import { useAIService } from '@/hooks/ai/useAIService';
import { useAPIConfigStore } from '@/lib/store/api-config-store';
import { selectModelsForContext } from '@/lib/model-center';

export type AIModel = 'gemini' | 'doubao' | 'gpt' | 'auto';

interface OptimizePromptCallOptions {
  profileId?: string;
}

interface UsePromptOptimizationReturn {
  isOptimizing: boolean;
  optimizePrompt: (
    text: string,
    model?: AIModel,
    image?: string,
    callOptions?: OptimizePromptCallOptions,
  ) => Promise<string | null>;
}

export function usePromptOptimization(
): UsePromptOptimizationReturn {
  const { callText, callVision, isLoading: isOptimizing } = useAIService();
  const { toast } = useToast();
  const providers = useAPIConfigStore((state) => state.providers);

  const optimizePrompt = async (
    text: string,
    model: AIModel = 'auto',
    image?: string,
    callOptions?: OptimizePromptCallOptions,
  ): Promise<string | null> => {
    if (!text.trim() && !image) {
      toast({ title: '错误', description: '请先输入提示词内容或上传图片', variant: 'destructive' });
      return null;
    }

    try {
      let modelId: string | undefined;
      if (model !== 'auto') {
        if (model === 'doubao') modelId = 'doubao-seed-1-8-251228';
        if (model === 'gpt') modelId = 'deepseek-chat';
        if (model === 'gemini') {
          const gemini = selectModelsForContext(providers, 'service:optimize', { requiredTask: 'text' })
            .find((item) => item.modelId.startsWith('gemini-'));
          modelId = gemini?.modelId || 'gemini-3-pro-image-preview';
        }
      }

      let resultText = '';

      if (image) {
        const result = await callVision({
          model: modelId,
          image,
          input: text,
          ...(callOptions?.profileId ? { profileId: callOptions.profileId } : {}),
        });
        resultText = result.text;
      } else {
        const result = await callText({
          model: modelId,
          input: text,
          ...(callOptions?.profileId ? { profileId: callOptions.profileId } : {}),
        });
        resultText = result.text;
      }

      if (!resultText) {
        throw new Error('未收到优化结果');
      }

      return resultText;
    } catch (error) {
      console.error('Prompt Optimization Error:', error);
      return null;
    }
  };

  return { isOptimizing, optimizePrompt };
}
