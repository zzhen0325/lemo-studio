---
name: comfyui-workflow-kit
description: Build, modify, and migrate ComfyUI workflow Prompt JSON pipelines (e.g., FLUX/FLUX.2 Klein, Z-image text-only, reference-image chains) and the frontend/backend logic that submits /prompt. Use when adding new workflow types, extending reference-image logic, or porting workflows between projects.
---

# ComfyUI Workflow Kit

## Overview
Use this skill to create or update ComfyUI Prompt JSON workflows and the code that builds and submits them.

## Workflow Decision Tree
1. If the task is about running `/prompt` or frontend integration, use Prompt JSON (API format). See `references/prompt-vs-workflow-json.md`.
2. If the task is about adding or changing reference images:
- FLUX.2 Klein ReferenceLatent chain: `references/flux2-klein-reference-latent.md`
- CLIPVision + ConditioningCombine chain: `references/conditioning-combine.md`
3. If the task is about a text-only workflow:
- Z-image text-only (no img2img): `references/zimage-text.md`
4. If the task is about migrating to another project, see `references/current-project-map.md` for what to copy and adjust.

## Standard Workflow
1. Get a working base template.
- Export Prompt JSON using Save (API) or Copy (API).
- Keep `class_type` and existing `inputs` keys. Only adjust values and links.
2. Implement builder changes.
- Update text prompt nodes.
- Update model files (UNET/CLIP/VAE) for the selected model type. See `references/model-files.md`.
- Update steps/guidance/seed/size nodes.
- If there are N reference images, rebuild the reference chain. See the relevant reference file.
3. Update UI + API glue.
- Upload images via `/upload/image` when needed.
- Submit Prompt JSON via `/prompt`, poll `/history`, and fetch images via `/view`.
4. Validate.
- Load the Prompt JSON in ComfyUI desktop if errors appear.
- Confirm node IDs and links are valid and no red nodes remain.

## Adding a New Workflow Type
1. Define the base template in ComfyUI and export Prompt JSON.
2. Decide the reference-image strategy (ReferenceLatent vs ConditioningCombine) or text-only.
3. Implement builder logic for parameters and chain wiring.
4. Update UI controls for the new workflow type.
5. Validate by submitting `/prompt` and by loading the Prompt JSON in ComfyUI desktop.

## Resources
- `references/api-contract.md`
- `references/prompt-vs-workflow-json.md`
- `references/flux2-klein-reference-latent.md`
- `references/conditioning-combine.md`
- `references/zimage-text.md`
- `references/model-files.md`
- `references/current-project-map.md`
- `references/frontend-params.md`
