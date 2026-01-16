import { useState, useCallback } from 'react';
import { CozeWorkflowParams, CozeWorkflowResponse, UseCozeWorkflowOptions } from '@/types/coze-workflow';
import { getApiBase } from '@/lib/api-base';

interface UseCozeWorkflowReturn {
  loading: boolean;
  error: Error | null;
  data: CozeWorkflowResponse | null;
  runWorkflow: (params: CozeWorkflowParams) => Promise<string | null>;
  uploadFile: (file: File) => Promise<string | null>;
  reset: () => void;
}

export function useCozeWorkflow(options?: UseCozeWorkflowOptions): UseCozeWorkflowReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<CozeWorkflowResponse | null>(null);

  const { retryCount = 3, retryDelay = 1000, onSuccess, onError } = options || {};

  // 文件上传功能
  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${getApiBase()}/coze-upload`, {

        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.msg || 'File upload failed');
      }
      console.log('result.data.id====',result)
      return result.data.id; // 直接返回 file_id
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }, []);

  // 运行工作流
  const runWorkflow = useCallback(async (params: CozeWorkflowParams): Promise<string | null> => {
    setLoading(true);
    setError(null);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        console.log('11111============', params);
        const response = await fetch(`${getApiBase()}/coze-workflow`, {

          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });

        const result = await response.json();

        if (result.code !== 0) {
          throw new Error(result.msg || 'Workflow execution failed');
        }

        // 提取图片URL - 根据Coze API响应格式解析
        let imageUrl = null;
        
        // 根据你提供的响应格式，result.data 包含 Coze SDK 的响应
        if (result.data && result.data.data) {
          try {
            // result.data.data 是一个字符串化的 JSON，包含 output 数组
            const parsedData = JSON.parse(result.data.data);
            if (parsedData.output) {
              // output 是一个字符串化的数组，如: "[\"https://s.coze.cn/t/QXpP5td5xt0/\"]"
              const outputArray = JSON.parse(parsedData.output);
              imageUrl = outputArray[0]; // 获取第一个URL
            }
          } catch (e) {
            console.error('Failed to parse result.data.data:', e);
          }
        } else {
          // 如果不是预期的格式，尝试其他可能的格式
          imageUrl = result.data?.imageUrl || result.data?.url || result.data;
        }
        
        setData(result);
        setLoading(false);
        
        if (onSuccess) {
          onSuccess(result);
        }

        return imageUrl;
      } catch (error) {
        lastError = error as Error;
        console.error(`Workflow execution attempt ${attempt + 1} failed:`, error);

        if (attempt < retryCount - 1) {
          // 等待重试延迟
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // 所有重试都失败
    setError(lastError);
    setLoading(false);
    
    if (onError) {
      onError(lastError!);
    }

    return null;
  }, [retryCount, retryDelay, onSuccess, onError]);

  // 重置状态
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    loading,
    error,
    data,
    runWorkflow,
    uploadFile,
    reset,
  };
}