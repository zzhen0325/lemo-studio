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

        // 同步引用图片到外部存储 (10.75.163.225:5000)
        await this.syncImagesFromInputs(args.viewComfy.inputs);

        const comfyWorkflow = new ComfyWorkflow(workflow);
        await comfyWorkflow.setViewComfy(args.viewComfy.inputs);

        try {

            const promptData = await this.comfyUIAPIService.queuePrompt(workflow);
            const outputFiles = promptData.outputFiles;
            const comfyUIAPIService = this.comfyUIAPIService;

            if (outputFiles.length === 0) {
                throw new ComfyWorkflowError({
                    message: "No output files found",
                    errors: ['Make sure your workflow contains at least one node that saves an output to the ComfyUI output folder. eg. "Save Image" or "Video Combine" from comfyui-videohelpersuite'],
                });
            }

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
                                    outputBuffer = await comfyUIAPIService.getOutputFiles({ file });
                                    mimeType = mime.lookup(file?.filename) || "application/octet-stream";
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

        let workflow = undefined;

        try {
            const filePath = path.join(process.cwd(), viewComfyFileName);
            const fileContent = await fs.readFile(filePath, "utf8");
            workflow = JSON.parse(fileContent);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
            throw missingWorkflowError;
        }

        if (!workflow) {
            throw missingWorkflowError;
        }

        for (const w of workflow.workflows as { [key: string]: object }[]) {
            for (const key in w) {
                if (key === "workflowApiJSON") {
                    return w[key];
                }
            }
        }

        throw new ComfyWorkflowError({
            message: "Failed to find workflowApiJSON",
            errors: ["Failed to find workflowApiJSON"],
        });
    }

    private async syncImagesFromInputs(inputs: Array<{ value: unknown }>) {
        if (!inputs || !Array.isArray(inputs)) return;

        for (const input of inputs) {
            const value = input.value;
            // 识别本地上传路径 (例如 /upload/xxx.png 或 /outputs/xxx.png)
            if (typeof value === 'string' && (value.startsWith('/upload/') || value.startsWith('/outputs/'))) {
                try {
                    await this.syncToExternalStorage(value);
                } catch (error) {
                    logger.error(`Failed to sync image ${value} to external storage:`, error);
                }
            }
        }
    }

    private async syncToExternalStorage(imagePath: string) {
        try {
            const publicDir = path.join(process.cwd(), 'public');
            const absolutePath = path.join(publicDir, imagePath);

            // 检查文件是否存在
            try {
                await fs.access(absolutePath);
            } catch {
                logger.warn(`File not found, skipping sync: ${absolutePath}`);
                return;
            }

            const fileBuffer = await fs.readFile(absolutePath);
            const fileName = path.basename(imagePath);

            const formData = new FormData();
            // Convert Buffer to Uint8Array to avoid SharedArrayBuffer typing issues in BlobPart
            const blob = new Blob([Uint8Array.from(fileBuffer)], { type: (mime.lookup(fileName) || 'image/png') as string });
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
        } catch (error) {
            throw error;
        }
    }
}