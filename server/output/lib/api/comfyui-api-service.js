"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyUIAPIService = exports.ComfyImageOutputFile = void 0;
const errors_1 = require("../../app/models/errors");
const constants_1 = require("../constants");
class ComfyImageOutputFile {
    fileName;
    subFolder;
    outputType;
    constructor({ fileName, subFolder, outputType }) {
        this.fileName = fileName;
        this.subFolder = subFolder;
        this.outputType = outputType;
    }
}
exports.ComfyImageOutputFile = ComfyImageOutputFile;
class ComfyUIAPIService {
    baseUrl;
    ws;
    clientId;
    promptId = undefined;
    isPromptRunning;
    workflowStatus;
    secure;
    httpBaseUrl;
    wsBaseUrl;
    outputFiles;
    apiKey;
    constructor(clientId, config) {
        this.apiKey = config?.apiKey;
        let url = config?.comfyUrl || process.env.COMFYUI_API_URL || "127.0.0.1:8188";
        // Basic protocol handling
        if (url.startsWith("https://")) {
            this.secure = true;
            url = url.replace("https://", "");
        }
        else if (url.startsWith("http://")) {
            this.secure = false;
            url = url.replace("http://", "");
        }
        else {
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
        try {
            this.ws = new WebSocket(`${this.getUrl("ws")}/ws?clientId=${this.clientId}`);
            this.connect();
        }
        catch (error) {
            console.error(error);
            throw error;
        }
        this.isPromptRunning = false;
        this.workflowStatus = undefined;
        this.outputFiles = [];
    }
    getUrl(protocol) {
        if (protocol === "http") {
            return `${this.httpBaseUrl}${this.baseUrl}`;
        }
        return `${this.wsBaseUrl}${this.baseUrl}`;
    }
    async connect() {
        try {
            this.ws.onopen = () => {
                console.log("WebSocket connection opened");
            };
            this.ws.onmessage = (event) => {
                // console.log("WebSocket message received:", event.data);
                this.comfyEventDataHandler(event.data);
            };
        }
        catch (error) {
            console.error(error);
            throw new Error("WebSocket connection error");
        }
    }
    comfyEventDataHandler(eventData) {
        if (typeof eventData !== 'string') {
            // Skip binary data (like preview images) for now
            return;
        }
        // Defensive check for common stringification errors
        if (eventData === '[object Blob]' || eventData === '[object Object]') {
            return;
        }
        let event;
        try {
            event = JSON.parse(eventData);
        }
        catch (error) {
            console.log("Error parsing event data:", eventData);
            console.error(error);
            return;
        }
        const data = event.data;
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
                console.log("Executed:", event.data);
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
    async queuePrompt(workflow) {
        const data = {
            "prompt": workflow,
            "client_id": this.clientId,
        };
        try {
            const headers = {
                "Content-Type": "application/json",
            };
            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }
            const response = await fetch(`${this.getUrl("http")}/prompt`, {
                method: 'POST',
                body: JSON.stringify(data),
                headers,
            });
            if (!response.ok) {
                let resError;
                try {
                    const responseError = await response.json();
                    if (responseError.error?.message) {
                        resError = {
                            message: responseError.error.message,
                            node_errors: responseError.node_errors || [],
                        };
                    }
                    else {
                        resError = responseError;
                    }
                }
                catch (error) {
                    console.error("cannot parse response", error);
                    throw error;
                }
                console.error(resError);
                throw resError;
            }
            if (!response.body) {
                throw new Error("No response body");
            }
            const responseData = await response.json();
            this.promptId = responseData.prompt_id;
            if (this.promptId === undefined) {
                throw new Error("Prompt ID is undefined");
            }
            this.isPromptRunning = true;
            while (this.isPromptRunning) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.workflowStatus === "execution_error") {
                throw new errors_1.ComfyWorkflowError({
                    message: "ComfyUI workflow execution error",
                    errors: []
                });
            }
            return { outputFiles: this.outputFiles, promptId: this.promptId };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            console.error(error);
            if (error?.cause?.code === "ECONNREFUSED") {
                throw new errors_1.ComfyWorkflowError({
                    message: "Cannot connect to ComfyUI",
                    errors: [(0, constants_1.ComfyUIConnRefusedError)(this.getUrl("http"))]
                });
            }
            throw error;
        }
    }
    async getOutputFiles({ file }) {
        const data = new URLSearchParams({ ...file }).toString();
        try {
            const headers = {};
            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }
            const response = await fetch(`${this.getUrl("http")}/view?${encodeURI(data)}`, {
                headers
            });
            if (!response.ok) {
                if (response.status === 404) {
                    const fileName = file.filename || "";
                    throw new errors_1.ComfyWorkflowError({
                        message: "File not found",
                        errors: [`The file ${fileName} was not found in the ComfyUI output directory`]
                    });
                }
                const responseError = await response.json();
                throw responseError;
            }
            return await response.blob();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            console.error(error);
            if (error?.cause?.code === "ECONNREFUSED") {
                throw new errors_1.ComfyWorkflowError({
                    message: "Cannot connect to ComfyUI",
                    errors: [(0, constants_1.ComfyUIConnRefusedError)(this.getUrl("http"))]
                });
            }
            throw error;
        }
    }
    parseOutputFiles(data) {
        if (!data.output) {
            return;
        }
        const output = data.output;
        for (const key in output) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const dict of output[key]) {
                if (dict.type !== "temp") {
                    this.outputFiles.push(dict);
                }
            }
        }
    }
}
exports.ComfyUIAPIService = ComfyUIAPIService;
