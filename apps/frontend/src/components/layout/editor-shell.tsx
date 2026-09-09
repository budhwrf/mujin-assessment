import { parseImportedMap, useConnectionStatus, useLoadMap, useMapAutosave, useSaveMap } from '@/hooks/use-map-api'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { mapsApi } from '@/api/maps'
import { MapCanvas } from '@/components/map/map-canvas'
import { NodeProperties } from '@/components/node/node-properties'
import { AppHeader } from '@/components/layout/app-header'
import { BottomPanel, type InspectorMode } from '@/components/layout/bottom-panel'
import { LeftSidebar } from '@/components/layout/left-sidebar'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { exportCurrentDocument, useMapEditorStore } from '@/store/map-editor-store'

export const EditorShell = () => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isLoadingMap, setIsLoadingMap] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [inspector, setInspector] = useState<InspectorMode>('open')
  const connection = useConnectionStatus()
  const loaded = useLoadMap()
  const save = useSaveMap()
  useMapAutosave()
  useKeyboardShortcuts()

  const commandOpen = useMapEditorStore((state) => state.commandOpen)
  const setCommandOpen = useMapEditorStore((state) => state.setCommandOpen)
  const renameOpen = useMapEditorStore((state) => state.renameOpen)
  const setRenameOpen = useMapEditorStore((state) => state.setRenameOpen)
  const deleteConfirmOpen = useMapEditorStore((state) => state.deleteConfirmOpen)
  const setDeleteConfirmOpen = useMapEditorStore((state) => state.setDeleteConfirmOpen)
  const helpOpen = useMapEditorStore((state) => state.helpOpen)
  const setHelpOpen = useMapEditorStore((state) => state.setHelpOpen)
  const nodeListOpen = useMapEditorStore((state) => state.nodeListOpen)
  const setNodeListOpen = useMapEditorStore((state) => state.setNodeListOpen)
  const mapName = useMapEditorStore((state) => state.mapName)
  const setMapName = useMapEditorStore((state) => state.setMapName)
  const deleteSelected = useMapEditorStore((state) => state.deleteSelected)
  const importDocument = useMapEditorStore((state) => state.importDocument)
  const loadSavedMap = useMapEditorStore((state) => state.loadSavedMap)
  const fitToScreen = useMapEditorStore((state) => state.fitToScreen)
  const selectedNodeId = useMapEditorStore((state) => state.selectedNodeId)
  const statusMessage = useMapEditorStore((state) => state.statusMessage)
  const setTool = useMapEditorStore((state) => state.setTool)
  const dirty = useMapEditorStore((state) => state.dirty)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1280)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useMapEditorStore.getState().dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    if (!statusMessage) return
    if (statusMessage.includes('Cannot') || statusMessage.includes('Invalid') || statusMessage.includes('apart')) {
      toast.error(statusMessage)
    } else {
      toast.success(statusMessage)
    }
  }, [statusMessage])

  useEffect(() => {
    if (!loaded.isError) return
    toast.message('Using the local sample map. The server has not responded yet.')
  }, [loaded.isError])

  const connectionState = connection.isPending
    ? 'connecting'
    : connection.isError
      ? 'disconnected'
      : 'connected'

  const importFile = async (file: File) => {
    try {
      const result = parseImportedMap(await file.text())
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      importDocument(result.document, file.name.replace(/\.json$/i, ''))
      requestAnimationFrame(() => fitToScreen())
      toast.success('Map imported')
    } catch {
      toast.error('Unable to import that file.')
    }
  }

  const reloadFromServer = async () => {
    if (isLoadingMap || save.isPending) return
    setIsLoadingMap(true)
    try {
      const saved = await mapsApi.get(useMapEditorStore.getState().mapId)
      loadSavedMap(saved)
      requestAnimationFrame(() => fitToScreen())
      toast.success('Map loaded')
    } catch {
      toast.error('Unable to load the map. The server could not be reached.')
    } finally {
      setIsLoadingMap(false)
    }
  }

  const saveMap = () => {
    if (isLoadingMap || save.isPending) return
    save.mutate()
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        connected={connectionState}
        onSave={saveMap}
        onImport={() => fileRef.current?.click()}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className={inspector === 'expanded' ? 'relative h-44 shrink-0' : 'relative min-h-0 flex-1'}>
            <MapCanvas />
            {narrow && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-3 right-16 z-10"
                onClick={() => setNodeListOpen(true)}
              >
                Properties
              </Button>
            )}
          </div>
          <BottomPanel
            mode={inspector}
            onModeChange={setInspector}
            onLoad={reloadFromServer}
            onSave={saveMap}
            isLoading={isLoadingMap}
            isSaving={save.isPending}
          />
        </div>
        {!narrow && (
          <aside className="h-full min-h-0 w-72 shrink-0 overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
            <NodeProperties />
          </aside>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importFile(file)
          event.currentTarget.value = ''
        }}
      />

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <Command>
          <CommandInput placeholder="Search commands" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Editor">
              <CommandItem onSelect={() => setTool('add-node')}>Add Node</CommandItem>
              <CommandItem onSelect={() => setTool('add-path')}>Add Path</CommandItem>
              <CommandItem onSelect={() => selectedNodeId && setDeleteConfirmOpen(true)}>Delete Node</CommandItem>
              <CommandItem onSelect={fitToScreen}>Fit to Screen</CommandItem>
              <CommandItem onSelect={() => useMapEditorStore.getState().resetView()}>Reset View</CommandItem>
              <CommandItem onSelect={() => fileRef.current?.click()}>Import Map</CommandItem>
              <CommandItem
                onSelect={() => {
                  const blob = new Blob([JSON.stringify(exportCurrentDocument(), null, 2)], {
                    type: 'application/json',
                  })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'agv-map.json'
                  link.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Export Map
              </CommandItem>
              <CommandItem onSelect={saveMap}>Save Map</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename map</DialogTitle>
            <DialogDescription>This name is stored with the map on the server.</DialogDescription>
          </DialogHeader>
          <Input
            defaultValue={mapName}
            aria-label="Map name"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setMapName(event.currentTarget.value)
                setRenameOpen(false)
              }
            }}
            id="map-name-input"
          />
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                const input = document.getElementById('map-name-input') as HTMLInputElement | null
                if (input) setMapName(input.value)
                setRenameOpen(false)
              }}
            >
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove its connected paths.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteSelected}>
              Delete Node
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Help</DialogTitle>
            <DialogDescription>
              North is positive X and West is positive Y. Paths are derived from node travel directions and cannot be diagonal.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Sheet open={narrow && (nodeListOpen || Boolean(selectedNodeId))} onOpenChange={setNodeListOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Node Properties</SheetTitle>
          </SheetHeader>
          <NodeProperties />
        </SheetContent>
      </Sheet>
      <span className="sr-only">{dirty ? 'Unsaved changes' : 'Saved'}</span>
    </div>
  )
}
