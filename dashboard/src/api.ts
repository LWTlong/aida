import type { RunSummary, RunData, RequirementData, IndexData } from './types'

const BASE = ''
export const isDemo = import.meta.env.VITE_DEMO === 'true'
const DEMO_BASE = `${import.meta.env.BASE_URL}demo`

function getDemoLocale(): string {
  try { return localStorage.getItem('aida-locale') || 'zh' } catch { return 'zh' }
}

function getDemoRunFile(): string {
  return `run.${getDemoLocale()}.json`
}

async function demoFetch<T>(file: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${DEMO_BASE}/${file}`)
    if (!res.ok) return fallback
    return res.json()
  } catch { return fallback }
}

export async function fetchRuns(): Promise<RunSummary[]> {
  if (isDemo) return demoFetch('runs.json', [])
  const res = await fetch(`${BASE}/api/runs`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchRunData(runId: string): Promise<RunData | null> {
  if (isDemo) return demoFetch(getDemoRunFile(), null)
  const res = await fetch(`${BASE}/api/runs/${runId}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchAggregatedData(): Promise<RunData | null> {
  if (isDemo) return demoFetch(getDemoRunFile(), null)
  const res = await fetch(`${BASE}/api/aggregate`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchOverview(): Promise<IndexData | null> {
  if (isDemo) return demoFetch('overview.json', null)
  const res = await fetch(`${BASE}/api/overview`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchRequirement(branch: string): Promise<RequirementData | null> {
  if (isDemo) return null
  const res = await fetch(`${BASE}/api/requirement/${encodeURIComponent(branch)}`)
  if (!res.ok) return null
  return res.json()
}

export async function updateRunCost(
  runId: string,
  updates: { estimatedManualHours?: number },
): Promise<boolean> {
  if (isDemo) return true
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
  if (isDemo) return true
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
  if (isDemo) return () => {}
  const es = new EventSource(`${BASE}/api/events`)
  es.onmessage = (e) => {
    try {
      onUpdate(JSON.parse(e.data))
    } catch { /* ignore */ }
  }
  return () => es.close()
}
