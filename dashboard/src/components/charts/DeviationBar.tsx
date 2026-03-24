import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import type { DeviationItem } from '../../types'
import { deviationCategoryLabel } from '../../labelMap'

interface Props {
  deviations: DeviationItem[]
}

const rawCategoryColors: Record<string, string> = {
  'ui-spacing': '#f59e0b',
  'layout': '#3b82f6',
  'component-usage': '#a855f7',
  'i18n': '#06b6d4',
  'logic': '#ef4444',
  'process': '#22c55e',
  'other': '#94a3b8',
}

export function DeviationBar({ deviations }: Props) {
  const { t } = useLocale()

  const counts: Record<string, number> = {}
  const labelToRawKey: Record<string, string> = {}
  for (const d of deviations) {
    const cat = deviationCategoryLabel(d.deviationCategory, t)
    counts[cat] = (counts[cat] || 0) + 1
    labelToRawKey[cat] = d.deviationCategory
  }

  if (Object.keys(counts).length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoDeviation}</div>
  }

  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1])
  const categories = sorted.map(([c]) => c)
  const values = sorted.map(([c, v]) => ({
    value: v,
    itemStyle: { color: rawCategoryColors[labelToRawKey[c]] || '#94a3b8' },
  }))

  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' as const },
    grid: { left: 20, right: 20, top: 10, bottom: 5, containLabel: true },
    yAxis: {
      type: 'category' as const,
      data: categories,
      axisLabel: { color: '#6b7b8d', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e2d3d' } },
    },
    xAxis: {
      type: 'value' as const,
      axisLabel: { color: '#6b7b8d' },
      splitLine: { lineStyle: { color: '#1e2d3d' } },
    },
    series: [
      {
        type: 'bar' as const,
        data: values,
        label: { show: true, position: 'right' as const, color: '#94a3b8', fontSize: 12 },
        barWidth: '45%',
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} />
}
