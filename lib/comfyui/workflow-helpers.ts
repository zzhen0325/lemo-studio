import type { IInput } from "@/types/input";
import { SEED_LIKE_INPUT_VALUES } from "@/lib/constants";
import { getComfyUIRandomSeed } from "@/lib/utils";

type WorkflowNode = {
  class_type?: string;
  inputs?: Record<string, unknown>;
};

export type WorkflowLike = Record<string, WorkflowNode>;

function createRunId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function deepCloneWorkflow<T>(workflow: T): T {
  return JSON.parse(JSON.stringify(workflow)) as T;
}

export function applyLoadImageDefaults(inputs: IInput[], workflow: WorkflowLike): IInput[] {
  const nextInputs = Array.isArray(inputs) ? [...inputs] : [];
  const keyIndex = new Map<string, number>();

  nextInputs.forEach((input, index) => {
    if (typeof input.key === "string") {
      keyIndex.set(input.key, index);
    }
  });

  Object.entries(workflow).forEach(([nodeId, node]) => {
    if (!node || typeof node !== "object") return;
    if (node.class_type !== "LoadImage" && node.class_type !== "LoadImageMask") return;

    const targetKey = `${nodeId}-inputs-image`;
    if (keyIndex.has(targetKey)) {
      const index = keyIndex.get(targetKey) as number;
      const existing = nextInputs[index];
      if (existing && (existing.value === null || typeof existing.value === "undefined")) {
        nextInputs[index] = { ...existing, value: "" };
      }
      return;
    }

    nextInputs.push({ key: targetKey, value: "" });
    keyIndex.set(targetKey, nextInputs.length - 1);
  });

  return nextInputs;
}

export function setWorkflowInputs(workflow: WorkflowLike, inputs: IInput[]) {
  for (const input of inputs) {
    const path = input.key.split("-");
    let target: Record<string, unknown> | undefined = workflow;
    let skip = false;

    for (let i = 0; i < path.length - 1; i += 1) {
      const part = path[i];
      if (!target || typeof target !== "object" || !(part in target)) {
        skip = true;
        break;
      }
      target = target[part] as Record<string, unknown>;
    }

    if (skip || !target || typeof target !== "object") continue;

    const lastPart = path[path.length - 1];
    target[lastPart] = input.value;
  }
}

export function finalizeWorkflowForExecution(workflow: WorkflowLike) {
  const runId = createRunId();

  Object.values(workflow).forEach((node) => {
    if (!node || typeof node !== "object") return;
    const inputs = node.inputs;
    if (!inputs) return;

    if (node.class_type === "SaveImage" || node.class_type === "VHS_VideoCombine") {
      inputs.filename_prefix = `${runId}_`;
      return;
    }

    Object.keys(inputs).forEach((key) => {
      if (SEED_LIKE_INPUT_VALUES.includes(key) && !Array.isArray(inputs[key])) {
        inputs[key] = getComfyUIRandomSeed();
      }
    });
  });
}
