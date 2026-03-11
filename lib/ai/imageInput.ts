import { promises as fs } from "fs";
import path from "path";
import { getPublicApiBase, getPublicBaseUrl } from "@/lib/env/public";

const bufferToArrayBuffer = (buf: Buffer): ArrayBuffer =>
  Uint8Array.from(buf).buffer;

function getWorkspaceRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith(`${path.sep}server`) ? path.join(cwd, "..") : cwd;
}

function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

function normalizeAbsoluteHttpUrl(value: string | undefined | null): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function deriveOriginFromApiBase(value: string | undefined | null): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getConfiguredSiteBaseUrl(): string | null {
  const candidates = [
    normalizeAbsoluteHttpUrl(getPublicBaseUrl()),
    deriveOriginFromApiBase(getPublicApiBase()),
    deriveOriginFromApiBase(process.env.GULUX_API_BASE),
    deriveOriginFromApiBase(process.env.INTERNAL_API_BASE),
  ];

  return candidates.find((candidate) => Boolean(candidate)) || null;
}

export function buildAbsoluteSiteUrl(rawPath: string): string | null {
  const normalized = rawPath.replace(/\\/g, "/").trim();
  if (!normalized.startsWith("/") || normalized.includes("..")) {
    return null;
  }

  const siteBaseUrl = getConfiguredSiteBaseUrl();
  if (!siteBaseUrl) {
    return null;
  }

  return new URL(normalized, `${siteBaseUrl}/`).toString();
}

function isFileMissingError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: string }).code === "ENOENT"
  );
}

async function fetchRelativeImageFromSite(rawPath: string): Promise<{ data: string; mimeType: string } | null> {
  const absoluteUrl = buildAbsoluteSiteUrl(rawPath);
  if (!absoluteUrl) {
    return null;
  }

  const response = await fetch(absoluteUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch relative image ${rawPath}: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || "image/png";
  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mimeType,
  };
}

export async function readLocalPublicImage(
  rawPath: string
): Promise<{ data: string; mimeType: string } | null> {
  const normalized = rawPath.replace(/\\/g, "/").trim();
  if (!normalized.startsWith("/") || normalized.includes("..")) {
    return null;
  }

  const publicPath = path.join(getWorkspaceRoot(), "public", normalized);
  try {
    const buffer = await fs.readFile(publicPath);
    return {
      data: buffer.toString("base64"),
      mimeType: getMimeTypeFromPath(publicPath),
    };
  } catch (error) {
    if (!isFileMissingError(error)) {
      throw error;
    }
  }

  return fetchRelativeImageFromSite(normalized);
}

function detectMimeTypeFromBuffer(buffer: Buffer): string {
  if (buffer.length > 3) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
      return "image/jpeg";
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    )
      return "image/png";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
      return "image/gif";
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    )
      return "image/webp";
  }
  return "image/png";
}

async function toBlobFromLocalPath(imageUrl: string): Promise<Blob> {
  const localImage = await readLocalPublicImage(imageUrl);
  if (localImage) {
    const buffer = Buffer.from(localImage.data, "base64");
    return new Blob([bufferToArrayBuffer(buffer)], {
      type: localImage.mimeType,
    });
  }

  const absoluteUrl = buildAbsoluteSiteUrl(imageUrl);
  if (!absoluteUrl) {
    throw new Error(`Failed to resolve relative image path ${imageUrl}. Configure NEXT_PUBLIC_BASE_URL for split deployments.`);
  }

  const response = await fetch(absoluteUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch relative image ${imageUrl}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";
  return new Blob([arrayBuffer], { type: contentType });
}

export async function toBlobFromImageInput(imageUrl: string): Promise<Blob> {
  if (imageUrl.startsWith("data:")) {
    const [header, base64Data] = imageUrl.split(",");
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const buffer = Buffer.from(base64Data, "base64");
    return new Blob([bufferToArrayBuffer(buffer)], { type: mime });
  }

  if (imageUrl.startsWith("/") && imageUrl.length < 2048) {
    return toBlobFromLocalPath(imageUrl);
  }

  if (imageUrl.startsWith("http")) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";
    return new Blob([arrayBuffer], { type: contentType });
  }

  const buffer = Buffer.from(imageUrl, "base64");
  const mime = detectMimeTypeFromBuffer(buffer);
  return new Blob([bufferToArrayBuffer(buffer)], { type: mime });
}
