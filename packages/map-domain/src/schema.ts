import { z } from 'zod'
import { directions } from './types.js'

export const directionSchema = z.enum(directions)

export const nodeSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  code: z.number().int(),
  directions: z.array(directionSchema).optional(),
  charger: z
    .object({
      direction: directionSchema,
    })
    .optional(),
  chute: z
    .object({
      direction: directionSchema,
    })
    .optional(),
  name: z.string().optional(),
})

export const mapSchema = z.object({
  maxNeighborDistance: z.number().positive(),
  nodes: z.array(nodeSchema),
})

export const mapDocumentSchema = z.object({
  map: mapSchema,
})

export const savedMapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  document: mapDocumentSchema,
  updatedAt: z.string(),
})
