import type { Direction, Point } from './types.js'

export const directionVectors: Record<Direction, { dx: number; dy: number }> = {
  North: { dx: 1, dy: 0 },
  South: { dx: -1, dy: 0 },
  West: { dx: 0, dy: 1 },
  East: { dx: 0, dy: -1 },
}

export const oppositeDirection: Record<Direction, Direction> = {
  North: 'South',
  South: 'North',
  East: 'West',
  West: 'East',
}

export const directionOrder: Direction[] = ['North', 'South', 'East', 'West']

export const isDirection = (value: string): value is Direction =>
  value === 'North' || value === 'South' || value === 'East' || value === 'West'

export const directionBetween = (from: Point, to: Point): Direction | null => {
  if (from.x === to.x && from.y === to.y) return null
  if (from.x !== to.x && from.y !== to.y) return null

  if (from.x === to.x) {
    return to.y > from.y ? 'West' : 'East'
  }

  return to.x > from.x ? 'North' : 'South'
}

export const travelMatchesDirection = (from: Point, to: Point, direction: Direction) => {
  const actual = directionBetween(from, to)
  return actual === direction
}

export const uniqueDirections = (values: Direction[] | undefined) => {
  if (!values) return []
  const seen = new Set<Direction>()
  const result: Direction[] = []
  for (const direction of values) {
    if (!isDirection(direction) || seen.has(direction)) continue
    seen.add(direction)
    result.push(direction)
  }
  return result
}
