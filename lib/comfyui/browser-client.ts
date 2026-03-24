import type { IViewComfy } from "@/types/comfy-input";
import type { IInput } from "@/types/input";
import { getDirectComfyEndpoints } from "@/lib/comfyui/direct-config";
import {
  applyLoadImageDefaults,
  deepCloneWorkflow,
  finalizeWorkflowForExecution,
  setWorkflowInputs,
  type WorkflowLike,
} from "@/lib/comfyui/workflow-helpers";

// Storage key 前缀，用于识别对象存储中的文件
const STORAGE_KEY_PREFIX = 'ljhwZthlaukjlkulzlp/';

type ComfyOutputFile = {
  filename: string;
  subfolder: string;
  type: string;
};

type RunDirectComfyWorkflowArgs = {
  workflow: object;
  viewComfy: IViewComfy;
  apiKey?: string;
  comfyUrl?: string | null;
  requestId?: string;
};

export type DirectComfyAvailability =
  | { available: true }
  | { available: false; reason: string };

const CONNECT_TIMEOUT_MS = 15_000;
const EXECUTION_TIMEOUT_MS = 300_000;

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildHeaders(apiKey?: string): HeadersInit | undefined {
  if (!apiKey) return undefined;
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = CONNECT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Cannot connect to ComfyUI: Connect Timeout Error (attempted address: ${String(input)}, timeout: ${timeoutMs}ms)`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function probeDirectComfyAvailability({
  apiKey,
  comfyUrl,
}: {
  apiKey?: string;
  comfyUrl?: string | null;
}): Promise<DirectComfyAvailability> {
  if (typeof window === "undefined") {
    return { available: false, reason: "Direct ComfyUI mode is only available in the browser." };
  }

  const endpoints = getDirectComfyEndpoints(comfyUrl);
  if (!endpoints) {
    return { available: false, reason: "Direct ComfyUI URL is not configured." };
  }

  try {
    await fetchWithTimeout(`${endpoints.httpBase}/prompt`, {
      method: "GET",
      headers: buildHeaders(apiKey),
    }, 5_000);
    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error && error.message ? error.message : "Failed to reach ComfyUI from the browser.",
    };
  }
}

async function waitForWebSocketOpen(socket: WebSocket, targetLabel: string): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return;

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Cannot connect to ComfyUI: Connect Timeout Error (attempted address: ${targetLabel}, timeout: ${CONNECT_TIMEOUT_MS}ms)`));
    }, CONNECT_TIMEOUT_MS);

    const handleOpen = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error(`Cannot open ComfyUI websocket: ${targetLabel}`));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("error", handleError);
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("error", handleError);
  });
}

function parseOutputFiles(data: unknown): ComfyOutputFile[] {
  if (!data || typeof data !== "object") return [];
  const output = (data as { output?: Record<string, unknown> }).output;
  if (!output || typeof output !== "object") return [];

  const files: ComfyOutputFile[] = [];

  Object.values(output).forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const record = item as Record<string, unknown>;
      const filename = typeof record.filename === "string" ? record.filename : "";
      const type = typeof record.type === "string" ? record.type : "output";
      if (!filename || type === "temp") return;
      files.push({
        filename,
        subfolder: typeof record.subfolder === "string" ? record.subfolder : "",
        type,
      });
    });
  });

  return files;
}

function extractOutputFilesFromHistory(historyData: unknown, promptId: string): ComfyOutputFile[] {
  if (!historyData || typeof historyData !== "object") return [];

  const promptHistory = (historyData as Record<string, unknown>)[promptId];
  if (!promptHistory || typeof promptHistory !== "object") return [];

  const outputs = (promptHistory as Record<string, unknown>).outputs;
  if (!outputs || typeof outputs !== "object") return [];

  const files: ComfyOutputFile[] = [];

  Object.values(outputs as Record<string, unknown>).forEach((nodeOutput) => {
    if (!nodeOutput || typeof nodeOutput !== "object") return;

    Object.values(nodeOutput as Record<string, unknown>).forEach((values) => {
      if (!Array.isArray(values)) return;

      values.forEach((value) => {
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        const filename = typeof record.filename === "string" ? record.filename : "";
        const type = typeof record.type === "string" ? record.type : "output";
        if (!filename || type === "temp") return;
        files.push({
          filename,
          subfolder: typeof record.subfolder === "string" ? record.subfolder : "",
          type,
        });
      });
    });
  });

  return files;
}

