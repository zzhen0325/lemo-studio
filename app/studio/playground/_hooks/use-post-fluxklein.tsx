import { useCallback, useState } from "react";
import { SETTINGS_STORAGE_KEY } from "@/lib/constants";
import { buildFluxKleinWorkflow } from "@/lib/api/fluxklein-workflow";
import { probeDirectComfyAvailability, runDirectComfyWorkflow } from "@/lib/comfyui/browser-client";
import { getConfiguredDirectComfyUrl, getDirectComfyDecision } from "@/lib/comfyui/direct-config";
import { extractErrorMessage } from "@/lib/error-message";

export interface IUsePostFluxKlein {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  batchSize?: number;
  referenceImages?: string[];
  onSuccess: (outputs: Blob[]) => void;
  onError: (error: unknown) => void;
}

export const usePostFluxKlein = () => {
  const [loading, setLoading] = useState(false);

  const doPost = useCallback(async ({ prompt, width, height, seed, batchSize, referenceImages, onSuccess, onError }: IUsePostFluxKlein) => {
    setLoading(true);
    const nowMs = typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => Date.now();
    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const startAt = nowMs();

    try {
      let apiKey: string | undefined;

      try {
        const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          if (settings.apiKey) apiKey = settings.apiKey;
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }

      const directComfyUrl = getConfiguredDirectComfyUrl();
      const directComfyDecision = getDirectComfyDecision(directComfyUrl);

      // 必须配置前端直连地址
      if (!directComfyDecision.enabled) {
        const reason = directComfyDecision.reason || "ComfyUI 地址未配置";
        console.error("[FluxKlein][Front] direct_config_error", {
          requestId,
          comfyUrl: directComfyDecision.comfyUrl || directComfyUrl,
          reason,
        });
        throw new Error(`前端直连 ComfyUI 配置错误: ${reason}。请检查 NEXT_PUBLIC_COMFYUI_URL 环境变量。`);
      }

      console.info("[FluxKlein][Front] request_start", {
        requestId,
        mode: "browser-direct",
        comfyUrl: directComfyUrl,
      });

      // 探测 ComfyUI 连接（不回退后端，失败直接报错）
      const directAvailability = await probeDirectComfyAvailability({
        apiKey,
        comfyUrl: directComfyUrl,
      });

      if (!directAvailability.available) {
        const reason = directAvailability.reason || "未知错误";
        console.error("[FluxKlein][Front] direct_probe_failed", {
          requestId,
          comfyUrl: directComfyUrl,
          reason,
        });
        // 根据错误类型提供更明确的提示
        if (reason.includes("Timeout") || reason.includes("timeout")) {
          throw new Error(`ComfyUI 连接超时: ${directComfyUrl}。请检查 ComfyUI 是否已启动，地址是否正确。`);
        }
        if (reason.includes("SSL") || reason.includes("certificate") || reason.includes("CERT")) {
          throw new Error(`ComfyUI 证书错误: 请在浏览器中访问 ${directComfyUrl} 并信任证书后重试。`);
        }
        if (reason.includes("CORS") || reason.includes("cors") || reason.includes("cross-origin")) {
          throw new Error(`ComfyUI 跨域错误: 请在 ComfyUI 启动参数中添加 --enable-cors-header "*" 或指定允许的域名。`);
        }
        if (reason.includes("Failed to fetch") || reason.includes("NetworkError")) {
          throw new Error(`ComfyUI 网络不可达: ${directComfyUrl}。请检查网络连接或 ComfyUI 是否已启动。`);
        }
        throw new Error(`ComfyUI 连接失败: ${reason}`);
      }

      // 构建工作流
      const { workflow, viewComfyInputs } = await buildFluxKleinWorkflow({
        prompt,
        width,
        height,
        seed,
        batchSize,
        referenceImages,
      });

      console.info("[FluxKlein][Front] workflow_built", {
        requestId,
        comfyUrl: directComfyUrl,
      });

      // 执行工作流
      const blobs = await runDirectComfyWorkflow({
        workflow,
        viewComfy: {
          inputs: viewComfyInputs,
          textOutputEnabled: false,
        },
        apiKey,
        comfyUrl: directComfyUrl,
        requestId,
      });

      console.info("[FluxKlein][Front] stream_done", {
        requestId,
        outputs: blobs.length,
        elapsedMs: Math.round(nowMs() - startAt),
        mode: "browser-direct",
      });

      if (blobs.length > 0) {
        onSuccess(blobs);
        return;
      }

      throw new Error("ComfyUI 工作流未返回图片结果");
    } catch (error) {
      const errorAt = nowMs();
      const errorMessage = extractErrorMessage(error, "FluxKlein 请求失败");
      console.error("[FluxKlein][Front] request_error", {
        requestId,
        elapsedMs: Math.round(errorAt - startAt),
        error,
        errorMessage,
      });

      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error(errorMessage || "FluxKlein 请求失败"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { doPost, loading };
};
