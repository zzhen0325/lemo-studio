import { afterEach, describe, expect, it } from "vitest";
import { getApiBase } from "@/lib/api-base";

describe("getApiBase", () => {
  afterEach(() => {
    delete window.__LEMO_RUNTIME_ENV__;
    delete process.env.NEXT_PUBLIC_API_BASE;
  });

  it("prefers the runtime-injected client api base", () => {
    window.__LEMO_RUNTIME_ENV__ = {
      apiBase: "https://qzcnzen0.fn-boe.bytedance.net/api",
    };

    expect(getApiBase()).toBe("https://qzcnzen0.fn-boe.bytedance.net/api");
  });

  it("falls back to same-origin proxy when no runtime api base exists", () => {
    window.__LEMO_RUNTIME_ENV__ = {
      apiBase: "",
    };

    expect(getApiBase()).toBe("/api");
  });
});
