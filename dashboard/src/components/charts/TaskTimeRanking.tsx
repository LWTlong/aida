import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import type { TaskItem } from '../../types'

interface Props {
  tasks: TaskItem[]
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

export function TaskTimeRanking({ tasks }: Props) {
  const { t } = useLocale()

  const timed = tasks
    .filter((t) => t.startedAt && t.completedAt)
    .map((t) => ({
      id: t.taskId,
      title: t.title,
      seconds: (new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime()) / 1000,
    }))
    .filter((t) => t.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10)

  if (timed.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoTaskTime}</div>
  }

  const reversed = [...timed].reverse()
  const names = reversed.map((t) => `${t.id} ${t.title.length > 12 ? t.title.slice(0, 12) + '...' : t.title}`)
  const values = reversed.map((t) => t.seconds)

  const option = {
    ...darkTheme,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: { name: string; value: number }[]) => {
        const p = Array.isArray(params) ? params[0] : params
        const task = reversed.find((t) => p.name.startsWith(t.id))
        return `${task?.title || p.name}: ${formatSeconds(p.value)}`
      },
    },
    grid: { left: 20, right: 40, top: 10, bottom: 5, containLabel: true },
    yAxis: {
      type: 'category' as const,
      data: names,
      axisLabel: { color: '#6b7b8d', fontSize: 10 },
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
        data: values.map((v) => ({
          value: v,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: v >= 3600 ? '#ef4444' : v >= 1800 ? '#f59e0b' : v >= 600 ? '#3b82f6' : '#22c55e',
          },
        })),
        label: {
          show: true,
          position: 'right' as const,
          color: '#94a3b8',
          fontSize: 11,
          formatter: (p: { value: number }) => formatSeconds(p.value),
        },
        barWidth: '50%',
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: Math.max(250, timed.length * 35) }} />
}
