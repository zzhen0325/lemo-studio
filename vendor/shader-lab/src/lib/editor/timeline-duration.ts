import type { EditorAsset, EditorLayer } from "@shaderlab/types/editor"

function normalizeVideoDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return duration
}

export function getLongestVideoLayerDuration(
  layers: readonly EditorLayer[],
  assets: readonly EditorAsset[]
): number | null {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  let longestDuration = 0

  for (const layer of layers) {
    if (!(layer.kind === "source" && layer.type === "video" && layer.assetId)) {
      continue
    }

    const duration = assetsById.get(layer.assetId)?.duration

    if (!(typeof duration === "number" && Number.isFinite(duration) && duration > 0)) {
      continue
    }

    longestDuration = Math.max(longestDuration, normalizeVideoDuration(duration))
  }

  return longestDuration > 0 ? longestDuration : null
}

export function getEffectiveTimelineDuration(
  layers: readonly EditorLayer[],
  assets: readonly EditorAsset[],
  manualDuration: number
): number {
  return getLongestVideoLayerDuration(layers, assets) ?? manualDuration
}
