import fs from "node:fs/promises";
import path from "node:path";

type WorkflowNode = {
  class_type?: string;
  inputs?: Record<string, unknown>;
};

type Workflow = Record<string, WorkflowNode>;

export type FluxKleinBuildArgs = {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  batchSize?: number;
  referenceImages?: string[];
};

type FluxKleinBuildResult = {
  workflow: Workflow;
  viewComfyInputs: Array<{ key: string; value: string | number | boolean }>;
};

const templateCache: { t2i?: Workflow; i2i?: Workflow } = {};

async function loadTemplate(name: "t2i" | "i2i"): Promise<Workflow> {
  const cached = templateCache[name];
  if (cached) return cached;
  const fileName = name === "t2i" ? "Flux_klein_T2I.json" : "Flux_klein_I2I.json";
  const firstPath = path.join(process.cwd(), fileName);
  let content: string;
  try {
    content = await fs.readFile(firstPath, "utf8");
  } catch {
    const fallbackPath = path.join(process.cwd(), "..", fileName);
    content = await fs.readFile(fallbackPath, "utf8");
  }
  const parsed = JSON.parse(content) as Workflow;
  templateCache[name] = parsed;
  return parsed;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function findNodeIdByClassType(workflow: Workflow, classType: string): string | undefined {
  return Object.entries(workflow).find(([, node]) => node?.class_type === classType)?.[0];
}

function findNodeIdsByClassType(workflow: Workflow, classType: string): string[] {
  return Object.entries(workflow)
    .filter(([, node]) => node?.class_type === classType)
    .map(([id]) => id);
}

function setInput(workflow: Workflow, nodeId: string | undefined, key: string, value: unknown) {
  if (!nodeId) return;
  const node = workflow[nodeId];
  if (!node) return;
  if (!node.inputs) node.inputs = {};
  node.inputs[key] = value;
}

function getNextIdFactory(workflow: Workflow) {
  const maxId = Object.keys(workflow).reduce((max, id) => {
    const parsed = Number.parseInt(id, 10);
    if (Number.isFinite(parsed)) return Math.max(max, parsed);
    return max;
  }, 0);
  let nextId = maxId + 1;
  return () => String(nextId++);
}

export async function buildFluxKleinWorkflow(args: FluxKleinBuildArgs): Promise<FluxKleinBuildResult> {
  const referenceImages = (args.referenceImages || []).filter(Boolean);
  const base = await loadTemplate("t2i");
  const workflow = deepClone(base);

  const clipTextId = findNodeIdByClassType(workflow, "CLIPTextEncode");
  const conditioningZeroId = findNodeIdByClassType(workflow, "ConditioningZeroOut");
  const cfgGuiderId = findNodeIdByClassType(workflow, "CFGGuider");
  const noiseId = findNodeIdByClassType(workflow, "RandomNoise");
  const latentId = findNodeIdByClassType(workflow, "EmptyFlux2LatentImage");
  const schedulerId = findNodeIdByClassType(workflow, "Flux2Scheduler");
  const vaeLoaderId = findNodeIdByClassType(workflow, "VAELoader");
  const textNodeId = findNodeIdByClassType(workflow, "ttN text");
  const getImageSizeId = findNodeIdByClassType(workflow, "GetImageSize");

  if (!clipTextId || !conditioningZeroId || !cfgGuiderId || !vaeLoaderId) {
    throw new Error("FluxKlein workflow 缺少核心节点");
  }

  setInput(workflow, clipTextId, "text", args.prompt || "");
  if (textNodeId) {
    delete workflow[textNodeId];
  }

  const seedValue = typeof args.seed === "number" ? Math.floor(args.seed) : Math.floor(Math.random() * 1000000000000);
  setInput(workflow, noiseId, "noise_seed", seedValue);

  const batchSizeValue = Math.max(1, Math.floor(Number(args.batchSize || 1)));
  setInput(workflow, latentId, "batch_size", batchSizeValue);

  const viewComfyInputs: Array<{ key: string; value: string | number | boolean }> = [];

  if (referenceImages.length === 0) {
    const refNodeTypesToRemove = ["LoadImage", "ImageScaleToTotalPixels", "VAEEncode", "ReferenceLatent"];
    refNodeTypesToRemove.forEach((type) => {
      findNodeIdsByClassType(workflow, type).forEach((id) => {
        delete workflow[id];
      });
    });
    setInput(workflow, cfgGuiderId, "positive", [clipTextId, 0]);
    setInput(workflow, cfgGuiderId, "negative", [conditioningZeroId, 0]);
    setInput(workflow, schedulerId, "width", Math.floor(Number(args.width) || 1024));
    setInput(workflow, schedulerId, "height", Math.floor(Number(args.height) || 1024));
    setInput(workflow, latentId, "width", Math.floor(Number(args.width) || 1024));
    setInput(workflow, latentId, "height", Math.floor(Number(args.height) || 1024));
    if (getImageSizeId) {
      delete workflow[getImageSizeId];
    }
  } else {
    const refNodeTypesToRemove = ["LoadImage", "ImageScaleToTotalPixels", "VAEEncode", "ReferenceLatent"];
    refNodeTypesToRemove.forEach((type) => {
      findNodeIdsByClassType(workflow, type).forEach((id) => {
        delete workflow[id];
      });
    });
    const nextId = getNextIdFactory(workflow);
    let prevPosId = clipTextId;
    let prevNegId = conditioningZeroId;
    let firstScaleId: string | undefined;

    for (let i = 0; i < referenceImages.length; i += 1) {
      const loadId = nextId();
      const scaleId = nextId();
      const encodeId = nextId();
      const posId = nextId();
      const negId = nextId();

      workflow[loadId] = { class_type: "LoadImage", inputs: { image: "" } };
      workflow[scaleId] = {
        class_type: "ImageScaleToTotalPixels",
        inputs: { upscale_method: "nearest-exact", megapixels: 1, resolution_steps: 1, image: [loadId, 0] },
      };
      workflow[encodeId] = { class_type: "VAEEncode", inputs: { pixels: [scaleId, 0], vae: [vaeLoaderId, 0] } };
      workflow[posId] = { class_type: "ReferenceLatent", inputs: { conditioning: [prevPosId, 0], latent: [encodeId, 0] } };
      workflow[negId] = { class_type: "ReferenceLatent", inputs: { conditioning: [prevNegId, 0], latent: [encodeId, 0] } };

      prevPosId = posId;
      prevNegId = negId;

      if (!firstScaleId) firstScaleId = scaleId;
      const refImage = referenceImages[i];
      viewComfyInputs.push({ key: `${loadId}-inputs-image`, value: refImage });
    }

    if (getImageSizeId && firstScaleId) {
      setInput(workflow, getImageSizeId, "image", [firstScaleId, 0]);
      setInput(workflow, schedulerId, "width", [getImageSizeId, 0]);
      setInput(workflow, schedulerId, "height", [getImageSizeId, 1]);
      setInput(workflow, latentId, "width", [getImageSizeId, 0]);
      setInput(workflow, latentId, "height", [getImageSizeId, 1]);
    } else {
      setInput(workflow, schedulerId, "width", Math.floor(Number(args.width) || 1024));
      setInput(workflow, schedulerId, "height", Math.floor(Number(args.height) || 1024));
      setInput(workflow, latentId, "width", Math.floor(Number(args.width) || 1024));
      setInput(workflow, latentId, "height", Math.floor(Number(args.height) || 1024));
    }

    setInput(workflow, cfgGuiderId, "positive", [prevPosId, 0]);
    setInput(workflow, cfgGuiderId, "negative", [prevNegId, 0]);
  }

  return { workflow, viewComfyInputs };
}
