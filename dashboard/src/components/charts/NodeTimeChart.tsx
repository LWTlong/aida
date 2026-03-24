import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import { stageLabel } from '../../labelMap'
import type { RunMetrics } from '../../types'

interface Props {
  metrics: RunMetrics
}

const colorPool = ['#3b82f6', '#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#22c55e', '#ec4899', '#f97316']

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

export function NodeTimeChart({ metrics }: Props) {
  const { t } = useLocale()

  const breakdown = metrics.nodeTimeBreakdown
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoNodeTime}</div>
  }

  const sorted = Object.entries(breakdown).sort((a, b) => a[1] - b[1])
  const names = sorted.map(([k]) => stageLabel(k, t))
  const values = sorted.map(([, v]) => v)

  const option = {
    ...darkTheme,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params]
        const idx = list[0]?.dataIndex
        if (idx == null) return ''
        return `<b>${names[idx]}</b><br/>${t.tipDuration}: ${formatSeconds(values[idx])}`
      },
    },
    grid: { left: 20, right: 60, top: 10, bottom: 5, containLabel: true },
    yAxis: {
      type: 'category' as const,
      data: names,
      axisLabel: { color: '#6b7b8d', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e2d3d' } },
    },
    xAxis: {
      type: 'value' as const,
      axisLabel: { color: '#6b7b8d', formatter: (v: number) => formatSeconds(v) },
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
        label: {
          show: true,
          position: 'right' as const,
          color: '#94a3b8',
          fontSize: 10,
          formatter: (p: { value: number }) => formatSeconds(p.value),
        },
        barWidth: '50%',
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: Math.max(200, names.length * 45) }} />
}
