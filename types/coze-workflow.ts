export interface CozeWorkflowParams {
  prompt: string;
  image1?: string; // JSON字符串格式: {"file_id":"xxx"}
  image2?: string; // JSON字符串格式: {"file_id":"xxx"}
  image?: string[]; // 多张图片时使用数组格式: [{"file_id":"xxx"}, {"file_id":"yyy"}]
  width?: number;
  height?: number;
}

export interface CozeWorkflowRequest {
  workflow_id: string;
  parameters: {
    parameters: CozeWorkflowParams;
  };
}

export interface CozeWorkflowResponse {
  code: number;
  msg: string;
  data?: {
    id: string;
    workflow_id: string;
    status: 'running' | 'completed' | 'failed';
    parameters: CozeWorkflowParams;
    result?: {
      images?: string[];
      text?: string;
      [key: string]: unknown;
    };
  };
}

export interface CozeUploadResponse {
  code: number;
  msg: string;
  data?: {
    id: string;
    bytes: number;
    created_at: number;
    file_name: string;
  };
}

export interface UseCozeWorkflowOptions {
  onSuccess?: (data: CozeWorkflowResponse) => void;
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
}