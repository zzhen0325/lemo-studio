# Bug 修复计划 (plan.md)

本文档基于 `proj_analysis.md` 的分析，针对“Coze API 返回 URL 后未成功上传到 CDN”的问题，提出具体的失败点分析、修复建议和验证方案。

## 1. 根本原因 (Root Cause) 分析

通过对调用链和相关代码的深入分析，定位到问题的主要根源在于 `server/utils/cdn.ts` 的 `uploadBufferToCdn` 方法中，为上传文件创建 `File` 对象时，**未指定 `type` (MIME 类型)**。

**证据与分析**:

1.  **CDN 工具函数**: 在 `server/utils/cdn.ts` 的第 74 行：
    ```typescript
    // server/utils/cdn.ts:74
    form.set('file', new File([buffer], fileName)); 
    ```
    这里使用了 `new File([buffer], fileName)` 来构造文件对象。根据 `File` 构造函数的[规范](https://developer.mozilla.org/en-US/docs/Web/API/File/File)，第三个参数 `options` (包含 `type` 属性) 是可选的。如果省略，`type` 属性默认为一个空字符串 `""`。

2.  **CDN 后端行为推测**: `ife-cdn.byteintl.net` 这类内部 CDN 服务通常会进行严格的校验。当接收到 `multipart/form-data` 中的文件部分时，如果其 `Content-Type` 缺失或为空，可能会出于安全或规范性原因直接拒绝该文件上传，导致请求失败（例如返回 4xx 或 5xx 错误，或返回成功但 `cdnUrl` 为空）。

3.  **日志佐证**:
    - `server/log/app/i18n_fe.opera.node.access.log.*` 文件中存在大量针对 `/api/save-image` 的 `statusCode=500` 的 `ERROR` 日志。
    - `app/api/save-image/route.ts` 中第 118 行的 `console.error` 打印的错误信息为 `[cdn 500] [object Object]` 或类似错误，这与 `server/utils/cdn.ts` 中第 52 行抛出的错误格式 `[cdn ${res.status}] ${msg}${detail}` 一致，表明错误发生在 `postForm` 函数中，即 CDN 上传请求失败。

4.  **其他潜在问题**:
    - **Coze URL 解析失败**: `app/api/save-image/route.ts` 中的 `tryExtractImageUrlFromHtml` 逻辑虽然存在，但可能不够健壮，无法覆盖所有 Coze 返回的 HTML 结构，导致图片下载环节就已失败。
    - **Content-Type 推断不准**: `app/api/save-image/route.ts` 在 `fetchImageBuffer` 后，通过 `getExtFromMime` 推断文件扩展名，这个逻辑本身是合理的。但如果 CDN 上传时没有传递 MIME 类型，即便文件名后缀正确，也可能被拒绝。

**结论**: **核心问题是上传 CDN 时构造的 `File` 对象缺少 MIME 类型。** 其他环节虽然存在优化空间，但不是导致当前大规模失败的直接原因。

## 2. 修复建议与改动点

为确保问题得到稳健修复并提升代码质量，建议采取以下分层修复策略：

**优先级 P0：核心问题修复**

- **目标**: 为上传到 CDN 的文件显式提供 MIME 类型。

- **需修改文件**:
    1.  **`server/utils/cdn.ts`**:
        -   修改 `uploadBufferToCdn` 函数签名，增加 `mimeType` 参数: `export async function uploadBufferToCdn(buffer: Buffer, opts: UploadOptions & { mimeType?: string }): Promise<UploadResult>`。
        -   在创建 `File` 对象时传入 `type`:
            ```typescript
            // server/utils/cdn.ts
            const mimeType = opts.mimeType || 'image/png'; // 默认 image/png
            form.set('file', new File([buffer], fileName, { type: mimeType }));
            ```
    2.  **`app/api/save-image/route.ts`**:
        -   在 `POST` 处理函数中，将下载或解析得到的 `mime` 类型传递给 `uploadBufferToCdn`。
            ```typescript
            // app/api/save-image/route.ts (处理 URL 下载后)
            const downloaded = await fetchImageBuffer(imageBase64);
            const inferredMime = downloaded.mime || 'image/png';
            // ...
            const cdnRes = await uploadBufferToCdn(imageBuffer, { ..., mimeType: inferredMime });

            // app/api/save-image/route.ts (处理 base64 后)
            const { mime } = extractBase64(imageBase64);
            const inferredMime = getExtFromMime(mime) ? mime : 'image/png';
            // ...
            const cdnRes = await uploadBufferToCdn(imageBuffer, { ..., mimeType: inferredMime });
            ```
    3.  **`server/service/save-image.service.ts` (可选但建议)**:
        -   同样为 `uploadBufferToCdn` 的调用添加 `mimeType`，保持一致性。

**优先级 P1：增强健壮性与日志**

- **目标**: 优化 URL 解析、错误处理和日志记录，便于未来问题排查。

- **需修改文件**:
    1.  **`app/api/save-image/route.ts`**:
        -   **增强 HTML 解析**: 在 `tryExtractImageUrlFromHtml` 中增加更多匹配规则，例如匹配 `<img>` 标签的 `src` 属性。
        -   **明确错误日志**: 在 `fetchImageBuffer` 的 `catch` 块中，如果下载内容非图片，将响应文本的前 500 字符记录到日志中，便于分析 Coze 返回的内容结构。
            ```typescript
            // app/api/save-image/route.ts
            // 在 fetchImageBuffer 的 Error 中
            const text = await resp.text().catch(() => '');
            throw new Error(`Downloaded content is not an image... snippet: ${text.slice(0, 500)}`);
            ```
    2.  **`server/utils/cdn.ts`**:
        -   **校验 CDN 响应**: 在 `postForm` 中，严格校验 CDN 返回的 `cdnUrl` 是否存在且为有效 URL，如果缺失则抛出错误，而不是依赖后续的 `||` 运算符。
        -   **丰富错误日志**: 在 CDN 请求失败的 `console.error` 中，额外记录请求的 `dir`, `fileName`, `region` 等参数。

## 3. 验证方案

### 本地验证 (无需真实联网)

1.  **输入样例**:
    -   在 `hooks/features/PlaygroundV2/useGenerationService.ts` 的 `saveImageToOutputs` 方法中，暂时将 `fetch` 请求的 `body` 硬编码为一个包含 Coze 短链的 JSON 字符串。
        ```typescript
        // 临时修改用于测试
        const testBody = JSON.stringify({ 
            imageBase64: 'https://s.coze.cn/t/QXpP5td5xt0/', // 一个已知的 Coze 短链
            ext: 'png', 
            subdir: 'outputs' 
        });
        const resp = await fetch(`${getApiBase()}/save-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: testBody // 使用测试 body
        });
        ```
2.  **设置断点与日志**:
    -   在 `app/api/save-image/route.ts` 的 `POST` 函数开头设置断点或添加日志，确认接收到请求。
    -   在 `server/utils/cdn.ts` 的 `uploadBufferToCdn` 中添加日志，检查 `new File(...)` 时 `type` 属性是否正确设置。
3.  **Mock CDN 请求**:
    -   在 `server/utils/cdn.ts` 的 `postForm` 方法中，拦截 `fetch` 请求，使其直接返回一个模拟的成功 CDN 响应。
        ```typescript
        // 临时 mock
        if (pathName === '/cdn/upload') {
            console.log('[Mock CDN] FormData file type:', form.get('file').type);
            if (form.get('file').type.startsWith('image/')) {
                return Promise.resolve({ code: 0, cdnUrl: 'https://mock-cdn.com/test-image.png' });
            } else {
                throw new Error('[Mock CDN] File type is missing or invalid!');
            }
        }
        ```
4.  **期望结果**:
    -   控制台应打印 `[Mock CDN] FormData file type: image/png` (或其他正确的 MIME 类型)。
    -   整个流程无错误抛出。
    -   前端最终能收到并打印出模拟的 CDN URL `https://mock-cdn.com/test-image.png`。

## 4. 风险与回滚策略

-   **影响面**:
    -   本次修改核心影响的是所有通过 `uploadBufferToCdn` 上传文件的功能。除了 Coze 图片保存，还可能包括用户手动上传图片等流程（如 `server/service/upload.service.ts`）。
    -   由于改动集中在底层工具函数和后端 API，对前端组件无直接影响。
-   **风险评估**:
    -   风险较低。为 `File` 对象添加 `type` 属性是补全缺失信息，符合接口规范，不太可能对现有正常工作的流程造成负面影响。
-   **回滚策略**:
    -   如果上线后出现意外，可通过 Git revert 快速回滚相关提交。由于改动点清晰，可以快速定位并恢复 `cdn.ts` 和 `save-image/route.ts` 到修改前版本。
