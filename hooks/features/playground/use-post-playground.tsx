import { IViewComfy } from "@/types/comfy-input";
import { ErrorTypes, ResponseError } from "@/app/models/errors";
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
            let url = `${getApiBase()}/comfy`;
            if (appId) {
                url = `${getApiBase()}/byte-artist-comfy`;
            }

            const formData = new FormData();

            try {
                const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
                if (storedSettings) {
                    const settings = JSON.parse(storedSettings);
                    if (settings.apiKey) formData.append('apiKey', settings.apiKey);

                    // 优先级: viewcomfyEndpoint > settings.comfyUrl
                    const effectiveComfyUrl = viewcomfyEndpoint || settings.comfyUrl;
                    if (effectiveComfyUrl) formData.append('comfyUrl', effectiveComfyUrl);
                } else if (viewcomfyEndpoint) {
                    formData.append('comfyUrl', viewcomfyEndpoint);
                }
            } catch (e) {
                console.error("Failed to load settings", e);
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
            console.log(workflow, '--workflow')
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
                if (done) break;

                buffer = concatUint8Arrays(buffer, value);

                let separatorIndex: number;
                // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
                while ((separatorIndex = findSubarray(buffer, separator)) !== -1) {
                    const outputPart = buffer.slice(0, separatorIndex);
                    buffer = buffer.slice(separatorIndex + separator.length);

                    const mimeEndIndex = findSubarray(outputPart, new TextEncoder().encode('\r\n\r\n'));
                    if (mimeEndIndex !== -1) {
                        const mimeType = new TextDecoder().decode(outputPart.slice(0, mimeEndIndex)).split(': ')[1];
                        const outputData = outputPart.slice(mimeEndIndex + 4);
                        const blob = new Blob([outputData], { type: mimeType });
                        output.push(blob);
                    }
                }

                if (output.length > 0) {
                    onSuccess(output);
                }
            }

        } catch (error) {
            onError(error);
        }
        setLoading(false);
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
