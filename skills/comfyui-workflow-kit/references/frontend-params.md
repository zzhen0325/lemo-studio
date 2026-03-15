# Frontend Parameter Mapping

This describes how UI parameters map to workflow builder inputs in the current frontend.

## UI State -> Builder Inputs

- `prompt` (Textarea)
  - FLUX.2: `ttN text.text` or `CLIPTextEncode.text`
  - Z-image: `PrimitiveStringMultiline.value`

- `modelType` (Select)
  - FLUX.2: `FLUX2Klein4BBase` / `FLUX2Klein4BDistilled` / `FLUX2Klein9BBase` / `FLUX2Klein9BDistilled`
  - Z-image: `ZIMAGE_TEXT` / `ZIMAGE_TEXT_LORA`
  - Determines which template file is loaded.

- `steps` (Slider)
  - FLUX.2: `Flux2Scheduler.steps`
  - Z-image: `KSampler.steps`

- `guidance` (Slider)
  - FLUX.2: `CFGGuider.cfg`
  - Z-image: `KSampler.cfg`

- `width` / `height` (Sliders)
  - FLUX.2: `Flux2Scheduler.width/height` and `EmptyFlux2LatentImage.width/height` if numeric.
  - Z-image: `EmptySD3LatentImage.width/height`.

- `seed` (optional)
  - If not provided, the builder generates a random seed on each run.
  - FLUX.2: `RandomNoise.noise_seed`
  - Z-image: `KSampler.seed`

- `refImages` (file input)
  - FLUX.2 only.
  - When present, builder uploads files via `/upload/image` and rebuilds the `ReferenceLatent` chain.
  - When `modelType` is Z-image, the UI disables this input and clears the list.

## Template Selection

- FLUX.2 text-only: `/comfyui-official-flux/official-flux-txt2img.json`
- FLUX.2 img2img base: `/comfyui-official-flux/official-flux-img2img-base.json`
- Z-image text-only: `/comfyui-official-flux/zimage-text.json`
- Z-image text-only (LoRA): `/comfyui-official-flux/zimage-text-lora.json`

## Source Files (Current Project)

- UI page: `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/src/pages/FluxGeneratePage.tsx`
- Builder: `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/src/utils/fluxOfficialWorkflowBuilder.ts`
