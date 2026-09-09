import { fitViewport, worldToScreen } from '@mujin/map-domain'
import { useMapEditorStore, useMapStats } from '@/store/map-editor-store'

export const MapMinimap = () => {
  const map = useMapEditorStore((state) => state.map)
  const viewport = useMapEditorStore((state) => state.viewport)
  const canvasSize = useMapEditorStore((state) => state.canvasSize)
  const selectedNodeId = useMapEditorStore((state) => state.selectedNodeId)
  const setViewport = useMapEditorStore((state) => state.setViewport)
  const { edges } = useMapStats()
  const width = 176
  const height = 112
  const mini = fitViewport(map.nodes, width, height, viewport.rotation, 10)
  const corners = [
    worldToScreen({ x: 0, y: 0 }, viewport),
    worldToScreen({ x: 0, y: 0 }, viewport),
  ]
  void corners

  const viewCorners = [
    { x: (0 - viewport.x) / viewport.scale, y: (0 - viewport.y) / viewport.scale },
    { x: (canvasSize.width - viewport.x) / viewport.scale, y: (canvasSize.height - viewport.y) / viewport.scale },
  ]
  const worldView = [
    { x: -viewCorners[0].y, y: -viewCorners[0].x },
    { x: -viewCorners[1].y, y: -viewCorners[1].x },
  ]
  const a = worldToScreen(worldView[0] ?? { x: 0, y: 0 }, mini)
  const b = worldToScreen(worldView[1] ?? { x: 0, y: 0 }, mini)

  return (
    <button
      type="button"
      aria-label="Map overview"
      className="relative h-28 w-full overflow-hidden bg-background"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const localX = event.clientX - rect.left
        const localY = event.clientY - rect.top
        const world = {
          x: -((localY - mini.y) / mini.scale),
          y: -((localX - mini.x) / mini.scale),
        }
        setViewport({
          ...viewport,
          x: canvasSize.width / 2 - (-world.y) * viewport.scale,
          y: canvasSize.height / 2 - (-world.x) * viewport.scale,
        })
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        {edges.map((edge) => {
          const from = map.nodes[edge.fromIndex]
          const to = map.nodes[edge.toIndex]
          if (!from || !to) return null
          const start = worldToScreen(from, mini)
          const end = worldToScreen(to, mini)
          return (
            <line
              key={edge.id}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="var(--chart-1)"
              strokeWidth="1"
            />
          )
        })}
        {map.nodes.map((node) => {
          const point = worldToScreen(node, mini)
          const fill = node.charger ? 'var(--chart-2)' : node.chute ? 'var(--chart-3)' : 'var(--chart-1)'
          return (
            <circle
              key={node.id}
              cx={point.x}
              cy={point.y}
              r={node.id === selectedNodeId ? 3.2 : 2}
              fill={fill}
            />
          )
        })}
        <rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.max(8, Math.abs(b.x - a.x))}
          height={Math.max(8, Math.abs(b.y - a.y))}
          fill="color-mix(in oklch, var(--primary) 12%, transparent)"
          stroke="var(--ring)"
          strokeWidth="1"
        />
      </svg>
    </button>
  )
}
