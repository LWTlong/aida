import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import type { ReviewItem } from '../../types'

interface Props {
  reviews: ReviewItem[]
}

export function FirstPassRateTrend({ reviews }: Props) {
  if (reviews.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">暂无自检数据</div>
  }

  const chunkSize = 3
  const groups: string[] = []
  const rates: number[] = []

  for (let i = 0; i < reviews.length; i += chunkSize) {
    const chunk = reviews.slice(i, i + chunkSize)
    const first = chunk[0]?.reviewId || ''
    const last = chunk[chunk.length - 1]?.reviewId || ''
    groups.push(first === last ? first : `${first}~${last}`)
    const passCount = chunk.filter((r) => r.result === 'pass').length
    rates.push(Math.round((passCount / chunk.length) * 100))
  }

  const option = {
    ...darkTheme,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: { name: string; value: number }[]) => {
        const p = Array.isArray(params) ? params[0] : params
        return `${p.name}: ${p.value}%`
      },
    },
    grid: { left: 20, right: 20, top: 30, bottom: 30, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: groups,
      axisLabel: { color: '#6b7b8d', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e2d3d' } },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      axisLabel: { color: '#6b7b8d', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1e2d3d' } },
    },
    series: [
      {
        type: 'line' as const,
        data: rates,
        smooth: true,
        lineStyle: { color: '#22c55e', width: 2 },
        itemStyle: { color: '#22c55e' },
        symbol: 'circle',
        symbolSize: 8,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34,197,94,0.25)' },
              { offset: 1, color: 'rgba(34,197,94,0.02)' },
            ],
          },
        },
        markLine: {
          silent: true,
          data: [{ yAxis: 80, label: { formatter: '80%', color: '#6b7b8d', fontSize: 10 }, lineStyle: { color: '#f59e0b', type: 'dashed' } }],
        },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} />
}
