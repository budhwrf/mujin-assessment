import type { CSSProperties, ReactNode } from 'react'
import {
  CirclePlus,
  LocateFixed,
  MousePointer2,
  Pencil,
  RotateCw,
  Spline,
  Trash2,
  Waypoints,
  Zap,
  ZoomIn,
  ZoomOut,
  CircleDot,
  Inbox,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Slider } from '@/components/ui/slider'
import { MapMinimap } from '@/components/map/map-minimap'
import { useMapEditorStore, useMapStats } from '@/store/map-editor-store'

const SCALE_MIN = 0.02
const SCALE_MAX = 4

export const LeftSidebar = () => {
  const tool = useMapEditorStore((state) => state.tool)
  const setTool = useMapEditorStore((state) => state.setTool)
  const zoomAt = useMapEditorStore((state) => state.zoomAt)
  const fitToScreen = useMapEditorStore((state) => state.fitToScreen)
  const rotateMap = useMapEditorStore((state) => state.rotateMap)
  const viewport = useMapEditorStore((state) => state.viewport)
  const setViewport = useMapEditorStore((state) => state.setViewport)
  const setNodeListOpen = useMapEditorStore((state) => state.setNodeListOpen)
  const stats = useMapStats()

  const zoomPercent = Math.round(viewport.scale * 100)

  return (
    <SidebarProvider
      defaultOpen
      className="h-full min-h-0 w-(--sidebar-width) shrink-0"
      style={{ '--sidebar-width': '14rem' } as CSSProperties}
    >
      <Sidebar collapsible="none" className="h-full border-r border-sidebar-border">
        <SidebarContent className="gap-0 overflow-y-auto overscroll-contain">
          <SidebarGroup className="py-3">
            <SidebarGroupLabel>Map</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive
                    className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                    onClick={() => setNodeListOpen(true)}
                  >
                    <CircleDot />
                    <span>Nodes</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{stats.nodes}</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Waypoints />
                    <span>Paths</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{stats.paths}</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Zap />
                    <span>Chargers</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{stats.chargers}</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Inbox />
                    <span>Chutes</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{stats.chutes}</SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup className="py-3">
            <SidebarGroupLabel>Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <ToolItem
                  label="Select"
                  icon={<MousePointer2 />}
                  active={tool === 'select'}
                  onClick={() => setTool('select')}
                />
                <ToolItem
                  label="Add Node"
                  icon={<CirclePlus />}
                  active={tool === 'add-node'}
                  onClick={() => setTool('add-node')}
                />
                <ToolItem
                  label="Add Path"
                  icon={<Spline />}
                  active={tool === 'add-path'}
                  onClick={() => setTool('add-path')}
                />
                <ToolItem
                  label="Edit"
                  icon={<Pencil />}
                  active={tool === 'edit'}
                  onClick={() => setTool('edit')}
                />
                <ToolItem
                  label="Delete"
                  icon={<Trash2 />}
                  active={tool === 'delete'}
                  onClick={() => setTool('delete')}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup className="py-3">
            <SidebarGroupLabel>View</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <ToolItem label="Zoom In" icon={<ZoomIn />} onClick={() => zoomAt(1.15)} />
                <ToolItem label="Zoom Out" icon={<ZoomOut />} onClick={() => zoomAt(0.87)} />
                <ToolItem label="Fit to Screen" icon={<LocateFixed />} onClick={fitToScreen} />
                <ToolItem label="Rotate" icon={<RotateCw />} onClick={rotateMap} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-2 border-t border-sidebar-border">
          <SidebarGroupLabel className="px-0">Map Controls</SidebarGroupLabel>
          <Card size="sm" className="gap-0 overflow-hidden py-0 ring-sidebar-border">
            <MapMinimap />
          </Card>
          <div className="flex items-center gap-2 px-0.5">
            <Slider
              className="flex-1"
              min={0}
              max={100}
              value={[scaleToSlider(viewport.scale)]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value
                if (typeof next !== 'number') return
                setViewport({ ...viewport, scale: sliderToScale(next) })
              }}
              aria-label="Zoom level"
            />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {zoomPercent}%
            </span>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}

const scaleToSlider = (scale: number) => {
  const t = (Math.log(scale) - Math.log(SCALE_MIN)) / (Math.log(SCALE_MAX) - Math.log(SCALE_MIN))
  return Math.round(Math.min(100, Math.max(0, t * 100)))
}

const sliderToScale = (slider: number) => {
  const t = slider / 100
  return Math.exp(Math.log(SCALE_MIN) + t * (Math.log(SCALE_MAX) - Math.log(SCALE_MIN)))
}

const ToolItem = ({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  onClick: () => void
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      isActive={active}
      className={
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground'
          : undefined
      }
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </SidebarMenuButton>
  </SidebarMenuItem>
)
