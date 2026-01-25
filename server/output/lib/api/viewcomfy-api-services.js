"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptResult = exports.inferWithLogsStream = exports.infer = void 0;
const errors_1 = require("@/app/models/errors");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
function buildFormData(data) {
    const { params, overrideWorkflowApi, logs } = data;
    const formData = new FormData();
    const paramStr = {};
    for (const key in params) {
        const value = params[key];
        if (value instanceof File) {
            formData.set(key, value);
        }
        else {
            paramStr[key] = value;
        }
    }
    if (overrideWorkflowApi) {
        formData.set("workflow_api", JSON.stringify(overrideWorkflowApi));
    }
    formData.set("params", JSON.stringify(paramStr));
    formData.set("logs", logs.toString());
    return formData;
}
/**
 * Make an inference request to the viewComfy API
 *
 * @param apiUrl - The URL to send the request to
 * @param params - The parameter to send to the workflow
 * @param overrideWorkflowApi - Optional override the default workflow_api of the deployment
 * @returns The parsed prompt result or null
 */
const infer = async ({ apiUrl, params, overrideWorkflowApi, clientId, clientSecret, }) => {
    if (!apiUrl) {
        throw new Error("viewComfyUrl is not set. Please get the right endpoint from your dashboard.");
    }
    if (!clientId) {
        throw new Error("Client ID is not set. You need your API keys to use your API endpoint. You can get your keys from the ViewComfy dashboard and add them to the .env file.");
    }
    if (!clientSecret) {
        throw new Error("Client Secret is not set. You need your API keys to use your API endpoint. You can get your keys from the ViewComfy dashboard and add them to the .env file.");
    }
    try {
        const formData = buildFormData({
            logs: false,
            params,
            overrideWorkflowApi,
        });
        const response = await fetch(apiUrl, {
            method: "POST",
            body: formData,
            redirect: "follow",
            headers: {
                "client_id": clientId,
                "client_secret": clientSecret,
            },
        });
        if (!response.ok) {
            const errMsg = `Failed to fetch viewComfy: ${response.statusText}, ${await response.text()}`;
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const data = await response.json();
        const results = new PromptResult(data);
        if (results.outputs.length === 0) {
            throw new errors_1.ComfyWorkflowError({
                message: "No output files found",
                errors: ["No output files found"],
            });
        }
        const stream = new ReadableStream({
            async start(controller) {
                debugger;
                const outputsDir = path_1.default.join(process.cwd(), 'public', 'outputs');
                await fs_1.promises.mkdir(outputsDir, { recursive: true });
                let i = 0;
                for (const blob of results.outputs) {
                    try {
                        const mimeType = blob.type;
                        const mimeInfo = `Content-Type: ${mimeType}\r\n\r\n`;
                        const ext = mimeType.split('/')?.[1] || 'png';
                        const filename = `${Date.now()}-${i++}.${ext}`;
                        const filePath = path_1.default.join(outputsDir, filename);
                        const buffer = Buffer.from(await blob.arrayBuffer());
                        await fs_1.promises.writeFile(filePath, buffer);
                        controller.enqueue(new TextEncoder().encode(mimeInfo));
                        controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
                        controller.enqueue(new TextEncoder().encode("\r\n--BLOB_SEPARATOR--\r\n"));
                    }
                    catch (error) {
                        console.error("Failed to get output file");
                        console.error(error);
                    }
                }
                controller.close();
            },
        });
        return stream;
    }
    catch (error) {
        console.error("Failed to run the workflow");
        console.error({ error });
        if (error instanceof Error && error.cause) {
            throw error;
        }
        if (error instanceof errors_1.ComfyWorkflowError) {
            throw error;
        }
        throw new errors_1.ComfyWorkflowError({
            message: "Error running workflow",
            errors: [
                error instanceof Error ? error.message : String(error),
            ],
        });
    }
};
exports.infer = infer;
/**
 * Process a streaming Server-Sent Events (SSE) response.
 *
 * @param response - An active fetch response with a readable stream
 * @param loggingCallback - Function to handle log messages
 * @returns The parsed prompt result or null
 */
async function consumeEventSource(response, loggingCallback) {
    if (!response.body) {
        throw new Error("Response body is null");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let currentData = "";
    let currentEvent = "message"; // Default event type
    let promptResult = null;
    let buffer = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // Process complete lines in the buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (promptResult)
                    break;
                // Empty line signals the end of an event
                if (!trimmedLine) {
                    if (currentData) {
                        try {
                            if (currentEvent === "log_message" ||
                                currentEvent === "error") {
                                loggingCallback(`${currentEvent}: ${currentData}`);
                            }
                            else if (currentEvent === "prompt_result") {
                                promptResult = new PromptResult(JSON.parse(currentData));
                            }
                            else {
                                console.log(`Unknown event: ${currentEvent}, data: ${currentData}`);
                            }
                        }
                        catch (e) {
                            console.log("Invalid JSON: ...");
                            console.error(e);
                        }
                        // Reset for next event
                        currentData = "";
                        currentEvent = "message";
                    }
                    continue;
                }
                // Parse SSE fields
                if (trimmedLine.startsWith("event:")) {
                    currentEvent = trimmedLine.substring(6).trim();
                }
                else if (trimmedLine.startsWith("data:")) {
                    currentData = trimmedLine.substring(5).trim();
                }
                else if (trimmedLine.startsWith("id:")) {
                    // Handle event ID if needed
                }
                else if (trimmedLine.startsWith("retry:")) {
                    // Handle retry directive if needed
                }
            }
            if (promptResult)
                break;
        }
    }
    catch (error) {
        console.error("Error reading stream:", error);
        throw error;
    }
    return promptResult;
}
/**
 * Make an inference with real-time logs from the execution prompt
 *
 * @param apiUrl - The URL to send the request to
 * @param params - The parameter to send to the workflow
 * @param loggingCallback - Function to handle log messages
 * @param override_workflow_api - Optional override the default workflow_api of the deployment
 * @returns The parsed prompt result or null
 */
