import { uniqueDirections } from './directions.js'
import { deriveEdges } from './graph.js'
import { mapDocumentSchema, mapSchema } from './schema.js'
import type { AGVMap, EditorMap, ValidationIssue, ValidationResult } from './types.js'

const readNodeId = (node: AGVMap['nodes'][number] | { id?: string }): string | undefined =>
  typeof (node as { id?: unknown }).id === 'string' ? (node as { id: string }).id : undefined

const issue = (
  severity: ValidationIssue['severity'],
  code: string,
  message: string,
  extra?: Pick<ValidationIssue, 'nodeId' | 'nodeIndex'>,
): ValidationIssue => ({
  severity,
  code,
  message,
  ...extra,
})

export const validateMap = (input: unknown): ValidationResult => {
  const parsed = mapSchema.safeParse(input)
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((item) =>
        issue('error', 'schema', item.message),
      ),
      warnings: [],
    }
  }

  return validateParsedMap(parsed.data)
}

export const validateDocument = (input: unknown): ValidationResult => {
  const parsed = mapDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((item) =>
        issue('error', 'schema', item.message),
      ),
      warnings: [],
    }
  }

  return validateParsedMap(parsed.data.map)
}

export const validateParsedMap = (map: AGVMap | EditorMap): ValidationResult => {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const coordinates = new Map<string, number>()
  const codes = new Map<number, number>()

  map.nodes.forEach((node, index) => {
    const nodeId = readNodeId(node)
    const key = `${node.x},${node.y}`
    const previous = coordinates.get(key)
    if (previous !== undefined) {
      errors.push(
        issue(
          'error',
          'duplicate-coordinate',
          `Nodes ${previous + 1} and ${index + 1} share coordinates ${node.x}, ${node.y}.`,
          { nodeId, nodeIndex: index },
        ),
      )
    } else {
      coordinates.set(key, index)
    }

    const codeCount = codes.get(node.code) ?? 0
    codes.set(node.code, codeCount + 1)

    const directions = node.directions ?? []
    if (new Set(directions).size !== directions.length) {
      warnings.push(
        issue('warning', 'duplicate-direction', 'Duplicate travel directions were ignored.', {
          nodeId,
          nodeIndex: index,
        }),
      )
    }

    if (node.charger && node.chute) {
      warnings.push(
        issue(
          'warning',
          'charger-and-chute',
          'This node is both a charger and a chute. The charger marker takes precedence.',
          { nodeId, nodeIndex: index },
        ),
      )
    }
  })

  for (const [code, count] of codes) {
    if (count > 1 && code !== 0) {
      warnings.push(
        issue(
          'warning',
          'duplicate-code',
          `QR code ${code} is used by ${count} nodes.`,
        ),
      )
    }
  }

  const edges = deriveEdges(map)
  const connected = new Set(edges.flatMap((edge) => [edge.fromId]))
  map.nodes.forEach((node, index) => {
    const directions = uniqueDirections(node.directions)
    if (directions.length === 0) return
    const nodeId = readNodeId(node) ?? `node-${index}`
    const hasEdge = edges.some((edge) => edge.fromId === nodeId)
    if (!hasEdge && !connected.has(nodeId)) {
      warnings.push(
        issue(
          'warning',
          'orphan-direction',
          'A travel direction has no neighbor within the maximum distance.',
          { nodeId, nodeIndex: index },
        ),
      )
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
