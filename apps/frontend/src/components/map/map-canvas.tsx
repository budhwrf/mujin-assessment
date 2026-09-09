import { screenToWorld, worldToScreen, type MapEdge } from '@mujin/map-domain'
import type Konva from 'konva'
import { useEffect, useRef, useState } from 'react'
import { Layer, Line, Stage } from 'react-konva'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { pathIdFor, useMapEditorStore, useMapStats } from '@/store/map-editor-store'
import { mapColors } from './colors'
import { MapGrid } from './map-grid'
import { MapNodeMarker } from './map-node-marker'
import { MapPathLine } from './map-path-line'

export const MapCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const spaceDown = useRef(false)
  const panning = useRef(false)
  const panMoved = useRef(false)
  const pointerHandled = useRef(false)
  const pendingAdd = useRef<{ x: number; y: number } | null>(null)
  const panOrigin = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const [isGrabbing, setIsGrabbing] = useState(false)
  const [dragLabel, setDragLabel] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null)

  const map = useMapEditorStore((state) => state.map)
  const viewport = useMapEditorStore((state) => state.viewport)
  const tool = useMapEditorStore((state) => state.tool)
  const selectedNodeId = useMapEditorStore((state) => state.selectedNodeId)
  const selectedPathId = useMapEditorStore((state) => state.selectedPathId)
  const hoveredNodeId = useMapEditorStore((state) => state.hoveredNodeId)
  const hoveredEdgeId = useMapEditorStore((state) => state.hoveredEdgeId)
  const pathStartId = useMapEditorStore((state) => state.pathStartId)
  const gridEnabled = useMapEditorStore((state) => state.gridEnabled)
  const showNames = useMapEditorStore((state) => state.showNames)
  const setCanvasSize = useMapEditorStore((state) => state.setCanvasSize)
  const setViewport = useMapEditorStore((state) => state.setViewport)
  const zoomAt = useMapEditorStore((state) => state.zoomAt)
  const selectNode = useMapEditorStore((state) => state.selectNode)
  const selectPath = useMapEditorStore((state) => state.selectPath)
  const addNodeAt = useMapEditorStore((state) => state.addNodeAt)
  const startOrCompletePath = useMapEditorStore((state) => state.startOrCompletePath)
  const beginNodeMove = useMapEditorStore((state) => state.beginNodeMove)
  const moveNode = useMapEditorStore((state) => state.moveNode)
  const setHoveredNode = useMapEditorStore((state) => state.setHoveredNode)
  const setHoveredEdge = useMapEditorStore((state) => state.setHoveredEdge)
  const setDeleteConfirmOpen = useMapEditorStore((state) => state.setDeleteConfirmOpen)
  const canvasSize = useMapEditorStore((state) => state.canvasSize)
  const alignmentGuides = useMapEditorStore((state) => state.alignmentGuides)
  const { edges } = useMapStats()

  const fittedRef = useRef(false)
  const fitToScreen = useMapEditorStore((state) => state.fitToScreen)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry?.contentRect.width ?? 0)
      const height = Math.floor(entry?.contentRect.height ?? 0)
      if (width < 200 || height < 200) return
      setCanvasSize(width, height)
      if (fittedRef.current) return
      fittedRef.current = true
      requestAnimationFrame(() => fitToScreen())
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [fitToScreen, setCanvasSize])

  useEffect(() => {
    if (!isGrabbing) return
    const onMove = (event: MouseEvent) => {
      if (!panning.current) return
      const dx = event.clientX - panOrigin.current.x
      const dy = event.clientY - panOrigin.current.y
      if (!panMoved.current && Math.hypot(dx, dy) < 4) return
      panMoved.current = true
      const current = useMapEditorStore.getState().viewport
      setViewport({
        ...current,
        x: panOrigin.current.vx + dx,
        y: panOrigin.current.vy + dy,
      })
    }
    const onUp = () => finishPointer(0, 0)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isGrabbing, setViewport])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceDown.current = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceDown.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const hoveredNode = map.nodes.find((node) => node.id === hoveredNodeId) ?? null
  const hoveredEdge = edges.find((edge) => edge.id === hoveredEdgeId) ?? null
  const hoverPoint = hoveredNode ? worldToScreen(hoveredNode, viewport) : null

  const beginPan = (clientX: number, clientY: number) => {
    const current = useMapEditorStore.getState().viewport
    panning.current = true
    panMoved.current = false
    pointerHandled.current = false
    setIsGrabbing(true)
    panOrigin.current = { x: clientX, y: clientY, vx: current.x, vy: current.y }
  }

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const middle = event.evt.button === 1
    const spacePan = spaceDown.current && event.evt.button === 0
    if (middle || spacePan) {
      beginPan(event.evt.clientX, event.evt.clientY)
      return
    }

    if (event.target !== event.target.getStage()) return
    if (event.evt.button !== 0) return

    if (tool === 'add-node') {
      pendingAdd.current = { x: event.evt.offsetX, y: event.evt.offsetY }
    } else {
      pendingAdd.current = null
    }
    beginPan(event.evt.clientX, event.evt.clientY)
  }

  const handleMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!panning.current) return
    const dx = event.evt.clientX - panOrigin.current.x
    const dy = event.evt.clientY - panOrigin.current.y
    if (!panMoved.current && Math.hypot(dx, dy) < 4) return
    panMoved.current = true
    const current = useMapEditorStore.getState().viewport
    setViewport({
      ...current,
      x: panOrigin.current.vx + dx,
      y: panOrigin.current.vy + dy,
    })
  }

  const finishPointer = (offsetX: number, offsetY: number) => {
    if (pointerHandled.current || !panning.current) return
    pointerHandled.current = true
    const moved = panMoved.current
    panning.current = false
    panMoved.current = false
    setIsGrabbing(false)
    if (moved) {
      pendingAdd.current = null
      return
    }
    if (pendingAdd.current && tool === 'add-node') {
      const point = pendingAdd.current
      pendingAdd.current = null
      const world = screenToWorld(point, useMapEditorStore.getState().viewport)
      addNodeAt(world.x, world.y)
      return
    }
    pendingAdd.current = null
    if (tool !== 'add-node') {
      selectNode(null)
      selectPath(null)
    }
    void offsetX
    void offsetY
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full overflow-hidden bg-background"
      style={{ cursor: isGrabbing ? 'grabbing' : 'grab' }}
    >
      <Stage
        width={canvasSize.width}
        height={canvasSize.height}
        onWheel={(event) => {
          event.evt.preventDefault()
          const pointer = { x: event.evt.offsetX, y: event.evt.offsetY }
          const delta = event.evt.deltaY
          const isTrackpad =
            event.evt.deltaMode === 0 && Math.abs(delta) < 50 && !event.evt.ctrlKey
          const sensitivity = isTrackpad ? 0.0011 : event.evt.ctrlKey ? 0.004 : 0.0014
          const factor = Math.exp(-delta * sensitivity)
          if (Math.abs(factor - 1) < 0.0008) return
          zoomAt(factor, pointer)
        }}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={(event) => finishPointer(event.evt.offsetX, event.evt.offsetY)}
        onMouseLeave={() => {
          setHoveredNode(null)
          setHoveredEdge(null)
        }}
      >
        <Layer listening={false}>
          <MapGrid
            viewport={viewport}
            width={canvasSize.width}
            height={canvasSize.height}
            enabled={gridEnabled}
          />
        </Layer>
        <Layer>
          {edges.map((edge) => {
            const from = map.nodes[edge.fromIndex]
            const to = map.nodes[edge.toIndex]
            if (!from || !to) return null
            return (
              <MapPathLine
                key={edge.id}
                edge={edge}
                viewport={viewport}
                from={from}
                to={to}
                selected={selectedPathId === pathIdFor(edge.fromId, edge.toId)}
                hovered={hoveredEdgeId === edge.id}
                onHover={(hovered) => setHoveredEdge(hovered ? edge.id : null)}
                onSelect={() => {
                  selectPath(pathIdFor(edge.fromId, edge.toId))
                }}
              />
            )
          })}
        </Layer>
        <Layer listening={false}>
          {alignmentGuides?.x != null && (
            <Line
              points={guideLine(alignmentGuides.x, 'x', viewport, canvasSize)}
              stroke={mapColors.selected}
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
          {alignmentGuides?.y != null && (
            <Line
              points={guideLine(alignmentGuides.y, 'y', viewport, canvasSize)}
              stroke={mapColors.selected}
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
        </Layer>
        <Layer>
          {map.nodes.map((node) => (
            <MapNodeMarker
              key={node.id}
              node={node}
              viewport={viewport}
              selected={selectedNodeId === node.id}
              hovered={hoveredNodeId === node.id}
              pathStart={pathStartId === node.id}
              showName={showNames}
              draggable={tool === 'select' || tool === 'edit'}
              onHover={(hovered) => setHoveredNode(hovered ? node.id : hoveredNodeId === node.id ? null : hoveredNodeId)}
              onSelect={() => {
                if (tool === 'add-path') {
                  startOrCompletePath(node.id)
                  return
                }
                if (tool === 'delete') {
                  selectNode(node.id)
                  setDeleteConfirmOpen(true)
                  return
                }
                selectNode(node.id)
              }}
              onDragStart={() => beginNodeMove(node.id)}
              onDragMove={(x, y) => {
                const world = screenToWorld({ x, y }, viewport)
                moveNode(node.id, world.x, world.y, false)
                setDragLabel({ x, y, worldX: Math.round(world.x), worldY: Math.round(world.y) })
              }}
              onDragEnd={(x, y) => {
                const world = screenToWorld({ x, y }, viewport)
                moveNode(node.id, world.x, world.y, true)
                setDragLabel(null)
              }}
            />
          ))}
        </Layer>
      </Stage>

      <Compass rotation={viewport.rotation} />

      {dragLabel && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-primary/40 bg-popover/90 px-2 py-1 text-[11px] text-primary shadow-lg"
          style={{ left: dragLabel.x + 14, top: dragLabel.y - 28 }}
        >
          X {dragLabel.worldX} mm
          <br />
          Y {dragLabel.worldY} mm
        </div>
      )}

      {hoveredNode && hoverPoint && !dragLabel && (
        <div
          className="pointer-events-none absolute z-20 max-w-56 rounded-md border border-border bg-popover/95 px-2.5 py-2 text-[11px] leading-5 text-popover-foreground shadow-lg"
          style={{ left: hoverPoint.x + 16, top: hoverPoint.y + 12 }}
        >
          <div className="font-semibold">{hoveredNode.name ?? `Node ${hoveredNode.code}`}</div>
          <div>Code: {hoveredNode.code}</div>
          <div>
            Position: {hoveredNode.x} × {hoveredNode.y} mm
          </div>
          <div>Directions: {hoveredNode.directions?.join(', ') || 'None'}</div>
          {hoveredNode.charger && <div>Charger: {hoveredNode.charger.direction}</div>}
          {hoveredNode.chute && <div>Chute: {hoveredNode.chute.direction}</div>}
        </div>
      )}

      {hoveredEdge && !hoveredNode && (
        <EdgeHint edge={hoveredEdge} viewport={viewport} nodes={map.nodes} />
      )}
    </div>
  )
}

const guideLine = (
  value: number,
  axis: 'x' | 'y',
  viewport: { x: number; y: number; scale: number; rotation: number },
  canvasSize: { width: number; height: number },
) => {
  const corners = [
    screenToWorld({ x: 0, y: 0 }, viewport),
    screenToWorld({ x: canvasSize.width, y: 0 }, viewport),
    screenToWorld({ x: 0, y: canvasSize.height }, viewport),
    screenToWorld({ x: canvasSize.width, y: canvasSize.height }, viewport),
  ]
  const minX = Math.min(...corners.map((point) => point.x)) - 400
  const maxX = Math.max(...corners.map((point) => point.x)) + 400
  const minY = Math.min(...corners.map((point) => point.y)) - 400
  const maxY = Math.max(...corners.map((point) => point.y)) + 400
  const start =
    axis === 'x'
      ? worldToScreen({ x: value, y: minY }, viewport)
      : worldToScreen({ x: minX, y: value }, viewport)
  const end =
    axis === 'x'
      ? worldToScreen({ x: value, y: maxY }, viewport)
      : worldToScreen({ x: maxX, y: value }, viewport)
  return [start.x, start.y, end.x, end.y]
}

const Compass = ({ rotation }: { rotation: number }) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <div className="pointer-events-auto absolute top-3 right-3 flex size-14 items-center justify-center rounded-full border border-border bg-popover/80 text-[10px] text-muted-foreground shadow-sm" />
      }
    >
      <div style={{ transform: `rotate(${-rotation}deg)` }} className="text-center leading-none">
        <div className="text-primary">N</div>
        <div className="text-lg leading-none text-foreground">↑</div>
      </div>
    </TooltipTrigger>
    <TooltipContent side="left" className="max-w-44 text-xs">
      Floor frame: North is +X. Nodes · Chargers · Chutes · travel directions.
    </TooltipContent>
  </Tooltip>
)

const EdgeHint = ({
  edge,
  viewport,
  nodes,
}: {
  edge: MapEdge
  viewport: { x: number; y: number; scale: number; rotation: number }
  nodes: Array<{ id: string; x: number; y: number }>
}) => {
  const from = nodes.find((node) => node.id === edge.fromId)
  const to = nodes.find((node) => node.id === edge.toId)
  if (!from || !to) return null
  const start = worldToScreen(from, viewport)
  const end = worldToScreen(to, viewport)
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-[11px] text-popover-foreground"
      style={{ left: (start.x + end.x) / 2 + 8, top: (start.y + end.y) / 2 + 8 }}
    >
      Distance: {edge.distance} mm
      <br />
      Direction: {edge.direction}
    </div>
  )
}
