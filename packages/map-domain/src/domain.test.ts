import { describe, expect, it } from 'vitest'
import { directionBetween, directionVectors, oppositeDirection } from './directions.js'
import { sampleMapDocument } from './fixtures.js'
import { fitViewport, screenToWorld, worldToScreen } from './geometry.js'
import { canConnect, countUniquePaths, deriveEdges, withEditorIds } from './graph.js'
import { validateDocument, validateMap } from './validation.js'

describe('directions', () => {
  it('uses the assignment vectors', () => {
    expect(directionVectors.North).toEqual({ dx: 1, dy: 0 })
    expect(directionVectors.South).toEqual({ dx: -1, dy: 0 })
    expect(directionVectors.West).toEqual({ dx: 0, dy: 1 })
    expect(directionVectors.East).toEqual({ dx: 0, dy: -1 })
  })

  it('resolves axis travel and rejects diagonals', () => {
    expect(directionBetween({ x: 1000, y: 1000 }, { x: 1800, y: 1000 })).toBe('North')
    expect(directionBetween({ x: 1800, y: 1000 }, { x: 1000, y: 1000 })).toBe('South')
    expect(directionBetween({ x: 1000, y: 1000 }, { x: 1000, y: 1900 })).toBe('West')
    expect(directionBetween({ x: 1000, y: 1900 }, { x: 1000, y: 1000 })).toBe('East')
    expect(directionBetween({ x: 1000, y: 1000 }, { x: 1800, y: 1900 })).toBeNull()
  })

  it('pairs opposite directions', () => {
    expect(oppositeDirection.North).toBe('South')
    expect(oppositeDirection.West).toBe('East')
  })
})

describe('canConnect', () => {
  const limit = 1500

  it('allows the same X or the same Y within range', () => {
    expect(canConnect({ x: 1000, y: 1000 }, { x: 1000, y: 1900 }, limit).ok).toBe(true)
    expect(canConnect({ x: 1000, y: 1000 }, { x: 1800, y: 1000 }, limit).ok).toBe(true)
  })

  it('rejects diagonals and excess distance', () => {
    const diagonal = canConnect({ x: 1000, y: 1000 }, { x: 1800, y: 1900 }, limit)
    expect(diagonal.ok).toBe(false)
    expect(diagonal.message).toContain('diagonally')

    const far = canConnect({ x: 1000, y: 1000 }, { x: 1000, y: 4000 }, limit)
    expect(far.ok).toBe(false)
    expect(far.message).toContain('3,000 mm')
    expect(far.message).toContain('1,500 mm')
  })

  it('rejects a node connecting to itself', () => {
    expect(canConnect({ x: 10, y: 10 }, { x: 10, y: 10 }, limit).ok).toBe(false)
  })
})

describe('viewport', () => {
  it('round-trips world and screen coordinates', () => {
    const viewport = { x: 200, y: 160, scale: 0.5, rotation: 0 }
    const screen = worldToScreen({ x: 1000, y: 2000 }, viewport)
    const world = screenToWorld(screen, viewport)
    expect(world.x).toBeCloseTo(1000)
    expect(world.y).toBeCloseTo(2000)
  })

  it('does not change world coordinates when the viewport rotates', () => {
    const viewport = { x: 400, y: 300, scale: 0.2, rotation: 90 }
    const world = { x: 2600, y: 6510 }
    const restored = screenToWorld(worldToScreen(world, viewport), viewport)
    expect(restored.x).toBeCloseTo(world.x)
    expect(restored.y).toBeCloseTo(world.y)
  })

  it('fits the sample map inside the canvas', () => {
    const viewport = fitViewport(sampleMapDocument.map.nodes, 900, 600, 0)
    expect(viewport.scale).toBeGreaterThan(0.02)
    expect(viewport.scale).toBeLessThan(0.25)
    const screens = sampleMapDocument.map.nodes.map((node) => worldToScreen(node, viewport))
    expect(Math.min(...screens.map((point) => point.x))).toBeGreaterThan(40)
    expect(Math.max(...screens.map((point) => point.x))).toBeLessThan(860)
    expect(viewport.rotation).toBe(0)
  })
})

describe('sample map', () => {
  it('preserves the assignment fixture', () => {
    expect(sampleMapDocument.map.maxNeighborDistance).toBe(1500)
    expect(sampleMapDocument.map.nodes).toHaveLength(58)
    expect(sampleMapDocument.map.nodes.find((node) => node.name === 'CHUTE')?.chute).toEqual({
      direction: 'North',
    })
    expect(sampleMapDocument.map.nodes.find((node) => node.name === 'CHRG1')?.charger).toEqual({
      direction: 'West',
    })
    expect(sampleMapDocument.map.nodes.find((node) => node.name === 'CHRG2')?.charger).toEqual({
      direction: 'South',
    })
  })

  it('validates and derives paths from directions', () => {
    const result = validateDocument(sampleMapDocument)
    expect(result.valid).toBe(true)
    const editor = {
      maxNeighborDistance: sampleMapDocument.map.maxNeighborDistance,
      nodes: withEditorIds(sampleMapDocument.map.nodes),
    }
    const edges = deriveEdges(editor)
    expect(edges.length).toBeGreaterThan(0)
    expect(countUniquePaths(edges)).toBeGreaterThan(0)
    expect(edges.every((edge) => edge.distance <= 1500)).toBe(true)
  })

  it('rejects a malformed map', () => {
    const result = validateMap({ maxNeighborDistance: -1, nodes: [] })
    expect(result.valid).toBe(false)
  })
})
