import path from "node:path";
import type { IComfyInput } from "../../types/comfy-input";
import { ComfyWorkflow } from "../models/comfy-workflow";
import { ComfyErrorHandler } from "../comfy-error-handler";
import { ComfyError, ComfyWorkflowError } from "../models/errors";
import { ComfyUIAPIService, ComfyUIAPIServiceConfig } from "./comfyui-api-service";
import mime from 'mime-types';
import { missingViewComfyFileError, viewComfyFileName } from "../constants";
import { readJsonAsset, resolvePublicAssetUrl } from "../runtime-assets";

export class ComfyUIService {
    private comfyErrorHandler: ComfyErrorHandler;
    private comfyUIAPIService: ComfyUIAPIService;
    private clientId: string;
    private traceId?: string;

    constructor(config?: ComfyUIAPIServiceConfig) {
        this.clientId = crypto.randomUUID();
        this.traceId = config?.traceId;
        this.comfyErrorHandler = new ComfyErrorHandler();
        this.comfyUIAPIService = new ComfyUIAPIService(this.clientId, config);
    }

    async runWorkflow(args: IComfyInput): Promise<ReadableStream<Uint8Array>> {
        const startAt = Date.now();
        let workflow = args.workflow;
        const textOutputEnabled = args.viewComfy.textOutputEnabled ?? false;

        if (!workflow) {
            workflow = await this.getLocalWorkflow();
        }

        const inputsWithLoadImageDefaults = this.applyLoadImageDefaults(
            args.viewComfy.inputs,
            workflow as Record<string, unknown>
        );

        const syncStart = Date.now();
        await this.syncImagesFromInputs(inputsWithLoadImageDefaults);
        console.info("[FluxKlein][Server] sync_images_done", {
            traceId: this.traceId,
            elapsedMs: Date.now() - syncStart,
        });

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
                console.info("[FluxKlein][Server] queue_prompt_start", { traceId: this.traceId, index: i + 1 });
                const promptData = await this.comfyUIAPIService.queuePrompt(finalWorkflow);
                console.info("[FluxKlein][Server] queue_prompt_done", {
                    traceId: this.traceId,
                    promptId: promptData.promptId,
                    elapsedMs: Date.now() - startAt,
                });
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
            const traceId = this.traceId;

            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    // Execute the processing in a background task so start() returns synchronously
                    (async () => {
                        try {
                            for (let i = 0; i < outputFiles.length; i++) {
                                const file = outputFiles[i];

                                let outputBuffer: Blob;
                                let mimeType: string;
                                if (typeof file === 'string' && textOutputEnabled) {
                                    outputBuffer = new Blob([file], { type: 'text/plain' });
                                    mimeType = 'text/plain';
                                } else {
                                    const fileInfo = file as { [key: string]: string };
                                    const fetchStart = Date.now();
                                    outputBuffer = await comfyUIAPIService.getOutputFiles({ file: fileInfo });
                                    console.info("[FluxKlein][Server] view_file_done", {
                                        traceId,
                                        elapsedMs: Date.now() - fetchStart,
                                    });
                                    mimeType = mime.lookup(fileInfo.filename) || "application/octet-stream";
                                }

                                const mimeInfo = `Content-Type: ${mimeType}\r\n\r\n`;
                                controller.enqueue(new TextEncoder().encode(mimeInfo));

                                const buffer = await outputBuffer.arrayBuffer();
                                controller.enqueue(new Uint8Array(buffer));

                                controller.enqueue(new TextEncoder().encode("--BLOB_SEPARATOR--"));
                            }
                        } catch (error) {
                            console.error("[ComfyUIService] Stream processing error:", error);
                            controller.error(error);
                        } finally {
                            controller.close();
                        }
                    })().catch(err => {
                        console.error("[ComfyUIService] Fatal stream crash:", err);
                        try { controller.error(err); } catch { }
                    });
                },
            });
            console.info("[FluxKlein][Server] stream_ready", {
                traceId: this.traceId,
                elapsedMs: Date.now() - startAt,
                outputs: outputFiles.length,
            });
            return stream;

            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } catch (error: unknown) {
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
        throw new Error("Unhandled workflow error");
    }

    private async getLocalWorkflow(): Promise<object> {
        const missingWorkflowError = new ComfyError({
            message: "Failed to launch ComfyUI",
            errors: [missingViewComfyFileError],
        });

        let workflow: unknown = undefined;

        try {
            workflow = await readJsonAsset<Record<string, unknown>>(viewComfyFileName);
        } catch {
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
        const uploadCandidates = inputs
            .map((input) => ({ input, value: input.value }))
            .filter(({ value }) =>
                typeof value === 'string'
                && (value.startsWith('/upload/')
                    || value.startsWith('/uploads/')
                    || value.startsWith('/outputs/')
                    || value.startsWith('/images/')
                    || value.startsWith('http')
                    || value.startsWith('data:image'))
            );

        const uploaded = await Promise.all(uploadCandidates.map(async ({ value }) => {
            try {
                const filename = await this.uploadImageToComfyUI(value as string);
                return { filename };
            } catch (error) {
                console.error(`Failed to upload image ${value} to ComfyUI:`, error);
                return { filename: undefined as string | undefined };
            }
        }));

        uploadCandidates.forEach(({ input }, index) => {
            const filename = uploaded[index]?.filename;
            if (filename) {
                input.value = filename;
            }
        });
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
                const url = new URL(imagePathOrUrl);
                filename = path.basename(url.pathname);
                if (!filename || filename.length === 0) filename = `upload_${Date.now()}.png`;
                const response = await fetch(imagePathOrUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image from URL: status=${response.status} ${response.statusText}`);
                }
                blob = await response.blob();

            } else {
                const normalizedForCheck = imagePathOrUrl.replace(/^\/+/, '');
                const looksLikePath = imagePathOrUrl.includes('/') || normalizedForCheck.includes('/');
                if (!looksLikePath) {
                    console.warn(`Image input already looks like a ComfyUI filename, keep original value: ${imagePathOrUrl}`);
                    return path.basename(imagePathOrUrl);
                }

                const resolvedUrl = await resolvePublicAssetUrl(imagePathOrUrl);
                if (!resolvedUrl) {
                    throw new Error(`CDN mapping not found for public asset: ${imagePathOrUrl}`);
                }

                const response = await fetch(resolvedUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch CDN image: status=${response.status} ${response.statusText} url=${resolvedUrl}`);
                }

                filename = path.basename(new URL(resolvedUrl).pathname) || `upload_${Date.now()}.png`;
                blob = await response.blob();
            }

            console.info(`Uploading image to ComfyUI: ${filename} ...`);
            const uploadedName = await this.comfyUIAPIService.uploadImage(blob, filename);
            console.info(`Successfully uploaded image to ComfyUI: ${uploadedName}`);
            return uploadedName;

        } catch (error) {
            throw error;
        }
    }
}
