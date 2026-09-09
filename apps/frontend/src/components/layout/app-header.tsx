import type { ReactNode } from 'react'
import {
  Box,
  CircleHelp,
  CirclePlus,
  FolderOpen,
  Map as MapIcon,
  Pencil,
  Redo2,
  Save,
  Search,
  Spline,
  SquareMousePointer,
  Undo2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMapEditorStore } from '@/store/map-editor-store'

const formatSavedAt = (value: string | null) => {
  if (!value) return 'Not saved yet'
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export const AppHeader = ({
  connected,
  onSave,
  onImport,
}: {
  connected: 'connected' | 'connecting' | 'disconnected'
  onSave: () => void
  onImport: () => void
}) => {
  const mapName = useMapEditorStore((state) => state.mapName)
  const tool = useMapEditorStore((state) => state.tool)
  const gridEnabled = useMapEditorStore((state) => state.gridEnabled)
  const gridSize = useMapEditorStore((state) => state.gridSize)
  const saveStatus = useMapEditorStore((state) => state.saveStatus)
  const lastSavedAt = useMapEditorStore((state) => state.lastSavedAt)
  const dirty = useMapEditorStore((state) => state.dirty)
  const setTool = useMapEditorStore((state) => state.setTool)
  const undo = useMapEditorStore((state) => state.undo)
  const redo = useMapEditorStore((state) => state.redo)
  const toggleGrid = useMapEditorStore((state) => state.toggleGrid)
  const setGridSize = useMapEditorStore((state) => state.setGridSize)
  const setRenameOpen = useMapEditorStore((state) => state.setRenameOpen)
  const setHelpOpen = useMapEditorStore((state) => state.setHelpOpen)
  const fitToScreen = useMapEditorStore((state) => state.fitToScreen)
  const history = useMapEditorStore((state) => state.history)
  const future = useMapEditorStore((state) => state.future)

  const statusLabel =
    saveStatus === 'saving'
      ? 'Saving...'
      : saveStatus === 'error'
        ? 'Save failed'
        : dirty
          ? 'Unsaved changes'
          : `Auto saved ${formatSavedAt(lastSavedAt)}`

  return (
    <header className="border-b border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 items-center gap-4 px-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Box className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">AGV Map Editor</div>
            <div className="text-xs text-muted-foreground">Design · Edit · Connect</div>
          </div>
        </div>

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <nav className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none border-b-2 border-primary text-foreground"
          >
            <MapIcon />
            Map Editor
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onImport}>
            <FolderOpen />
            File
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={fitToScreen}>
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp />
            Help
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <Badge
            variant="secondary"
            className={
              connected === 'connected'
                ? 'gap-1.5 bg-success/15 text-success'
                : connected === 'connecting'
                  ? 'gap-1.5 bg-warning/15 text-warning'
                  : 'gap-1.5 bg-destructive/15 text-destructive'
            }
          >
            <span
              className={
                connected === 'connected'
                  ? 'size-1.5 rounded-full bg-success'
                  : connected === 'connecting'
                    ? 'size-1.5 rounded-full bg-warning'
                    : 'size-1.5 rounded-full bg-destructive'
              }
            />
            {connected === 'connected'
              ? 'Connected'
              : connected === 'connecting'
                ? 'Connecting...'
                : 'Disconnected'}
          </Badge>
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-0.5 pr-2.5 pl-0.5">
            <Avatar size="sm">
              <AvatarFallback>DU</AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-foreground">Dev User</span>
          </div>
          <Button size="sm" onClick={onSave}>
            <Save />
            Save
          </Button>
        </div>
      </div>

      <div className="flex h-11 items-center gap-2 border-t border-border px-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 font-medium text-foreground"
          onClick={() => setRenameOpen(true)}
        >
          {mapName}
          <Pencil className="size-3.5 text-muted-foreground" />
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <ButtonGroup>
          <ToolButton label="Undo" shortcut="Ctrl+Z" disabled={history.length === 0} onClick={undo}>
            <Undo2 />
          </ToolButton>
          <ToolButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={future.length === 0} onClick={redo}>
            <Redo2 />
          </ToolButton>
        </ButtonGroup>

        <Separator orientation="vertical" className="h-5" />

        <ButtonGroup>
          <ToolButton
            label="Select"
            shortcut="V"
            active={tool === 'select'}
            onClick={() => setTool('select')}
          >
            <SquareMousePointer />
          </ToolButton>
          <ToolButton
            label="Add Path"
            shortcut="P"
            active={tool === 'add-path'}
            onClick={() => setTool('add-path')}
          >
            <Spline />
          </ToolButton>
          <ToolButton
            label="Add Node"
            shortcut="N"
            active={tool === 'add-node'}
            onClick={() => setTool('add-node')}
          >
            <CirclePlus />
          </ToolButton>
        </ButtonGroup>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Grid</span>
          <Switch size="sm" checked={gridEnabled} onCheckedChange={toggleGrid} aria-label="Toggle grid" />
          <InputGroup className="h-7 w-28">
            <InputGroupInput
              aria-label="Grid size"
              type="number"
              value={gridSize}
              onChange={(event) => setGridSize(Number(event.target.value))}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText className="text-xs">mm</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <NodeSearch />
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
      </div>
    </header>
  )
}

const NodeSearch = () => {
  const nodes = useMapEditorStore((state) => state.map.nodes)
  const focusNode = useMapEditorStore((state) => state.focusNode)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return nodes
      .filter((node) =>
        [node.name, String(node.code), String(node.x), String(node.y)]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(needle)),
      )
      .slice(0, 8)
  }, [nodes, query])

  return (
    <div className="relative w-52">
      <InputGroup className="h-7">
        <InputGroupAddon>
          <Search className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
            if (event.key === 'Enter' && matches[0]) {
              focusNode(matches[0].id)
              setOpen(false)
            }
          }}
          placeholder="Search nodes"
          aria-label="Search nodes"
        />
      </InputGroup>
      {open && query.trim() && (
        <Card className="absolute top-full right-0 z-50 mt-1 w-72 gap-0 py-1" size="sm">
          {matches.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching nodes</p>
          ) : (
            matches.map((node) => (
              <Button
                key={node.id}
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-between rounded-none px-2 py-1.5 text-xs font-normal"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  focusNode(node.id)
                  setOpen(false)
                }}
              >
                <span>{node.name || node.code}</span>
                <span className="text-muted-foreground">
                  {node.x},{node.y}
                </span>
              </Button>
            ))
          )}
        </Card>
      )}
    </div>
  )
}

const ToolButton = ({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  shortcut: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          size="icon-sm"
          variant={active ? 'secondary' : 'outline'}
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        />
      }
    >
      {children}
    </TooltipTrigger>
    <TooltipContent>
      {label} <Kbd>{shortcut}</Kbd>
    </TooltipContent>
  </Tooltip>
)
