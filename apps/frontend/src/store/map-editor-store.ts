import {
  addDirection,
  canConnect,
  countUniquePaths,
  createNodeId,
  deriveEdges,
  fitViewport,
  worldToScreen,
  nodeKind,
  snapToAlignment,
  removeDirection,
  sampleMapDocument,
  stripEditorIds,
  toDocument,
  withEditorIds,
  type Direction,
  type EditorMap,
  type EditorNode,
  type MapDocument,
  type Viewport,
} from '@mujin/map-domain'
import { useMemo } from 'react'
import { create } from 'zustand'

export type EditorTool = 'select' | 'add-node' | 'add-path' | 'edit' | 'delete'

export interface HistoryEntry {
  map: EditorMap
  mapName: string
}

interface EditorState {
  mapId: string
  mapName: string
  map: EditorMap
  selectedNodeId: string | null
  selectedPathId: string | null
  hoveredNodeId: string | null
  hoveredEdgeId: string | null
  tool: EditorTool
  pathStartId: string | null
  viewport: Viewport
  canvasSize: { width: number; height: number }
  gridEnabled: boolean
  snapEnabled: boolean
  gridSize: number
  alignmentGuides: { x: number | null; y: number | null } | null
  showNames: boolean
  legendOpen: boolean
  history: HistoryEntry[]
  future: HistoryEntry[]
  dirty: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: string | null
  statusMessage: string | null
  commandOpen: boolean
  nodeListOpen: boolean
  renameOpen: boolean
  deleteConfirmOpen: boolean
  helpOpen: boolean
  movingSnapshot: HistoryEntry | null
  beginNodeMove: (nodeId: string) => void
  setTool: (tool: EditorTool) => void
  setCanvasSize: (width: number, height: number) => void
  selectNode: (nodeId: string | null) => void
  selectPath: (pathId: string | null) => void
  setHoveredNode: (nodeId: string | null) => void
  setHoveredEdge: (edgeId: string | null) => void
  setViewport: (viewport: Viewport) => void
  zoomAt: (factor: number, screen?: { x: number; y: number }) => void
  rotateMap: () => void
  fitToScreen: () => void
  resetView: () => void
  toggleGrid: () => void
  toggleSnap: () => void
  setGridSize: (size: number) => void
  toggleNames: () => void
  setLegendOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setNodeListOpen: (open: boolean) => void
  setRenameOpen: (open: boolean) => void
  setDeleteConfirmOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setMapName: (name: string) => void
  addNodeAt: (x: number, y: number) => string | null
  updateNode: (nodeId: string, patch: Partial<Omit<EditorNode, 'id'>>) => void
  toggleDirection: (nodeId: string, direction: Direction) => void
  moveNode: (nodeId: string, x: number, y: number, commit?: boolean) => void
  deleteSelected: () => void
  startOrCompletePath: (nodeId: string) => string | null
  cancelOperation: () => void
  undo: () => void
  redo: () => void
  loadSavedMap: (input: { id: string; name: string; document: MapDocument; updatedAt?: string }) => void
  importDocument: (
    document: MapDocument,
    name?: string,
    options?: { silent?: boolean; history?: boolean },
  ) => void
  markSaving: () => void
  markSaved: (savedAt: string) => void
  markSaveError: () => void
  focusNode: (nodeId: string) => void
}

const initialMap = (): EditorMap => ({
  maxNeighborDistance: sampleMapDocument.map.maxNeighborDistance,
  nodes: withEditorIds(sampleMapDocument.map.nodes),
})

const cloneMap = (map: EditorMap): EditorMap => ({
  maxNeighborDistance: map.maxNeighborDistance,
  nodes: map.nodes.map((node) => ({
    ...node,
    directions: node.directions ? [...node.directions] : undefined,
    charger: node.charger ? { ...node.charger } : undefined,
    chute: node.chute ? { ...node.chute } : undefined,
  })),
})

const withStableEditorIds = (document: MapDocument, previous: EditorMap): EditorMap => {
  const previousByKey = new Map<string, string>(
    previous.nodes.map((node) => [`${node.x}:${node.y}:${node.code}`, node.id]),
  )
  const used = new Set<string>()

  return {
    maxNeighborDistance: document.map.maxNeighborDistance,
    nodes: document.map.nodes.map((node, index) => {
      const key = `${node.x}:${node.y}:${node.code}`
      const reused = previousByKey.get(key)
      const fallback = previous.nodes[index]?.id
      const id =
        (reused && !used.has(reused) && reused) ||
        (fallback && !used.has(fallback) && fallback) ||
        createNodeId()
      used.add(id)
      return { ...node, id }
    }),
  }
}

