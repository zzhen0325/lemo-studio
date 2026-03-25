import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnimatedButton } from "@/components/ui/animated-gradient-button";

describe("AnimatedButton", () => {
  it("stays disabled while loading by default", () => {
    const onClick = vi.fn();

    render(
      <AnimatedButton
        label="Generate"
        loading
        onClick={onClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("can keep accepting clicks while loading when explicitly allowed", () => {
    const onClick = vi.fn();

    render(
      <AnimatedButton
        label="Generate Again"
        loading
        disableWhileLoading={false}
        onClick={onClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate Again" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
