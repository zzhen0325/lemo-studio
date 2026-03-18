import { ComfyWorkflowError } from '../models/errors';
import { ComfyUIConnRefusedError } from '../constants';
import { Agent as UndiciAgent, fetch as undiciFetch, FormData as UndiciFormData, WebSocket as UndiciWebSocket } from 'undici';

type ComfyUIWSEventType = "status" | "executing" | "execution_cached" | "progress" | "executed" | "execution_error" | "execution_success";

interface IComfyUIWSEventData {
    type: ComfyUIWSEventType;
    data: { [key: string]: unknown };
}

export interface IComfyUINodeError {
    type: string;
    message: string;
}

export interface IComfyUIError {
    message: string;
    node_errors: { [key: number]: IComfyUINodeError[] }
}

export class ComfyImageOutputFile {
    public fileName: string;
    public subFolder: string;
    public outputType: string;

    constructor({ fileName, subFolder, outputType }: { fileName: string, subFolder: string, outputType: string }) {
        this.fileName = fileName;
        this.subFolder = subFolder;
        this.outputType = outputType;
    }
}

export interface ComfyUIAPIServiceConfig {
    apiKey?: string;
    // Deprecated: endpoint is now unified to COMFYUI_API_URL.
    comfyUrl?: string;
    traceId?: string;
}

export class ComfyUIAPIService {
    private baseUrl: string;
    private ws: UndiciWebSocket;
    private dispatcher: UndiciAgent;
    private clientId: string;
    private promptId: string | undefined = undefined;
    private isPromptRunning: boolean;
    private workflowStatus: ComfyUIWSEventType | undefined;
    private secure: boolean;
    private httpBaseUrl: string;
    private wsBaseUrl: string;
    private outputFiles: Array<{ [key: string]: string }>;
    private apiKey?: string;
    private traceId?: string;

    constructor(clientId: string, config?: ComfyUIAPIServiceConfig) {
        this.apiKey = config?.apiKey;
        this.traceId = config?.traceId;

        const envComfyUrl = (process.env.COMFYUI_API_URL || "").trim();
        let url = envComfyUrl || "127.0.0.1:8188";
        if (config?.comfyUrl && config.comfyUrl !== envComfyUrl) {
            console.warn("[ComfyUIAPIService] Ignoring request comfyUrl and using COMFYUI_API_URL");
        }

        // Basic protocol handling
        if (url.startsWith("https://")) {
            this.secure = true;
            url = url.replace("https://", "");
        } else if (url.startsWith("http://")) {
            this.secure = false;
            url = url.replace("http://", "");
        } else {
            this.secure = process.env.COMFYUI_SECURE === "true";
        }

        this.httpBaseUrl = this.secure ? "https://" : "http://";
        this.wsBaseUrl = this.secure ? "wss://" : "ws://";

        // Remove trailing slash if present
        if (url.endsWith("/")) {
            url = url.slice(0, -1);
        }

        this.baseUrl = url;
        this.clientId = clientId;
        this.dispatcher = new UndiciAgent({
            connect: { 
                timeout: 15_000,
                rejectUnauthorized: false, // 忽略自签名证书错误
            }
        });
        console.info("[ComfyUIAPIService] Using endpoint", { traceId: this.traceId, endpoint: this.getUrl("http") });
        try {
            this.ws = new UndiciWebSocket(`${this.getUrl("ws")}/ws?clientId=${this.clientId}`, {
                dispatcher: this.dispatcher
            });
            this.connect();
        } catch (error) {
            console.error(error);
            throw error;
        }
        this.isPromptRunning = false;
        this.workflowStatus = undefined;
        this.outputFiles = [];
    }

    private getUrl(protocol: "http" | "ws") {
        if (protocol === "http") {
            return `${this.httpBaseUrl}${this.baseUrl}`;
        }
        return `${this.wsBaseUrl}${this.baseUrl}`;
    }

    private async connect() {
        try {
            this.ws.onopen = () => {
                return;
            };

            this.ws.onmessage = (event) => {
                // console.log("WebSocket message received:", event.data);
                this.comfyEventDataHandler(event.data);
            };
        } catch (error) {
            console.error(error);
            throw new Error("WebSocket connection error");
        }
    }

