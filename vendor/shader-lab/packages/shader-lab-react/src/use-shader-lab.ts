import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import type * as THREE_WEBGPU from "three/webgpu"
import type { ShaderLabConfig } from "./types"
import { useShaderLabCanvasSource } from "./use-shader-lab-canvas-source"
import { useShaderLabPostProcessingSource } from "./use-shader-lab-postprocessing-source"

export interface UseShaderLabOptions {
  canvas?: HTMLCanvasElement
  height?: number
  pixelRatio?: number
  renderer?: THREE_WEBGPU.WebGPURenderer
  width?: number
}

export interface ShaderLabPostProcessingHandle {
  error: Error | null
  ready: boolean
  resize: (width: number, height: number, pixelRatio?: number) => void
  readonly texture: THREE_WEBGPU.Texture | null
  render: (
    inputTexture: THREE_WEBGPU.Texture,
    time: number,
    delta: number
  ) => THREE_WEBGPU.Texture | null
}

export interface UseShaderLabResult {
  canvas: HTMLCanvasElement | null
  ready: boolean
  texture: THREE.CanvasTexture | null
  postprocessing: ShaderLabPostProcessingHandle
}

export function useShaderLab(
  config: ShaderLabConfig,
  options?: UseShaderLabOptions
): UseShaderLabResult {
  const width = options?.width
  const height = options?.height
  const pixelRatio = options?.pixelRatio
  const renderer = options?.renderer

  const canvasSource = useShaderLabCanvasSource(config, {
    ...(options?.canvas ? { canvas: options.canvas } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(pixelRatio !== undefined ? { pixelRatio } : {}),
  })

  const postprocessingSource = useShaderLabPostProcessingSource(config, {
    enabled: renderer !== undefined,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(pixelRatio !== undefined ? { pixelRatio } : {}),
    ...(renderer !== undefined ? { renderer } : {}),
  })

  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    const sourceCanvas = canvasSource.canvas
    if (!sourceCanvas) {
      textureRef.current?.dispose()
      textureRef.current = null
      setTexture(null)
      return
    }

    const texture = new THREE.CanvasTexture(sourceCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    textureRef.current = texture
    setTexture(texture)

    return () => {
      if (textureRef.current === texture) {
        textureRef.current = null
      }
      setTexture((current) => (current === texture ? null : current))
      texture.dispose()
    }
  }, [canvasSource.canvas])

  useEffect(() => {
    const texture = textureRef.current
    if (!(canvasSource.ready && canvasSource.canvas && texture)) {
      return
    }

    let cancelled = false
    let frameId: number | null = null
    let lastTime: number | null = null

    const renderFrame = (now: number) => {
      if (cancelled) return

      const previousTime = lastTime ?? now
      const delta = Math.max(0, (now - previousTime) / 1000)
      lastTime = now

      canvasSource.update(now / 1000, delta)
      texture.needsUpdate = true
      frameId = window.requestAnimationFrame(renderFrame)
    }

    frameId = window.requestAnimationFrame(renderFrame)

    return () => {
      cancelled = true
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [canvasSource.canvas, canvasSource.ready, canvasSource.update])

  const postprocessing = useMemo<ShaderLabPostProcessingHandle>(
    () => ({
      error: postprocessingSource.error,
      ready: postprocessingSource.ready,
      resize: postprocessingSource.resize,
      get texture() {
        return postprocessingSource.texture
      },
      render: postprocessingSource.update,
    }),
    [postprocessingSource]
  )

  return useMemo(
    () => ({
      canvas: canvasSource.canvas,
      ready: canvasSource.ready && texture !== null,
      texture,
      postprocessing,
    }),
    [canvasSource.canvas, canvasSource.ready, postprocessing, texture]
  )
}
