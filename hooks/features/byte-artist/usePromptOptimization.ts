import { useState } from 'react';
import { useToast } from '@/hooks/common/use-toast';
import { generateText } from '@/lib/ai/client';

export type AIModel = 'gemini' | 'doubao' | 'gpt';

interface UsePromptOptimizationOptions {
  systemInstruction: string;
}

interface UsePromptOptimizationReturn {
  isOptimizing: boolean;
  optimizePrompt: (text: string, model?: AIModel) => Promise<string | null>;
}

export function usePromptOptimization(options: UsePromptOptimizationOptions): UsePromptOptimizationReturn {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const { toast } = useToast();

  const optimizePrompt = async (text: string, model: AIModel = 'gemini'): Promise<string | null> => {
    if (!text.trim()) {
      toast({
        title: "错误",
        description: "请先输入提示词内容",
        variant: "destructive",
      });
      return null;
    }

    setIsOptimizing(true);

    try {
      // Map legacy model names to registry IDs
      let modelId = 'gemini-3-pro-image-preview';
      if (model === 'doubao') modelId = 'doubao-pro-4k';
      if (model === 'gpt') modelId = 'deepseek-chat';

      const result = await generateText({
        model: modelId,
        input: text,
        systemPrompt: options.systemInstruction,
        profileId: 'optimization'
      });

      if (!result.text) {
        throw new Error('未收到优化结果');
      }

      toast({
        title: "优化完成",
        description: "提示词已成功优化",
      });

      return result.text;

    } catch (error) {
      console.error("AI优化失败:", error);
      toast({
        title: "优化失败",
        description: error instanceof Error ? error.message : "AI优化服务暂时不可用，请稍后重试",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsOptimizing(false);
    }
  };

  return {
    isOptimizing,
    optimizePrompt,
  };
}