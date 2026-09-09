import type { FastifyPluginAsync } from 'fastify'
import { mapDocumentSchema } from '@mujin/map-domain'
import type { MapStore } from '../maps/store.js'

interface MapBody {
  id?: string
  name?: string
  document?: unknown
}

const readBody = (body: unknown) => {
  if (!body || typeof body !== 'object') return null
  const record = body as MapBody
  if (!record.document) return null
  const parsed = mapDocumentSchema.safeParse(record.document)
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((item) => item.message).join(' '),
    }
  }
  return {
    id: typeof record.id === 'string' ? record.id : undefined,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Untitled map',
    document: parsed.data,
  }
}

export const createMapRoutes = (store: MapStore): FastifyPluginAsync => {
  const routes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/api/health', async () => ({ status: 'ok' }))

    fastify.get('/api/maps', async () => {
      const maps = await store.list()
      return { maps }
    })

    fastify.get<{ Params: { id: string } }>('/api/maps/:id', async (request, reply) => {
      const map = await store.get(request.params.id)
      if (!map) {
        return reply.code(404).send({ message: 'Map not found.' })
      }
      return map
    })

    fastify.post<{ Body: unknown }>('/api/maps', async (request, reply) => {
      const body = readBody(request.body)
      if (!body || 'error' in body) {
        return reply.code(400).send({
          message: body && 'error' in body ? body.error : 'Map payload is invalid.',
        })
      }

      try {
        const created = await store.create(body)
        return reply.code(201).send(created)
      } catch {
        return reply.code(409).send({ message: 'A map with this id already exists.' })
      }
    })

    fastify.put<{ Params: { id: string }; Body: unknown }>(
      '/api/maps/:id',
      async (request, reply) => {
        const body = readBody(request.body)
        if (!body || 'error' in body) {
          return reply.code(400).send({
            message: body && 'error' in body ? body.error : 'Map payload is invalid.',
          })
        }

        const updated = await store.update(request.params.id, body)
        if (!updated) {
          return reply.code(404).send({ message: 'Map not found.' })
        }
        return updated
      },
    )

    fastify.delete<{ Params: { id: string } }>('/api/maps/:id', async (request, reply) => {
      const removed = await store.remove(request.params.id)
      if (!removed) {
        return reply.code(404).send({ message: 'Map not found.' })
      }
      return reply.code(204).send()
    })
  }

  return routes
}
