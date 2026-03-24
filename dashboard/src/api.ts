import type { RunSummary, RunData, RequirementData, IndexData } from './types'

const BASE = ''

export async function fetchRuns(): Promise<RunSummary[]> {
  const res = await fetch(`${BASE}/api/runs`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchRunData(runId: string): Promise<RunData | null> {
  const res = await fetch(`${BASE}/api/runs/${runId}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchAggregatedData(): Promise<RunData | null> {
  const res = await fetch(`${BASE}/api/aggregate`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchOverview(): Promise<IndexData | null> {
  const res = await fetch(`${BASE}/api/overview`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchRequirement(branch: string): Promise<RequirementData | null> {
  const res = await fetch(`${BASE}/api/requirement/${encodeURIComponent(branch)}`)
  if (!res.ok) return null
  return res.json()
}

export async function updateRunCost(
  runId: string,
  updates: { estimatedManualHours?: number },
): Promise<boolean> {
  const res = await fetch(`${BASE}/api/runs/${runId}/cost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) return false
  const data = await res.json()
  return data.success === true
}

export async function updateConfig(
  updates: { hourlyRate?: number },
): Promise<boolean> {
  const res = await fetch(`${BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) return false
  const data = await res.json()
  return data.success === true
}

export function subscribeSSE(onUpdate: (data: unknown) => void): () => void {
  const es = new EventSource(`${BASE}/api/events`)
  es.onmessage = (e) => {
    try {
      onUpdate(JSON.parse(e.data))
    } catch { /* ignore */ }
  }
  return () => es.close()
}
