import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FluxKleinConnectionHelpDialog from "@/app/studio/playground/_components/Dialogs/FluxKleinConnectionHelpDialog";
import { probeDirectComfyAvailability } from "@/lib/comfyui/browser-client";

vi.mock("@/lib/comfyui/browser-client", () => ({
  probeDirectComfyAvailability: vi.fn(),
}));

describe("FluxKleinConnectionHelpDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(probeDirectComfyAvailability).mockResolvedValue({ available: true });
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("shows the success state after the user returns from opening the ComfyUI link", async () => {
    render(
      <FluxKleinConnectionHelpDialog
        open
        comfyUrl="https://10.75.169.12:1000"
        onOpenChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /打开链接/i }));

    expect(window.open).toHaveBeenCalledWith(
      "https://10.75.169.12:1000",
      "_blank",
      "noopener,noreferrer",
    );

    fireEvent(window, new Event("focus"));

    await waitFor(() => {
      expect(probeDirectComfyAvailability).toHaveBeenCalledWith({
        comfyUrl: "https://10.75.169.12:1000",
      });
    });

    expect(await screen.findByText("连接成功啦")).toBeTruthy();
    expect(screen.getByText(/后续一般就不用重复做这一步了/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /知道了，继续使用/i })).toBeTruthy();
  });
});
