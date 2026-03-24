import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import type { BugItem } from '../../types'

interface Props {
  bugs: BugItem[]
}

const severityColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
}

export function BugSeverityChart({ bugs }: Props) {
  const { t } = useLocale()

  const severityLabels: Record<string, string> = {
    critical: t.bugCritical,
    high: t.bugHigh,
    medium: t.bugMedium,
    low: t.bugLow,
  }

  const counts: Record<string, number> = {}
  for (const b of bugs) {
    counts[b.severity] = (counts[b.severity] || 0) + 1
  }

  const entries = Object.entries(counts)
  if (entries.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoBug}</div>
  }

  const order = ['critical', 'high', 'medium', 'low']
  const data = order
    .filter((s) => counts[s])
    .map((s) => ({
      name: severityLabels[s] || s,
      value: counts[s],
      itemStyle: { color: severityColors[s] || '#94a3b8' },
    }))

  const option = {
    ...darkTheme,
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie' as const,
        radius: ['42%', '70%'],
        center: ['50%', '52%'],
        label: { color: '#94a3b8', fontSize: 12 },
        data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} />
}
