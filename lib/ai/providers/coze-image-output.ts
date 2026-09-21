import { isLikelyBase64 } from "./coze-image-input";

function pushUniqueImage(images: string[], candidate: string): void {
  const value = candidate.trim();
  if (!value || images.includes(value)) return;
  images.push(value);
}

export function extractImageUrlsFromString(input: string): string[] {
  const images: string[] = [];
  const value = input.trim();
  if (!value) return images;

  if (value.startsWith("data:image/")) {
    pushUniqueImage(images, value);
  } else if (/^https?:\/\/[^\s"'<>]+$/i.test(value)) {
    pushUniqueImage(images, value);
  } else if (isLikelyBase64(value)) {
    pushUniqueImage(images, `data:image/png;base64,${value.replace(/\s+/g, "")}`);
  }

  const cozeRegex = /https?:\/\/[st]\.coze\.cn\/t\/[a-zA-Z0-9_-]+\//gi;
  let match: RegExpExecArray | null;
  while ((match = cozeRegex.exec(value)) !== null) {
    pushUniqueImage(images, match[0]);
  }

  const fileRegex =
    /https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^\s"'<>]*)?(?:#[^\s"'<>]*)?/gi;
  while ((match = fileRegex.exec(value)) !== null) {
    pushUniqueImage(images, match[0]);
  }

  return images;
}

export function extractCozeWorkflowImageUrls(payload: unknown): string[] {
  const images: string[] = [];
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  const preferredKeys = [
    "url",
    "image",
    "image_url",
    "imageUrl",
    "images",
    "generated_image_urls",
    "output",
    "result",
    "data",
    "content",
    "message",
    "response",
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === "string") {
      for (const candidate of extractImageUrlsFromString(current)) {
        pushUniqueImage(images, candidate);
      }
      continue;
    }

    if (typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === "string") {
        for (const candidate of extractImageUrlsFromString(value)) {
          pushUniqueImage(images, candidate);
        }
      } else if (value !== undefined) {
        queue.push(value);
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === "string" || typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return images;
}
