I will fix the Coze file upload issue by switching to `multipart/form-data` as requested and sanitizing error messages to prevent base64 data dumping.

### 1. Refactor `uploadToCoze` in `lib/ai/providers.ts`
- **Use FormData**: Instead of sending the raw `Blob` as the body, I will wrap it in a `FormData` object. This matches the provided `curl` command (`--form 'file=@...'`).
- **Set Filename**: Append the file with a proper filename (e.g., `image.png` or based on extension) which is often required by servers to detect file type correctly.
- **Update Headers**: Remove the explicit `Content-Type` header. The `fetch` API will automatically set the correct `Content-Type: multipart/form-data; boundary=...` when it detects a `FormData` body.

### 2. Sanitize Error Handling in `generateImage`
- **Truncate Error Messages**: In the `catch` block (lines 512-514), I will modify the error message construction to ensure that if `err.message` or `String(err)` is excessively long (likely containing base64 data), it gets truncated before being thrown. This prevents log spamming and UI clutter.

### 3. Verification
- **Review**: Double-check the implementation against the user's `curl` example to ensure parameter parity (`file` field name, headers).
- **Safe Fallback**: Ensure the existing logic for handling Data URLs, local paths, and external URLs remains intact, only changing the final upload step.