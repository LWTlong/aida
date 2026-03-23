import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import type { DeviationItem } from '../../types'
import { deviationCategoryLabel } from '../../labelMap'

interface Props {
  deviations: DeviationItem[]
}

const categoryColors: Record<string, string> = {
  'UI/间距': '#f59e0b',
  '布局/结构': '#3b82f6',
  '组件使用': '#a855f7',
  'i18n/国际化': '#06b6d4',
  '逻辑错误': '#ef4444',
  '流程/缓存': '#22c55e',
  '其他': '#94a3b8',
}

export function DeviationBar({ deviations }: Props) {
  const counts: Record<string, number> = {}
  for (const d of deviations) {
    const cat = deviationCategoryLabel(d.deviationCategory)
    counts[cat] = (counts[cat] || 0) + 1
  }

  if (Object.keys(counts).length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">暂无偏差数据</div>
  }

  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1])
  const categories = sorted.map(([c]) => c)
  const values = sorted.map(([c, v]) => ({
    value: v,
    itemStyle: { color: categoryColors[c] || '#94a3b8' },
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