const clampScale = (scale: number) => Math.min(4, Math.max(0.02, scale))

export const pathIdFor = (leftId: string, rightId: string) =>
  [leftId, rightId].sort().join('|')

export const useMapEditorStore = create<EditorState>((set, get) => {
  const commit = (map: EditorMap, extra?: Partial<EditorState>) => {
    const current = get()
    set({
      history: [...current.history, { map: cloneMap(current.map), mapName: current.mapName }].slice(-80),
      future: [],
      map,
      dirty: true,
      saveStatus: current.saveStatus === 'saving' ? 'saving' : 'idle',
      statusMessage: null,
      ...extra,
    })
  }

  return {
    mapId: 'warehouse-map-01',
    mapName: 'Warehouse-Map-01',
    map: initialMap(),
    selectedNodeId: null,
    selectedPathId: null,
    hoveredNodeId: null,
    hoveredEdgeId: null,
    tool: 'select',
    pathStartId: null,
    viewport: { x: 80, y: 80, scale: 0.12, rotation: 0 },
    canvasSize: { width: 900, height: 560 },
    gridEnabled: true,
    snapEnabled: true,
    gridSize: 100,
    alignmentGuides: null,
    showNames: true,
    legendOpen: true,
    history: [],
    future: [],
    dirty: false,
    saveStatus: 'idle',
    lastSavedAt: null,
    statusMessage: null,
    commandOpen: false,
    nodeListOpen: false,
    renameOpen: false,
    deleteConfirmOpen: false,
    helpOpen: false,
    movingSnapshot: null as HistoryEntry | null,
    beginNodeMove: (nodeId) => {
      const current = get()
      if (current.movingSnapshot) return
      const node = current.map.nodes.find((item) => item.id === nodeId)
      if (!node) return
      set({
        movingSnapshot: { map: cloneMap(current.map), mapName: current.mapName },
        selectedNodeId: nodeId,
        selectedPathId: null,
      })
    },
    setTool: (tool) =>
      set({
        tool,
        pathStartId: null,
        statusMessage: tool === 'add-path' ? 'Select the first node.' : null,
      }),
    setCanvasSize: (width, height) => set({ canvasSize: { width, height } }),
    selectNode: (nodeId) =>
      set({
        selectedNodeId: nodeId,
        selectedPathId: null,
        tool: get().tool === 'delete' ? 'select' : get().tool,
      }),
    selectPath: (pathId) => set({ selectedPathId: pathId, selectedNodeId: null }),
    setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
    setHoveredEdge: (edgeId) => set({ hoveredEdgeId: edgeId }),
    setViewport: (viewport) => set({ viewport }),
    zoomAt: (factor, screen) => {
      const { viewport, canvasSize } = get()
      const origin = screen ?? { x: canvasSize.width / 2, y: canvasSize.height / 2 }
      const nextScale = clampScale(viewport.scale * factor)
      const ratio = nextScale / viewport.scale
      set({
        viewport: {
          ...viewport,
          scale: nextScale,
          x: origin.x - (origin.x - viewport.x) * ratio,
          y: origin.y - (origin.y - viewport.y) * ratio,
        },
      })
    },
    rotateMap: () =>
      set((state) => ({
        viewport: {
          ...state.viewport,
          rotation: (state.viewport.rotation + 90) % 360,
        },
      })),
    fitToScreen: () => {
      const { map, canvasSize, viewport } = get()
      set({
        viewport: fitViewport(map.nodes, canvasSize.width, canvasSize.height, viewport.rotation),
      })
    },
    resetView: () => {
      const { map, canvasSize } = get()
      set({ viewport: fitViewport(map.nodes, canvasSize.width, canvasSize.height, 0) })
    },
    toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
    toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
    setGridSize: (size) => set({ gridSize: Math.max(1, Math.round(size)) }),
    toggleNames: () => set((state) => ({ showNames: !state.showNames })),
    setLegendOpen: (open) => set({ legendOpen: open }),
    setCommandOpen: (open) => set({ commandOpen: open }),
    setNodeListOpen: (open) => set({ nodeListOpen: open }),
    setRenameOpen: (open) => set({ renameOpen: open }),
    setDeleteConfirmOpen: (open) => set({ deleteConfirmOpen: open }),
    setHelpOpen: (open) => set({ helpOpen: open }),
    setMapName: (name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const current = get()
      set({
        history: [...current.history, { map: cloneMap(current.map), mapName: current.mapName }].slice(-80),
        future: [],
        mapName: trimmed,
        dirty: true,
      })
    },
    addNodeAt: (x, y) => {
      const { snapEnabled, gridSize, map, viewport } = get()
      const aligned = snapToAlignment(
        { x, y },
        map.nodes,
        viewport.scale,
        gridSize,
        snapEnabled,
      )
      const nextX = aligned.x
      const nextY = aligned.y
      if (map.nodes.some((node) => node.x === nextX && node.y === nextY)) {
        set({ statusMessage: 'A node already exists at that coordinate.' })
        return null
      }
      const node: EditorNode = {
        id: createNodeId(),
        x: nextX,
        y: nextY,
        code: 0,
        directions: [],
      }
      commit(
        { ...map, nodes: [...map.nodes, node] },
        { selectedNodeId: node.id, selectedPathId: null, tool: 'select', statusMessage: 'Node added' },
      )
      return node.id
    },
    updateNode: (nodeId, patch) => {
      const { map } = get()
      commit({
        ...map,
        nodes: map.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch, id: node.id } : node)),
      })
    },
    toggleDirection: (nodeId, direction) => {
      const { map } = get()
      commit({
        ...map,
        nodes: map.nodes.map((node) => {
          if (node.id !== nodeId) return node
          const enabled = node.directions?.includes(direction)
          return enabled ? removeDirection(node, direction) : addDirection(node, direction)
        }),
      })
    },
    moveNode: (nodeId, x, y, commitMove = false) => {
      const { map, snapEnabled, gridSize, movingSnapshot, history, viewport } = get()
      const aligned = snapToAlignment(
        { x, y },
        map.nodes.filter((node) => node.id !== nodeId),
        viewport.scale,
        gridSize,
        snapEnabled,
      )
      const nextX = aligned.x
      const nextY = aligned.y
      const nextMap = {
        ...map,
        nodes: map.nodes.map((node) =>
          node.id === nodeId ? { ...node, x: nextX, y: nextY } : node,
        ),
      }
      if (!commitMove) {
        set({
          map: nextMap,
          alignmentGuides: { x: aligned.guideX, y: aligned.guideY },
        })
        return
      }
      const node = nextMap.nodes.find((item) => item.id === nodeId)
      const blocked = nextMap.nodes.some(
        (other) => other.id !== nodeId && other.x === node?.x && other.y === node?.y,
      )
      if (blocked && movingSnapshot) {
        set({
          map: movingSnapshot.map,
          movingSnapshot: null,
          alignmentGuides: null,
          statusMessage: 'Cannot place two nodes on the same coordinate.',
        })
        return
      }
      const snapshot = movingSnapshot ?? { map: cloneMap(map), mapName: get().mapName }
      const unchanged = node?.x === snapshot.map.nodes.find((item) => item.id === nodeId)?.x
        && node?.y === snapshot.map.nodes.find((item) => item.id === nodeId)?.y
      set({
        map: nextMap,
        movingSnapshot: null,
        alignmentGuides: null,
        history: unchanged ? history : [...history, snapshot].slice(-80),
        future: unchanged ? get().future : [],
        dirty: unchanged ? get().dirty : true,
      })
    },
    deleteSelected: () => {
      const { map, selectedNodeId, selectedPathId } = get()
      if (selectedPathId) {
        const [leftId, rightId] = selectedPathId.split('|')
        const left = map.nodes.find((node) => node.id === leftId)
        const right = map.nodes.find((node) => node.id === rightId)
        if (!left || !right) return
        const check = canConnect(left, right, map.maxNeighborDistance)
        commit(
          {
            ...map,
            nodes: map.nodes.map((node) => {
              if (node.id === left.id && check.direction) return removeDirection(node, check.direction)
              if (node.id === right.id && check.reverse) return removeDirection(node, check.reverse)
              return node
            }),
          },
          { selectedPathId: null, statusMessage: 'Path deleted' },
        )
        return
      }

      if (!selectedNodeId) return
      commit(
        {
          ...map,
          nodes: map.nodes.filter((node) => node.id !== selectedNodeId),
        },
        { selectedNodeId: null, deleteConfirmOpen: false, statusMessage: 'Node deleted' },
      )
    },
    startOrCompletePath: (nodeId) => {
      const { pathStartId, map } = get()
      if (!pathStartId) {
        set({ pathStartId: nodeId, statusMessage: 'Select the second node.' })
        return null
      }
      if (pathStartId === nodeId) {
        set({ pathStartId: null, statusMessage: 'Select two different nodes.' })
        return 'Select two different nodes.'
      }
      const from = map.nodes.find((node) => node.id === pathStartId)
      const to = map.nodes.find((node) => node.id === nodeId)
      if (!from || !to) return null
      const check = canConnect(from, to, map.maxNeighborDistance)
      if (!check.ok || !check.direction || !check.reverse) {
        set({ pathStartId: null, statusMessage: check.message ?? 'Invalid connection' })
        return check.message ?? 'Invalid connection'
      }
      commit(
        {
          ...map,
          nodes: map.nodes.map((node) => {
            if (node.id === from.id) return addDirection(node, check.direction!)
            if (node.id === to.id) return addDirection(node, check.reverse!)
            return node
          }),
        },
        {
          pathStartId: null,
          selectedPathId: pathIdFor(from.id, to.id),
          tool: 'select',
          statusMessage: 'Path created',
        },
      )
      return null
    },
    cancelOperation: () => set({ pathStartId: null, tool: 'select', statusMessage: null }),
    undo: () => {
      const { history, future, map, mapName } = get()
      const previous = history.at(-1)
      if (!previous) return
      set({
        history: history.slice(0, -1),
        future: [{ map: cloneMap(map), mapName }, ...future].slice(0, 80),
        map: previous.map,
        mapName: previous.mapName,
        dirty: true,
        selectedNodeId: null,
        selectedPathId: null,
      })
    },
    redo: () => {
      const { history, future, map, mapName } = get()
      const next = future[0]
      if (!next) return
      set({
        future: future.slice(1),
        history: [...history, { map: cloneMap(map), mapName }],
        map: next.map,
        mapName: next.mapName,
        dirty: true,
        selectedNodeId: null,
        selectedPathId: null,
      })
    },
    loadSavedMap: ({ id, name, document, updatedAt }) =>
      set({
        mapId: id,
        mapName: name,
        map: {
          maxNeighborDistance: document.map.maxNeighborDistance,
          nodes: withEditorIds(document.map.nodes),
        },
        history: [],
        future: [],
        dirty: false,
        saveStatus: 'saved',
        lastSavedAt: updatedAt ?? new Date().toISOString(),
        selectedNodeId: null,
        selectedPathId: null,
        pathStartId: null,
        statusMessage: null,
      }),
    importDocument: (document, name, options) => {
      const current = get()
      const withHistory = options?.history !== false
      const nextMap = withStableEditorIds(document, current.map)
      const selectedStillExists = nextMap.nodes.some((node) => node.id === current.selectedNodeId)
      set({
        history: withHistory
          ? [...current.history, { map: cloneMap(current.map), mapName: current.mapName }].slice(-80)
          : current.history,
        future: withHistory ? [] : current.future,
        mapName: name?.trim() || current.mapName,
        map: nextMap,
        dirty: true,
        selectedNodeId: selectedStillExists ? current.selectedNodeId : null,
        selectedPathId: withHistory ? null : current.selectedPathId,
        pathStartId: null,
        statusMessage: options?.silent ? null : 'Map imported',
      })
    },
    markSaving: () => set({ saveStatus: 'saving' }),
    markSaved: (savedAt) => set({ saveStatus: 'saved', dirty: false, lastSavedAt: savedAt }),
    markSaveError: () => set({ saveStatus: 'error' }),
    focusNode: (nodeId) => {
      const node = get().map.nodes.find((item) => item.id === nodeId)
      if (!node) return
      const { viewport, canvasSize } = get()
      const width = Math.max(canvasSize.width, 1)
      const height = Math.max(canvasSize.height, 1)
      const scale = Math.max(viewport.scale, 0.35)
      const placed = worldToScreen(node, { ...viewport, scale, x: 0, y: 0 })
      set({
        selectedNodeId: nodeId,
        selectedPathId: null,
        viewport: {
          rotation: viewport.rotation,
          scale,
          x: width / 2 - placed.x,
          y: height / 2 - placed.y,
        },
      })
    },
  }
})

export const useSelectedNode = () => {
  const selectedNodeId = useMapEditorStore((state) => state.selectedNodeId)
  const nodes = useMapEditorStore((state) => state.map.nodes)
  return useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
}

export const useMapStats = () => {
  const map = useMapEditorStore((state) => state.map)
  return useMemo(() => {
    const edges = deriveEdges(map)
    return {
      nodes: map.nodes.length,
      paths: countUniquePaths(edges),
      chargers: map.nodes.filter((node) => nodeKind(node) === 'charger').length,
      chutes: map.nodes.filter((node) => nodeKind(node) === 'chute').length,
      maxNeighborDistance: map.maxNeighborDistance,
      edges,
    }
  }, [map])
}

export const exportCurrentDocument = () => toDocument(useMapEditorStore.getState().map)

export const exportCurrentJson = () => JSON.stringify(toDocument(useMapEditorStore.getState().map), null, 2)

export { stripEditorIds }