function makeRelativeImageUrl(value: string): string {
  return new URL(value, window.location.origin).toString();
}

function normalizeUploadFilename(raw: string): string {
  const cleaned = raw.replace(/[?#].*$/, "").split("/").pop() || "";
  if (cleaned) return cleaned;
  return `upload_${Date.now()}.png`;
}

async function resolveUploadableValue(key: string, value: unknown): Promise<{ blob: Blob; filename: string } | null> {
  if (value instanceof File) {
    return { blob: value, filename: value.name || normalizeUploadFilename("") };
  }

  if (typeof value !== "string") return null;
  if (!value.trim()) return null;

  const isImageInputKey = key.endsWith("-inputs-image");
  const startsLikeUrl = /^(https?:|blob:|data:image|\/|\.\/|\.\.\/)/i.test(value);
  const isStorageKey = value.startsWith(STORAGE_KEY_PREFIX);
  const maybeRelativeImagePath = isImageInputKey && value.includes("/");

  if (!startsLikeUrl && !maybeRelativeImagePath && !isStorageKey) {
    return null;
  }

  let sourceUrl: string;

  // 处理 storage key - 需要先获取预签名 URL
  if (isStorageKey) {
    const presignedResponse = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: value }),
    });
    if (!presignedResponse.ok) {
      throw new Error(`Failed to get presigned URL for storage key: ${value}`);
    }
    const { url } = await presignedResponse.json();
    sourceUrl = url;
  } else {
    sourceUrl = startsLikeUrl ? value : makeRelativeImageUrl(value);
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    if (maybeRelativeImagePath && !startsLikeUrl && !isStorageKey) {
      return null;
    }
    throw new Error(`Failed to read image input from ${value}: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return {
    blob,
    filename: normalizeUploadFilename(sourceUrl),
  };
}

async function uploadImage(httpBase: string, apiKey: string | undefined, value: { blob: Blob; filename: string }) {
  const formData = new FormData();
  formData.append("image", value.blob, value.filename);
  formData.append("type", "input");
  formData.append("overwrite", "true");

  const response = await fetchWithTimeout(`${httpBase}/upload/image`, {
    method: "POST",
    body: formData,
    headers: buildHeaders(apiKey),
  }, 60_000);

  if (!response.ok) {
    throw new Error(`Upload failed: HTTP ${response.status}`);
  }

  const result = await response.json() as { name?: string };
  return result.name || value.filename;
}

async function normalizeInputs(httpBase: string, apiKey: string | undefined, inputs: IInput[]) {
  const normalizedInputs: IInput[] = [];

  for (const input of inputs) {
    const uploadable = await resolveUploadableValue(input.key, input.value);
    if (!uploadable) {
      normalizedInputs.push(input);
      continue;
    }

    const uploadedFilename = await uploadImage(httpBase, apiKey, uploadable);
    normalizedInputs.push({
      key: input.key,
      value: uploadedFilename,
    });
  }

  return normalizedInputs;
}

async function queuePrompt(httpBase: string, apiKey: string | undefined, workflow: WorkflowLike, clientId: string) {
  const response = await fetchWithTimeout(`${httpBase}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(buildHeaders(apiKey) || {}),
    },
    body: JSON.stringify({
      prompt: workflow,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `ComfyUI /prompt failed with HTTP ${response.status}`);
  }

  const data = await response.json() as { prompt_id?: string };
  if (!data.prompt_id) {
    throw new Error("Prompt ID is undefined");
  }

  return data.prompt_id;
}

