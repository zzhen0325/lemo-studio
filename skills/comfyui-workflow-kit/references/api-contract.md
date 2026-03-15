# ComfyUI API Contract (Frontend Use)

- `POST /prompt`
  - Body: `{ "prompt": <Prompt JSON>, "client_id": "..." }`
  - Returns: `{ "prompt_id": "...", "number": ... }`
- `GET /history/{prompt_id}`
  - Returns: `{ "<prompt_id>": { "outputs": { ... } } }`
- `GET /view?filename=...&subfolder=...&type=input|output|temp`
  - Returns image bytes.
- `POST /upload/image`
  - `multipart/form-data` with `image` field
  - Returns `{ "name": "...", "subfolder": "...", "type": "input" }`
- `POST /queue`
  - Body: `{ "delete": ["prompt_id"] }` to cancel
- `POST /interrupt`
  - Interrupt currently running job
