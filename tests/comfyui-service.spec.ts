import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadImage: vi.fn(),
  queuePrompt: vi.fn(),
  getOutputFiles: vi.fn(),
  readJsonAsset: vi.fn(),
  resolvePublicAssetUrl: vi.fn(),
}));

vi.mock("../lib/api/comfyui-api-service", () => ({
  ComfyUIAPIService: class MockComfyUIAPIService {
    public uploadImage = mocks.uploadImage;
    public queuePrompt = mocks.queuePrompt;
    public getOutputFiles = mocks.getOutputFiles;
  },
}));

vi.mock("../lib/runtime-assets", () => ({
  readJsonAsset: mocks.readJsonAsset,
  resolvePublicAssetUrl: mocks.resolvePublicAssetUrl,
}));

import { ComfyUIService } from "../lib/api/comfyui-service";

describe("ComfyUIService image normalization", () => {
  beforeEach(() => {
    mocks.uploadImage.mockReset();
    mocks.queuePrompt.mockReset();
    mocks.getOutputFiles.mockReset();
    mocks.readJsonAsset.mockReset();
    mocks.resolvePublicAssetUrl.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploads remote LoadImage inputs before queueing the prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    mocks.uploadImage.mockResolvedValue("uploaded-ref.jpg");
    mocks.getOutputFiles.mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer,
    });
    mocks.queuePrompt.mockResolvedValue({
      promptId: "prompt-1",
      outputFiles: [{ filename: "out.png", subfolder: "", type: "output" }],
    });

    const service = new ComfyUIService();
    await service.runWorkflow({
      workflow: {
        "1": {
          class_type: "LoadImage",
          inputs: { image: "" },
        },
        "2": {
          class_type: "SaveImage",
          inputs: { filename_prefix: "", images: ["1", 0] },
        },
      },
      viewComfy: {
        inputs: [{ key: "1-inputs-image", value: "https://example.com/ref.jpg" }],
        textOutputEnabled: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/ref.jpg",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("Mozilla/5.0"),
        }),
      }),
    );
    const [uploadedBlob, uploadedFilename] = mocks.uploadImage.mock.calls[0] as [{ arrayBuffer?: () => Promise<ArrayBuffer> }, string];
    expect(typeof uploadedBlob?.arrayBuffer).toBe("function");
    expect(uploadedFilename).toBe("ref.jpg");

    const queuedWorkflow = mocks.queuePrompt.mock.calls[0]?.[0] as Record<string, { inputs?: Record<string, unknown> }>;
    expect(queuedWorkflow["1"]?.inputs?.image).toBe("uploaded-ref.jpg");
  });

  it("fails before queueing when a remote image cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", {
      status: 403,
      statusText: "Forbidden",
      headers: {
        "content-type": "text/plain",
      },
    })));

    const service = new ComfyUIService();

    await expect(service.runWorkflow({
      workflow: {
        "1": {
          class_type: "LoadImage",
          inputs: { image: "" },
        },
      },
      viewComfy: {
        inputs: [{ key: "1-inputs-image", value: "https://example.com/ref.jpg" }],
        textOutputEnabled: false,
      },
    })).rejects.toMatchObject({
      message: "Failed to prepare image inputs for ComfyUI",
      errors: [expect.stringContaining("1-inputs-image: Failed to fetch remote image URL: HTTP 403 Forbidden")],
    });

    expect(mocks.uploadImage).not.toHaveBeenCalled();
    expect(mocks.queuePrompt).not.toHaveBeenCalled();
  });

  it("falls back to NEXT_PUBLIC_BASE_URL when runtime asset mapping is missing", async () => {
    window.__GULUX_RUNTIME_ENV__ = {
      baseUrl: "https://pr62hkr9.fn-boe.bytedance.net",
    };

    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        "content-type": "image/png",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    mocks.resolvePublicAssetUrl.mockResolvedValue(undefined);
    mocks.uploadImage.mockResolvedValue("uploaded-runtime-only.png");
    mocks.getOutputFiles.mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer,
    });
    mocks.queuePrompt.mockResolvedValue({
      promptId: "prompt-2",
      outputFiles: [{ filename: "out.png", subfolder: "", type: "output" }],
    });

    const service = new ComfyUIService();
    await service.runWorkflow({
      workflow: {
        "1": {
          class_type: "LoadImage",
          inputs: { image: "" },
        },
        "2": {
          class_type: "SaveImage",
          inputs: { filename_prefix: "", images: ["1", 0] },
        },
      },
      viewComfy: {
        inputs: [{ key: "1-inputs-image", value: "/outputs/runtime-only.png" }],
        textOutputEnabled: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://pr62hkr9.fn-boe.bytedance.net/outputs/runtime-only.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const queuedWorkflow = mocks.queuePrompt.mock.calls[0]?.[0] as Record<string, { inputs?: Record<string, unknown> }>;
    expect(queuedWorkflow["1"]?.inputs?.image).toBe("uploaded-runtime-only.png");
  });
});
