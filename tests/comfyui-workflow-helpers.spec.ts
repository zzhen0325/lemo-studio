import { describe, expect, it } from "vitest";
import {
  applyLoadImageDefaults,
  finalizeWorkflowForExecution,
  setWorkflowInputs,
  type WorkflowLike,
} from "@/lib/comfyui/workflow-helpers";

describe("comfyui workflow helpers", () => {
  it("fills missing LoadImage inputs with empty strings", () => {
    const workflow: WorkflowLike = {
      "10": {
        class_type: "LoadImage",
        inputs: { image: "" },
      },
    };

    const inputs = applyLoadImageDefaults([], workflow);
    expect(inputs).toEqual([{ key: "10-inputs-image", value: "" }]);
  });

  it("applies mapped inputs onto workflow nodes", () => {
    const workflow: WorkflowLike = {
      "12": {
        class_type: "CLIPTextEncode",
        inputs: { text: "" },
      },
    };

    setWorkflowInputs(workflow, [{ key: "12-inputs-text", value: "hello direct comfy" }]);
    expect(workflow["12"]?.inputs?.text).toBe("hello direct comfy");
  });

  it("updates save prefixes and regenerates seed-like fields", () => {
    const workflow: WorkflowLike = {
      "1": {
        class_type: "SaveImage",
        inputs: { filename_prefix: "old" },
      },
      "2": {
        class_type: "RandomNoise",
        inputs: { noise_seed: 1 },
      },
    };

    finalizeWorkflowForExecution(workflow);

    expect(String(workflow["1"]?.inputs?.filename_prefix || "")).toMatch(/_$/);
    expect(workflow["2"]?.inputs?.noise_seed).not.toBe(1);
  });
});