const inferWithLogsStream = async ({ apiUrl, params, loggingCallback, overrideWorkflowApi: override_workflow_api, clientId, clientSecret, }) => {
    if (!apiUrl) {
        throw new Error("url is not set");
    }
    if (!clientId) {
        throw new Error("clientId is not set");
    }
    if (!clientSecret) {
        throw new Error("clientSecret is not set");
    }
    try {
        const formData = buildFormData({
            logs: true,
            overrideWorkflowApi: override_workflow_api,
            params,
        });
        const response = await fetch(apiUrl, {
            method: "POST",
            body: formData,
            headers: {
                "client_id": clientId,
                "client_secret": clientSecret,
            },
        });
        if (response.status === 201) {
            // Check if it's actually a server-sent event stream
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/event-stream")) {
                return await consumeEventSource(response, loggingCallback);
            }
            else {
                throw new Error("Set the logs to True for streaming the process logs");
            }
        }
        else {
            const errorText = await response.text();
            console.error(`Error response: ${errorText}`);
            throw new Error(errorText);
        }
    }
    catch (e) {
        console.error(`Error with streaming request: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
};
exports.inferWithLogsStream = inferWithLogsStream;
/**
 * Creates a PromptResult object from the response
 *
 * @param data Raw prompt result data
 * @returns A properly formatted PromptResult with File objects
 */
class PromptResult {
    /** Unique identifier for the prompt */
    prompt_id;
    /** Current status of the prompt execution */
    status;
    /** Whether the prompt execution is complete */
    completed;
    /** Time taken to execute the prompt in seconds */
    execution_time_seconds;
    /** The original prompt configuration */
    prompt;
    /** List of output files */
    outputs;
    constructor(data) {
        const { prompt_id, status, completed, execution_time_seconds, prompt, outputs = [], } = data;
        // Convert output data to File objects
        const fileOutputs = outputs.map((output) => {
            // Convert base64 data to Blob
            const binaryData = atob(output.data);
            const arrayBuffer = new ArrayBuffer(binaryData.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }
            const blob = new Blob([arrayBuffer], { type: output.content_type });
            return blob;
            // Create File object from Blob
            // return new File([blob], output.filename, {
            //     type: output.content_type,
            //     lastModified: new Date().getTime(),
            // });
        });
        this.prompt_id = prompt_id;
        this.status = status;
        this.completed = completed;
        this.execution_time_seconds = execution_time_seconds;
        this.prompt = prompt;
        this.outputs = fileOutputs;
    }
}
exports.PromptResult = PromptResult;
