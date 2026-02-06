import path from "node:path";
import type { IComfyInput } from "../../types/comfy-input";
import { ComfyWorkflow } from "../../app/models/comfy-workflow";
import fs from "node:fs/promises";
import { ComfyErrorHandler } from "../comfy-error-handler";
import { ComfyError, ComfyWorkflowError } from "../../app/models/errors";
import { ComfyUIAPIService, ComfyUIAPIServiceConfig } from "./comfyui-api-service";
import mime from 'mime-types';
import { missingViewComfyFileError, viewComfyFileName } from "../constants";

// 简单的日志工具类
const logger = {
    log: (message: unknown, ...args: unknown[]) => console.log(message, ...args),
    info: (message: unknown, ...args: unknown[]) => console.info(message, ...args),
    error: (message: unknown, ...args: unknown[]) => console.error(message, ...args),
    warn: (message: unknown, ...args: unknown[]) => console.warn(message, ...args),
};

export class ComfyUIService {
    private comfyErrorHandler: ComfyErrorHandler;
    private comfyUIAPIService: ComfyUIAPIService;
    private clientId: string;

    constructor(config?: ComfyUIAPIServiceConfig) {
        this.clientId = crypto.randomUUID();
        this.comfyErrorHandler = new ComfyErrorHandler();
        this.comfyUIAPIService = new ComfyUIAPIService(this.clientId, config);
    }

