import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  defaultMapId,
  defaultMapName,
  mapDocumentSchema,
  sampleMapDocument,
  savedMapSchema,
  toAssignmentDocument,
  type MapDocument,
} from '@mujin/map-domain'

export interface SavedMap {
  id: string
  name: string
  document: MapDocument
  updatedAt: string
}

const fileName = (id: string) => `${id}.json`
const metaName = (id: string) => `${id}.meta.json`
const isMapFile = (file: string) => file.endsWith('.json') && !file.endsWith('.meta.json')

export const createMapStore = (directory: string) => {
  const ensure = async () => {
    await mkdir(directory, { recursive: true })
    const files = await readdir(directory)
    if (files.length > 0) return

    await writeMap({
      id: defaultMapId,
      name: defaultMapName,
      document: sampleMapDocument,
      updatedAt: new Date().toISOString(),
    })
  }

  const writeMap = async (map: SavedMap) => {
    const document = toAssignmentDocument(map.document)
    const parsed = savedMapSchema.parse({ ...map, document })
    await writeFile(path.join(directory, fileName(parsed.id)), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    await writeFile(
      path.join(directory, metaName(parsed.id)),
      `${JSON.stringify({ name: parsed.name, updatedAt: parsed.updatedAt }, null, 2)}\n`,
      'utf8',
    )
    return parsed
  }

  const readMap = async (id: string) => {
    try {
      const raw = JSON.parse(await readFile(path.join(directory, fileName(id)), 'utf8')) as unknown
      const assignment = mapDocumentSchema.safeParse(raw)
      const wrapped = savedMapSchema.safeParse(raw)
      const document = assignment.success
        ? toAssignmentDocument(assignment.data)
        : wrapped.success
          ? toAssignmentDocument(wrapped.data.document)
          : null
      if (!document) return null

      let name = wrapped.success ? wrapped.data.name : defaultMapName
      let updatedAt = wrapped.success ? wrapped.data.updatedAt : new Date().toISOString()
      try {
        const meta = JSON.parse(await readFile(path.join(directory, metaName(id)), 'utf8')) as {
          name?: string
          updatedAt?: string
        }
        if (typeof meta.name === 'string' && meta.name.trim()) name = meta.name
        if (typeof meta.updatedAt === 'string') updatedAt = meta.updatedAt
      } catch {
        // Older files stored only the assignment document.
      }

      return savedMapSchema.parse({
        id,
        name,
        document,
        updatedAt,
      })
    } catch {
      return null
    }
  }

  return {
    ensure,
    list: async () => {
      await ensure()
      const files = await readdir(directory)
      const maps = await Promise.all(
        files
          .filter(isMapFile)
          .map((file) => readMap(file.replace(/\.json$/, ''))),
      )
      return maps
        .filter((map): map is SavedMap => map !== null)
        .map(({ document: _document, ...summary }) => summary)
        .sort((left, right) => left.name.localeCompare(right.name))
    },
    get: async (id: string) => {
      await ensure()
      return readMap(id)
    },
    create: async (input: { id?: string; name: string; document: MapDocument }) => {
      await ensure()
      const id = input.id?.trim() || `map-${Date.now()}`
      const existing = await readMap(id)
      if (existing) {
        throw new Error('A map with this id already exists.')
      }
      return writeMap({
        id,
        name: input.name,
        document: input.document,
        updatedAt: new Date().toISOString(),
      })
    },
    update: async (id: string, input: { name?: string; document: MapDocument }) => {
      await ensure()
      const existing = await readMap(id)
      if (!existing) return null
      return writeMap({
        id,
        name: input.name ?? existing.name,
        document: input.document,
        updatedAt: new Date().toISOString(),
      })
    },
    remove: async (id: string) => {
      await ensure()
      const existing = await readMap(id)
      if (!existing) return false
      await unlink(path.join(directory, fileName(id)))
      await unlink(path.join(directory, metaName(id))).catch(() => undefined)
      return true
    },
  }
}

export type MapStore = ReturnType<typeof createMapStore>
