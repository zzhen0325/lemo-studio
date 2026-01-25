import { useToast } from '@/hooks/common/use-toast';
import { useAIService } from '@/hooks/ai/useAIService';

export type AIModel = 'gemini' | 'doubao' | 'gpt' | 'auto';

interface UsePromptOptimizationOptions {
  systemInstruction?: string; // 可选，如果不传则使用settings中的配置
}

interface UsePromptOptimizationReturn {
  isOptimizing: boolean;
  optimizePrompt: (text: string, model?: AIModel, image?: string) => Promise<string | null>;
}

export function usePromptOptimization(options: UsePromptOptimizationOptions = {}): UsePromptOptimizationReturn {
  const { callText, callVision, isLoading: isOptimizing } = useAIService();
  const { toast } = useToast();

  const optimizePrompt = async (text: string, model: AIModel = 'auto', image?: string): Promise<string | null> => {
    if (!text.trim() && !image) {
      toast({ title: '错误', description: '请先输入提示词内容或上传图片', variant: 'destructive' });
      return null;
    }

    try {
      // 只在明确指定模型时才覆盖settings中的配置
      let modelId: string | undefined = undefined;
      if (model !== 'auto') {
        if (model === 'doubao') modelId = 'doubao-seed-1-8-251228';
        if (model === 'gpt') modelId = 'deepseek-chat';
        if (model === 'gemini') modelId = 'gemini-3-pro-image-preview';
      }
      // 如果model === 'auto'，则modelId为undefined，useAIService会使用settings中的配置

      let resultText = "";

      if (image) {
        // 使用视觉服务（描述服务）
        const result = await callVision({
          model: modelId, // undefined时使用settings配置
          image: image,
          input: text,
          profileId: 'optimization-with-image'
        });
        resultText = result.text;
      } else {
        // 使用文本服务（优化服务）
        const result = await callText({
          model: modelId, // undefined时使用settings配置
          input: text,
          systemPrompt: options.systemInstruction, // 可选，如果不传则useAIService会使用settings中的systemPrompt
          profileId: 'optimization'
        });
        resultText = result.text;
      }

      if (!resultText) throw new Error('未收到优化结果');

      return resultText;
    } catch (error) {
      console.error("Prompt Optimization Error:", error);
      // useAIService already shows a toast, so we just return null here
      return null;
    }
  };

  return { isOptimizing, optimizePrompt };
}
