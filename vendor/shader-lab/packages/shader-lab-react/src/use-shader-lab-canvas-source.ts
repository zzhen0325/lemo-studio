import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ShaderLabCanvasSource,
  type ShaderLabCanvasSourceOptions,
} from "./shader-lab-canvas-source"
import type { ShaderLabConfig } from "./types"

export interface UseShaderLabCanvasSourceResult {
  canvas: HTMLCanvasElement | null
  ready: boolean
  resize: (width: number, height: number, pixelRatio?: number) => void
  update: (time: number, delta: number) => HTMLCanvasElement | null
}

export type UseShaderLabCanvasSourceOptions = ShaderLabCanvasSourceOptions

export function useShaderLabCanvasSource(
  config: ShaderLabConfig,
  options?: UseShaderLabCanvasSourceOptions
): UseShaderLabCanvasSourceResult {
  const [ready, setReady] = useState(false)
  const sourceRef = useRef<ShaderLabCanvasSource | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const canvas = options?.canvas
  const width = options?.width
  const height = options?.height
  const pixelRatio = options?.pixelRatio

  useEffect(() => {
    const sourceOptions: ShaderLabCanvasSourceOptions = {}
    if (canvas !== undefined) sourceOptions.canvas = canvas
    if (width !== undefined) sourceOptions.width = width
    if (height !== undefined) sourceOptions.height = height
    if (pixelRatio !== undefined) sourceOptions.pixelRatio = pixelRatio

    const source = new ShaderLabCanvasSource(configRef.current, sourceOptions)
    sourceRef.current = source
    canvasRef.current = source.element
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
      canvasRef.current = null
      setReady(false)
    }
  }, [canvas, height, pixelRatio, width])

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
    return source.update(time, delta)
  }, [])

  return useMemo(
    () => ({
      canvas: canvasRef.current,
      ready,
      resize,
      update,
    }),
    [ready, resize, update]
  )
}
