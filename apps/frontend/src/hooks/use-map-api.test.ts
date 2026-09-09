import { describe, expect, it } from 'vitest'
import { sampleMapDocument } from '@mujin/map-domain'
import { parseImportedMap } from './use-map-api'

describe('parseImportedMap', () => {
  it('accepts a valid AGV map document', () => {
    const result = parseImportedMap(JSON.stringify(sampleMapDocument))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.map.nodes).toHaveLength(sampleMapDocument.map.nodes.length)
    }
  })

  it('rejects a document with the wrong shape', () => {
    const result = parseImportedMap(JSON.stringify({ nodes: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('valid AGV map document')
    }
  })

  it('rejects a document that fails map validation', () => {
    const result = parseImportedMap(
      JSON.stringify({
        map: {
          maxNeighborDistance: -1,
          nodes: [],
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBeTruthy()
    }
  })
})
