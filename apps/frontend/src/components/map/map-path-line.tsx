import { worldToScreen, type MapEdge, type Viewport } from '@mujin/map-domain'
import { Arrow, Group } from 'react-konva'
import { mapColors } from './colors'

interface MapPathLineProps {
  edge: MapEdge
  viewport: Viewport
  selected: boolean
  hovered: boolean
  from: { x: number; y: number }
  to: { x: number; y: number }
  onSelect: () => void
  onHover: (hovered: boolean) => void
}

export const MapPathLine = ({
  viewport,
  selected,
  hovered,
  from,
  to,
  onSelect,
  onHover,
}: MapPathLineProps) => {
  const start = worldToScreen(from, viewport)
  const end = worldToScreen(to, viewport)
  const mx = (start.x + end.x) / 2
  const my = (start.y + end.y) / 2
  return (
    <Group>
      <Arrow
        points={[start.x, start.y, end.x, end.y]}
        stroke={selected || hovered ? mapColors.pathSelected : mapColors.path}
        strokeWidth={selected ? 3.2 : 2}
        pointerLength={7}
        pointerWidth={7}
        opacity={0.95}
        hitStrokeWidth={14}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={(event) => {
          event.cancelBubble = true
          onSelect()
        }}
        onTap={(event) => {
          event.cancelBubble = true
          onSelect()
        }}
      />
      <Arrow
        points={[
          start.x + (mx - start.x) * 0.55,
          start.y + (my - start.y) * 0.55,
          start.x + (mx - start.x) * 0.72,
          start.y + (my - start.y) * 0.72,
        ]}
        pointerLength={6}
        pointerWidth={6}
        stroke={selected ? mapColors.nodeStroke : mapColors.pathSelected}
        fill={selected ? mapColors.nodeStroke : mapColors.pathSelected}
        strokeWidth={1.2}
        listening={false}
      />
    </Group>
  )
}
