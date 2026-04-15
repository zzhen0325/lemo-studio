import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type * as THREE from "three/webgpu"
import {
  ShaderLabPostProcessingSource,
  type ShaderLabPostProcessingSourceOptions,
} from "./shader-lab-postprocessing-source"
import type { ShaderLabConfig } from "./types"

export interface UseShaderLabPostProcessingSourceResult {
  error: Error | null
  ready: boolean
  resize: (width: number, height: number, pixelRatio?: number) => void
  readonly texture: THREE.Texture | null
  update: (
    inputTexture: THREE.Texture,
    time: number,
    delta: number
  ) => THREE.Texture | null
}

export type UseShaderLabPostProcessingSourceOptions =
  ShaderLabPostProcessingSourceOptions & {
    enabled?: boolean
  }

export function useShaderLabPostProcessingSource(
  config: ShaderLabConfig,
  options?: UseShaderLabPostProcessingSourceOptions
): UseShaderLabPostProcessingSourceResult {
  const [error, setError] = useState<Error | null>(null)
  const [ready, setReady] = useState(false)
  const sourceRef = useRef<ShaderLabPostProcessingSource | null>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const width = options?.width
  const height = options?.height
  const pixelRatio = options?.pixelRatio
  const renderer = options?.renderer
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) {
      sourceRef.current = null
      textureRef.current = null
      setError(null)
      setReady(false)
      return
    }

    const sourceOptions: ShaderLabPostProcessingSourceOptions = {}
    if (width !== undefined) sourceOptions.width = width
    if (height !== undefined) sourceOptions.height = height
    if (pixelRatio !== undefined) sourceOptions.pixelRatio = pixelRatio
    if (renderer !== undefined) sourceOptions.renderer = renderer

    let source: ShaderLabPostProcessingSource

    try {
      source = new ShaderLabPostProcessingSource(configRef.current, sourceOptions)
    } catch (nextError) {
      sourceRef.current = null
      textureRef.current = null
      setReady(false)
      setError(
        nextError instanceof Error
          ? nextError
          : new Error("Failed to create Shader Lab postprocessing source.")
      )
      return
    }

    sourceRef.current = source
    textureRef.current = null
    setError(null)
    setReady(false)
    let cancelled = false

    void source
      .initialize()
      .then(() => {
        if (!cancelled) {
          setReady(true)
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setReady(false)
          setError(
            nextError instanceof Error
              ? nextError
              : new Error("Failed to initialize Shader Lab postprocessing source.")
          )
        }
      })

    return () => {
      cancelled = true
      sourceRef.current = null
      source.dispose()
      textureRef.current = null
      setError(null)
      setReady(false)
    }
  }, [enabled, height, pixelRatio, renderer, width])

  const resize = useCallback(
    (widthValue: number, heightValue: number, nextPixelRatio?: number) => {
      sourceRef.current?.resize(widthValue, heightValue, nextPixelRatio)
    },
    []
  )

  const update = useCallback(
    (inputTexture: THREE.Texture, time: number, delta: number) => {
      const source = sourceRef.current
      if (!source) return null
      source.setConfig(configRef.current)
      const nextTexture = source.update(inputTexture, time, delta)
      textureRef.current = nextTexture
      return nextTexture
    },
    []
  )

  return useMemo(
    () => ({
      ready,
      error,
      resize,
      get texture() {
        return textureRef.current
      },
      update,
    }),
    [error, ready, resize, update]
  )
}
