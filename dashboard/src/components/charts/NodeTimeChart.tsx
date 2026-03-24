import ReactECharts from 'echarts-for-react'
import { darkTheme } from './darkTheme'
import { useLocale } from '../../i18n'
import { stageLabel } from '../../labelMap'
import type { RunMetrics, RunCost, TaskItem, BugItem } from '../../types'

interface Props {
  metrics: RunMetrics
  cost?: RunCost
  tasks?: TaskItem[]
  bugs?: BugItem[]
}

const colorPool = ['#3b82f6', '#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#22c55e', '#ec4899', '#f97316']

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export function NodeTimeChart({ metrics, cost, tasks, bugs }: Props) {
  const { t } = useLocale()

  const breakdown = metrics.nodeTimeBreakdown
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return <div className="h-80 flex items-center justify-center text-[#6b7b8d] text-sm">{t.chartNoNodeTime}</div>
  }

  // Build node-level token map from tokenBreakdown
  // tokenBreakdown entries are like "task:TASK-01" or "bugfix:BUG-01"
  // We aggregate task tokens into "Code Generation" and bugfix tokens into "Bug Fix"
  const tokenMap: Record<string, number> = {}
  if (cost?.tokenBreakdown) {
    for (const item of cost.tokenBreakdown) {
      if (item.stage.startsWith('task:')) {
        tokenMap['Code Generation'] = (tokenMap['Code Generation'] || 0) + item.tokens
      } else if (item.stage.startsWith('bugfix:')) {
        tokenMap['Bug Fix'] = (tokenMap['Bug Fix'] || 0) + item.tokens
      } else {
        tokenMap[item.stage] = (tokenMap[item.stage] || 0) + item.tokens
      }
    }
  }

  // Also check per-task tokensConsumed (set by MCP server)
  if (tasks && Object.keys(tokenMap).length === 0) {
    let taskTokenTotal = 0
    for (const t of tasks) {
      taskTokenTotal += (t as any).tokensConsumed || 0
    }
    if (taskTokenTotal > 0) tokenMap['Code Generation'] = taskTokenTotal
    if (bugs) {
      let bugTokenTotal = 0
      for (const b of bugs) {
        bugTokenTotal += (b as any).tokensConsumed || 0
      }
      if (bugTokenTotal > 0) tokenMap['Bug Fix'] = bugTokenTotal
    }
  }

  const hasTokens = Object.keys(tokenMap).length > 0
  const totalTokens = cost?.totalTokens || 0

  const sorted = Object.entries(breakdown).sort((a, b) => a[1] - b[1])
  const rawKeys = sorted.map(([k]) => k)
  const names = sorted.map(([k]) => stageLabel(k, t))
  const values = sorted.map(([, v]) => v)
  const tokenValues = rawKeys.map(k => tokenMap[k] || 0)

  const option = {
    ...darkTheme,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params]
        const idx = list[0]?.dataIndex
        if (idx == null) return ''
        const name = names[idx]
        let tip = `<b>${name}</b><br/>${t.tipDuration}: ${formatSeconds(values[idx])}`
        if (hasTokens && tokenValues[idx] > 0) {
          tip += `<br/>Token: ${formatTokens(tokenValues[idx])}`
        }
        return tip
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
          formatter: (p: { dataIndex: number; value: number }) => {
            const tokens = tokenValues[p.dataIndex]
            let label = formatSeconds(p.value)
            if (hasTokens && tokens > 0) label += ` · ${formatTokens(tokens)}`
            return label
          },
        },
        barWidth: '50%',
      },
    ],
  }

  return (
    <div>
      <ReactECharts option={option} style={{ height: Math.max(200, names.length * 45) }} />
      {totalTokens > 0 && !hasTokens && (
        <div className="text-center text-xs text-[#6b7b8d] mt-1">
          {t.chartTotalTokens}: {totalTokens.toLocaleString()}
        </div>
      )}
    </div>
  )
}
