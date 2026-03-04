import { promises as fs } from "fs";
import path from "path";

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

export async function readLocalPublicImage(
  rawPath: string
): Promise<{ data: string; mimeType: string } | null> {
  const normalized = rawPath.replace(/\\/g, "/").trim();
  if (!normalized.startsWith("/") || normalized.includes("..")) {
    return null;
  }

  const publicPath = path.join(getWorkspaceRoot(), "public", normalized);
  const buffer = await fs.readFile(publicPath);
  return {
    data: buffer.toString("base64"),
    mimeType: getMimeTypeFromPath(publicPath),
  };
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}${imageUrl}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
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
