import type { FastifyPluginAsync } from 'fastify'

export const rootRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return { hello: 'world' }
  })
}
