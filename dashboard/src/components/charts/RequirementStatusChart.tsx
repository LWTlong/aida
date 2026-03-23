import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import type { IndexRunEntry } from '../../types'

interface Props {
  runs: IndexRunEntry[]
}

const statusColors: Record<string, string> = {
  completed: '#22c55e',
  'in-progress': '#f59e0b',
  pending: '#6b7b8d',
  failed: '#ef4444',
}

const statusLabels: Record<string, string> = {
  completed: '已完成',
  'in-progress': '进行中',
  'in_progress': '进行中',
  pending: '待开始',
  failed: '失败',
}

export function RequirementStatusChart({ runs }: Props) {
  const counts: Record<string, number> = {}
  for (const r of runs) {
    const status = r.status || 'pending'
    counts[status] = (counts[status] || 0) + 1
  }

  const entries = Object.entries(counts)
  if (entries.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">暂无需求数据</div>
  }

  const data = entries.map(([status, value]) => ({
    name: statusLabels[status] || status,
    value,
    itemStyle: { color: statusColors[status] || '#94a3b8' },
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
