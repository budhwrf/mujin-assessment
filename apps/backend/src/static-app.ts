import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'

export const resolveStaticDir = (configured?: string) => {
  const directory = configured ?? process.env.STATIC_DIR
  if (!directory) return null
  const root = path.resolve(directory)
  return existsSync(root) ? root : null
}

export const registerStaticApp = (fastify: FastifyInstance, root: string) => {
  fastify.register(fastifyStatic, {
    root,
    wildcard: false,
  })

  fastify.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0] ?? '/'
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return reply.code(404).send({ message: 'Not found.' })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return reply.code(404).send({ message: 'Not found.' })
    }
    return reply.sendFile('index.html')
  })
}
