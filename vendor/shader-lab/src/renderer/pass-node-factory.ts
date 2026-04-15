import { AsciiPass } from "@shaderlab/renderer/ascii-pass"
import { CircuitBentPass } from "@shaderlab/renderer/circuit-bent-pass"
import { ChromaticAberrationPass } from "@shaderlab/renderer/chromatic-aberration-pass"
import { CrtPass } from "@shaderlab/renderer/crt-pass"
import { DirectionalBlurPass } from "@shaderlab/renderer/directional-blur-pass"
import { DisplacementMapPass } from "@shaderlab/renderer/displacement-map-pass"
import { DitheringPass } from "@shaderlab/renderer/dithering-pass"
import { EdgeDetectPass } from "@shaderlab/renderer/edge-detect-pass"
import { FlutedGlassPass } from "@shaderlab/renderer/fluted-glass-pass"
import { HalftonePass } from "@shaderlab/renderer/halftone-pass"
import { InkPass } from "@shaderlab/renderer/ink-pass"
import { ParticleGridPass } from "@shaderlab/renderer/particle-grid-pass"
import { PassNode } from "@shaderlab/renderer/pass-node"
import { PatternPass } from "@shaderlab/renderer/pattern-pass"
import { PixelSortingPass } from "@shaderlab/renderer/pixel-sorting-pass"
import { PixelationPass } from "@shaderlab/renderer/pixelation-pass"
import { PlotterPass } from "@shaderlab/renderer/plotter-pass"
import { PosterizePass } from "@shaderlab/renderer/posterize-pass"
import { SlicePass } from "@shaderlab/renderer/slice-pass"
import { SmearPass } from "@shaderlab/renderer/smear-pass"
import { ThresholdPass } from "@shaderlab/renderer/threshold-pass"
import type { EffectLayerType } from "@shaderlab/types/editor"

export function createPassNode(
  layerId: string,
  type: EffectLayerType
): PassNode {
  switch (type) {
    case "ascii":
      return new AsciiPass(layerId)
    case "circuit-bent":
      return new CircuitBentPass(layerId)
    case "directional-blur":
      return new DirectionalBlurPass(layerId)
    case "crt":
      return new CrtPass(layerId)
    case "chromatic-aberration":
      return new ChromaticAberrationPass(layerId)
    case "displacement-map":
      return new DisplacementMapPass(layerId)
    case "dithering":
      return new DitheringPass(layerId)
    case "edge-detect":
      return new EdgeDetectPass(layerId)
    case "fluted-glass":
      return new FlutedGlassPass(layerId)
    case "halftone":
      return new HalftonePass(layerId)
    case "ink":
      return new InkPass(layerId)
    case "pattern":
      return new PatternPass(layerId)
    case "particle-grid":
      return new ParticleGridPass(layerId)
    case "pixelation":
      return new PixelationPass(layerId)
    case "plotter":
      return new PlotterPass(layerId)
    case "posterize":
      return new PosterizePass(layerId)
    case "threshold":
      return new ThresholdPass(layerId)
    case "pixel-sorting":
      return new PixelSortingPass(layerId)
    case "slice":
      return new SlicePass(layerId)
    case "smear":
      return new SmearPass(layerId)
    default:
      return new PassNode(layerId)
  }
}
