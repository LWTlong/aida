import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import type { DeviationItem, BugItem } from '../../types'

interface Props {
  deviations: DeviationItem[]
  bugs: BugItem[]
}

const NON_SOURCE_EXT = /\.(md|mdx|txt|docx|doc|pdf|png|jpg|jpeg|svg|ico)$/i

function isSourceFile(f: string): boolean {
  return !!f && !NON_SOURCE_EXT.test(f)
}

export function FileHotspot({ deviations, bugs }: Props) {
  const counts: Record<string, number> = {}

  for (const d of deviations) {
    if (d.files) {
      for (const f of d.files) {
        if (isSourceFile(f)) counts[f] = (counts[f] || 0) + 1
      }
    }
  }
  for (const b of bugs) {
    if (b.files) {
      for (const f of b.files) {
        if (isSourceFile(f)) counts[f] = (counts[f] || 0) + 1
      }
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1])
  const files = sorted.map(([f]) => f)
  const values = sorted.map(([, v]) => v)

  if (files.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">暂无文件热点数据</div>
  }

  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' as const },
    grid: { left: 20, right: 30, top: 10, bottom: 5, containLabel: true },
    yAxis: {
      type: 'category' as const,
      data: files,
      axisLabel: { color: '#6b7b8d', fontSize: 10 },
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
        data: values.map((v) => ({
          value: v,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: v >= 10 ? '#ef4444' : v >= 5 ? '#f59e0b' : v >= 3 ? '#3b82f6' : '#22c55e',
          },
        })),
        label: { show: true, position: 'right' as const, color: '#94a3b8', fontSize: 11 },
        barWidth: '50%',
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: Math.max(200, files.length * 30) }} />
}