    private comfyEventDataHandler(eventData: unknown) {
        if (typeof eventData !== 'string') {
            // Skip binary data (like preview images) for now
            return;
        }

        // Defensive check for common stringification errors
        if (eventData === '[object Blob]' || eventData === '[object Object]') {
            return;
        }

        let event: IComfyUIWSEventData | undefined;
        try {
            event = JSON.parse(eventData) as IComfyUIWSEventData;
        } catch (error) {
            console.warn("Failed to parse ComfyUI websocket event");
            console.error(error);
            return;
        }

        const data = event.data as object;
        // Skip any messages that aren't about our prompt
        if ("prompt_id" in data && data.prompt_id !== this.promptId) {
            return true;
        }

        switch (event.type) {
            case "status":
                // console.log("Status:", event.data);
                this.workflowStatus = event.type;
                break;
            case "executing":
                // console.log("Executing:", event.data);
                this.workflowStatus = event.type;
                break;
            case "execution_cached":
                // console.log("Execution cached:", event.data);
                this.workflowStatus = event.type;
                break;
            case "progress":
                // console.log("Progress:", event.data);
                this.workflowStatus = event.type;
                break;
            case "executed":
                this.parseOutputFiles(event.data);
                this.workflowStatus = event.type;
                break;
            case "execution_error":
                // console.log("Execution error:", event.data);
                this.isPromptRunning = false;
                this.workflowStatus = event.type;
                break;
            case "execution_success":
                // console.log("Execution success:", event.data);
                this.isPromptRunning = false;
                this.workflowStatus = event.type;
                break;
            default:
                // console.log("Unknown event type:", event.type);
                this.workflowStatus = event.type;
                break;
        }
    }

