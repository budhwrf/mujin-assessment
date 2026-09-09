import { useEffect } from 'react'
import { useMapEditorStore } from '@/store/map-editor-store'

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export const useKeyboardShortcuts = () => {
  const setTool = useMapEditorStore((state) => state.setTool)
  const cancelOperation = useMapEditorStore((state) => state.cancelOperation)
  const deleteSelected = useMapEditorStore((state) => state.deleteSelected)
  const selectedNodeId = useMapEditorStore((state) => state.selectedNodeId)
  const selectedPathId = useMapEditorStore((state) => state.selectedPathId)
  const setDeleteConfirmOpen = useMapEditorStore((state) => state.setDeleteConfirmOpen)
  const undo = useMapEditorStore((state) => state.undo)
  const redo = useMapEditorStore((state) => state.redo)
  const zoomAt = useMapEditorStore((state) => state.zoomAt)
  const resetView = useMapEditorStore((state) => state.resetView)
  const fitToScreen = useMapEditorStore((state) => state.fitToScreen)
  const rotateMap = useMapEditorStore((state) => state.rotateMap)
  const setCommandOpen = useMapEditorStore((state) => state.setCommandOpen)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
        return
      }
      if (isTypingTarget(event.target)) return

      if (meta && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        redo()
        return
      }
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if (event.key === 'Escape') cancelOperation()
      if (event.key === 'v' || event.key === 'V') setTool('select')
      if (event.key === 'n' || event.key === 'N') setTool('add-node')
      if (event.key === 'p' || event.key === 'P') setTool('add-path')
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedPathId) deleteSelected()
        else if (selectedNodeId) setDeleteConfirmOpen(true)
      }
      if (event.key === '+' || event.key === '=') zoomAt(1.12)
      if (event.key === '-' || event.key === '_') zoomAt(0.9)
      if (event.key === '0') resetView()
      if (event.key === 'f' || event.key === 'F') fitToScreen()
      if (event.key === 'r' || event.key === 'R') rotateMap()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    cancelOperation,
    deleteSelected,
    fitToScreen,
    redo,
    resetView,
    rotateMap,
    selectedNodeId,
    selectedPathId,
    setCommandOpen,
    setDeleteConfirmOpen,
    setTool,
    undo,
    zoomAt,
  ])
}
