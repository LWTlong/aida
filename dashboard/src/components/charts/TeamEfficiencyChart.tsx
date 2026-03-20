import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import type { DeveloperSummary } from '../../types'

interface Props {
  developers: DeveloperSummary[]
}

const colorPool = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#ec4899', '#f97316']

export function TeamEfficiencyChart({ developers }: Props) {
  if (developers.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">暂无团队数据</div>
  }

  const devs = developers.slice(0, 10)
  const names = devs.map((d) => d.name)

  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['完成任务', '偏差数', 'Bug 数'], textStyle: { color: '#6b7b8d' }, top: 0 },
    grid: { left: 20, right: 20, top: 40, bottom: 5, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: names,
      axisLabel: { color: '#6b7b8d', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e2d3d' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#6b7b8d' },
      splitLine: { lineStyle: { color: '#1e2d3d' } },
    },
    series: [
      {
        name: '完成任务',
        type: 'bar' as const,
        data: devs.map((d, i) => ({ value: d.completedTasks, itemStyle: { color: colorPool[i % colorPool.length] } })),
        barWidth: '20%',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '偏差数',
        type: 'bar' as const,
        data: devs.map((d) => ({ value: d.deviations, itemStyle: { color: '#f59e0b' } })),
        barWidth: '20%',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Bug 数',
        type: 'bar' as const,
        data: devs.map((d) => ({ value: d.bugs, itemStyle: { color: '#ef4444' } })),
        barWidth: '20%',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} />
}