    public async queuePrompt(workflow: object) {
        const data = {
            "prompt": workflow,
            "client_id": this.clientId,
        }
        try {
            this.outputFiles = [];
            this.workflowStatus = undefined;
            const requestStart = Date.now();
            const headers: HeadersInit = {
                "Content-Type": "application/json",
            };
            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }

            const response = await undiciFetch(`${this.getUrl("http")}/prompt`, {
                method: 'POST',
                body: JSON.stringify(data),
                headers,
                dispatcher: this.dispatcher,
            });
            const responseAt = Date.now();
            console.info("[FluxKlein][ComfyUI] prompt_response", {
                traceId: this.traceId,
                elapsedMs: responseAt - requestStart,
                status: response.status,
            });
            if (!response.ok) {

                let resError: unknown;
                try {
                    const responseError = await response.json() as {
                        error?: { message?: string };
                        node_errors?: { [key: number]: IComfyUINodeError[] };
                        [key: string]: unknown;
                    };
                    if (responseError.error?.message) {
                        resError = {
                            message: responseError.error.message,
                            node_errors: responseError.node_errors || [],
                        }
                    } else {
                        resError = responseError;
                    }
                } catch (error) {
                    console.error("cannot parse response", error);
                    throw error;
                }
                console.error(resError);
                throw resError;

            }

            if (!response.body) {
                throw new Error("No response body");
            }

            const responseData = await response.json() as { prompt_id?: string };
            this.promptId = responseData.prompt_id;

            if (this.promptId === undefined) {
                throw new Error("Prompt ID is undefined");
            }

            this.isPromptRunning = true;
            const waitStart = Date.now();

            while (this.isPromptRunning) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const waitEnd = Date.now();
            console.info("[FluxKlein][ComfyUI] prompt_completed", {
                traceId: this.traceId,
                promptId: this.promptId,
                status: this.workflowStatus,
                elapsedMs: waitEnd - waitStart,
            });

            if (this.workflowStatus === "execution_error") {
                throw new ComfyWorkflowError({
                    message: "ComfyUI workflow execution error",
                    errors: []
                });
            }
            if (this.outputFiles.length === 0 && this.promptId) {
                try {
                    const historyOutputFiles = await this.getPromptOutputFilesFromHistory(this.promptId);
                    if (historyOutputFiles.length > 0) {
                        this.outputFiles = historyOutputFiles;
                        console.info("[FluxKlein][ComfyUI] history_fallback_applied", {
                            traceId: this.traceId,
                            promptId: this.promptId,
                            outputCount: historyOutputFiles.length,
                        });
                    }
                } catch (historyError) {
                    console.warn("[FluxKlein][ComfyUI] history_fallback_failed", {
                        traceId: this.traceId,
                        promptId: this.promptId,
                        historyError,
                    });
                }
            }
            return { outputFiles: this.outputFiles, promptId: this.promptId };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error(error);
            if (error?.cause?.code === "ECONNREFUSED") {
                throw new ComfyWorkflowError({
                    message: "Cannot connect to ComfyUI",
                    errors: [ComfyUIConnRefusedError(this.getUrl("http"))]
                });
            }
            if (error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT") {
                const details = typeof error?.cause?.message === "string"
                    ? error.cause.message
                    : `Connect timeout: ${this.getUrl("http")}`;
                throw new ComfyWorkflowError({
                    message: "Cannot connect to ComfyUI",
                    errors: [details]
                });
            }
            throw error;
        }
    }

    public async getOutputFiles({ file }: { file: { [key: string]: string } }) {

        const data = new URLSearchParams({ ...file }).toString();

        try {
            const requestStart = Date.now();
            const headers: HeadersInit = {};
            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }
            const response = await undiciFetch(`${this.getUrl("http")}/view?${encodeURI(data)}`, {
                headers,
                dispatcher: this.dispatcher,
            });
            const responseAt = Date.now();
            console.info("[FluxKlein][ComfyUI] view_response", {
                traceId: this.traceId,
                elapsedMs: responseAt - requestStart,
                status: response.status,
            });
            if (!response.ok) {
                if (response.status === 404) {
                    const fileName = file.filename || "";
                    throw new ComfyWorkflowError({
                        message: "File not found",
                        errors: [`The file ${fileName} was not found in the ComfyUI output directory`]
                    });
                }
                const responseError = await response.json();
                throw responseError;
            }

            const contentType = response.headers.get("content-type") || "application/octet-stream";
            const outputData = await response.arrayBuffer();
            return new Blob([outputData], { type: contentType });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error(error);
            if (error?.cause?.code === "ECONNREFUSED") {
                throw new ComfyWorkflowError({
                    message: "Cannot connect to ComfyUI",
                    errors: [ComfyUIConnRefusedError(this.getUrl("http"))]
                });
            }
            throw error;
        }
    }

    private parseOutputFiles(data: { [key: string]: unknown }) {
        if (!data.output) {
            return
        }

        const output = data.output as { [key: string]: unknown } | undefined;
        for (const key in output) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const dict of output[key] as any[]) {
                if (dict.type !== "temp") {
                    this.outputFiles.push(dict)
                }
            }
        }
    }

    private async getPromptOutputFilesFromHistory(promptId: string): Promise<Array<{ [key: string]: string }>> {
        const headers: HeadersInit = {};
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        const requestStart = Date.now();
        const response = await undiciFetch(`${this.getUrl("http")}/history/${encodeURIComponent(promptId)}`, {
            headers,
            dispatcher: this.dispatcher,
        });
        const responseAt = Date.now();
        console.info("[FluxKlein][ComfyUI] history_response", {
            traceId: this.traceId,
            promptId,
            elapsedMs: responseAt - requestStart,
            status: response.status,
        });

        if (!response.ok) {
            return [];
        }

        const responseData = await response.json();
        return this.extractOutputFilesFromHistory(responseData, promptId);
    }

    private extractOutputFilesFromHistory(historyData: unknown, promptId: string): Array<{ [key: string]: string }> {
        if (!historyData || typeof historyData !== "object") return [];

        const historyRecord = historyData as Record<string, unknown>;
        const promptHistoryRaw = historyRecord[promptId];
        if (!promptHistoryRaw || typeof promptHistoryRaw !== "object") return [];

        const outputsRaw = (promptHistoryRaw as Record<string, unknown>).outputs;
        if (!outputsRaw || typeof outputsRaw !== "object") return [];

        const files: Array<{ [key: string]: string }> = [];
        const outputs = outputsRaw as Record<string, unknown>;

        for (const nodeOutput of Object.values(outputs)) {
            if (!nodeOutput || typeof nodeOutput !== "object") continue;
            const nodeOutputRecord = nodeOutput as Record<string, unknown>;
            for (const values of Object.values(nodeOutputRecord)) {
                if (!Array.isArray(values)) continue;
                for (const fileValue of values) {
                    if (!fileValue || typeof fileValue !== "object") continue;
                    const fileRecord = fileValue as Record<string, unknown>;
                    const filename = typeof fileRecord.filename === "string" ? fileRecord.filename : "";
                    if (!filename) continue;
                    const type = typeof fileRecord.type === "string" ? fileRecord.type : "output";
                    if (type === "temp") continue;
                    const subfolder = typeof fileRecord.subfolder === "string" ? fileRecord.subfolder : "";
                    files.push({
                        filename,
                        subfolder,
                        type,
                    });
                }
            }
        }

        return files;
    }

    public async uploadImage(imageBlob: Blob, filename: string): Promise<string> {
        const formData = new UndiciFormData();
        formData.append('image', imageBlob, filename);
        formData.append('type', 'input');
        formData.append('overwrite', 'true');

        const headers: HeadersInit = {};
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        const requestStart = Date.now();
        const response = await undiciFetch(`${this.getUrl("http")}/upload/image`, {
            method: 'POST',
            body: formData,
            headers,
            dispatcher: this.dispatcher,
        });
        const responseAt = Date.now();
        console.info("[FluxKlein][ComfyUI] upload_response", {
            traceId: this.traceId,
            elapsedMs: responseAt - requestStart,
            status: response.status,
            filename,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        const result = await response.json() as { name?: string };
        return result.name || filename;
    }
}
