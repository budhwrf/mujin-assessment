import { buildApp } from './app.js'
import { env } from './config/env.js'

const start = async () => {
  const fastify = buildApp()

  try {
    await fastify.listen({ host: env.host, port: env.port })
  } catch (error) {
    fastify.log.error(error)
    process.exit(1)
  }
}

start()
