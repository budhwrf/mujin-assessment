import { describe, expect, it } from 'vitest'
import { sampleMapDocument } from '@mujin/map-domain'
import { useMapEditorStore } from './map-editor-store'

const reset = () => {
  useMapEditorStore.setState(useMapEditorStore.getInitialState())
}

describe('map editor store', () => {
  it('loads the sample map and can edit a node', () => {
    reset()
    const node = useMapEditorStore.getState().map.nodes[0]
    expect(node).toBeDefined()
    useMapEditorStore.getState().updateNode(node!.id, { name: 'ORIGIN' })
    expect(useMapEditorStore.getState().map.nodes[0]?.name).toBe('ORIGIN')
    useMapEditorStore.getState().undo()
    expect(useMapEditorStore.getState().map.nodes[0]?.name).toBeUndefined()
    useMapEditorStore.getState().redo()
    expect(useMapEditorStore.getState().map.nodes[0]?.name).toBe('ORIGIN')
  })

  it('adds a node and deletes it', () => {
    reset()
    const id = useMapEditorStore.getState().addNodeAt(5000, 5000)
    expect(id).toBeTruthy()
    expect(useMapEditorStore.getState().selectedNodeId).toBe(id)
    useMapEditorStore.getState().deleteSelected()
    expect(useMapEditorStore.getState().map.nodes.some((node) => node.id === id)).toBe(false)
  })

  it('rejects a diagonal path and accepts an axis-aligned path', () => {
    reset()
    const nodes = useMapEditorStore.getState().map.nodes
    const first = nodes.find((node) => node.x === 1000 && node.y === 1000)
    const diagonalTarget = nodes.find((node) => node.x !== first?.x && node.y !== first?.y)
    expect(first && diagonalTarget).toBeTruthy()
    useMapEditorStore.getState().startOrCompletePath(first!.id)
    const diagonal = useMapEditorStore.getState().startOrCompletePath(diagonalTarget!.id)
    expect(diagonal).toContain('diagonally')

    const sameAxis = useMapEditorStore
      .getState()
      .map.nodes.find((node) => node.x === first!.x && node.id !== first!.id)
    expect(sameAxis).toBeTruthy()
    useMapEditorStore.getState().startOrCompletePath(first!.id)
    const created = useMapEditorStore.getState().startOrCompletePath(sameAxis!.id)
    expect(created).toBeNull()
    expect(useMapEditorStore.getState().statusMessage).toBe('Path created')
  })

  it('does not store viewport changes in undo history', () => {
    reset()
    const before = useMapEditorStore.getState().history.length
    useMapEditorStore.getState().zoomAt(1.2)
    expect(useMapEditorStore.getState().history.length).toBe(before)
  })

  it('toggles a direction on and off', () => {
    reset()
    const node = useMapEditorStore.getState().map.nodes[0]
    expect(node).toBeDefined()
    useMapEditorStore.getState().toggleDirection(node!.id, 'South')
    expect(useMapEditorStore.getState().map.nodes[0]?.directions).toContain('South')
    useMapEditorStore.getState().toggleDirection(node!.id, 'South')
    expect(useMapEditorStore.getState().map.nodes[0]?.directions).not.toContain('South')
  })

  it('deletes a selected path from both nodes', () => {
    reset()
    const nodes = useMapEditorStore.getState().map.nodes
    const first = nodes.find((node) => node.x === 1000 && node.y === 1000)
    const second = nodes.find((node) => node.x === 1000 && node.y === 1900)
    expect(first && second).toBeTruthy()

    useMapEditorStore.getState().startOrCompletePath(first!.id)
    useMapEditorStore.getState().startOrCompletePath(second!.id)

    const selectedPathId = useMapEditorStore.getState().selectedPathId
    expect(selectedPathId).toBeTruthy()

    useMapEditorStore.setState({ selectedPathId })
    useMapEditorStore.getState().deleteSelected()

    const updatedNodes = useMapEditorStore.getState().map.nodes
    expect(updatedNodes.find((node) => node.id === first!.id)?.directions).not.toContain('West')
    expect(updatedNodes.find((node) => node.id === second!.id)?.directions).not.toContain('East')
    expect(useMapEditorStore.getState().statusMessage).toBe('Path deleted')
  })

  it('rejects committing a node move onto an occupied coordinate', () => {
    reset()
    const [first, second] = useMapEditorStore.getState().map.nodes
    expect(first && second).toBeTruthy()

    useMapEditorStore.getState().beginNodeMove(first!.id)
    useMapEditorStore.getState().moveNode(first!.id, second!.x, second!.y, true)

    const restored = useMapEditorStore.getState().map.nodes.find((node) => node.id === first!.id)
    expect(restored?.x).toBe(first!.x)
    expect(restored?.y).toBe(first!.y)
    expect(useMapEditorStore.getState().statusMessage).toContain('Cannot place two nodes')
  })

  it('loads and imports documents with the expected save state', () => {
    reset()

    useMapEditorStore.getState().loadSavedMap({
      id: 'saved-map',
      name: 'Saved Map',
      document: sampleMapDocument,
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(useMapEditorStore.getState().mapId).toBe('saved-map')
    expect(useMapEditorStore.getState().mapName).toBe('Saved Map')
    expect(useMapEditorStore.getState().dirty).toBe(false)
    expect(useMapEditorStore.getState().saveStatus).toBe('saved')

    useMapEditorStore.getState().importDocument(sampleMapDocument, 'Imported Map')
    expect(useMapEditorStore.getState().mapName).toBe('Imported Map')
    expect(useMapEditorStore.getState().dirty).toBe(true)
    expect(useMapEditorStore.getState().statusMessage).toBe('Map imported')
  })

  it('focuses a node and centers the viewport around it', () => {
    reset()
    const node = useMapEditorStore.getState().map.nodes.find((item) => item.name === 'CHRG1')
    expect(node).toBeTruthy()

    useMapEditorStore.getState().focusNode(node!.id)

    const state = useMapEditorStore.getState()
    expect(state.selectedNodeId).toBe(node!.id)
    expect(state.viewport.scale).toBeGreaterThanOrEqual(0.35)
  })
})
