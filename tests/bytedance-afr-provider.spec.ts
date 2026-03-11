import { afterEach, describe, expect, it, vi } from "vitest";
import { BytedanceAfrProvider } from "@/lib/ai/providers";

describe("BytedanceAfrProvider", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalGatewayBaseUrl = process.env.GATEWAY_BASE_URL;
  const originalBytedanceAid = process.env.BYTEDANCE_AID;
  const originalBytedanceAppKey = process.env.BYTEDANCE_APP_KEY;
  const originalBytedanceAppSecret = process.env.BYTEDANCE_APP_SECRET;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalGatewayBaseUrl === undefined) delete process.env.GATEWAY_BASE_URL;
    else process.env.GATEWAY_BASE_URL = originalGatewayBaseUrl;

    if (originalBytedanceAid === undefined) delete process.env.BYTEDANCE_AID;
    else process.env.BYTEDANCE_AID = originalBytedanceAid;

    if (originalBytedanceAppKey === undefined) delete process.env.BYTEDANCE_APP_KEY;
    else process.env.BYTEDANCE_APP_KEY = originalBytedanceAppKey;

    if (originalBytedanceAppSecret === undefined) delete process.env.BYTEDANCE_APP_SECRET;
    else process.env.BYTEDANCE_APP_SECRET = originalBytedanceAppSecret;

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses fixed conf schema for seed4_v2_0226lemo", async () => {
    process.env.NODE_ENV = "test";
    process.env.GATEWAY_BASE_URL = "https://effect.bytedance.net";
    process.env.BYTEDANCE_AID = "6834";
    process.env.BYTEDANCE_APP_KEY = "test-app-key";
    process.env.BYTEDANCE_APP_SECRET = "test-app-secret";

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

  it("fails fast in production when AFR env vars are missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.GATEWAY_BASE_URL;
    delete process.env.BYTEDANCE_AID;
    delete process.env.BYTEDANCE_APP_KEY;
    delete process.env.BYTEDANCE_APP_SECRET;

    const provider = new BytedanceAfrProvider({
      providerId: "bytedance",
      modelId: "seed4_v2_0226lemo",
    });

    await expect(provider.generateImage({
      prompt: "test",
    })).rejects.toThrow(/Missing ByteDance AFR environment variables/);
  });
});
