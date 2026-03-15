# Current Project Map (This Repo)

Paths below refer to the current workspace:

- Templates (Prompt JSON)
  - `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/public/comfyui-official-flux/official-flux-txt2img.json`
  - `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/public/comfyui-official-flux/official-flux-img2img-base.json`
- Z-image templates (Prompt JSON)
  - `/Users/bytedance/Downloads/Zimage-text.json`
  - `/Users/bytedance/Downloads/Zimage-text-lora.json`
- Builder logic
  - `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/src/utils/fluxOfficialWorkflowBuilder.ts`
- API wrapper
  - `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/src/utils/comfyuiOfficialApi.ts`
- UI page
  - `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/src/pages/FluxGeneratePage.tsx`
- Env config
  - `/Users/bytedance/Downloads/ComfyUI官方FLUX模型0~N参考图动态工作流实现方案，含前置准备、项目结构、工具函数、生图页面实现、跨域配置、调试方法、避坑点及扩展说明/comfyui-flux-official-react/.env.development`

Notes:
- Templates are also copied into `dist/comfyui-official-flux/` for the built bundle.
- When migrating, copy the templates and the builder, then rewire model files and chain logic as needed.
