import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
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

export function TaskChart({ tasks, prdPhases }: Props) {
  // Group tasks by stageName, preserve order of appearance
  const stageOrder: string[] = []
  const stageMap: Record<string, { count: number; prd: string }> = {}

  for (const t of tasks) {
    const stage = t.stageName || '未分类'
    if (!stageMap[stage]) {
      stageOrder.push(stage)
      stageMap[stage] = { count: 0, prd: t.prdPhase || '' }
    }
    stageMap[stage].count++
  }

  // Build prd → color mapping
  const prdColors: Record<string, [string, string]> = {}
  const phases = prdPhases || [...new Set(tasks.map((t) => t.prdPhase).filter(Boolean))]
  phases.forEach((p, i) => {
    prdColors[p] = prdColorList[i % prdColorList.length]
  })

  const names = stageOrder
  const data = stageOrder.map((s) => stageMap[s].count)

  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' as const },
    grid: { left: 10, right: 30, top: 5, bottom: 5, containLabel: true },
    yAxis: {
      type: 'category' as const,
      data: [...names].reverse(),
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
        label: { show: true, position: 'right' as const, color: '#94a3b8', fontSize: 11, fontWeight: 600 },
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
