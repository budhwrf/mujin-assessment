const port = Number(process.env.PORT ?? 3000)

export const env = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number.isFinite(port) ? port : 3000,
  mapsDir: process.env.MAPS_DIR,
}
