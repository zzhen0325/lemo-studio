import { describe, expect, it } from "vitest";
import {
  assertDirectComfyCompatibility,
  getDirectComfyDecision,
  getDirectComfyEndpoints,
  resolveDirectComfyUrl,
} from "@/lib/comfyui/direct-config";

describe("direct ComfyUI config", () => {
  it("normalizes the direct ComfyUI URL", () => {
    const comfyUrl = resolveDirectComfyUrl("https://10.75.163.10:1000");
    expect(comfyUrl?.toString()).toBe("https://10.75.163.10:1000/");

    const endpoints = getDirectComfyEndpoints("https://10.75.163.10:1000/");
    expect(endpoints).toMatchObject({
      httpBase: "https://10.75.163.10:1000",
      wsBase: "wss://10.75.163.10:1000",
    });
  });

  it("blocks HTTPS pages from directly calling an HTTP ComfyUI endpoint", () => {
    const comfyUrl = resolveDirectComfyUrl("http://10.75.163.10:1000/");
    expect(comfyUrl).not.toBeNull();
    expect(() => assertDirectComfyCompatibility(comfyUrl as URL, "https:")).toThrow(/HTTPS pages/);
  });

  it("returns a clear disabled decision for HTTPS pages with HTTP ComfyUI", () => {
    expect(getDirectComfyDecision("http://10.75.163.10:1000/", "https:")).toEqual({
      enabled: false,
      reason: expect.stringMatching(/HTTPS pages/),
      comfyUrl: "http://10.75.163.10:1000/",
    });
  });
});
