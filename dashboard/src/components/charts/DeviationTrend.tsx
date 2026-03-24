import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import type { DeviationItem, RuleItem } from '../../types'

interface Props {
  deviations: DeviationItem[]
  rules: RuleItem[]
}

export function DeviationTrend({ deviations, rules }: Props) {
  const { t } = useLocale()

  if (deviations.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoTrend}</div>
  }

  const chunkSize = 4
  const groups: string[] = []
  const devCounts: number[] = []
  const ruleCumulative: number[] = []

  for (let i = 0; i < deviations.length; i += chunkSize) {
    const chunk = deviations.slice(i, i + chunkSize)
    const first = chunk[0]?.deviationId || ''
    const last = chunk[chunk.length - 1]?.deviationId || ''
    groups.push(first === last ? first : `${first}\n~${last}`)
    devCounts.push(chunk.length)
  }

  // Count rules sedimented up to each group
  const allDevIds = deviations.map((d) => d.deviationId)
  for (let g = 0; g < groups.length; g++) {
    const groupEnd = Math.min((g + 1) * chunkSize, deviations.length)
    const devsUpToGroup = new Set(allDevIds.slice(0, groupEnd))
    const cumRules = rules.filter((r) => r.status !== 'pending' && r.sourceDeviation && devsUpToGroup.has(r.sourceDeviation)).length
    ruleCumulative.push(cumRules)
  }

  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' as const },
    grid: { left: 20, right: 20, top: 30, bottom: 30, containLabel: true },
    legend: { data: [t.chartDeviationCount, t.chartAccumRules], textStyle: { color: '#6b7b8d' }, top: 0 },
    xAxis: {
      type: 'category' as const,
      data: groups,
      axisLabel: { color: '#6b7b8d', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e2d3d' } },
    },
    yAxis: [
      { type: 'value' as const, name: t.chartQuantity, axisLabel: { color: '#6b7b8d' }, splitLine: { lineStyle: { color: '#1e2d3d' } }, nameTextStyle: { color: '#6b7b8d' } },
      { type: 'value' as const, name: t.chartRules, axisLabel: { color: '#6b7b8d' }, splitLine: { show: false }, nameTextStyle: { color: '#6b7b8d' } },
    ],
    series: [
      {
        name: t.chartDeviationCount,
        type: 'bar' as const,
        data: devCounts,
        itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
        barWidth: '40%',
      },
      {
        name: t.chartAccumRules,
        type: 'line' as const,
        yAxisIndex: 1,
        data: ruleCumulative,
        lineStyle: { color: '#22c55e', width: 2 },
        itemStyle: { color: '#22c55e' },
        symbol: 'circle',
        symbolSize: 8,
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} />
}
