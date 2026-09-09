import { adaptiveGridStep, screenToWorld, worldToScreen, type Viewport } from '@mujin/map-domain'
import { Line } from 'react-konva'
import { mapColors } from './colors'

interface MapGridProps {
  viewport: Viewport
  width: number
  height: number
  enabled: boolean
}

export const MapGrid = ({ viewport, width, height, enabled }: MapGridProps) => {
  if (!enabled || width <= 0 || height <= 0) return null

  const corners = [
    screenToWorld({ x: 0, y: 0 }, viewport),
    screenToWorld({ x: width, y: 0 }, viewport),
    screenToWorld({ x: 0, y: height }, viewport),
    screenToWorld({ x: width, y: height }, viewport),
  ]
  const minX = Math.min(...corners.map((point) => point.x))
  const maxX = Math.max(...corners.map((point) => point.x))
  const minY = Math.min(...corners.map((point) => point.y))
  const maxY = Math.max(...corners.map((point) => point.y))
  const step = adaptiveGridStep(viewport.scale, 1500)
  const pad = step * 2
  const startX = Math.floor((minX - pad) / step) * step
  const endX = Math.ceil((maxX + pad) / step) * step
  const startY = Math.floor((minY - pad) / step) * step
  const endY = Math.ceil((maxY + pad) / step) * step
  const lines: Array<{ points: number[]; major: boolean; key: string }> = []

  for (let x = startX; x <= endX; x += step) {
    const a = worldToScreen({ x, y: minY - pad }, viewport)
    const b = worldToScreen({ x, y: maxY + pad }, viewport)
    lines.push({
      key: `x-${x}`,
      major: x % (step * 5) === 0,
      points: [a.x, a.y, b.x, b.y],
    })
  }

  for (let y = startY; y <= endY; y += step) {
    const a = worldToScreen({ x: minX - pad, y }, viewport)
    const b = worldToScreen({ x: maxX + pad, y }, viewport)
    lines.push({
      key: `y-${y}`,
      major: y % (step * 5) === 0,
      points: [a.x, a.y, b.x, b.y],
    })
  }

  return (
    <>
      {lines.slice(0, 180).map((line) => (
        <Line
          key={line.key}
          points={line.points}
          stroke={line.major ? mapColors.gridMajor : mapColors.gridMinor}
          strokeWidth={line.major ? 1 : 0.6}
          listening={false}
        />
      ))}
    </>
  )
}
