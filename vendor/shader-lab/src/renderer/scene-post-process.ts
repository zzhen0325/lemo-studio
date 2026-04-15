import {
  clamp,
  float,
  floor,
  max,
  mix,
  type TSLNode,
  texture as tslTexture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl"
import * as THREE from "three/webgpu"
import type { SceneConfig } from "@shaderlab/types/editor"

type Node = TSLNode

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function buildColorMapTexture(
  stops: { position: number; color: string }[]
): Uint8Array {
  const size = 256
  const data = new Uint8Array(size * 4)
  const sorted = [...stops].sort((a, b) => a.position - b.position)

  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (!(first && last)) {
    for (let i = 0; i < size; i++) {
      data[i * 4] = i
      data[i * 4 + 1] = i
      data[i * 4 + 2] = i
      data[i * 4 + 3] = 255
    }
    return data
  }

  for (let i = 0; i < size; i++) {
    const t = i / (size - 1)
    let r = 0
    let g = 0
    let b = 0

    if (t <= first.position) {
      ;[r, g, b] = hexToRgb(first.color)
    } else if (t >= last.position) {
      ;[r, g, b] = hexToRgb(last.color)
    } else {
      for (let s = 0; s < sorted.length - 1; s++) {
        const stopA = sorted[s]!
        const stopB = sorted[s + 1]!
        if (t >= stopA.position && t <= stopB.position) {
          const range = stopB.position - stopA.position
          const localT = range > 0 ? (t - stopA.position) / range : 0
          const [r0, g0, b0] = hexToRgb(stopA.color)
          const [r1, g1, b1] = hexToRgb(stopB.color)
          r = r0 + (r1 - r0) * localT
          g = g0 + (g1 - g0) * localT
          b = b0 + (b1 - b0) * localT
          break
        }
      }
    }

    data[i * 4] = Math.round(r * 255)
    data[i * 4 + 1] = Math.round(g * 255)
    data[i * 4 + 2] = Math.round(b * 255)
    data[i * 4 + 3] = 255
  }

  return data
}

function isDefaultConfig(config: SceneConfig): boolean {
  return (
    config.brightness === 0 &&
    config.contrast === 0 &&
    !config.invert &&
    config.channelMixer.rr === 1 &&
    config.channelMixer.rg === 0 &&
    config.channelMixer.rb === 0 &&
    config.channelMixer.gr === 0 &&
    config.channelMixer.gg === 1 &&
    config.channelMixer.gb === 0 &&
    config.channelMixer.br === 0 &&
    config.channelMixer.bg === 0 &&
    config.channelMixer.bb === 1 &&
    config.clampMin === 0 &&
    config.clampMax === 1 &&
    config.quantizeLevels === 256 &&
    config.colorMap === null
  )
}

export class ScenePostProcess {
  private readonly scene: THREE.Scene
  private readonly camera: THREE.OrthographicCamera
  private readonly material: THREE.MeshBasicNodeMaterial
  private readonly inputNode: Node

  private readonly brightnessUniform: Node
  private readonly contrastUniform: Node
  private readonly invertUniform: Node
  private readonly mixerRowR: Node
  private readonly mixerRowG: Node
  private readonly mixerRowB: Node
  private readonly clampMinUniform: Node
  private readonly clampMaxUniform: Node
  private readonly quantizeLevelsUniform: Node
  private readonly colorMapEnabledUniform: Node
  private readonly colorMapTexture: THREE.DataTexture

  active = false

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.material = new THREE.MeshBasicNodeMaterial()

    const renderTargetUv = vec2(uv().x, float(1).sub(uv().y))
    this.inputNode = tslTexture(new THREE.Texture(), renderTargetUv)

    this.brightnessUniform = uniform(0)
    this.contrastUniform = uniform(0)
    this.invertUniform = uniform(0)
    this.mixerRowR = uniform(new THREE.Vector3(1, 0, 0))
    this.mixerRowG = uniform(new THREE.Vector3(0, 1, 0))
    this.mixerRowB = uniform(new THREE.Vector3(0, 0, 1))
    this.clampMinUniform = uniform(0)
    this.clampMaxUniform = uniform(1)
    this.quantizeLevelsUniform = uniform(256)
    this.colorMapEnabledUniform = uniform(0)

    const lutData = buildColorMapTexture([])
    this.colorMapTexture = new THREE.DataTexture(
      lutData,
      256,
      1,
      THREE.RGBAFormat
    )
    this.colorMapTexture.magFilter = THREE.LinearFilter
    this.colorMapTexture.minFilter = THREE.LinearFilter
    this.colorMapTexture.needsUpdate = true

    this.material.colorNode = this.buildColorNode()

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }

  update(config: SceneConfig): boolean {
    const shouldBeActive = !isDefaultConfig(config)

    if (!shouldBeActive) {
      this.active = false
      return false
    }

    this.active = true
    this.brightnessUniform.value = config.brightness
    this.contrastUniform.value = config.contrast
    this.invertUniform.value = config.invert ? 1 : 0

    ;(this.mixerRowR.value as THREE.Vector3).set(
      config.channelMixer.rr,
      config.channelMixer.rg,
      config.channelMixer.rb
    )
    ;(this.mixerRowG.value as THREE.Vector3).set(
      config.channelMixer.gr,
      config.channelMixer.gg,
      config.channelMixer.gb
    )
    ;(this.mixerRowB.value as THREE.Vector3).set(
      config.channelMixer.br,
      config.channelMixer.bg,
      config.channelMixer.bb
    )

    this.clampMinUniform.value = config.clampMin
    this.clampMaxUniform.value = config.clampMax
    this.quantizeLevelsUniform.value = config.quantizeLevels

    if (config.colorMap) {
      this.colorMapEnabledUniform.value = 1
      const lutData = buildColorMapTexture(config.colorMap.stops)
      ;(this.colorMapTexture.image.data as Uint8Array).set(lutData)
      this.colorMapTexture.needsUpdate = true
    } else {
      this.colorMapEnabledUniform.value = 0
    }

    return true
  }

  render(
    renderer: THREE.WebGPURenderer,
    inputTexture: THREE.Texture,
    outputTarget: THREE.WebGLRenderTarget
  ): void {
    this.inputNode.value = inputTexture
    renderer.setRenderTarget(outputTarget)
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.scene.clear()
    this.material.dispose()
    this.colorMapTexture.dispose()
  }

  private buildColorNode(): Node {
    const input = this.inputNode
    let color: Node = vec3(input.r, input.g, input.b)

    // Brightness
    color = color.add(
      vec3(
        this.brightnessUniform,
        this.brightnessUniform,
        this.brightnessUniform
      )
    )

    // Contrast: (color - 0.5) * (1 + contrast) + 0.5
    const contrastScale = float(1).add(this.contrastUniform)
    color = color
      .sub(vec3(float(0.5), float(0.5), float(0.5)))
      .mul(vec3(contrastScale, contrastScale, contrastScale))
      .add(vec3(float(0.5), float(0.5), float(0.5)))

    // Channel mixer (3x3 matrix via dot products per row)
    const r = float(color.x)
      .mul(this.mixerRowR.x)
      .add(float(color.y).mul(this.mixerRowR.y))
      .add(float(color.z).mul(this.mixerRowR.z))
    const g = float(color.x)
      .mul(this.mixerRowG.x)
      .add(float(color.y).mul(this.mixerRowG.y))
      .add(float(color.z).mul(this.mixerRowG.z))
    const b = float(color.x)
      .mul(this.mixerRowB.x)
      .add(float(color.y).mul(this.mixerRowB.y))
      .add(float(color.z).mul(this.mixerRowB.z))
    color = vec3(r, g, b)

    // Invert
    color = mix(
      color,
      vec3(float(1), float(1), float(1)).sub(color),
      this.invertUniform
    )

    // Clamp / remap: (color - min) / (max - min)
    const range = max(
      float(this.clampMaxUniform).sub(this.clampMinUniform),
      float(0.001)
    )
    color = color
      .sub(
        vec3(this.clampMinUniform, this.clampMinUniform, this.clampMinUniform)
      )
      .div(vec3(range, range, range))

    // Quantize
    const levels = this.quantizeLevelsUniform
    const levelsMinusOne = max(float(levels).sub(float(1)), float(1))
    color = floor(
      clamp(color, 0, 1)
        .mul(vec3(levelsMinusOne, levelsMinusOne, levelsMinusOne))
        .add(vec3(float(0.5), float(0.5), float(0.5)))
    ).div(vec3(levelsMinusOne, levelsMinusOne, levelsMinusOne))

    // Color map LUT
    const luma = float(color.x)
      .mul(float(0.2126))
      .add(float(color.y).mul(float(0.7152)))
      .add(float(color.z).mul(float(0.0722)))
    const lutSample = tslTexture(
      this.colorMapTexture,
      vec2(clamp(luma, 0, 1), float(0.5))
    )
    color = mix(
      color,
      vec3(lutSample.r, lutSample.g, lutSample.b),
      this.colorMapEnabledUniform
    )

    // Final clamp
    color = clamp(color, 0, 1)

    return vec4(color, float(1))
  }
}
