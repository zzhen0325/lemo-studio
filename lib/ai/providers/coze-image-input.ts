import { buildAbsoluteSiteUrl, toBlobFromImageInput, getConfiguredSiteBaseUrl, readLocalPublicImage } from "../imageInput";
import { getApiBase, extractStorageKeyFromPresignedUrl } from "@/lib/api-base";
import { getFileUrl } from "@/src/storage/object-storage";

export type CozePromptImagePayload = {
  url: string;
  file_type: string;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

const COZE_WORKFLOW_SUPPORTED_REFERENCE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

export function isLikelyBase64(value: string): boolean {
  if (!value || value.length < 24) return false;
  const sanitized = value.replace(/\s+/g, "");
  return /^[A-Za-z0-9+/=]+$/.test(sanitized);
}

function normalizeImageMimeType(mimeType: string | undefined | null): string {
  const normalized = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized || "image/png";
}

function parseImageDataUrl(value: string): { mimeType: string; base64: string; buffer: Buffer } | null {
  const match = value.match(/^data:([^;,]+)(?:;[^,]*)?;base64,([\s\S]*)$/i);
  if (!match) return null;
  const mimeType = normalizeImageMimeType(match[1]);
  if (!mimeType.startsWith("image/")) return null;

  const base64 = match[2].replace(/\s+/g, "");
  return {
    mimeType,
    base64,
    buffer: Buffer.from(base64, "base64"),
  };
}

async function transcodeToPngDataUrl(buffer: Buffer, sourceMimeType: string): Promise<string | null> {
  try {
    const sharpModule = await import("sharp");
    const pngBuffer = await sharpModule.default(buffer, {
      animated: false,
      limitInputPixels: false,
    })
      .rotate()
      .png()
      .toBuffer();
    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  } catch (error) {
    console.warn("[buildCozeImagePayload] failed_to_transcode_reference_image", {
      sourceMimeType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function normalizeCozeReferenceDataUrl(dataUrl: string): Promise<string> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  if (COZE_WORKFLOW_SUPPORTED_REFERENCE_MIME_TYPES.has(parsed.mimeType)) {
    return `data:${parsed.mimeType};base64,${parsed.base64}`;
  }

  return (await transcodeToPngDataUrl(parsed.buffer, parsed.mimeType)) || dataUrl;
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  if (typeof blob.arrayBuffer === "function") {
    return Buffer.from(await blob.arrayBuffer());
  }

  if (typeof FileReader !== "undefined") {
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("Failed to read image blob"));
      reader.onloadend = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }
        reject(new Error("Failed to read image blob as ArrayBuffer"));
      };
      reader.readAsArrayBuffer(blob);
    });
    return Buffer.from(arrayBuffer);
  }

  return Buffer.from(await new Response(blob).arrayBuffer());
}

function buildAbsoluteCozeImageUrl(rawPath: string): string | null {
  const siteAbsoluteUrl = buildAbsoluteSiteUrl(rawPath);
  if (siteAbsoluteUrl) {
    return siteAbsoluteUrl;
  }

  try {
    const apiBase = getApiBase();
    const apiUrl = new URL(apiBase, "http://placeholder.local");
    if (apiUrl.origin === "http://placeholder.local") {
      return null;
    }
    return new URL(rawPath, `${apiUrl.origin}/`).toString();
  } catch {
    return null;
  }
}

async function inlineCozeImageInput(imageInput: string): Promise<string | null> {
  try {
    const blob = await toBlobFromImageInput(imageInput);
    const buffer = await blobToBuffer(blob);
    return normalizeCozeReferenceDataUrl(
      `data:${normalizeImageMimeType(blob.type)};base64,${buffer.toString("base64")}`,
    );
  } catch (error) {
    console.warn("[buildCozeImagePayload] failed_to_inline_image_input", {
      imageInput,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function shouldInlineCozeHttpImage(imageInput: string): boolean {
  try {
    const parsed = new URL(imageInput);
    if (LOOPBACK_HOSTS.has(parsed.hostname)) {
      return true;
    }

    if (parsed.hostname.includes("tiktokcdn.com")) {
      return true;
    }

    if (parsed.pathname.endsWith("/api/storage/image") || parsed.pathname.endsWith("/storage/image")) {
      return true;
    }

    if (extractStorageKeyFromPresignedUrl(imageInput)) {
      return true;
    }

    if (/\.(?:avif|bmp|gif|heic|heif|tiff?|webp|svg)$/i.test(parsed.pathname)) {
      return true;
    }

    if ((parsed.searchParams.get("format") || "").toLowerCase() === "webp") {
      return true;
    }

    const configuredSiteBaseUrl = getConfiguredSiteBaseUrl();
    if (!configuredSiteBaseUrl) {
      return false;
    }

    return new URL(configuredSiteBaseUrl).origin === parsed.origin;
  } catch {
    return false;
  }
}

export async function buildCozeImagePayload(imageInput: string): Promise<CozePromptImagePayload> {
  if (!imageInput) {
    throw new Error("Coze API requires image input");
  }

  if (imageInput.startsWith("data:")) {
    return {
      url: await normalizeCozeReferenceDataUrl(imageInput),
      file_type: "image",
    };
  }

  if (imageInput.startsWith("/")) {
    const localImage = await readLocalPublicImage(imageInput);
    if (localImage) {
      return {
        url: await normalizeCozeReferenceDataUrl(`data:${localImage.mimeType};base64,${localImage.data}`),
        file_type: "image",
      };
    }

    const absoluteUrl = buildAbsoluteCozeImageUrl(imageInput);
    if (absoluteUrl) {
      const inlined = await inlineCozeImageInput(absoluteUrl);
      if (inlined) {
        return {
          url: inlined,
          file_type: "image",
        };
      }
    }

    throw new Error(`Invalid local image path: ${imageInput}`);
  }

  if (/^https?:\/\//i.test(imageInput)) {
    if (shouldInlineCozeHttpImage(imageInput)) {
      const inlined = await inlineCozeImageInput(imageInput);
      if (inlined) {
        return {
          url: inlined,
          file_type: "image",
        };
      }
    }

    return {
      url: imageInput,
      file_type: "image",
    };
  }

  if (isLikelyBase64(imageInput)) {
    const sanitized = imageInput.replace(/\s+/g, "");
    return {
      url: `data:image/png;base64,${sanitized}`,
      file_type: "image",
    };
  }

  // 尝试作为对象存储 key 处理（生成预签名 URL）
  // 对象存储 key 通常不包含 :// 且不是 data URL、base64、本地路径
  try {
    const presignedUrl = await getFileUrl(imageInput, 3600); // 1小时过期
    console.info('[buildCozeImagePayload] resolved_storage_key_to_presigned_url', {
      key: imageInput,
      resolvedUrl: presignedUrl.substring(0, 50) + '...',
    });
    const inlined = await inlineCozeImageInput(presignedUrl);
    if (inlined) {
      return {
        url: inlined,
        file_type: "image",
      };
    }
    return {
      url: presignedUrl,
      file_type: "image",
    };
  } catch (error) {
    console.warn('[buildCozeImagePayload] failed_to_resolve_storage_key', {
      key: imageInput,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  throw new Error("Unsupported image input for Coze API");
}
