# Z-image Text-Only Workflows (No Img2Img)

These workflows are Prompt JSON examples for Z-image text generation.

## Common Node Chain
- `PrimitiveStringMultiline` (prompt source)
- Optional: `StringConcatenate` to prepend styles
- `CLIPLoader` (type: `lumina2`)
- `CLIPTextEncode` (prompt -> conditioning)
- `ConditioningZeroOut` (negative conditioning)
- `UNETLoader` (Z-image model)
- Optional: `LoraLoaderModelOnly` (model-only LoRA)
- `ModelSamplingAuraFlow` (shift=3)
- `EmptySD3LatentImage` (width/height/batch)
- `KSampler` (steps/cfg/seed/sampler/scheduler/denoise)
- `VAELoader` -> `VAEDecode`
- `SaveImage`

## Non-LoRA Variant (Zimage-text.json)
- UNET: `z_image_turbo_bf16.safetensors`
- Prompt: `PrimitiveStringMultiline` -> `CLIPTextEncode`
- `ModelSamplingAuraFlow.model` points to `UNETLoader`
- `KSampler.positive` -> `CLIPTextEncode`
- `KSampler.negative` -> `ConditioningZeroOut`
- `latent_image` -> `EmptySD3LatentImage`

## LoRA Variant (Zimage-text-lora.json)
- UNET: `z_image_bf16.safetensors`
- LoRA: `LoraLoaderModelOnly` with `lora_name` and `strength_model`
- `ModelSamplingAuraFlow.model` points to `LoraLoaderModelOnly`
- Prompt can be composed with `StringConcatenate` before `CLIPTextEncode`

## Parameters To Update in Builders
- Prompt text:
  - `PrimitiveStringMultiline.value`
  - or `StringConcatenate.string_b` (if using style prefix)
- Size:
  - `EmptySD3LatentImage.width/height`
- Sampling:
  - `KSampler.steps`, `KSampler.cfg`, `KSampler.seed`

## Notes
- No img2img nodes (`LoadImage`, `VAEEncode`, `ReferenceLatent`) are present.
- Keep `denoise=1` for pure text-to-image runs unless the workflow requires partial denoise.
