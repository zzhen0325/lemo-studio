import { useEffect, useRef, useState } from "react"
import type * as THREE from "three/webgpu"
import {
  ShaderLabTextureSource,
  type ShaderLabTextureSourceOptions,
} from "./shader-lab-texture-source"
import type { ShaderLabConfig } from "./types"

export type UseShaderLabTextureOptions = ShaderLabTextureSourceOptions

export function useShaderLabTexture(
  config: ShaderLabConfig,
  options?: UseShaderLabTextureOptions
): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const sourceRef = useRef<ShaderLabTextureSource | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const width = options?.width
  const height = options?.height
  const pixelRatio = options?.pixelRatio
  const renderer = options?.renderer

  useEffect(() => {
    const opts: ShaderLabTextureSourceOptions = {}
    if (width !== undefined) opts.width = width
    if (height !== undefined) opts.height = height
    if (pixelRatio !== undefined) opts.pixelRatio = pixelRatio
    if (renderer !== undefined) opts.renderer = renderer
    const source = new ShaderLabTextureSource(configRef.current, opts)
    sourceRef.current = source
    let frameId: number | null = null
    let lastTime: number | null = null
    let cancelled = false

    const loop = (now: number) => {
      if (cancelled) return

      const prev = lastTime ?? now
      const delta = Math.max(0, (now - prev) / 1000)
      lastTime = now

      source.setConfig(configRef.current)
      const tex = source.update(now / 1000, delta)

      if (tex) {
        setTexture((current) => (current === tex ? current : tex))
      }

      frameId = requestAnimationFrame(loop)
    }

    source.initialize().then(() => {
      if (!cancelled) {
        frameId = requestAnimationFrame(loop)
      }
    })

    return () => {
      cancelled = true
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      sourceRef.current = null
      source.dispose()
      setTexture(null)
    }
  }, [width, height, pixelRatio, renderer])

  return texture
}
