import { describe, expect, it } from "vitest";
import {
  assertDirectComfyCompatibility,
  getDirectComfyEndpoints,
  resolveDirectComfyUrl,
} from "@/lib/comfyui/direct-config";

describe("direct ComfyUI config", () => {
  it("normalizes the direct ComfyUI URL", () => {
    const comfyUrl = resolveDirectComfyUrl("http://10.75.169.12:1000");
    expect(comfyUrl?.toString()).toBe("http://10.75.169.12:1000/");

    const endpoints = getDirectComfyEndpoints("http://10.75.169.12:1000/");
    expect(endpoints).toMatchObject({
      httpBase: "http://10.75.169.12:1000",
      wsBase: "ws://10.75.169.12:1000",
    });
  });

  it("blocks HTTPS pages from directly calling an HTTP ComfyUI endpoint", () => {
    const comfyUrl = resolveDirectComfyUrl("http://10.75.169.12:1000/");
    expect(comfyUrl).not.toBeNull();
    expect(() => assertDirectComfyCompatibility(comfyUrl as URL, "https:")).toThrow(/HTTPS pages/);
  });
});
