import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type * as THREE from "three/webgpu"
import {
  ShaderLabTextureSource,
  type ShaderLabTextureSourceOptions,
} from "./shader-lab-texture-source"
import type { ShaderLabConfig } from "./types"

export interface UseShaderLabTextureSourceResult {
  ready: boolean
  resize: (width: number, height: number, pixelRatio?: number) => void
  readonly texture: THREE.Texture | null
  update: (time: number, delta: number) => THREE.Texture | null
}

export type UseShaderLabTextureSourceOptions = ShaderLabTextureSourceOptions

export function useShaderLabTextureSource(
  config: ShaderLabConfig,
  options?: UseShaderLabTextureSourceOptions
): UseShaderLabTextureSourceResult {
  const [ready, setReady] = useState(false)
  const sourceRef = useRef<ShaderLabTextureSource | null>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const width = options?.width
  const height = options?.height
  const pixelRatio = options?.pixelRatio
  const renderer = options?.renderer

  useEffect(() => {
    const sourceOptions: ShaderLabTextureSourceOptions = {}
    if (width !== undefined) sourceOptions.width = width
    if (height !== undefined) sourceOptions.height = height
    if (pixelRatio !== undefined) sourceOptions.pixelRatio = pixelRatio
    if (renderer !== undefined) sourceOptions.renderer = renderer

    const source = new ShaderLabTextureSource(configRef.current, sourceOptions)
    sourceRef.current = source
    textureRef.current = null
    setReady(false)
    let cancelled = false

    void source.initialize().then(() => {
      if (!cancelled) {
        setReady(true)
      }
    })

    return () => {
      cancelled = true
      sourceRef.current = null
      source.dispose()
      textureRef.current = null
      setReady(false)
    }
  }, [height, pixelRatio, renderer, width])

  const resize = useCallback(
    (widthValue: number, heightValue: number, nextPixelRatio?: number) => {
      sourceRef.current?.resize(widthValue, heightValue, nextPixelRatio)
    },
    []
  )

  const update = useCallback((time: number, delta: number) => {
    const source = sourceRef.current
    if (!source) return null
    source.setConfig(configRef.current)
    const nextTexture = source.update(time, delta)
    textureRef.current = nextTexture
    return nextTexture
  }, [])

  return useMemo(
    () => ({
      ready,
      resize,
      get texture() {
        return textureRef.current
      },
      update,
    }),
    [ready, resize, update]
  )
}
