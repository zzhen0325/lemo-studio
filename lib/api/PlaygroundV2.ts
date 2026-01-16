import { getApiBase } from "@/lib/api-base";

export type ByteArtistConfig = Record<string, unknown>;

export interface ByteArtistParams {
  conf: ByteArtistConfig;
  algorithms: string;
  img_return_format: string;
}

export type ByteArtistResponse = Record<string, unknown>;

export async function fetchByteArtistImage(params: ByteArtistParams): Promise<ByteArtistResponse> {
  try {
    const response = await fetch(`${getApiBase()}/byte-artist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const errorMessage = typeof errorData.error === 'string'
        ? errorData.error
        : typeof errorData.message === 'string'
          ? errorData.message
          : `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const result = (await response.json()) as ByteArtistResponse;
    return result;
  } catch (error) {
    throw new Error(`ByteArtist API 调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export async function exampleUsage(text: string, config?: Partial<ByteArtistConfig>) {
  const defaultConfig = {
    batch_size: 1,
    height: 1200,
    seed: Math.floor(Math.random() * 2147483647),
    width: 1200,
    text: text,
  };

  const result = await fetchByteArtistImage({
    conf: { ...defaultConfig, ...config },
    algorithms: 'lemo_2dillustator',
    img_return_format: 'png',
  });

  return result;
}

import type { IViewComfy } from '@/lib/providers/view-comfy-provider';
import type { IMultiValueInput, IInputField } from '@/lib/workflow-api-parser';

export interface LoraParam {
  model_name: string;
  strength: number;
}

export async function runComfyWorkflowWithMapping(args: {
  workflowConfig: IViewComfy;
  prompt: string;
  width: number;
  height: number;
  batch_size: number;
  base_model?: string;
  loras?: LoraParam[];
  endpoint?: string | null;
}): Promise<Blob[]> {
  const flatten = (arr: IMultiValueInput[]) => {
    const list: { key: string; value: unknown; valueType?: string; title?: string }[] = [];
    arr.forEach(group => {
      group.inputs.forEach((input: IInputField) => {
        list.push({ key: input.key, value: input.value, valueType: input.valueType, title: input.title });
      });
    });
    return list;
  };
  const basic = flatten(args.workflowConfig.viewComfyJSON.inputs);
  const adv = flatten(args.workflowConfig.viewComfyJSON.advancedInputs);
  const all = [...basic, ...adv];
  const mapped = all.map(item => {
    if ((item.valueType === 'long-text' || /prompt|文本|提示/i.test(item.title || '')) && args.prompt) return { key: item.key, value: args.prompt };
    if (/width/i.test(item.title || '')) return { key: item.key, value: args.width };
    if (/height/i.test(item.title || '')) return { key: item.key, value: args.height };
    if (/batch|数量|batch_size/i.test(item.title || '')) return { key: item.key, value: args.batch_size };
    if (args.base_model && /model|模型|path/i.test(item.title || '')) return { key: item.key, value: args.base_model };
    return { key: item.key, value: item.value };
  });

  const viewComfy = { inputs: mapped, textOutputEnabled: false };
  const wf = args.workflowConfig.workflowApiJSON || undefined;

  const formData = new FormData();
  formData.append('workflow', JSON.stringify(wf));
  formData.append('viewComfy', JSON.stringify(viewComfy));
  formData.append('viewcomfyEndpoint', args.endpoint ?? '');

  const url = args.endpoint ? `${getApiBase()}/viewcomfy` : `${getApiBase()}/comfy`;
  const response = await fetch(url, { method: 'POST', body: formData });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData?.error as string) || '工作流执行失败');
  }
  if (!response.body) throw new Error('无响应数据');
  const reader = response.body.getReader();
  let buffer: Uint8Array = new Uint8Array(0);
  const outputs: Blob[] = [];
  const sep = new TextEncoder().encode('--BLOB_SEPARATOR--');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const c = new Uint8Array(buffer.length + value.length);
    c.set(buffer);
    c.set(value, buffer.length);
    buffer = c;
    let idx: number;
    while ((idx = findSub(buffer, sep)) !== -1) {
      const part = buffer.slice(0, idx);
      buffer = buffer.slice(idx + sep.length);
      const mimeEndIndex = findSub(part, new TextEncoder().encode('\r\n\r\n'));
      if (mimeEndIndex !== -1) {
        const mimeType = new TextDecoder().decode(part.slice(0, mimeEndIndex)).split(': ')[1];
        const data = part.slice(mimeEndIndex + 4);
        outputs.push(new Blob([data], { type: mimeType }));
      }
    }
  }
  return outputs;
}

function findSub(arr: Uint8Array, sep: Uint8Array): number {
  outer: for (let i = 0; i <= arr.length - sep.length; i++) {
    for (let j = 0; j < sep.length; j++) {
      if (arr[i + j] !== sep[j]) continue outer;
    }
    return i;
  }
  return -1;
}
