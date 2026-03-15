# Prompt JSON vs Workflow JSON

- **Prompt JSON** is the API format for `/prompt`.
  - Structure: a map of node IDs to `{ class_type, inputs, ... }`.
  - Export via **Save (API)** or **Copy (API)** in ComfyUI desktop.
- **Workflow JSON** is the UI format with `nodes` and `links`.
  - Used for editing in the UI, not accepted by `/prompt`.

If you only have Workflow JSON:
1. Load it in ComfyUI desktop.
2. Use **Save (API)** / **Copy (API)** to export Prompt JSON.
3. Use the Prompt JSON as the frontend template.