async function waitForExecution(socket: WebSocket, promptId: string) {
  return await new Promise<ComfyOutputFile[]>((resolve, reject) => {
    const outputFiles: ComfyOutputFile[] = [];
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`ComfyUI workflow timed out after ${Math.floor(EXECUTION_TIMEOUT_MS / 1000)} seconds.`));
    }, EXECUTION_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("close", handleClose);
    };

    const handleError = () => {
      cleanup();
      reject(new Error("ComfyUI websocket connection failed during execution."));
    };

    const handleClose = () => {
      cleanup();
      reject(new Error("ComfyUI websocket closed before execution finished."));
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;

      let message: { type?: string; data?: Record<string, unknown> };
      try {
        message = JSON.parse(event.data) as { type?: string; data?: Record<string, unknown> };
      } catch {
        return;
      }

      const data = message.data || {};
      const eventPromptId = typeof data.prompt_id === "string" ? data.prompt_id : undefined;
      if (eventPromptId && eventPromptId !== promptId) {
        return;
      }

      if (message.type === "executed") {
        outputFiles.push(...parseOutputFiles(data));
        return;
      }

      if (message.type === "execution_error") {
        cleanup();
        reject(new Error("ComfyUI workflow execution error"));
        return;
      }

      if (message.type === "execution_success") {
        cleanup();
        resolve(outputFiles);
      }
    };

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", handleError);
    socket.addEventListener("close", handleClose);
  });
}

async function getHistoryOutputs(httpBase: string, apiKey: string | undefined, promptId: string) {
  const response = await fetchWithTimeout(`${httpBase}/history/${encodeURIComponent(promptId)}`, {
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return extractOutputFilesFromHistory(data, promptId);
}

async function fetchOutputBlob(httpBase: string, apiKey: string | undefined, file: ComfyOutputFile) {
  const query = new URLSearchParams(file).toString();
  const response = await fetchWithTimeout(`${httpBase}/view?${query}`, {
    headers: buildHeaders(apiKey),
  }, 60_000);

  if (!response.ok) {
    throw new Error(`Failed to fetch ComfyUI output ${file.filename}: HTTP ${response.status}`);
  }

  return response.blob();
}

export async function runDirectComfyWorkflow({
  workflow,
  viewComfy,
  apiKey,
  comfyUrl,
  requestId,
}: RunDirectComfyWorkflowArgs): Promise<Blob[]> {
  if (typeof window === "undefined") {
    throw new Error("Direct ComfyUI mode is only available in the browser.");
  }

  const endpoints = getDirectComfyEndpoints(comfyUrl);
  if (!endpoints) {
    throw new Error("Direct ComfyUI URL is not configured.");
  }

  const clientId = requestId || createClientId();
  const socketUrl = `${endpoints.wsBase}/ws?clientId=${encodeURIComponent(clientId)}`;
  const socket = new WebSocket(socketUrl);

  try {
    await waitForWebSocketOpen(socket, socketUrl);

    const workflowClone = deepCloneWorkflow(workflow) as WorkflowLike;
    const inputsWithDefaults = applyLoadImageDefaults(viewComfy.inputs, workflowClone);
    const normalizedInputs = await normalizeInputs(endpoints.httpBase, apiKey, inputsWithDefaults);

    setWorkflowInputs(workflowClone, normalizedInputs);
    finalizeWorkflowForExecution(workflowClone);

    const promptId = await queuePrompt(endpoints.httpBase, apiKey, workflowClone, clientId);
    let outputFiles = await waitForExecution(socket, promptId);

    if (outputFiles.length === 0) {
      outputFiles = await getHistoryOutputs(endpoints.httpBase, apiKey, promptId);
    }

    if (outputFiles.length === 0) {
      throw new Error("No images were generated by the workflow.");
    }

    return Promise.all(outputFiles.map((file) => fetchOutputBlob(endpoints.httpBase, apiKey, file)));
  } finally {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }
}
