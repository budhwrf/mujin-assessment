import { mapDocumentSchema, validateDocument } from '@mujin/map-domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { mapsApi } from '@/api/maps'
import { exportCurrentDocument, useMapEditorStore } from '@/store/map-editor-store'

export const mapQueryKey = (id: string) => ['maps', id] as const

export const useConnectionStatus = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: mapsApi.health,
    refetchInterval: 15000,
    retry: 1,
  })

export const useLoadMap = () => {
  const loadSavedMap = useMapEditorStore((state) => state.loadSavedMap)
  const fitToScreen = useMapEditorStore((state) => state.fitToScreen)
  const loadedRef = useRef(false)
  const query = useQuery({
    queryKey: mapQueryKey('warehouse-map-01'),
    queryFn: () => mapsApi.get('warehouse-map-01'),
    retry: 1,
  })

  useEffect(() => {
    if (!query.data || loadedRef.current) return
    loadedRef.current = true
    loadSavedMap(query.data)
    requestAnimationFrame(() => fitToScreen())
  }, [query.data, loadSavedMap, fitToScreen])

  return query
}

export const useSaveMap = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const state = useMapEditorStore.getState()
      useMapEditorStore.getState().markSaving()
      return mapsApi.update(state.mapId, {
        name: state.mapName,
        document: exportCurrentDocument(),
      })
    },
    onSuccess: (saved) => {
      useMapEditorStore.getState().markSaved(saved.updatedAt)
      queryClient.setQueryData(mapQueryKey(saved.id), saved)
      toast.success('Map saved successfully')
    },
    onError: (error) => {
      useMapEditorStore.getState().markSaveError()
      toast.error(error instanceof ApiError ? error.message : 'Unable to save the map.')
    },
  })
}

export const useMapAutosave = () => {
  const dirty = useMapEditorStore((state) => state.dirty)
  const map = useMapEditorStore((state) => state.map)
  const mapName = useMapEditorStore((state) => state.mapName)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(async () => {
      const state = useMapEditorStore.getState()
      if (!state.dirty) return
      state.markSaving()
      try {
        const saved = await mapsApi.update(state.mapId, {
          name: state.mapName,
          document: exportCurrentDocument(),
        })
        useMapEditorStore.getState().markSaved(saved.updatedAt)
        queryClient.setQueryData(mapQueryKey(saved.id), saved)
      } catch (error) {
        useMapEditorStore.getState().markSaveError()
        toast.error(error instanceof ApiError ? error.message : 'Unable to save the map.')
      }
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [dirty, map, mapName, queryClient])
}

export const parseImportedMap = (raw: string) => {
  const json = JSON.parse(raw) as unknown
  const parsed = mapDocumentSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false as const, message: 'The file is not a valid AGV map document.' }
  }
  const result = validateDocument(parsed.data)
  if (!result.valid) {
    return { ok: false as const, message: result.errors[0]?.message ?? 'Map validation failed.' }
  }
  return { ok: true as const, document: parsed.data }
}