    async runWorkflow(args: IComfyInput) {
        let workflow = args.workflow;
        const textOutputEnabled = args.viewComfy.textOutputEnabled ?? false;

        if (!workflow) {
            workflow = await this.getLocalWorkflow();
        }

        const inputsWithLoadImageDefaults = this.applyLoadImageDefaults(
            args.viewComfy.inputs,
            workflow as Record<string, unknown>
        );

        await this.syncImagesFromInputs(inputsWithLoadImageDefaults);

        const getWorkflowBatchSize = (wf: Record<string, unknown>) => {
            let maxBatchSize = 1;
            Object.values(wf).forEach((node) => {
                if (!node || typeof node !== "object") return;
                const inputs = (node as { inputs?: Record<string, unknown> }).inputs;
                const batchSize = inputs?.batch_size;
                if (typeof batchSize === "number" && Number.isFinite(batchSize) && batchSize > maxBatchSize) {
                    maxBatchSize = Math.floor(batchSize);
                }
            });
            return Math.max(1, maxBatchSize);
        };

        const normalizeInputsForBatch = (inputs: IComfyInput["viewComfy"]["inputs"], batchSize: number) => {
            return inputs.map(input => {
                if (typeof input.key === "string" && input.key.endsWith("-inputs-batch_size")) {
                    return { ...input, value: batchSize };
                }
                return input;
            });
        };

        const forceWorkflowBatchSize = (wf: Record<string, unknown>, batchSize: number) => {
            Object.values(wf).forEach((node) => {
                if (!node || typeof node !== "object") return;
                const inputs = (node as { inputs?: Record<string, unknown> }).inputs;
                if (inputs && typeof inputs.batch_size === "number") {
                    inputs.batch_size = batchSize;
                }
            });
        };

        const batchSize = workflow ? getWorkflowBatchSize(workflow as Record<string, unknown>) : 1;

        try {
            const workflowsToRun = batchSize > 1 ? batchSize : 1;
            const allOutputFiles: Array<{ [key: string]: string } | string> = [];
            for (let i = 0; i < workflowsToRun; i++) {
                const clonedWorkflow = JSON.parse(JSON.stringify(workflow)) as Record<string, unknown>;
                const comfyWorkflow = new ComfyWorkflow(clonedWorkflow);
                const normalizedInputs = batchSize > 1
                    ? normalizeInputsForBatch(inputsWithLoadImageDefaults, 1)
                    : inputsWithLoadImageDefaults;
                await comfyWorkflow.setViewComfy(normalizedInputs);
                const finalWorkflow = comfyWorkflow.getWorkflow() as Record<string, unknown>;
                if (batchSize > 1) {
                    forceWorkflowBatchSize(finalWorkflow, 1);
                }
                console.log(`[ComfyUIService] Final Workflow JSON structure:`, Object.keys(finalWorkflow).length, "nodes");
                const promptData = await this.comfyUIAPIService.queuePrompt(finalWorkflow);
                const outputFiles = promptData.outputFiles;

                if (outputFiles.length === 0) {
                    throw new ComfyWorkflowError({
                        message: "No output files found",
                        errors: ['Make sure your workflow contains at least one node that saves an output to the ComfyUI output folder. eg. "Save Image" or "Video Combine" from comfyui-videohelpersuite'],
                    });
                }

                allOutputFiles.push(...outputFiles);
            }
            const comfyUIAPIService = this.comfyUIAPIService;
            const outputFiles = allOutputFiles;

            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    console.log(`[ComfyUIService] Stream start hook triggered. Files to process: ${outputFiles.length}`);
                    // Execute the processing in a background task so start() returns synchronously
                    (async () => {
                        try {
                            for (let i = 0; i < outputFiles.length; i++) {
                                const file = outputFiles[i];
                                console.log(`[ComfyUIService] Processing file ${i + 1}/${outputFiles.length}`);

                                let outputBuffer: Blob;
                                let mimeType: string;
                                if (typeof file === 'string' && textOutputEnabled) {
                                    outputBuffer = new Blob([file], { type: 'text/plain' });
                                    mimeType = 'text/plain';
                                } else {
                                    console.log(`[ComfyUIService] Fetching file data from ComfyUI...`);
                                    const fileInfo = file as { [key: string]: string };
                                    outputBuffer = await comfyUIAPIService.getOutputFiles({ file: fileInfo });
                                    mimeType = mime.lookup(fileInfo.filename) || "application/octet-stream";
                                }

                                const mimeInfo = `Content-Type: ${mimeType}\r\n\r\n`;
                                controller.enqueue(new TextEncoder().encode(mimeInfo));

                                const buffer = await outputBuffer.arrayBuffer();
                                console.log(`[ComfyUIService] Enqueuing binary data. Size: ${buffer.byteLength}`);
                                controller.enqueue(new Uint8Array(buffer));

                                controller.enqueue(new TextEncoder().encode("--BLOB_SEPARATOR--"));
                                console.log(`[ComfyUIService] Finished file ${i + 1}`);
                            }
                        } catch (error) {
                            console.error("[ComfyUIService] Stream processing error:", error);
                            controller.error(error);
                        } finally {
                            console.log("[ComfyUIService] Closing stream controller");
                            controller.close();
                        }
                    })().catch(err => {
                        console.error("[ComfyUIService] Fatal stream crash:", err);
                        try { controller.error(err); } catch { }
                    });
                },
            });
            logger.info('返回 stream ======');
            return stream;

            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } catch (error: unknown) {
            logger.info("Failed to run the workflow", error);
            console.error({ error });

            if (error instanceof ComfyWorkflowError) {
                throw error;
            }

            const comfyError =
                this.comfyErrorHandler.tryToParseWorkflowError(error);
            if (comfyError) {
                throw comfyError;
            }

            throw new ComfyWorkflowError({
                message: "Error running workflow",
                errors: [
                    "Something went wrong running the workflow, the most common cases are missing nodes and running out of Vram. Make sure that you can run this workflow in your local comfy",
                ],
            });
        }
    }

    private async getLocalWorkflow(): Promise<object> {
        const missingWorkflowError = new ComfyError({
            message: "Failed to launch ComfyUI",
            errors: [missingViewComfyFileError],
        });

        let workflow: unknown = undefined;

        try {
            const filePath = path.join(process.cwd(), viewComfyFileName);
            const fileContent = await fs.readFile(filePath, "utf8");
            workflow = JSON.parse(fileContent);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
            throw missingWorkflowError;
        }

        if (!workflow || typeof workflow !== "object") {
            throw missingWorkflowError;
        }
        const workflowRecord = workflow as Record<string, unknown>;

        // 1. Check for root-level workflowApiJSON (Current structure)
        if ("workflowApiJSON" in workflowRecord && workflowRecord.workflowApiJSON) {
            return workflowRecord.workflowApiJSON as object;
        }

        // 2. Fallback: Check for legacy workflows array structure
        if ("workflows" in workflowRecord && Array.isArray(workflowRecord.workflows)) {
            const workflows = workflowRecord.workflows as Record<string, unknown>[];
            for (const w of workflows) {
                if ("workflowApiJSON" in w && w.workflowApiJSON) {
                    return w.workflowApiJSON as object;
                }
            }
        }

        throw new ComfyWorkflowError({
            message: "Failed to find workflowApiJSON",
            errors: ["Failed to find workflowApiJSON in local configuration"],
        });
    }

    private async syncImagesFromInputs(inputs: Array<{ value: unknown }>) {
        if (!inputs || !Array.isArray(inputs)) return;

        for (const input of inputs) {
            const value = input.value;
            // 识别图片路径 (以 /upload/ 或 /outputs/ 开头，或者 http(s) 开头的 URL，或者 data:image 开头的 base64)
            if (typeof value === 'string') {
                if (value.startsWith('/upload/') || value.startsWith('/outputs/') || value.startsWith('http') || value.startsWith('data:image')) {
                    try {
                        const filename = await this.uploadImageToComfyUI(value);
                        // 更新 input 的值为 ComfyUI 返回的文件名
                        input.value = filename;
                    } catch (error) {
                        logger.error(`Failed to upload image ${value} to ComfyUI:`, error);
                    }
                }
            }
        }
    }

    private applyLoadImageDefaults(inputs: IComfyInput["viewComfy"]["inputs"], workflow: Record<string, unknown>) {
        const nextInputs = Array.isArray(inputs) ? [...inputs] : [];
        const keyIndex = new Map<string, number>();
        nextInputs.forEach((input, index) => {
            if (typeof input.key === "string") {
                keyIndex.set(input.key, index);
            }
        });

        Object.entries(workflow).forEach(([nodeId, node]) => {
            if (!node || typeof node !== "object") return;
            const nodeObj = node as { class_type?: string };
            if (nodeObj.class_type !== "LoadImage" && nodeObj.class_type !== "LoadImageMask") return;
            const targetKey = `${nodeId}-inputs-image`;
            if (keyIndex.has(targetKey)) {
                const index = keyIndex.get(targetKey) as number;
                const existing = nextInputs[index];
                if (existing && (existing.value === null || typeof existing.value === "undefined")) {
                    nextInputs[index] = { ...existing, value: "" };
                }
            } else {
                nextInputs.push({ key: targetKey, value: "" });
                keyIndex.set(targetKey, nextInputs.length - 1);
            }
        });

        return nextInputs;
    }

    private async uploadImageToComfyUI(imagePathOrUrl: string): Promise<string> {
        try {
            let blob: Blob;
            let filename: string;

            if (imagePathOrUrl.startsWith('data:image')) {
                // Base64 处理
                const matches = imagePathOrUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches || matches.length !== 3) {
                    throw new Error('Invalid base64 string');
                }
                const type = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                blob = new Blob([Uint8Array.from(buffer)], { type });
                filename = `upload_${Date.now()}.${mime.extension(type) || 'png'}`;
            } else if (imagePathOrUrl.startsWith('http')) {
                // URL 下载
                const response = await fetch(imagePathOrUrl);
                if (!response.ok) throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
                blob = await response.blob();
                const url = new URL(imagePathOrUrl);
                filename = path.basename(url.pathname);
                if (!filename || filename.length === 0) filename = `upload_${Date.now()}.png`;

            } else {
                // 本地文件读取
                const publicDir = path.join(process.cwd(), 'public');
                const absolutePath = path.join(publicDir, imagePathOrUrl);

                try {
                    await fs.access(absolutePath);
                } catch {
                    logger.warn(`File not found, skipping upload: ${absolutePath}`);
                    // 如果找不到文件，就原样返回，不报错，避免中断流程（可能已经是 ComfyUI 里的文件了？）
                    // 或者应该抛出错误？目前保持原逻辑的柔性
                    return path.basename(imagePathOrUrl);
                }

                const fileBuffer = await fs.readFile(absolutePath);
                filename = path.basename(imagePathOrUrl);
                blob = new Blob([Uint8Array.from(fileBuffer)], { type: (mime.lookup(filename) || 'image/png') as string });
            }

            logger.info(`Uploading image to ComfyUI: ${filename} ...`);
            const uploadedName = await this.comfyUIAPIService.uploadImage(blob, filename);
            logger.info(`Successfully uploaded image to ComfyUI: ${uploadedName}`);
            return uploadedName;

        } catch (error) {
            throw error;
        }
    }
}
