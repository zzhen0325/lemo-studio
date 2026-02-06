# ConditioningCombine Reference Chain

Use when the workflow expects `CLIPVisionEncodeFlux` (or similar) and `ConditioningCombine`.

## Wiring (N references)
- Text:
  - `CLIPTextEncodeFlux` output must go to `ConditioningCombine.conditioning_1` (index 0).
- Image i:
  - `LoadImage_i` -> `CLIPVisionEncodeFlux_i`.
  - `CLIPVisionEncodeFlux_i.image` = `[LoadImage_i, 0]`.
  - `CLIPVisionEncodeFlux_i.clip` = shared CLIP model output.
  - `ConditioningCombine.conditioning_{i+1}` (index i) = `[CLIPVisionEncodeFlux_i, 0]`.

Notes:
- For negative prompt, use a separate `CLIPTextEncode` or a model-specific negative node and wire it into the sampler's `negative` input.
