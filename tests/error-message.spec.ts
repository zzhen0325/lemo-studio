import { describe, expect, it } from "vitest";
import { extractErrorInfo, toDisplayError } from "@/lib/error-message";
import { ErrorResponseFactory } from "@/lib/models/errors";

describe("error message extraction", () => {
  it("prefers nested details over generic top-level HTTP errors", () => {
    const info = extractErrorInfo({
      error: "Internal Server Error",
      details: {
        errorMsg: "Cannot connect to ComfyUI",
        errorDetails: ["Connect timeout: http://10.0.0.1:8188"],
      },
    });

    expect(info.message).toBe("Cannot connect to ComfyUI");
    expect(info.details).toContain("Connect timeout: http://10.0.0.1:8188");
  });

  it("extracts comfy node error details from plain objects", () => {
    const factory = new ErrorResponseFactory();

    const response = factory.getErrorResponse({
      message: "ComfyUI workflow execution error",
      node_errors: {
        42: [{ type: "ValueError", message: "Checkpoint loader failed" }],
      },
    });

    expect(response.errorMsg).toBe("ComfyUI workflow execution error");
    expect(response.errorDetails).toEqual([
      "Node 42 (ValueError): Checkpoint loader failed",
    ]);
  });

  it("wraps parsed payloads into readable Error instances", () => {
    const error = toDisplayError({
      error: "Something went wrong",
      details: {
        errorMsg: "Missing ByteDance AFR environment variables: GATEWAY_BASE_URL, BYTEDANCE_APP_KEY",
      },
      status: 502,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Missing ByteDance AFR environment variables: GATEWAY_BASE_URL, BYTEDANCE_APP_KEY");
    expect((error as Error & { status?: number }).status).toBe(502);
  });
});
