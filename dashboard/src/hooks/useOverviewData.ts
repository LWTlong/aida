import { useState, useEffect, useCallback } from 'react'
import type { IndexData } from '../types'
import { fetchOverview } from '../api'

export function useOverviewData() {
  const [data, setData] = useState<IndexData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchOverview()
    setData(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, reload: load }
}
