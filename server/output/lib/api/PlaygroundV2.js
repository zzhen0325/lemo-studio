"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchByteArtistImage = fetchByteArtistImage;
exports.exampleUsage = exampleUsage;
exports.runComfyWorkflowWithMapping = runComfyWorkflowWithMapping;
const api_base_1 = require("../api-base");
async function fetchByteArtistImage(params) {
    try {
        const response = await fetch(`${(0, api_base_1.getApiBase)()}/byte-artist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({})));
            const errorMessage = typeof errorData.error === 'string'
                ? errorData.error
                : typeof errorData.message === 'string'
                    ? errorData.message
                    : `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }
        const result = (await response.json());
        return result;
    }
    catch (error) {
        throw new Error(`ByteArtist API 调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}
async function exampleUsage(text, config) {
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
async function runComfyWorkflowWithMapping(args) {
    const flatten = (arr) => {
        const list = [];
        arr.forEach(group => {
            group.inputs.forEach((input) => {
                list.push({ key: input.key, value: input.value, valueType: input.valueType, title: input.title });
            });
        });
        return list;
    };
    const basic = flatten(args.workflowConfig.viewComfyJSON.inputs);
    const adv = flatten(args.workflowConfig.viewComfyJSON.advancedInputs);
    const all = [...basic, ...adv];
    const mapped = all.map(item => {
        if ((item.valueType === 'long-text' || /prompt|文本|提示/i.test(item.title || '')) && args.prompt)
            return { key: item.key, value: args.prompt };
        if (/width/i.test(item.title || ''))
            return { key: item.key, value: args.width };
        if (/height/i.test(item.title || ''))
            return { key: item.key, value: args.height };
        if (/batch|数量|batch_size/i.test(item.title || ''))
            return { key: item.key, value: args.batch_size };
        if (args.base_model && /model|模型|path/i.test(item.title || ''))
            return { key: item.key, value: args.base_model };
        return { key: item.key, value: item.value };
    });
    const viewComfy = { inputs: mapped, textOutputEnabled: false };
    const wf = args.workflowConfig.workflowApiJSON || undefined;
    const formData = new FormData();
    formData.append('workflow', JSON.stringify(wf));
    formData.append('viewComfy', JSON.stringify(viewComfy));
    formData.append('viewcomfyEndpoint', args.endpoint ?? '');
    const url = args.endpoint ? `${(0, api_base_1.getApiBase)()}/viewcomfy` : `${(0, api_base_1.getApiBase)()}/comfy`;
    const response = await fetch(url, { method: 'POST', body: formData });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || '工作流执行失败');
    }
    if (!response.body)
        throw new Error('无响应数据');
    const reader = response.body.getReader();
    let buffer = new Uint8Array(0);
    const outputs = [];
    const sep = new TextEncoder().encode('--BLOB_SEPARATOR--');
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        const c = new Uint8Array(buffer.length + value.length);
        c.set(buffer);
        c.set(value, buffer.length);
        buffer = c;
        let idx;
        while ((idx = findSub(buffer, sep)) !== -1) {
            const part = buffer.slice(0, idx);
            buffer = buffer.slice(idx + sep.length);
            const mimeEndIndex = findSub(part, new TextEncoder().encode('\r\n\r\n'));
            if (mimeEndIndex !== -1) {
                const mimeHeader = new TextDecoder().decode(part.slice(0, mimeEndIndex));
                const mimeType = mimeHeader.split(': ')[1]?.trim() || "application/octet-stream";
                const data = part.slice(mimeEndIndex + 4);
                outputs.push(new Blob([data], { type: mimeType }));
            }
        }
    }
    return outputs;
}
function findSub(arr, sep) {
    outer: for (let i = 0; i <= arr.length - sep.length; i++) {
        for (let j = 0; j < sep.length; j++) {
            if (arr[i + j] !== sep[j])
                continue outer;
        }
        return i;
    }
    return -1;
}
