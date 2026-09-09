import { directionOrder, type Direction } from '@mujin/map-domain'
import { MousePointerClick, Trash2, X, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useMapEditorStore, useSelectedNode } from '@/store/map-editor-store'

export const NodeProperties = () => {
  const node = useSelectedNode()
  const showNames = useMapEditorStore((state) => state.showNames)
  const toggleNames = useMapEditorStore((state) => state.toggleNames)
  const updateNode = useMapEditorStore((state) => state.updateNode)
  const toggleDirection = useMapEditorStore((state) => state.toggleDirection)
  const selectNode = useMapEditorStore((state) => state.selectNode)
  const setDeleteConfirmOpen = useMapEditorStore((state) => state.setDeleteConfirmOpen)

  if (!node) {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MousePointerClick />
          </EmptyMedia>
          <EmptyTitle>Select a node</EmptyTitle>
          <EmptyDescription>
            Choose a node on the map to inspect and edit its properties.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const nodeType = node.charger ? 'Charger' : node.chute ? 'Chute' : 'Node'

  return (
    <Card size="sm" className="h-full gap-0 rounded-none border-0 py-0 ring-0">
      <CardHeader className="flex flex-row items-start justify-between border-b py-3">
        <div className="space-y-0.5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Node Properties</p>
          <CardTitle className="text-sm">{node.name || node.code}</CardTitle>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Clear selection"
          onClick={() => selectNode(null)}
        >
          <X />
        </Button>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Name</FieldLabel>
            <Input
              value={node.name ?? ''}
              onChange={(event) =>
                updateNode(node.id, { name: event.target.value || undefined })
              }
              placeholder="Optional name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel className="text-xs text-muted-foreground">X (mm)</FieldLabel>
              <Input
                type="number"
                value={node.x}
                onChange={(event) => updateNode(node.id, { x: Number(event.target.value) })}
              />
            </Field>
            <Field>
              <FieldLabel className="text-xs text-muted-foreground">Y (mm)</FieldLabel>
              <Input
                type="number"
                value={node.y}
                onChange={(event) => updateNode(node.id, { y: Number(event.target.value) })}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Code</FieldLabel>
            <Input
              type="number"
              value={node.code}
              onChange={(event) => updateNode(node.id, { code: Number(event.target.value) })}
            />
          </Field>

          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Directions</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {directionOrder.map((direction) => (
                <label
                  key={direction}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={node.directions?.includes(direction) ?? false}
                    onCheckedChange={() => toggleDirection(node.id, direction)}
                  />
                  {direction}
                </label>
              ))}
            </div>
          </Field>

          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel>Charger</FieldLabel>
            <Switch
              checked={Boolean(node.charger)}
              onCheckedChange={(checked) =>
                updateNode(node.id, {
                  charger: checked ? { direction: node.charger?.direction ?? 'West' } : undefined,
                })
              }
            />
          </Field>
          {node.charger && (
            <DirectionSelect
              label="Charger Direction"
              value={node.charger.direction}
              onChange={(direction) => updateNode(node.id, { charger: { direction } })}
            />
          )}

          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel>Chute</FieldLabel>
            <Switch
              checked={Boolean(node.chute)}
              onCheckedChange={(checked) =>
                updateNode(node.id, {
                  chute: checked ? { direction: node.chute?.direction ?? 'North' } : undefined,
                })
              }
            />
          </Field>
          {node.chute && (
            <DirectionSelect
              label="Chute Direction"
              value={node.chute.direction}
              onChange={(direction) => updateNode(node.id, { chute: { direction } })}
            />
          )}

          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Node Type</FieldLabel>
            <div className="flex h-8 items-center">
              <Badge variant={node.charger ? 'default' : 'secondary'} className="gap-1.5">
                {node.charger && <Zap className="size-3" />}
                {nodeType}
              </Badge>
            </div>
          </Field>

          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel>Name Display</FieldLabel>
            <Switch checked={showNames} onCheckedChange={toggleNames} />
          </Field>
        </FieldGroup>
      </CardContent>

      <CardFooter className="border-t bg-transparent p-3">
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 />
          Delete Node
        </Button>
      </CardFooter>
    </Card>
  )
}

const DirectionSelect = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: Direction
  onChange: (direction: Direction) => void
}) => (
  <Field>
    <FieldLabel className="text-xs text-muted-foreground">{label}</FieldLabel>
    <Select value={value} onValueChange={(next) => next && onChange(next as Direction)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {directionOrder.map((direction) => (
          <SelectItem key={direction} value={direction}>
            {direction}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
)
