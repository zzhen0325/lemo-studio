import { IViewComfy } from "@/types/comfy-input";
import { probeDirectComfyAvailability, runDirectComfyWorkflow } from "@/lib/comfyui/browser-client";
import { getConfiguredDirectComfyUrl, shouldUseDirectComfyUi } from "@/lib/comfyui/direct-config";
import { ErrorTypes, ResponseError } from "@/lib/models/errors";
import { useSearchParams } from "next/navigation";
import { useState, useCallback } from "react"
import { SETTINGS_STORAGE_KEY } from "@/lib/constants";
import { getApiBase } from "@/lib/api-base";

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
    const searchParams = useSearchParams();
    const appId = searchParams?.get("appId");

    const doPost = useCallback(async ({ viewComfy, workflow, viewcomfyEndpoint, onSuccess, onError }: IUsePostPlayground) => {
        setLoading(true);
        try {
            const apiBase = getApiBase();
            const url = `${apiBase}/comfy`;
            const directComfyUrl = getConfiguredDirectComfyUrl();
            const wantsDirectComfy = shouldUseDirectComfyUi(directComfyUrl);

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

            if (workflow && wantsDirectComfy) {
                const directAvailability = await probeDirectComfyAvailability({
                    apiKey: apiKeyFromLocalStorage,
                    comfyUrl: directComfyUrl,
                });

                if (!directAvailability.available) {
                    console.warn("[usePostPlayground] Direct ComfyUI unavailable, falling back to server proxy.", {
                        comfyUrl: directComfyUrl,
                        reason: directAvailability.reason,
                    });
                } else {
                    const blobs = await runDirectComfyWorkflow({
                        workflow,
                        viewComfy,
                        apiKey: apiKeyFromLocalStorage,
                        comfyUrl: directComfyUrl,
                    });
                    onSuccess(blobs);
                    return;
                }
            }

            const formData = new FormData();
            if (apiKeyFromLocalStorage) {
                formData.append('apiKey', apiKeyFromLocalStorage);
            }

            const viewComfyJSON: IViewComfy = {
                inputs: [],
                textOutputEnabled: viewComfy.textOutputEnabled ?? false
            };
            for (const { key, value } of viewComfy.inputs) {
                if (value instanceof File) {
                    formData.append(key, value);
                } else {
                    viewComfyJSON.inputs.push({ key, value });
                }
            }
            formData.append('workflow', JSON.stringify(workflow));
            formData.append('viewComfy', JSON.stringify(viewComfyJSON));
            formData.append('viewcomfyEndpoint', viewcomfyEndpoint ?? "");

            if (appId) {
                formData.append('appId', appId);
            }

            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                if (response.status === 504) {
                    const error = new ResponseError({
                        error: "Your workflow is taking too long to respond. The maximum allowed time is 5 minutes.",
                        errorMsg: "ViewComfy Timeout",
                        errorType: ErrorTypes.VIEW_MODE_TIMEOUT
                    });
                    throw error;
                }
                const responseError: ResponseError = await response.json();
                throw responseError;
            }

            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
            let buffer: Uint8Array = new Uint8Array(0);
            const output: Blob[] = [];
            const separator = new TextEncoder().encode('--BLOB_SEPARATOR--');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer = concatUint8Arrays(buffer, value);

                let separatorIndex: number;
                while ((separatorIndex = findSubarray(buffer, separator)) !== -1) {
                    const outputPart = buffer.slice(0, separatorIndex);
                    buffer = buffer.slice(separatorIndex + separator.length);

                    const mimeEndIndex = findSubarray(outputPart, new TextEncoder().encode('\r\n\r\n'));
                    if (mimeEndIndex !== -1) {
                        const mimeHeader = new TextDecoder().decode(outputPart.slice(0, mimeEndIndex));
                        const mimeType = mimeHeader.split(': ')[1]?.trim() || "application/octet-stream";
                        const outputData = outputPart.slice(mimeEndIndex + 4);
                        const blob = new Blob([outputData], { type: mimeType });
                        output.push(blob);
                    } else {
                        console.warn("[usePostPlayground] Found separator but no mime header end");
                    }
                }
            }

            if (output.length > 0) {
                onSuccess(output);
            } else {
                throw new Error("No images were generated by the workflow.");
            }

        } catch (error) {
            console.error("[usePostPlayground] Error:", error);
            onError(error);
        } finally {
            setLoading(false);
        }
    }, [appId]);

    return { doPost, loading };
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
}

function findSubarray(arr: Uint8Array, separator: Uint8Array): number {
    outer: for (let i = 0; i <= arr.length - separator.length; i++) {
        for (let j = 0; j < separator.length; j++) {
            if (arr[i + j] !== separator[j]) {
                continue outer;
            }
        }
        return i;
    }
    return -1;
}
