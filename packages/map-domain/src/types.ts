export const directions = ['North', 'South', 'East', 'West'] as const

export type Direction = (typeof directions)[number]

export interface Charger {
  direction: Direction
}

export interface Chute {
  direction: Direction
}

export interface AGVNode {
  x: number
  y: number
  code: number
  directions?: Direction[]
  charger?: Charger
  chute?: Chute
  name?: string
}

export interface AGVMap {
  maxNeighborDistance: number
  nodes: AGVNode[]
}

export interface MapDocument {
  map: AGVMap
}

export interface EditorNode extends AGVNode {
  id: string
}

export interface EditorMap {
  maxNeighborDistance: number
  nodes: EditorNode[]
}

export interface MapEdge {
  id: string
  fromId: string
  toId: string
  fromIndex: number
  toIndex: number
  direction: Direction
  distance: number
}

export interface Viewport {
  x: number
  y: number
  scale: number
  rotation: number
}

export interface Point {
  x: number
  y: number
}

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  code: string
  message: string
  nodeId?: string
  nodeIndex?: number
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface ConnectionCheck {
  ok: boolean
  message?: string
  direction?: Direction
  reverse?: Direction
  distance?: number
}

export type NodeKind = 'node' | 'charger' | 'chute'

export const defaultMapId = 'warehouse-map-01'
export const defaultMapName = 'Warehouse-Map-01'
