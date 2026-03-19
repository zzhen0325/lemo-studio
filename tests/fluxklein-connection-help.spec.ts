import { describe, expect, it } from "vitest";
import {
  createFluxKleinConnectionHelpError,
  getFluxKleinConnectionHelp,
  shouldShowFluxKleinConnectionHelp,
} from "@/lib/comfyui/fluxklein-connection-help";

describe("fluxklein connection help", () => {
  it("flags browser fetch failures for the trust dialog", () => {
    expect(shouldShowFluxKleinConnectionHelp("Failed to fetch")).toBe(true);
    expect(shouldShowFluxKleinConnectionHelp("Cannot open ComfyUI websocket: wss://10.75.169.12:1000/ws")).toBe(true);
    expect(shouldShowFluxKleinConnectionHelp("ComfyUI 连接超时: https://10.75.169.12:1000")).toBe(false);
  });

  it("builds dialog payloads from enriched FluxKlein errors", () => {
    const error = createFluxKleinConnectionHelpError({
      comfyUrl: "https://10.75.169.12:1000",
      technicalReason: "Failed to fetch",
    });

    expect(getFluxKleinConnectionHelp(error)).toEqual({
      title: "需要先在浏览器中放行 ComfyUI 连接",
      message: "FluxKlein 需要由浏览器直接访问运行在你个人电脑上的 ComfyUI。请先单独打开 https://10.75.169.12:1000，在浏览器提示页里点击“高级”，再点击“继续前往”，然后回到这里重新点击生成。",
      comfyUrl: "https://10.75.169.12:1000",
      technicalReason: "Failed to fetch",
    });
  });

  it("can recover dialog payloads from plain error messages with URLs", () => {
    const error = new Error("ComfyUI 网络不可达: https://10.75.169.12:1000。请检查网络连接或 ComfyUI 是否已启动。");

    expect(getFluxKleinConnectionHelp(error)).toEqual({
      title: "需要先在浏览器中放行 ComfyUI 连接",
      message: "FluxKlein 需要由浏览器直接访问运行在你个人电脑上的 ComfyUI。请先单独打开 https://10.75.169.12:1000，在浏览器提示页里点击“高级”，再点击“继续前往”，然后回到这里重新点击生成。",
      comfyUrl: "https://10.75.169.12:1000",
      technicalReason: "ComfyUI 网络不可达: https://10.75.169.12:1000。请检查网络连接或 ComfyUI 是否已启动。",
    });
  });
});
