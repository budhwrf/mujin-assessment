import type { FastifyPluginAsync } from 'fastify'
import type { MapStore } from '../maps/store.js'
import { createMapRoutes } from './maps.route.js'
import { rootRoutes } from './root.route.js'

export const routes: FastifyPluginAsync<{ store: MapStore; serveApp?: boolean }> = async (
  fastify,
  options,
) => {
  if (!options.serveApp) {
    await fastify.register(rootRoutes)
  }
  await fastify.register(createMapRoutes(options.store))
}
