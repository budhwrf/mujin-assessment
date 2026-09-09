import type { AGVNode, Point, Viewport } from './types.js'

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180

export const axisDistance = (a: Point, b: Point) => {
  if (a.x === b.x && a.y === b.y) return 0
  if (a.x === b.x) return Math.abs(a.y - b.y)
  if (a.y === b.y) return Math.abs(a.x - b.x)
  return null
}

export const sharesAxis = (a: Point, b: Point) => a.x === b.x || a.y === b.y

export const worldToLocal = (point: Point): Point => ({
  x: -point.y,
  y: -point.x,
})

export const localToWorld = (point: Point): Point => ({
  x: -point.y,
  y: -point.x,
})

export const rotatePoint = (point: Point, rotation: number): Point => {
  const radians = degreesToRadians(rotation)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

export const worldToScreen = (point: Point, viewport: Viewport): Point => {
  const local = rotatePoint(worldToLocal(point), viewport.rotation)
  return {
    x: local.x * viewport.scale + viewport.x,
    y: local.y * viewport.scale + viewport.y,
  }
}

export const screenToWorld = (point: Point, viewport: Viewport): Point => {
  const local = {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  }
  const unrotated = rotatePoint(local, -viewport.rotation)
  return localToWorld(unrotated)
}

export const snapCoordinate = (value: number, gridSize: number) => {
  if (gridSize <= 0) return Math.round(value)
  return Math.round(value / gridSize) * gridSize
}

export interface AlignmentSnap {
  x: number
  y: number
  guideX: number | null
  guideY: number | null
}

export const snapToAlignment = (
  point: Point,
  others: Point[],
  scale: number,
  gridSize: number,
  snapToGrid: boolean,
): AlignmentSnap => {
  const threshold = Math.max(12 / Math.max(scale, 0.001), 1)
  let nextX = snapToGrid ? snapCoordinate(point.x, gridSize) : Math.round(point.x)
  let nextY = snapToGrid ? snapCoordinate(point.y, gridSize) : Math.round(point.y)
  let guideX: number | null = null
  let guideY: number | null = null
  let bestDx = threshold
  let bestDy = threshold

  for (const other of others) {
    const dx = Math.abs(point.x - other.x)
    if (dx <= bestDx) {
      bestDx = dx
      nextX = other.x
      guideX = other.x
    }
    const dy = Math.abs(point.y - other.y)
    if (dy <= bestDy) {
      bestDy = dy
      nextY = other.y
      guideY = other.y
    }
  }

  return { x: nextX, y: nextY, guideX, guideY }
}

export const boundsOfNodes = (nodes: Array<Pick<AGVNode, 'x' | 'y'>>) => {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
  }

  let minX = nodes[0]?.x ?? 0
  let minY = nodes[0]?.y ?? 0
  let maxX = minX
  let maxY = minY

  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x)
    maxY = Math.max(maxY, node.y)
  }

  return { minX, minY, maxX, maxY }
}

export const fitViewport = (
  nodes: Array<Pick<AGVNode, 'x' | 'y'>>,
  width: number,
  height: number,
  rotation = 0,
  padding = 72,
): Viewport => {
  const points = nodes.length > 0 ? nodes : [{ x: 0, y: 0 }]
  const projected = points.map((node) => rotatePoint(worldToLocal(node), rotation))

  let minX = projected[0]?.x ?? 0
  let minY = projected[0]?.y ?? 0
  let maxX = minX
  let maxY = minY

  for (const point of projected) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const availableWidth = Math.max(width - padding * 2, 1)
  const availableHeight = Math.max(height - padding * 2, 1)
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY, 4)
  const clamped = Math.max(0.02, Math.min(4, scale))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return {
    x: width / 2 - centerX * clamped,
    y: height / 2 - centerY * clamped,
    scale: clamped,
    rotation,
  }
}

export const adaptiveGridStep = (scale: number, preferred = 1500) => {
  const targetPx = 72
  const worldStep = targetPx / Math.max(scale, 0.01)
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(worldStep, 1)))
  const candidates = [1, 2, 5, 10].map((factor) => factor * magnitude)
  const nearest = candidates.find((candidate) => candidate >= worldStep) ?? magnitude * 10
  if (preferred > 0 && preferred * scale >= 28 && preferred * scale <= 180) {
    return preferred
  }
  return nearest
}
