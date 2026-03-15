import { toBlobFromImageInput } from "./imageInput";

export function selectCozeUploadEndpoint(baseURL = ""): string {
  if (baseURL.includes("coze.com")) {
    return "https://api.coze.com/v1/files/upload";
  }
  if (baseURL.includes("bytedance.net")) {
    return "https://bot-open-api.bytedance.net/v1/files/upload";
  }
  return "https://api.coze.cn/v1/files/upload";
}

export async function uploadToCoze(
  imageUrl: string,
  apiKey: string | undefined,
  baseURL = ""
): Promise<string> {
  if (!apiKey) {
    throw new Error("Coze API key is required");
  }
  const blob = await toBlobFromImageInput(imageUrl);
  const uploadUrl = selectCozeUploadEndpoint(baseURL);
  const formData = new FormData();
  formData.append("file", blob, "image.png");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(
      `Coze File Upload failed (${uploadResponse.status}): ${errorText}`
    );
  }

  const result = await uploadResponse.json();
  if (result.code !== 0) {
    throw new Error(`Coze File Upload API error: ${result.msg}`);
  }
  return result.data.id;
}
