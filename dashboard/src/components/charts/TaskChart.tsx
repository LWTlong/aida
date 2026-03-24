import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import { stageLabel } from '../../labelMap'
import type { TaskItem } from '../../types'

interface Props {
  tasks: TaskItem[]
  prdPhases?: string[]
}

const prdColorList: [string, string][] = [
  ['#1d4ed8', '#60a5fa'],
  ['#7c3aed', '#c084fc'],
  ['#16a34a', '#4ade80'],
  ['#b45309', '#fbbf24'],
  ['#dc2626', '#f87171'],
]

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

export function TaskChart({ tasks, prdPhases }: Props) {
  const { t } = useLocale()

  // Group tasks by stageName, preserve order of appearance
  const stageOrder: string[] = []
  const stageMap: Record<string, { count: number; prd: string; seconds: number }> = {}

  for (const tk of tasks) {
    const stage = tk.stageName || t.stageUncategorized
    if (!stageMap[stage]) {
      stageOrder.push(stage)
      stageMap[stage] = { count: 0, prd: tk.prdPhase || '', seconds: 0 }
    }
    stageMap[stage].count++
    if (tk.startedAt && tk.completedAt) {
      stageMap[stage].seconds += (new Date(tk.completedAt).getTime() - new Date(tk.startedAt).getTime()) / 1000
    }
  }

  // Build prd → color mapping
  const prdColors: Record<string, [string, string]> = {}
  const phases = prdPhases || [...new Set(tasks.map((t) => t.prdPhase).filter(Boolean))]
  phases.forEach((p, i) => {
    prdColors[p] = prdColorList[i % prdColorList.length]
  })

  const names = stageOrder.map((s) => stageLabel(s, t))
  const data = stageOrder.map((s) => stageMap[s].count)
  const reversedNames = [...names].reverse()

  const option = {
    ...darkTheme,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any[]) => {
        const p = Array.isArray(params) ? params[0] : params
        const idx = stageOrder.length - 1 - reversedNames.indexOf(p.name)
        const stage = stageOrder[idx]
        const info = stageMap[stage]
        let tip = `<b>${p.name}</b><br/>${t.tipTaskCount}: ${info.count}`
        if (info.seconds > 0) tip += `<br/>${t.tipDuration}: ${formatSeconds(info.seconds)}`
        return tip
      },
    },
    grid: { left: 10, right: 80, top: 5, bottom: 5, containLabel: true },
    yAxis: {
      type: 'category' as const,
      data: reversedNames,
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
        data: [...data].reverse().map((v, i) => {
          const origIndex = stageOrder.length - 1 - i
          const prd = stageMap[stageOrder[origIndex]].prd
          const [c1, c2] = prdColors[prd] || prdColorList[0]
          return {
            value: v,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }] },
            },
          }
        }),
        label: {
          show: true,
          position: 'right' as const,
          color: '#94a3b8',
          fontSize: 10,
          formatter: (p: { dataIndex: number; value: number }) => {
            const origIndex = stageOrder.length - 1 - p.dataIndex
            const stage = stageOrder[origIndex]
            const info = stageMap[stage]
            let label = `${p.value}`
            if (info.seconds > 0) label += ` · ${formatSeconds(info.seconds)}`
            return label
          },
        },
        barWidth: '55%',
      },
    ],
  }

  return (
    <div>
      <ReactECharts option={option} style={{ height: Math.max(300, names.length * 40) }} />
      {phases.length > 0 && (
        <div className="flex gap-4 justify-center mt-3">
          {phases.map((prd) => {
            const [c1, c2] = prdColors[prd] || prdColorList[0]
            return (
              <span key={prd} className="flex items-center gap-1.5 text-xs text-[#6b7b8d]">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: `linear-gradient(180deg, ${c2}, ${c1})` }}
                />
                {prd}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
