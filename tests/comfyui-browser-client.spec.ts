import { afterEach, describe, expect, it, vi } from "vitest";
import { probeDirectComfyAvailability } from "@/lib/comfyui/browser-client";

describe("probeDirectComfyAvailability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports direct ComfyUI as available when the browser can reach /prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(probeDirectComfyAvailability({
      comfyUrl: "http://10.75.169.12:1000",
    })).resolves.toEqual({ available: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.75.169.12:1000/prompt",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reports direct ComfyUI as unavailable when the browser cannot reach /prompt", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(probeDirectComfyAvailability({
      comfyUrl: "http://10.75.169.12:1000",
    })).resolves.toEqual({
      available: false,
      reason: "Failed to fetch",
    });
  });
});
