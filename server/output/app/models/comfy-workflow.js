"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyWorkflow = void 0;
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const constants_1 = require("../../lib/constants");
const utils_1 = require("../../lib/utils");
const COMFY_INPUTS_DIR = node_path_1.default.join(process.cwd(), "comfy", "inputs");
const COMFY_WORKFLOWS_DIR = node_path_1.default.join(process.cwd(), "comfy", "workflows");
class ComfyWorkflow {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workflow;
    workflowFileName;
    workflowFilePath;
    id;
    constructor(workflow) {
        this.workflow = workflow;
        this.id = node_crypto_1.default.randomUUID();
        this.workflowFileName = `workflow_${this.id}.json`;
        this.workflowFilePath = node_path_1.default.join(COMFY_WORKFLOWS_DIR, this.workflowFileName);
    }
    async setViewComfy(viewComfy) {
        try {
            for (const input of viewComfy) {
                const path = input.key.split("-");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let obj = this.workflow;
                for (let i = 0; i < path.length - 1; i++) {
                    if (i === path.length - 1) {
                        continue;
                    }
                    obj = obj[path[i]];
                }
                // if (input.value instanceof File) {
                //   const filePath = await this.createFileFromInput(input.value);
                //   obj[path[path.length - 1]] = filePath;
                // } else {
                obj[path[path.length - 1]] = input.value;
                // }
            }
        }
        catch (error) {
            console.error(error);
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
                        if (constants_1.SEED_LIKE_INPUT_VALUES.includes(key)
                            && node.inputs[key] === Number.MIN_VALUE) {
                            const newSeed = this.getNewSeed();
                            node.inputs[key] = newSeed;
                        }
                    });
            }
        }
    }
    getWorkflow() {
        return this.workflow;
    }
    getWorkflowFilePath() {
        return this.workflowFilePath;
    }
    getWorkflowFileName() {
        return this.workflowFileName;
    }
    getFileNamePrefix() {
        return `${this.id}_`;
    }
    getNewSeed() {
        return (0, utils_1.getComfyUIRandomSeed)();
    }
    async createFileFromInput(file) {
        const fileName = `${this.getFileNamePrefix()}${file.name}`;
        const filePath = node_path_1.default.join(COMFY_INPUTS_DIR, fileName);
        const fileBuffer = await file.arrayBuffer();
        await promises_1.default.writeFile(filePath, Buffer.from(fileBuffer));
        return filePath;
    }
}
exports.ComfyWorkflow = ComfyWorkflow;
