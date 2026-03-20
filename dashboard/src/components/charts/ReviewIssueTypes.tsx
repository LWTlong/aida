import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import type { ReviewItem } from '../../types'

interface Props {
  reviews: ReviewItem[]
}

const colorPool = ['#ef4444', '#f59e0b', '#3b82f6', '#a855f7', '#06b6d4', '#22c55e', '#ec4899', '#f97316']

export function ReviewIssueTypes({ reviews }: Props) {
  const issueCounts: Record<string, number> = {}
  for (const r of reviews) {
    if (r.issues) {
      for (const issue of r.issues) {
        const label = issue.length > 30 ? issue.slice(0, 30) + '...' : issue
        issueCounts[label] = (issueCounts[label] || 0) + 1
      }
    }
  }

  const entries = Object.entries(issueCounts).sort((a, b) => a[1] - b[1])
  if (entries.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">暂无自检问题数据</div>
  }

  const top = entries.slice(-10)
  const names = top.map(([k]) => k)
  const values = top.map(([, v]) => v)

  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' as const },
    grid: { left: 20, right: 30, top: 10, bottom: 5, containLabel: true },
    yAxis: {
      type: 'category' as const,
      data: names,
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
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: colorPool[i % colorPool.length],
          },
        })),
        label: { show: true, position: 'right' as const, color: '#94a3b8', fontSize: 11 },
        barWidth: '50%',
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: Math.max(250, top.length * 35) }} />
}
