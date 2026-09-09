import path from 'node:path'
import Fastify from 'fastify'
import { createMapStore, type MapStore } from './maps/store.js'
import { routes } from './routes/index.js'
import { registerStaticApp, resolveStaticDir } from './static-app.js'

export interface BuildAppOptions {
  store?: MapStore
  logger?: boolean
  staticDir?: string
}

export const buildApp = (options: BuildAppOptions = {}) => {
  const fastify = Fastify({
    logger: options.logger ?? true,
  })

  const store =
    options.store ??
    createMapStore(process.env.MAPS_DIR ?? path.resolve(process.cwd(), 'data'))

  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin)
      reply.header('Vary', 'Origin')
    }
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type')
    if (request.method === 'OPTIONS') {
      return reply.code(204).send()
    }
  })

  fastify.addHook('onReady', async () => {
    await store.ensure()
  })

  const staticDir = resolveStaticDir(options.staticDir)

  fastify.register(routes, { store, serveApp: Boolean(staticDir) })
  if (staticDir) {
    registerStaticApp(fastify, staticDir)
  }

  return fastify
}
