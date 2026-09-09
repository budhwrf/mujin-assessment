import { Braces, CheckCircle2, ChevronDown, ChevronsDown, ChevronsUp, FolderDown, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { JsonEditor } from '@/components/json/json-editor'
import { useMapEditorStore, useMapStats } from '@/store/map-editor-store'

export type InspectorMode = 'closed' | 'open' | 'expanded'

export const BottomPanel = ({
  mode,
  onModeChange,
  onLoad,
  onSave,
  isLoading = false,
  isSaving = false,
}: {
  mode: InspectorMode
  onModeChange: (mode: InspectorMode) => void
  onLoad: () => void
  onSave: () => void
  isLoading?: boolean
  isSaving?: boolean
}) => {
  const stats = useMapStats()
  const gridSize = useMapEditorStore((state) => state.gridSize)
  const expanded = mode === 'expanded'

  if (mode === 'closed') {
    return (
      <section className="flex h-10 shrink-0 items-center gap-4 border-t border-border bg-card px-3">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => onModeChange('open')}>
          <Braces className="size-3.5 text-primary" />
          JSON inspector
          <ChevronsUp className="size-3.5 text-muted-foreground" />
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-xs text-muted-foreground">{stats.nodes} nodes</span>
        <span className="text-xs text-muted-foreground">{stats.paths} paths</span>
        <span className="ml-auto text-xs text-muted-foreground">
          Max neighbor {stats.maxNeighborDistance} mm
        </span>
      </section>
    )
  }

  return (
    <section
      className={
        expanded
          ? 'grid min-h-0 flex-1 shrink-0 grid-cols-[minmax(0,1fr)_280px] gap-3 overflow-hidden border-t border-border bg-card p-3'
          : 'grid h-88 shrink-0 grid-cols-[minmax(0,1fr)_280px] gap-3 overflow-hidden border-t border-border bg-card p-3'
      }
    >
      <Card size="sm" className="min-h-0 gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-2">
          <div className="flex items-center gap-2">
            <Braces className="size-3.5 text-muted-foreground" />
            <CardTitle className="text-xs tracking-wide text-muted-foreground uppercase">
              Inspector
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={expanded ? 'Restore inspector' : 'Expand inspector'}
              onClick={() => onModeChange(expanded ? 'open' : 'expanded')}
            >
              {expanded ? <ChevronsDown /> : <ChevronsUp />}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Close inspector"
              onClick={() => onModeChange('closed')}
            >
              <ChevronDown />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-3">
          <JsonEditor expanded={expanded} />
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-col gap-3 overflow-auto">
        <Card size="sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs tracking-wide text-muted-foreground uppercase">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-auto justify-start gap-3 px-3 py-2.5"
              disabled={isLoading || isSaving}
              onClick={onLoad}
            >
              <FolderDown className="size-4 text-primary" />
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{isLoading ? 'Loading...' : 'Load Map'}</span>
                <span className="text-xs font-normal text-muted-foreground">Reload from server</span>
              </span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-auto justify-start gap-3 px-3 py-2.5"
              disabled={isLoading || isSaving}
              onClick={onSave}
            >
              <Save className="size-4 text-primary" />
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{isSaving ? 'Saving...' : 'Save Map'}</span>
                <span className="text-xs font-normal text-muted-foreground">Persist current draft</span>
              </span>
            </Button>
          </CardContent>
        </Card>

        <Card size="sm" className="min-h-0 flex-1">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs tracking-wide text-muted-foreground uppercase">
                Map Info
              </CardTitle>
              <CheckCircle2 className="size-3.5 text-success" />
            </div>
            <CardDescription className="text-xs">Live graph summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Total Nodes" value={String(stats.nodes)} />
            <InfoRow label="Total Paths" value={String(stats.paths)} />
            <InfoRow label="Chargers" value={String(stats.chargers)} />
            <InfoRow label="Chutes" value={String(stats.chutes)} />
            <Separator className="my-2" />
            <InfoRow label="Max Neighbor Distance" value={`${stats.maxNeighborDistance} mm`} />
            <InfoRow label="Snap" value={`${gridSize} mm`} />
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-0.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums text-foreground">{value}</span>
  </div>
)
