import type { CompositionAspect, SceneConfig, Size } from "@shaderlab/types/editor"

function getCompositionAspectRatio(
  aspect: CompositionAspect,
  customWidth: number,
  customHeight: number
): number | null {
  switch (aspect) {
    case "screen":
      return null
    case "16:9":
      return 16 / 9
    case "9:16":
      return 9 / 16
    case "4:3":
      return 4 / 3
    case "3:4":
      return 3 / 4
    case "1:1":
      return 1
    case "custom":
      return customWidth / Math.max(customHeight, 1)
    default:
      return null
  }
}

export function getEffectiveCompositionSize(
  sceneConfig: SceneConfig,
  canvasSize: Size
): Size {
  const ratio = getCompositionAspectRatio(
    sceneConfig.compositionAspect,
    sceneConfig.compositionWidth,
    sceneConfig.compositionHeight
  )

  if (ratio === null) {
    return canvasSize
  }

  const viewportAspect = canvasSize.width / Math.max(canvasSize.height, 1)

  if (ratio > viewportAspect) {
    return {
      width: canvasSize.width,
      height: Math.round(canvasSize.width / ratio),
    }
  }

  return {
    width: Math.round(canvasSize.height * ratio),
    height: canvasSize.height,
  }
}
