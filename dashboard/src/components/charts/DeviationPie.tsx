import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import type { DeviationItem } from '../../types'
import { rootCauseLabel } from '../../labelMap'

interface Props {
  deviations: DeviationItem[]
}

const colorPool = ['#ef4444', '#f59e0b', '#06b6d4', '#a855f7', '#3b82f6', '#22c55e', '#f97316', '#ec4899']

export function DeviationPie({ deviations }: Props) {
  const { t } = useLocale()

  const counts: Record<string, number> = {}
  for (const d of deviations) {
    const cause = rootCauseLabel(d.rootCauseCategory, t)
    counts[cause] = (counts[cause] || 0) + 1
  }

  let ci = 0
  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      value,
      name,
      itemStyle: { color: colorPool[ci++ % colorPool.length] },
    }))

  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoDeviation}</div>
  }

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
