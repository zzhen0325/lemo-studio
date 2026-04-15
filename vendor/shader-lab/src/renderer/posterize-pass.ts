import {
  clamp,
  dot,
  float,
  floor,
  max,
  pow,
  select,
  type TSLNode,
  uniform,
  vec3,
  vec4,
} from "three/tsl"
import { PassNode } from "@shaderlab/renderer/pass-node"
import type { LayerParameterValues } from "@shaderlab/types/editor"

type Node = TSLNode

const POSTERIZE_MODE_RGB = 0
const POSTERIZE_MODE_LUMA = 1

function toPosterizeModeValue(value: unknown): number {
  return value === "luma" ? POSTERIZE_MODE_LUMA : POSTERIZE_MODE_RGB
}

export class PosterizePass extends PassNode {
  private readonly levelsUniform: Node
  private readonly gammaUniform: Node
  private readonly inverseGammaUniform: Node
  private readonly modeUniform: Node

  constructor(layerId: string) {
    super(layerId)
    this.levelsUniform = uniform(5)
    this.gammaUniform = uniform(1)
    this.inverseGammaUniform = uniform(1)
    this.modeUniform = uniform(POSTERIZE_MODE_RGB)
    this.rebuildEffectNode()
  }

  override updateParams(params: LayerParameterValues): void {
    const gamma =
      typeof params.gamma === "number"
        ? Math.max(0.4, Math.min(2.5, params.gamma))
        : 1

    this.levelsUniform.value =
      typeof params.levels === "number"
        ? Math.max(2, Math.min(16, Math.round(params.levels)))
        : 5
    this.gammaUniform.value = gamma
    this.inverseGammaUniform.value = 1 / gamma
    this.modeUniform.value = toPosterizeModeValue(params.mode)
  }

  protected override buildEffectNode(): Node {
    if (!this.levelsUniform) {
      return this.inputNode
    }

    const sourceColor = vec3(
      float(this.inputNode.r),
      float(this.inputNode.g),
      float(this.inputNode.b)
    )
    const quantizationSteps = max(this.levelsUniform.sub(float(1)), float(1))
    const quantizeNode = (value: Node) => {
      const encoded = pow(clamp(value, float(0), float(1)), this.gammaUniform)
      const quantized = floor(encoded.mul(quantizationSteps).add(float(0.5))).div(
        quantizationSteps
      )
      return pow(quantized, this.inverseGammaUniform)
    }

    const rgbPosterized = vec3(
      quantizeNode(sourceColor.x),
      quantizeNode(sourceColor.y),
      quantizeNode(sourceColor.z)
    )
    const luma = dot(sourceColor, vec3(0.2126, 0.7152, 0.0722))
    const quantizedLuma = quantizeNode(luma)
    const lumaScale = quantizedLuma.div(max(luma, float(0.001)))
    const lumaPosterized = clamp(
      vec3(
        sourceColor.x.mul(lumaScale),
        sourceColor.y.mul(lumaScale),
        sourceColor.z.mul(lumaScale)
      ),
      vec3(float(0), float(0), float(0)),
      vec3(float(1), float(1), float(1))
    )
    const isLumaMode = this.modeUniform.greaterThan(float(0.5))

    return vec4(
      vec3(
        select(isLumaMode, lumaPosterized.x, rgbPosterized.x),
        select(isLumaMode, lumaPosterized.y, rgbPosterized.y),
        select(isLumaMode, lumaPosterized.z, rgbPosterized.z)
      ),
      float(1)
    )
  }
}
