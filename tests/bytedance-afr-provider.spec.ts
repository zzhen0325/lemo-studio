import { afterEach, describe, expect, it, vi } from "vitest";
import { BytedanceAfrProvider } from "@/lib/ai/providers";

describe("BytedanceAfrProvider", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = env.NODE_ENV;
  const originalGatewayBaseUrl = process.env.GATEWAY_BASE_URL;
  const originalBytedanceAid = process.env.BYTEDANCE_AID;
  const originalBytedanceAppKey = process.env.BYTEDANCE_APP_KEY;
  const originalBytedanceAppSecret = process.env.BYTEDANCE_APP_SECRET;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;

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

  it("uses submit_task_v2 + batch_get_result_v2 for seed4_v2_0226lemo", async () => {
    env.NODE_ENV = "test";
    process.env.GATEWAY_BASE_URL = "https://effect.bytedance.net";
    process.env.BYTEDANCE_AID = "6834";
    process.env.BYTEDANCE_APP_KEY = "test-app-key";
    process.env.BYTEDANCE_APP_SECRET = "test-app-secret";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 0,
          data: {
            task_id: "test-task-id",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 0,
          data: {
            results: [{
              status: "done",
              pic_urls: [{ main_url: "https://example.com/generated.png" }],
            }],
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

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [submitUrl, submitOptions] = fetchMock.mock.calls[0];
    expect(String(submitUrl)).toContain("/media/api/pic/submit_task_v2");
    const submitForm = new URLSearchParams(String(submitOptions?.body || ""));
    const reqJson = JSON.parse(String(submitForm.get("req_json") || "{}"));
    expect(submitForm.get("req_key")).toBe("seed4_v2_0226lemo");
    expect(reqJson).toEqual({
      width: 1024,
      height: 1024,
      seed: -1,
      string: "小龙虾形状的lemo，米黄色纯色背景",
    });

    const [pollUrl, pollOptions] = fetchMock.mock.calls[1];
    expect(String(pollUrl)).toContain("/media/api/pic/batch_get_result_v2");
    const pollForm = new URLSearchParams(String(pollOptions?.body || ""));
    expect(pollForm.get("req_key")).toBe("seed4_v2_0226lemo");
    expect(pollForm.get("task_ids")).toBe("test-task-id");
  });

  it("fails fast in production when AFR env vars are missing", async () => {
    env.NODE_ENV = "production";
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
