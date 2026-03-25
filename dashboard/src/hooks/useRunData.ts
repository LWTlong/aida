import { useState, useEffect, useCallback, useRef } from 'react'
import type { RunSummary, RunData } from '../types'
import { fetchRuns, fetchRunData, fetchAggregatedData, isDemo } from '../api'

export const ALL_PROJECT_ID = '__all__'

export function useRunData() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [currentRunId, setCurrentRunId] = useState<string>('')
  const [runData, setRunData] = useState<RunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(isDemo)
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRuns = useCallback(async () => {
    const list = await fetchRuns()
    setRuns(list)
    if (list.length > 0 && !currentRunId) {
      setCurrentRunId(list[0].runId)
    } else if (list.length === 0) {
      setLoading(false)
    }
  }, [currentRunId])

  const loadRunData = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    const data = id === ALL_PROJECT_ID ? await fetchAggregatedData() : await fetchRunData(id)
    setRunData(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (currentRunId) loadRunData(currentRunId)
  }, [currentRunId, loadRunData])

  // SSE with reconnect (skip in demo mode)
  useEffect(() => {
    if (isDemo) return
    function connect() {
      if (esRef.current) {
        esRef.current.close()
      }
      const es = new EventSource('/api/events')
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as { type: string }
          if (event.type === 'connected') {
            setConnected(true)
          } else if (event.type === 'run_updated') {
            loadRuns()
            if (currentRunId) loadRunData(currentRunId)
          }
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        esRef.current = null
        // Reconnect after 3 seconds
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (esRef.current) esRef.current.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [currentRunId, loadRuns, loadRunData])

  const refresh = useCallback(() => {
    loadRuns()
    if (currentRunId) loadRunData(currentRunId)
  }, [currentRunId, loadRuns, loadRunData])

  return { runs, currentRunId, setCurrentRunId, runData, loading, connected, refresh }
}
