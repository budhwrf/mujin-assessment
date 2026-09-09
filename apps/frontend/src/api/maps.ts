import type { MapDocument } from '@mujin/map-domain'
import { apiFetch } from './client'

export interface SavedMapSummary {
  id: string
  name: string
  updatedAt: string
}

export interface SavedMap extends SavedMapSummary {
  document: MapDocument
}

export const mapsApi = {
  list: () => apiFetch<{ maps: SavedMapSummary[] }>('/api/maps'),
  get: (id: string) => apiFetch<SavedMap>(`/api/maps/${id}`),
  create: (input: { name: string; document: MapDocument; id?: string }) =>
    apiFetch<SavedMap>('/api/maps', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: { name: string; document: MapDocument }) =>
    apiFetch<SavedMap>(`/api/maps/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<void>(`/api/maps/${id}`, { method: 'DELETE' }),
  health: () => apiFetch<{ status: string }>('/api/health'),
}
