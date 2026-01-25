"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyUIService = void 0;
const node_path_1 = __importDefault(require("node:path"));
const comfy_workflow_1 = require("../../app/models/comfy-workflow");
const promises_1 = __importDefault(require("node:fs/promises"));
const comfy_error_handler_1 = require("../comfy-error-handler");
const errors_1 = require("../../app/models/errors");
const comfyui_api_service_1 = require("./comfyui-api-service");
const mime_types_1 = __importDefault(require("mime-types"));
const constants_1 = require("../constants");
// 简单的日志工具类
const logger = {
    log: (message, ...args) => console.log(message, ...args),
    info: (message, ...args) => console.info(message, ...args),
    error: (message, ...args) => console.error(message, ...args),
    warn: (message, ...args) => console.warn(message, ...args),
};
class ComfyUIService {
    comfyErrorHandler;
    comfyUIAPIService;
    clientId;
    constructor(config) {
        this.clientId = crypto.randomUUID();
        this.comfyErrorHandler = new comfy_error_handler_1.ComfyErrorHandler();
        this.comfyUIAPIService = new comfyui_api_service_1.ComfyUIAPIService(this.clientId, config);
    }
    async runWorkflow(args) {
        let workflow = args.workflow;
        const textOutputEnabled = args.viewComfy.textOutputEnabled ?? false;
        if (!workflow) {
            workflow = await this.getLocalWorkflow();
        }
        // 同步引用图片到外部存储 (10.75.163.225:5000)
        await this.syncImagesFromInputs(args.viewComfy.inputs);
        const comfyWorkflow = new comfy_workflow_1.ComfyWorkflow(workflow);
        await comfyWorkflow.setViewComfy(args.viewComfy.inputs);
        try {
            const promptData = await this.comfyUIAPIService.queuePrompt(workflow);
            const outputFiles = promptData.outputFiles;
            const comfyUIAPIService = this.comfyUIAPIService;
            if (outputFiles.length === 0) {
                throw new errors_1.ComfyWorkflowError({
                    message: "No output files found",
                    errors: ['Make sure your workflow contains at least one node that saves an output to the ComfyUI output folder. eg. "Save Image" or "Video Combine" from comfyui-videohelpersuite'],
                });
            }
            const stream = new ReadableStream({
                start(controller) {
                    console.log(`[ComfyUIService] Stream start hook triggered. Files to process: ${outputFiles.length}`);
                    // Execute the processing in a background task so start() returns synchronously
                    (async () => {
                        try {
                            for (let i = 0; i < outputFiles.length; i++) {
                                const file = outputFiles[i];
                                console.log(`[ComfyUIService] Processing file ${i + 1}/${outputFiles.length}`);
                                let outputBuffer;
                                let mimeType;
                                if (typeof file === 'string' && textOutputEnabled) {
                                    outputBuffer = new Blob([file], { type: 'text/plain' });
                                    mimeType = 'text/plain';
                                }
                                else {
                                    console.log(`[ComfyUIService] Fetching file data from ComfyUI...`);
                                    outputBuffer = await comfyUIAPIService.getOutputFiles({ file });
                                    mimeType = mime_types_1.default.lookup(file?.filename) || "application/octet-stream";
                                }
                                const mimeInfo = `Content-Type: ${mimeType}\r\n\r\n`;
                                controller.enqueue(new TextEncoder().encode(mimeInfo));
                                const buffer = await outputBuffer.arrayBuffer();
                                console.log(`[ComfyUIService] Enqueuing binary data. Size: ${buffer.byteLength}`);
                                controller.enqueue(new Uint8Array(buffer));
                                controller.enqueue(new TextEncoder().encode("--BLOB_SEPARATOR--"));
                                console.log(`[ComfyUIService] Finished file ${i + 1}`);
                            }
                        }
                        catch (error) {
                            console.error("[ComfyUIService] Stream processing error:", error);
                            controller.error(error);
                        }
                        finally {
                            console.log("[ComfyUIService] Closing stream controller");
                            controller.close();
                        }
                    })().catch(err => {
                        console.error("[ComfyUIService] Fatal stream crash:", err);
                        try {
                            controller.error(err);
                        }
                        catch { }
                    });
                },
            });
            logger.info('返回 stream ======');
            return stream;
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        }
        catch (error) {
            logger.info("Failed to run the workflow", error);
            console.error({ error });
            if (error instanceof errors_1.ComfyWorkflowError) {
                throw error;
            }
            const comfyError = this.comfyErrorHandler.tryToParseWorkflowError(error);
            if (comfyError) {
                throw comfyError;
            }
            throw new errors_1.ComfyWorkflowError({
                message: "Error running workflow",
                errors: [
                    "Something went wrong running the workflow, the most common cases are missing nodes and running out of Vram. Make sure that you can run this workflow in your local comfy",
                ],
            });
        }
    }
    async getLocalWorkflow() {
        const missingWorkflowError = new errors_1.ComfyError({
            message: "Failed to launch ComfyUI",
            errors: [constants_1.missingViewComfyFileError],
        });
        let workflow = undefined;
        try {
            const filePath = node_path_1.default.join(process.cwd(), constants_1.viewComfyFileName);
            const fileContent = await promises_1.default.readFile(filePath, "utf8");
            workflow = JSON.parse(fileContent);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        }
        catch (_error) {
            throw missingWorkflowError;
        }
        if (!workflow) {
            throw missingWorkflowError;
        }
        for (const w of workflow.workflows) {
            for (const key in w) {
                if (key === "workflowApiJSON") {
                    return w[key];
                }
            }
        }
        throw new errors_1.ComfyWorkflowError({
            message: "Failed to find workflowApiJSON",
            errors: ["Failed to find workflowApiJSON"],
        });
    }
    async syncImagesFromInputs(inputs) {
        if (!inputs || !Array.isArray(inputs))
            return;
        for (const input of inputs) {
            const value = input.value;
            // 识别本地上传路径 (例如 /upload/xxx.png 或 /outputs/xxx.png)
            if (typeof value === 'string' && (value.startsWith('/upload/') || value.startsWith('/outputs/'))) {
                try {
                    await this.syncToExternalStorage(value);
                }
                catch (error) {
                    logger.error(`Failed to sync image ${value} to external storage:`, error);
                }
            }
        }
    }
    async syncToExternalStorage(imagePath) {
        try {
            const publicDir = node_path_1.default.join(process.cwd(), 'public');
            const absolutePath = node_path_1.default.join(publicDir, imagePath);
            // 检查文件是否存在
            try {
                await promises_1.default.access(absolutePath);
            }
            catch {
                logger.warn(`File not found, skipping sync: ${absolutePath}`);
                return;
            }
            const fileBuffer = await promises_1.default.readFile(absolutePath);
            const fileName = node_path_1.default.basename(imagePath);
            const formData = new FormData();
            // Convert Buffer to Uint8Array to avoid SharedArrayBuffer typing issues in BlobPart
            const blob = new Blob([Uint8Array.from(fileBuffer)], { type: (mime_types_1.default.lookup(fileName) || 'image/png') });
            formData.append('file', blob, fileName);
            logger.info(`Syncing image to external storage: ${fileName} ...`);
            const response = await fetch('http://10.75.163.225:5000/upload', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`External storage responded with ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            logger.info(`Successfully synced image to external storage:`, result);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.ComfyUIService = ComfyUIService;
