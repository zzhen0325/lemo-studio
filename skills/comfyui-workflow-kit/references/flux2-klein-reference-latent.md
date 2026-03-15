# FLUX.2 Klein ReferenceLatent Chain

## Nodes
- `LoadImage` -> `ImageScaleToTotalPixels` -> `VAEEncode`
- `CLIPTextEncode` for the positive prompt
- `ConditioningZeroOut` for the negative chain
- `ReferenceLatent` to attach each reference image to both chains
- `CFGGuider` consumes the last positive and negative nodes
- Optional: `GetImageSize` to bind width/height to the first reference image

## Wiring (N references)
For each reference image i:
1. Create `LoadImage_i`, `ImageScaleToTotalPixels_i`, `VAEEncode_i`.
2. Positive chain:
   - Start from `CLIPTextEncode`.
   - For each image, add `ReferenceLatent_pos_i` with:
     - `conditioning`: previous positive node
     - `latent`: `VAEEncode_i`
3. Negative chain:
   - Start from `ConditioningZeroOut`.
   - For each image, add `ReferenceLatent_neg_i` with:
     - `conditioning`: previous negative node
     - `latent`: `VAEEncode_i`
4. Set `CFGGuider.positive` to the last positive ref node, and `CFGGuider.negative` to the last negative ref node.
5. If `GetImageSize` exists, set its `image` to the first `ImageScaleToTotalPixels` output.

Notes:
- This chain does not accept a separate negative prompt text.
- Keep `VAEEncode.vae` linked to the shared `VAELoader`.
