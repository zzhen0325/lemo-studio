import path from "node:path";
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import type { IInput } from "../../types/input";
import { SEED_LIKE_INPUT_VALUES } from "../../lib/constants";
import { getComfyUIRandomSeed } from "../../lib/utils";

const COMFY_INPUTS_DIR = path.join(process.cwd(), "comfy", "inputs");
const COMFY_WORKFLOWS_DIR = path.join(process.cwd(), "comfy", "workflows");

export class ComfyWorkflow {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private workflow: { [key: string]: any };
    private workflowFileName: string;
    private workflowFilePath: string;
    private id: string;

    constructor(workflow: object) {
        this.workflow = workflow;
        this.id = crypto.randomUUID();
        this.workflowFileName = `workflow_${this.id}.json`;
        this.workflowFilePath = path.join(COMFY_WORKFLOWS_DIR, this.workflowFileName);
    }

    public async setViewComfy(viewComfy: IInput[]) {
        try {
            for (const input of viewComfy) {
                const path = input.key.split("-");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let obj: any = this.workflow;
                let skip = false;

                for (let i = 0; i < path.length - 1; i++) {
                    const part = path[i];
                    if (obj[part] === undefined) {
                        console.warn(`[ComfyWorkflow] Path part "${part}" not found for key "${input.key}"`);
                        skip = true;
                        break;
                    }
                    obj = obj[part];
                }

                if (skip) continue;

                const lastPart = path[path.length - 1];
                obj[lastPart] = input.value;
            }
        } catch (error) {
            console.error("[ComfyWorkflow] setViewComfy failed:", error);
        }

        for (const key in this.workflow) {
            const node = this.workflow[key];
            switch (node.class_type) {
                case "SaveImage":
                case "VHS_VideoCombine":
                    node.inputs.filename_prefix = this.getFileNamePrefix();
                    break;

                default:
                    Object.keys(node.inputs).forEach((key) => {
                        if (
                            SEED_LIKE_INPUT_VALUES.includes(key)
                            && node.inputs[key] === Number.MIN_VALUE
                        ) {
                            const newSeed = this.getNewSeed();
                            node.inputs[key] = newSeed;
                        }
                    });
            }
        }
    }

    public getWorkflow() {
        return this.workflow;
    }

    public getWorkflowFilePath() {
        return this.workflowFilePath;
    }

    public getWorkflowFileName() {
        return this.workflowFileName;
    }

    public getFileNamePrefix() {
        return `${this.id}_`;
    }

    public getNewSeed() {
        return getComfyUIRandomSeed();
    }

    private async createFileFromInput(file: File) {
        const fileName = `${this.getFileNamePrefix()}${file.name}`;
        const filePath = path.join(COMFY_INPUTS_DIR, fileName);
        const fileBuffer = await file.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(fileBuffer));
        return filePath;
    }
}
