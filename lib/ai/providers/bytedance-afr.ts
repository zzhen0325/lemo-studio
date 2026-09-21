import { ImageProvider, ModelConfig, ImageGenerationInput, ImageResult } from "../types";
import { generateNonce, generateTimestamp, generateSign, getProxyAgent } from "../utils";
import { logProviderEvent, getRequestHost } from "./provider-diagnostics";

const warnedBytedanceAfrFallback = new Set<string>();

function resolveBytedanceAfrConfig() {
  const configured = {
    baseUrl: process.env.GATEWAY_BASE_URL?.trim() || "",
    aid: process.env.BYTEDANCE_AID?.trim() || "",
    appKey: process.env.BYTEDANCE_APP_KEY?.trim() || "",
    appSecret: process.env.BYTEDANCE_APP_SECRET?.trim() || "",
  };
  const missing = Object.entries({
    GATEWAY_BASE_URL: configured.baseUrl,
    BYTEDANCE_AID: configured.aid,
    BYTEDANCE_APP_KEY: configured.appKey,
    BYTEDANCE_APP_SECRET: configured.appSecret,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(`Missing ByteDance AFR environment variables: ${missing.join(", ")}`);
  }

  if (missing.length > 0) {
    const warningKey = missing.join(",");
    if (!warnedBytedanceAfrFallback.has(warningKey)) {
      warnedBytedanceAfrFallback.add(warningKey);
      console.warn("[AIProvider][bytedance-afr] Using development fallback config. Set explicit env vars before production deploy.", {
        missing,
      });
    }
  }

  return {
    BASE_URL: configured.baseUrl || "https://lv-api-lf.ulikecam.com",
    AID: configured.aid || "6834",
    APP_KEY: configured.appKey || "a89de09e9bca4723943e8830a642464d",
    APP_SECRET: configured.appSecret || "8505d553a24c485fb7d9bb336a3651a8",
    missing,
  };
}

/**
 * Bytedance Standard Image Generation API (Seed4 / ByteArtist)
 */
export class BytedanceAfrProvider implements ImageProvider {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  /**
   * 提交图片生成任务
   * 使用 submit_task_v2 接口
   */
  private async submitTask(params: {
    prompt: string;
    width: number;
    height: number;
    image?: string;
  }): Promise<string> {
    const { prompt, width, height, image } = params;
    const API_CONFIG = resolveBytedanceAfrConfig();

    const submitUrl = `${API_CONFIG.BASE_URL}/media/api/pic/submit_task_v2`;

    // 构建 req_json
    const reqJson: Record<string, unknown> = {
      width,
      height,
      seed: -1,
    };
    if (this.config.modelId === "seed4_0916_lemo") {
      reqJson.Prompt = prompt;
    } else {
      reqJson.string = prompt;
    }

    // 生成签名参数
    const nonce = generateNonce();
    const timestamp = generateTimestamp();
    const sign = generateSign(nonce, timestamp, API_CONFIG.APP_SECRET);

    const formData = new URLSearchParams();
    formData.append("aid", API_CONFIG.AID);
    formData.append("app_key", API_CONFIG.APP_KEY);
    formData.append("nonce", nonce);
    formData.append("timestamp", timestamp);
    formData.append("sign", sign);
    formData.append("req_key", this.config.modelId);
    formData.append("req_json", JSON.stringify(reqJson));
    formData.append("img_return_type", "url");
    formData.append("img_return_format", "png");
    formData.append("expired_duration", "600");

    // 处理参考图片
    if (image) {
      if (image.startsWith("http")) {
        formData.append("image_url", image);
      } else if (image.startsWith("data:")) {
        // base64 data URL
        const base64Data = image.split(",")[1];
        formData.append("image_data", base64Data);
      } else {
        // 纯 base64
        formData.append("image_data", image);
      }
    }

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    logProviderEvent("bytedance-afr", "submit_task_start", {
      modelId: this.config.modelId,
      host: getRequestHost(submitUrl),
      width,
      height,
      usingFallbackConfig: API_CONFIG.missing.length > 0,
    });

    const response = await fetch(submitUrl, fetchOptions);
    const data = await response.json() as { data?: { task_id?: string }; message?: string; status_code?: number };

    if (!response.ok || data.status_code !== 0) {
      console.error("[AIProvider][bytedance-afr] submit_task_error", {
        modelId: this.config.modelId,
        host: getRequestHost(submitUrl),
        status: response.status,
        statusCode: data.status_code,
        message: data.message,
      });
      throw new Error(`Submit task failed: ${data.message || response.status}`);
    }

    const taskId = data.data?.task_id;
    if (!taskId) {
      throw new Error("No task_id returned from submit_task_v2");
    }

    logProviderEvent("bytedance-afr", "submit_task_success", {
      modelId: this.config.modelId,
      taskId,
    });

    return taskId;
  }

  /**
   * 轮询获取任务结果
   * 使用 batch_get_result_v2 接口
   */
  private async pollForResult(taskId: string): Promise<string[]> {
    const API_CONFIG = resolveBytedanceAfrConfig();
    const pollUrl = `${API_CONFIG.BASE_URL}/media/api/pic/batch_get_result_v2`;

    // 轮询配置
    const maxAttempts = 120; // 最多轮询 120 次
    const pollInterval = 1000; // 每秒轮询一次

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // 每次请求都生成新的签名参数
      const nonce = generateNonce();
      const timestamp = generateTimestamp();
      const sign = generateSign(nonce, timestamp, API_CONFIG.APP_SECRET);

      const formData = new URLSearchParams();
      formData.append("aid", API_CONFIG.AID);
      formData.append("app_key", API_CONFIG.APP_KEY);
      formData.append("nonce", nonce);
      formData.append("timestamp", timestamp);
      formData.append("sign", sign);
      formData.append("req_key", this.config.modelId);
      formData.append("task_ids", taskId);
      formData.append("img_return_type", "url");
      formData.append("img_return_format", "png");

      const agent = getProxyAgent();
      const fetchOptions: RequestInit & { agent?: unknown } = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      };

      if (agent) {
        fetchOptions.agent = agent;
      }

      const response = await fetch(pollUrl, fetchOptions);
      const data = await response.json() as {
        data?: {
          results?: Array<{
            status?: number | string;
            pic_urls?: Array<{ main_url?: string; backup_url?: string }>;
            binary_data?: string[];
            message?: string;
          }>;
        };
        status_code?: number;
        message?: string;
      };

      if (!response.ok || data.status_code !== 0) {
        console.error("[AIProvider][bytedance-afr] poll_result_error", {
          modelId: this.config.modelId,
          taskId,
          attempt,
          status: response.status,
          statusCode: data.status_code,
          message: data.message,
        });
        throw new Error(`Poll result failed: ${data.message || response.status}`);
      }

      const result = data.data?.results?.[0];

      if (result) {
        // 判断任务是否完成
        // status 可能是数字 (1) 或字符串 ("done")
        const status = result.status;
        const isDone = status === 'done' || status === 1 || status === 'DONE';

        if (isDone) {
          // 优先取 pic_urls
          const picUrls = result.pic_urls;
          if (picUrls && picUrls.length > 0) {
            const images: string[] = [];
            for (const p of picUrls) {
              // 优先 main_url，其次 backup_url
              const url = p.main_url || p.backup_url;
              if (url) {
                images.push(url);
              }
            }

            if (images.length > 0) {
              logProviderEvent("bytedance-afr", "poll_result_success", {
                modelId: this.config.modelId,
                taskId,
                attempt,
                imageCount: images.length,
                status: String(status),
              });
              return images;
            }
          }

          // 如果有 binary_data，转换为 data URL
          if (result.binary_data && result.binary_data.length > 0) {
            const images = result.binary_data.map(b64 => `data:image/png;base64,${b64}`);
            logProviderEvent("bytedance-afr", "poll_result_success", {
              modelId: this.config.modelId,
              taskId,
              attempt,
              imageCount: images.length,
              status: String(status),
              source: 'binary_data',
            });
            return images;
          }

          // 完成但无图片
          throw new Error(`Task completed but no image data: ${result.message || "No pic_urls or binary_data"}`);
        }

        // 任务失败状态
        if (status === 'failed' || status === 2 || status === 'FAILED') {
          throw new Error(`Task failed: ${result.message || "Unknown error"}`);
        }

        // 处理中，记录日志
        if (attempt % 5 === 0) {
          logProviderEvent("bytedance-afr", "poll_result_pending", {
            modelId: this.config.modelId,
            taskId,
            attempt,
            status: String(status),
          });
        }
      }

      // 还在处理中，等待后继续轮询
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Poll timeout: task ${taskId} did not complete within ${maxAttempts} seconds`);
  }

  async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
    const { prompt, width, height, imageSize, image, images } = params;
    const API_CONFIG = resolveBytedanceAfrConfig();
    const startedAt = Date.now();

    // 计算实际尺寸
    const actualWidth = width || this.getWidthFromImageSize(imageSize);
    const actualHeight = height || this.getHeightFromImageSize(imageSize);

    // 处理参考图片
    const refImage = (images && images.length > 0) ? images[0] : image;

    logProviderEvent("bytedance-afr", "image_request_start", {
      modelId: this.config.modelId,
      host: getRequestHost(API_CONFIG.BASE_URL),
      width: actualWidth,
      height: actualHeight,
      hasImage: !!refImage,
      usingFallbackConfig: API_CONFIG.missing.length > 0,
    });

    try {
      // 1. 提交任务
      const taskId = await this.submitTask({
        prompt: prompt || "",
        width: actualWidth,
        height: actualHeight,
        image: refImage,
      });

      // 2. 轮询获取结果
      const imageUrls = await this.pollForResult(taskId);

      logProviderEvent("bytedance-afr", "image_request_success", {
        modelId: this.config.modelId,
        host: getRequestHost(API_CONFIG.BASE_URL),
        elapsedMs: Date.now() - startedAt,
        imageCount: imageUrls.length,
        taskId,
      });

      return {
        images: imageUrls,
        metadata: { taskId, width: actualWidth, height: actualHeight },
      };
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const errorInfo: Record<string, unknown> = {
        modelId: this.config.modelId,
        provider: "bytedance-afr",
        host: getRequestHost(API_CONFIG.BASE_URL),
        elapsedMs,
        usingFallbackConfig: API_CONFIG.missing.length > 0,
        missingEnvVars: API_CONFIG.missing.length > 0 ? API_CONFIG.missing : undefined,
      };

      if (error instanceof Error) {
        errorInfo.error = error.message;
        if (error.cause) {
          errorInfo.cause = String(error.cause);
        }
        if (error instanceof AggregateError) {
          errorInfo.errors = error.errors.map((e, i) => `[${i + 1}] ${e.message || e}`).join("; ");
        }
      }

      console.error("[AIProvider][bytedance-afr] image_request_failed", errorInfo);
      throw error;
    }
  }

  private getWidthFromImageSize(imageSize?: string): number {
    switch (imageSize) {
      case "1K":
        return 1024;
      case "2K":
        return 2048;
      default:
        return 1024;
    }
  }

  private getHeightFromImageSize(imageSize?: string): number {
    switch (imageSize) {
      case "1K":
        return 1024;
      case "2K":
        return 2048;
      default:
        return 1024;
    }
  }
}
