import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sampleMapDocument } from '@mujin/map-domain'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { createMapStore } from '../src/maps/store.js'

const directories: string[] = []

const createTestApp = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agv-maps-'))
  directories.push(directory)
  const store = createMapStore(directory)
  return buildApp({ store, logger: false })
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('map API', () => {
  it('keeps the health check and seeds the sample map', async () => {
    const app = await createTestApp()
    const health = await app.inject({ method: 'GET', url: '/' })
    expect(health.statusCode).toBe(200)
    expect(health.json()).toEqual({ hello: 'world' })

    const list = await app.inject({ method: 'GET', url: '/api/maps' })
    expect(list.statusCode).toBe(200)
    expect(list.json().maps[0].id).toBe('warehouse-map-01')
  })

  it('loads, updates, creates, and deletes maps', async () => {
    const app = await createTestApp()
    const loaded = await app.inject({ method: 'GET', url: '/api/maps/warehouse-map-01' })
    expect(loaded.statusCode).toBe(200)
    expect(loaded.json().document.map.nodes).toHaveLength(sampleMapDocument.map.nodes.length)

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/maps/warehouse-map-01',
      payload: {
        name: 'Warehouse-Map-01',
        document: {
          map: {
            maxNeighborDistance: 1500,
            nodes: [{ x: 10, y: 20, code: 1, directions: ['North'] }],
          },
        },
      },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json().document.map.nodes[0].x).toBe(10)

    const created = await app.inject({
      method: 'POST',
      url: '/api/maps',
      payload: {
        name: 'Spare map',
        document: sampleMapDocument,
      },
    })
    expect(created.statusCode).toBe(201)
    const createdId = created.json().id as string

    const removed = await app.inject({ method: 'DELETE', url: `/api/maps/${createdId}` })
    expect(removed.statusCode).toBe(204)

    const missing = await app.inject({ method: 'GET', url: `/api/maps/${createdId}` })
    expect(missing.statusCode).toBe(404)
  })

  it('rejects invalid payloads and unknown maps', async () => {
    const app = await createTestApp()
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/maps',
      payload: { document: { map: { maxNeighborDistance: 0, nodes: [] } } },
    })
    expect(invalid.statusCode).toBe(400)

    const missing = await app.inject({
      method: 'PUT',
      url: '/api/maps/missing',
      payload: { document: sampleMapDocument },
    })
    expect(missing.statusCode).toBe(404)

    const deleted = await app.inject({ method: 'DELETE', url: '/api/maps/missing' })
    expect(deleted.statusCode).toBe(404)
  })

  it('serves the editor and keeps the API under /api', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'agv-maps-'))
    const publicDir = await mkdtemp(path.join(os.tmpdir(), 'agv-app-'))
    directories.push(directory, publicDir)
    await writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>editor</title>', 'utf8')
    const store = createMapStore(directory)
    const app = buildApp({ store, logger: false, staticDir: publicDir })

    const page = await app.inject({ method: 'GET', url: '/' })
    expect(page.statusCode).toBe(200)
    expect(page.body).toContain('editor')

    const fallback = await app.inject({ method: 'GET', url: '/editor' })
    expect(fallback.statusCode).toBe(200)
    expect(fallback.body).toContain('editor')

    const health = await app.inject({ method: 'GET', url: '/api/health' })
    expect(health.statusCode).toBe(200)
    expect(health.json()).toEqual({ status: 'ok' })

    const missing = await app.inject({ method: 'GET', url: '/api/maps/missing' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toEqual({ message: 'Map not found.' })
  })
})
