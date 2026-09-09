import {
  directionVectors,
  worldToScreen,
  type Direction,
  type EditorNode,
  type Viewport,
} from '@mujin/map-domain'
import { Arrow, Circle, Group, Text } from 'react-konva'
import { mapColors } from './colors'

interface MapNodeMarkerProps {
  node: EditorNode
  viewport: Viewport
  selected: boolean
  hovered: boolean
  pathStart: boolean
  showName: boolean
  draggable: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
  onDragStart: () => void
  onDragMove: (x: number, y: number) => void
  onDragEnd: (x: number, y: number) => void
}

const markerColor = (node: EditorNode) => {
  if (node.charger) return mapColors.charger
  if (node.chute) return mapColors.chute
  return mapColors.node
}

export const MapNodeMarker = ({
  node,
  viewport,
  selected,
  hovered,
  pathStart,
  showName,
  draggable,
  onSelect,
  onHover,
  onDragStart,
  onDragMove,
  onDragEnd,
}: MapNodeMarkerProps) => {
  const point = worldToScreen(node, viewport)
  const radius = Math.min(13, Math.max(6.5, 8 + (viewport.scale - 0.12) * 8))
  const showCode = viewport.scale >= 0.07
  const color = markerColor(node)
  const label = showName && node.name ? node.name : showCode ? String(node.code) : ''

  return (
    <Group
      x={point.x}
      y={point.y}
      draggable={draggable}
      onMouseEnter={(event) => {
        const stage = event.target.getStage()
        if (stage) stage.container().style.cursor = 'pointer'
        onHover(true)
      }}
      onMouseLeave={(event) => {
        const stage = event.target.getStage()
        if (stage) stage.container().style.cursor = 'grab'
        onHover(false)
      }}
      onMouseDown={(event) => {
        event.cancelBubble = true
        onSelect()
      }}
      onDragStart={(event) => {
        event.cancelBubble = true
        onDragStart()
      }}
      onDragMove={(event) => {
        const pointer = event.target.getStage()?.getPointerPosition()
        if (pointer) onDragMove(pointer.x, pointer.y)
      }}
      onDragEnd={(event) => {
        const pointer = event.target.getStage()?.getPointerPosition()
        if (pointer) onDragEnd(pointer.x, pointer.y)
      }}
    >
      {(selected || hovered || pathStart) && (
        <Circle
          radius={radius + 5}
          stroke={pathStart ? mapColors.charger : mapColors.selected}
          strokeWidth={selected ? 2.4 : 1.4}
          listening={false}
        />
      )}
      <Circle
        radius={radius}
        fill={color}
        stroke={selected ? mapColors.nodeStroke : mapColors.muted}
        strokeWidth={selected ? 2 : 1}
      />
      {node.charger && (
        <Text
          text="⚡"
          fontSize={radius + 2}
          fill={mapColors.onMarker}
          x={-radius}
          y={-radius * 0.85}
          width={radius * 2}
          align="center"
          listening={false}
        />
      )}
      {node.chute && !node.charger && (
        <Text
          text="⇥"
          fontSize={radius + 1}
          fill={mapColors.onMarker}
          x={-radius}
          y={-radius * 0.8}
          width={radius * 2}
          align="center"
          listening={false}
        />
      )}
      {(node.directions ?? []).map((direction) => (
        <DirectionTick
          key={direction}
          direction={direction}
          viewport={viewport}
          radius={radius}
          color={color}
        />
      ))}
      {label ? (
        <Text
          text={label}
          fontSize={showName && node.name ? 11 : 10}
          fontStyle={node.name ? 'bold' : 'normal'}
          fill={mapColors.label}
          y={radius + 6}
          x={-48}
          width={96}
          align="center"
          listening={false}
        />
      ) : null}
    </Group>
  )
}

const DirectionTick = ({
  direction,
  viewport,
  radius,
  color,
}: {
  direction: Direction
  viewport: Viewport
  radius: number
  color: string
}) => {
  const vector = directionVectors[direction]
  const origin = worldToScreen({ x: 0, y: 0 }, viewport)
  const tip = worldToScreen({ x: vector.dx * 80, y: vector.dy * 80 }, viewport)
  const dx = tip.x - origin.x
  const dy = tip.y - origin.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  return (
    <Arrow
      points={[ux * (radius + 2), uy * (radius + 2), ux * (radius + 12), uy * (radius + 12)]}
      pointerLength={5}
      pointerWidth={5}
      stroke={color}
      fill={color}
      strokeWidth={1.4}
      listening={false}
    />
  )
}
