import { IViewComfy } from "@/types/comfy-input";
import { probeDirectComfyAvailability, runDirectComfyWorkflow } from "@/lib/comfyui/browser-client";
import { getConfiguredDirectComfyUrl, getDirectComfyDecision } from "@/lib/comfyui/direct-config";
import { useState, useCallback } from "react"
import { SETTINGS_STORAGE_KEY } from "@/lib/constants";

export interface IUsePostPlayground {
    viewComfy: IViewComfy,
    workflow?: object,
    viewcomfyEndpoint?: string | null,
    onSuccess: (outputs: Blob[]) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => void,
}


export const usePostPlayground = () => {
    const [loading, setLoading] = useState(false);

    const doPost = useCallback(async ({ viewComfy, workflow, onSuccess, onError }: IUsePostPlayground) => {
        setLoading(true);
        const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        try {
            const directComfyUrl = getConfiguredDirectComfyUrl();
            const directComfyDecision = getDirectComfyDecision(directComfyUrl);

            let apiKeyFromLocalStorage: string | undefined;
            try {
                const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
                if (storedSettings) {
                    const settings = JSON.parse(storedSettings);
                    if (settings.apiKey) apiKeyFromLocalStorage = settings.apiKey;
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            }

            // 必须配置前端直连地址
            if (!directComfyDecision.enabled) {
                const reason = directComfyDecision.reason || "ComfyUI 地址未配置";
                console.error("[Playground][Front] direct_config_error", {
                    requestId,
                    comfyUrl: directComfyDecision.comfyUrl || directComfyUrl,
                    reason,
                });
                throw new Error(`前端直连 ComfyUI 配置错误: ${reason}。请检查 NEXT_PUBLIC_COMFYUI_URL 环境变量。`);
            }

            if (!workflow) {
                throw new Error("工作流数据缺失");
            }

            console.info("[Playground][Front] request_start", {
                requestId,
                mode: "browser-direct",
                comfyUrl: directComfyUrl,
            });

            // 探测 ComfyUI 连接（不回退后端，失败直接报错）
            const directAvailability = await probeDirectComfyAvailability({
                apiKey: apiKeyFromLocalStorage,
                comfyUrl: directComfyUrl,
            });

            if (!directAvailability.available) {
                const reason = directAvailability.reason || "未知错误";
                console.error("[Playground][Front] direct_probe_failed", {
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

            // 执行工作流
            const blobs = await runDirectComfyWorkflow({
                workflow,
                viewComfy,
                apiKey: apiKeyFromLocalStorage,
                comfyUrl: directComfyUrl,
                requestId,
            });

            console.info("[Playground][Front] stream_done", {
                requestId,
                outputs: blobs.length,
                mode: "browser-direct",
            });

            if (blobs.length > 0) {
                onSuccess(blobs);
            } else {
                throw new Error("ComfyUI 工作流未返回图片结果");
            }

        } catch (error) {
            console.error("[Playground][Front] request_error:", {
                requestId,
                error,
            });
            onError(error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { doPost, loading };
}
