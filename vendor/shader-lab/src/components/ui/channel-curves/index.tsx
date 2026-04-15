"use client"

import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react"
import { cn } from "@shaderlab/lib/cn"

type ChannelPoint = { x: number; y: number }

type ChannelCurve = {
  color: string
  id: string
  label: string
  points: [ChannelPoint, ChannelPoint]
}

type ChannelCurvesProps = {
  className?: string
  curves: ChannelCurve[]
  label?: ReactNode
  onCurveChange: (curveId: string, points: [ChannelPoint, ChannelPoint]) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const PADDING = 16
const HANDLE_RADIUS = 6

function buildLinePath(
  points: [ChannelPoint, ChannelPoint],
  width: number,
  height: number
): string {
  const x0 = PADDING + points[0].x * (width - PADDING * 2)
  const y0 = height - PADDING - points[0].y * (height - PADDING * 2)
  const x1 = PADDING + points[1].x * (width - PADDING * 2)
  const y1 = height - PADDING - points[1].y * (height - PADDING * 2)
  return `M ${x0} ${y0} L ${x1} ${y1}`
}

export function ChannelCurves({
  className,
  curves,
  label,
  onCurveChange,
}: ChannelCurvesProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [activeDrag, setActiveDrag] = useState<{
    curveId: string
    pointIndex: number
  } | null>(null)
  const [hoveredCurve, setHoveredCurve] = useState<string | null>(null)

  const width = 268
  const height = 268

  const toNormalized = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      const scaleX = width / rect.width
      const scaleY = height / rect.height
      const svgX = (clientX - rect.left) * scaleX
      const svgY = (clientY - rect.top) * scaleY
      return {
        x: clamp((svgX - PADDING) / (width - PADDING * 2), 0, 1),
        y: clamp(1 - (svgY - PADDING) / (height - PADDING * 2), 0, 1),
      }
    },
    []
  )

  const handlePointerDown = useCallback(
    (
      curveId: string,
      pointIndex: number,
      e: PointerEvent<SVGCircleElement>
    ) => {
      e.stopPropagation()
      ;(e.target as SVGCircleElement).setPointerCapture(e.pointerId)
      setActiveDrag({ curveId, pointIndex })
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (!activeDrag) return
      const pos = toNormalized(e.clientX, e.clientY)
      const curve = curves.find((c) => c.id === activeDrag.curveId)
      if (!curve) return
      const newPoints: [ChannelPoint, ChannelPoint] = [
        { ...curve.points[0] },
        { ...curve.points[1] },
      ]
      // Lock x for start/end points (0 and 1), only allow y to change
      const sourcePoint = curve.points[activeDrag.pointIndex]
      if (!sourcePoint) return
      newPoints[activeDrag.pointIndex] = {
        x: sourcePoint.x,
        y: clamp(pos.y, 0, 1),
      }
      onCurveChange(activeDrag.curveId, newPoints)
    },
    [activeDrag, curves, onCurveChange, toNormalized]
  )

  const handlePointerUp = useCallback(() => {
    setActiveDrag(null)
  }, [])

  return (
    <div
      className={cn("flex w-full flex-col gap-[var(--ds-space-2)]", className)}
    >
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] leading-[14px] font-normal text-white/45">
            {label}
          </span>
          <div className="inline-flex gap-1.5">
            {curves.map((curve) => (
              <span
                className="inline-block h-2 w-2 rounded-full"
                key={curve.id}
                style={{ backgroundColor: curve.color, opacity: 0.7 }}
              />
            ))}
          </div>
        </div>
      )}
      <div className="relative w-full overflow-hidden rounded-[calc(var(--ds-radius-control)+2px)] border border-white/8 bg-[linear-gradient(180deg,rgb(255_255_255_/_0.04),rgb(255_255_255_/_0.01))] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]">
        <svg
          aria-label="channel curves configuration"
          className="block w-full touch-none select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={svgRef}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Grid */}
          <line
            stroke="rgb(255 255 255 / 0.06)"
            strokeWidth="1"
            x1={PADDING}
            x2={width - PADDING}
            y1={height / 2}
            y2={height / 2}
          />
          <line
            stroke="rgb(255 255 255 / 0.06)"
            strokeWidth="1"
            x1={width / 2}
            x2={width / 2}
            y1={PADDING}
            y2={height - PADDING}
          />
          {/* Identity line (diagonal) */}
          <line
            stroke="rgb(255 255 255 / 0.08)"
            strokeDasharray="3 3"
            strokeWidth="1"
            x1={PADDING}
            x2={width - PADDING}
            y1={height - PADDING}
            y2={PADDING}
          />
          {/* Axis labels */}
          <text
            fill="rgb(255 255 255 / 0.25)"
            fontSize="9"
            textAnchor="start"
            x={PADDING + 2}
            y={height - 3}
          >
            Shadows
          </text>
          <text
            fill="rgb(255 255 255 / 0.25)"
            fontSize="9"
            textAnchor="end"
            x={width - PADDING - 2}
            y={height - 3}
          >
            Highlights
          </text>
          <text
            dominantBaseline="central"
            fill="rgb(255 255 255 / 0.25)"
            fontSize="9"
            textAnchor="middle"
            transform={`rotate(-90, 6, ${height / 2})`}
            x={6}
            y={height / 2}
          >
            Output
          </text>
          {/* Curves */}
          {curves.map((curve) => {
            const isActive =
              activeDrag?.curveId === curve.id || hoveredCurve === curve.id
            return (
              <g key={curve.id}>
                <path
                  d={buildLinePath(curve.points, width, height)}
                  fill="none"
                  opacity={isActive ? 1 : 0.55}
                  stroke={curve.color}
                  strokeLinecap="round"
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{
                    transition: "opacity 160ms, stroke-width 160ms",
                  }}
                />
                {curve.points.map((point, pi) => {
                  const cx = PADDING + point.x * (width - PADDING * 2)
                  const cy = height - PADDING - point.y * (height - PADDING * 2)
                  const isHandleActive =
                    activeDrag?.curveId === curve.id &&
                    activeDrag.pointIndex === pi
                  return (
                    <circle
                      className="cursor-grab active:cursor-grabbing"
                      cx={cx}
                      cy={cy}
                      fill={isHandleActive ? curve.color : "rgb(18 18 18)"}
                      key={`${pi}+${curve.id}`}
                      onPointerDown={(e) => handlePointerDown(curve.id, pi, e)}
                      onPointerEnter={() => setHoveredCurve(curve.id)}
                      onPointerLeave={() => setHoveredCurve(null)}
                      r={isHandleActive ? HANDLE_RADIUS + 1 : HANDLE_RADIUS}
                      stroke={curve.color}
                      strokeWidth={2}
                      style={{
                        transition: "r 120ms ease-out, fill 120ms ease-out",
                      }}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
