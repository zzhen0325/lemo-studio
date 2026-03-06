import { afterEach, describe, expect, it, vi } from "vitest";
import { BytedanceAfrProvider } from "@/lib/ai/providers";

describe("BytedanceAfrProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses fixed conf schema for seed4_v2_0226lemo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          afr_data: [{ pic: "AAAABBBB" }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BytedanceAfrProvider({
      providerId: "bytedance",
      modelId: "seed4_v2_0226lemo",
    });

    await provider.generateImage({
      prompt: "小龙虾形状的lemo，米黄色纯色背景",
      width: 1024,
      height: 1024,
      options: {
        seed: 123456,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const body = String(options?.body || "");
    const form = new URLSearchParams(body);
    const conf = JSON.parse(String(form.get("conf") || "{}"));

    expect(form.get("algorithms")).toBe("seed4_v2_0226lemo");
    expect(conf).toEqual({
      width: 2048,
      height: 2048,
      seed: -1,
      string: "小龙虾形状的lemo，米黄色纯色背景",
    });
  });
});
