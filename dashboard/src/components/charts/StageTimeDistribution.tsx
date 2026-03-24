import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import { stageLabel } from '../../labelMap'
import type { WorkflowStage } from '../../types'

interface Props {
  workflow: WorkflowStage[]
}

const stageColors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#ec4899', '#f97316']

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

export function StageTimeDistribution({ workflow }: Props) {
  const { t } = useLocale()
  const stageTime: Record<string, number> = {}
  for (const w of workflow) {
    if (w.startTime && w.endTime) {
      const dur = (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 1000
      if (dur > 0) {
        stageTime[w.stage] = (stageTime[w.stage] || 0) + dur
      }
    }
  }

  const entries = Object.entries(stageTime).filter(([, v]) => v > 0)
  if (entries.length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoStageTime}</div>
  }

  const data = entries.map(([name, value], i) => ({
    name: stageLabel(name, t),
    value: Math.round(value),
    itemStyle: { color: stageColors[i % stageColors.length] },
  }))

  const option = {
    ...darkTheme,
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}: ${formatSeconds(p.value)} (${p.percent.toFixed(1)}%)`,
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['42%', '70%'],
        center: ['50%', '52%'],
        label: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (p: { name: string; percent: number }) => `${p.name}\n${p.percent.toFixed(1)}%`,
        },
        data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} />
}
