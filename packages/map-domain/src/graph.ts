import { directionBetween, oppositeDirection, uniqueDirections } from './directions.js'
import { axisDistance } from './geometry.js'
import type {
  AGVMap,
  AGVNode,
  ConnectionCheck,
  Direction,
  EditorMap,
  EditorNode,
  MapDocument,
  MapEdge,
} from './types.js'

const formatMillimeters = (value: number) =>
  new Intl.NumberFormat('en-US').format(value)

const editorId = (node: AGVNode | EditorNode, index: number) =>
  typeof (node as EditorNode).id === 'string' ? (node as EditorNode).id : `node-${index}`

export const canConnect = (
  nodeA: Pick<AGVNode, 'x' | 'y'>,
  nodeB: Pick<AGVNode, 'x' | 'y'>,
  maxNeighborDistance: number,
): ConnectionCheck => {
  if (nodeA.x === nodeB.x && nodeA.y === nodeB.y) {
    return {
      ok: false,
      message: 'Cannot connect a node to itself.',
    }
  }

  if (nodeA.x !== nodeB.x && nodeA.y !== nodeB.y) {
    return {
      ok: false,
      message:
        'Cannot connect nodes diagonally. Nodes must share the same X or Y coordinate.',
    }
  }

  const distance = axisDistance(nodeA, nodeB)
  if (distance === null) {
    return {
      ok: false,
      message:
        'Cannot connect nodes diagonally. Nodes must share the same X or Y coordinate.',
    }
  }

  if (distance > maxNeighborDistance) {
    return {
      ok: false,
      distance,
      message: `Nodes are ${formatMillimeters(distance)} mm apart. Maximum neighbor distance is ${formatMillimeters(maxNeighborDistance)} mm.`,
    }
  }

  const direction = directionBetween(nodeA, nodeB)
  if (!direction) {
    return {
      ok: false,
      message: 'Connection direction is not valid.',
    }
  }

  return {
    ok: true,
    direction,
    reverse: oppositeDirection[direction],
    distance,
  }
}

const isBetween = (value: number, start: number, end: number) => {
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  return value > min && value < max
}

const blocksSegment = (
  origin: Pick<AGVNode, 'x' | 'y'>,
  candidate: Pick<AGVNode, 'x' | 'y'>,
  other: Pick<AGVNode, 'x' | 'y'>,
) => {
  if (origin.x === candidate.x && origin.x === other.x) {
    return isBetween(other.y, origin.y, candidate.y)
  }

  if (origin.y === candidate.y && origin.y === other.y) {
    return isBetween(other.x, origin.x, candidate.x)
  }

  return false
}

export const deriveEdges = (map: EditorMap | AGVMap): MapEdge[] => {
  const nodes = map.nodes
  const edges: MapEdge[] = []

  nodes.forEach((node, fromIndex) => {
    const directions = uniqueDirections(node.directions)
    for (const direction of directions) {
      let nearestIndex = -1
      let nearestDistance = Number.POSITIVE_INFINITY

      nodes.forEach((candidate, toIndex) => {
        if (fromIndex === toIndex) return
        const check = canConnect(node, candidate, map.maxNeighborDistance)
        if (!check.ok || check.direction !== direction || check.distance === undefined) return

        const blocked = nodes.some(
          (other, otherIndex) =>
            otherIndex !== fromIndex &&
            otherIndex !== toIndex &&
            blocksSegment(node, candidate, other),
        )
        if (blocked) return

        if (check.distance < nearestDistance) {
          nearestDistance = check.distance
          nearestIndex = toIndex
        }
      })

      if (nearestIndex < 0) continue
      const target = nodes[nearestIndex]
      if (!target) continue
      const fromId = editorId(node, fromIndex)
      const toId = editorId(target, nearestIndex)

      edges.push({
        id: `${fromId}:${toId}:${direction}`,
        fromId,
        toId,
        fromIndex,
        toIndex: nearestIndex,
        direction,
        distance: nearestDistance,
      })
    }
  })

  return edges
}

export const countUniquePaths = (edges: MapEdge[]) => {
  const seen = new Set<string>()
  for (const edge of edges) {
    const key = [edge.fromId, edge.toId].sort().join('|')
    seen.add(key)
  }
  return seen.size
}

export const nodeKind = (node: Pick<AGVNode, 'charger' | 'chute'>) => {
  if (node.charger) return 'charger' as const
  if (node.chute) return 'chute' as const
  return 'node' as const
}

export const toAssignmentNode = (node: AGVNode): AGVNode => {
  const directions = uniqueDirections(node.directions)
  const next: AGVNode = {
    x: node.x,
    y: node.y,
    code: node.code,
  }
  if (directions.length > 0) next.directions = directions
  if (node.name) next.name = node.name
  if (node.charger) next.charger = { direction: node.charger.direction }
  if (node.chute) next.chute = { direction: node.chute.direction }
  return next
}

export const toAssignmentDocument = (document: MapDocument): MapDocument => ({
  map: {
    maxNeighborDistance: document.map.maxNeighborDistance,
    nodes: document.map.nodes.map(toAssignmentNode),
  },
})

export const stripEditorIds = (map: EditorMap): AGVMap =>
  toAssignmentDocument({ map }).map

export const toDocument = (map: EditorMap) => toAssignmentDocument({ map })

let nodeSequence = 0

export const createNodeId = () => {
  nodeSequence += 1
  return `node-${nodeSequence}-${Math.random().toString(36).slice(2, 8)}`
}

export const withEditorIds = (nodes: AGVNode[]): EditorNode[] =>
  nodes.map((node) => ({
    ...node,
    directions: uniqueDirections(node.directions),
    id: createNodeId(),
  }))

export const addDirection = (node: EditorNode, direction: Direction): EditorNode => ({
  ...node,
  directions: uniqueDirections([...(node.directions ?? []), direction]),
})

export const removeDirection = (node: EditorNode, direction: Direction): EditorNode => ({
  ...node,
  directions: uniqueDirections((node.directions ?? []).filter((item) => item !== direction)),
})
