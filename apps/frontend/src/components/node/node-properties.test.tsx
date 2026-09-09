import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NodeProperties } from '@/components/node/node-properties'
import { useMapEditorStore } from '@/store/map-editor-store'

describe('node properties', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows an empty state until a node is selected', () => {
    useMapEditorStore.setState({ selectedNodeId: null })
    render(<NodeProperties />)
    expect(screen.getByText('Select a node')).toBeTruthy()
  })

  it('shows charger controls for a charger node', () => {
    const charger = useMapEditorStore.getState().map.nodes.find((node) => node.name === 'CHRG1')
    expect(charger).toBeTruthy()
    useMapEditorStore.setState({ selectedNodeId: charger!.id })
    render(<NodeProperties />)
    expect(screen.getByPlaceholderText('Optional name')).toHaveProperty('value', 'CHRG1')
    expect(screen.getAllByText('Charger').length).toBeGreaterThan(0)
  })
})
