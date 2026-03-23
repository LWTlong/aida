import type { IndexData, IndexRunEntry, DeveloperSummary } from '../types'
import { ChartCard } from './ChartCard'
import { formatDate } from '../utils/date'
import { TeamEfficiencyChart } from './charts/TeamEfficiencyChart'
import { RequirementStatusChart } from './charts/RequirementStatusChart'

interface Props {
  data: IndexData
  onSelectBranch: (branch: string) => void
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

function aggregateDevelopers(runs: IndexRunEntry[]): DeveloperSummary[] {
  const map: Record<string, DeveloperSummary> = {}
  for (const run of runs) {
    for (const dev of run.developers) {
      if (!map[dev.name]) {
        map[dev.name] = { ...dev, modules: [...dev.modules] }
      } else {
        const d = map[dev.name]
        d.tasks += dev.tasks
        d.completedTasks += dev.completedTasks
        d.bugs += dev.bugs
        d.deviations += dev.deviations
        d.linesAdded += dev.linesAdded
        d.linesRemoved += dev.linesRemoved
        d.actualWorkSeconds += dev.actualWorkSeconds
        d.totalTokens += dev.totalTokens
        for (const m of dev.modules) {
          if (!d.modules.includes(m)) d.modules.push(m)
        }
      }
    }
  }
  // Recalculate firstPassRate
  for (const d of Object.values(map)) {
    d.firstPassRate = d.tasks > 0 ? d.completedTasks / d.tasks : 0
  }
  return Object.values(map).sort((a, b) => b.completedTasks - a.completedTasks)
}

export function ProjectOverview({ data, onSelectBranch }: Props) {
  const runs = data.runs
  const allDevs = aggregateDevelopers(runs)

  const totalTasks = runs.reduce((s, r) => s + r.totals.tasks, 0)
  const totalCompleted = runs.reduce((s, r) => s + r.totals.completedTasks, 0)
  const totalBugs = runs.reduce((s, r) => s + r.totals.bugs, 0)
  const totalDeviations = runs.reduce((s, r) => s + r.totals.deviations, 0)
  const totalLines = runs.reduce((s, r) => s + r.totals.linesAdded, 0)
  const totalTokens = runs.reduce((s, r) => s + r.totals.totalTokens, 0)
  const activeRuns = runs.filter((r) => r.status !== 'completed').length
  const completedRuns = runs.filter((r) => r.status === 'completed').length

  const kpis = [
    { label: '总需求数', value: `${runs.length}`, color: 'text-blue-500' },
    { label: '进行中', value: `${activeRuns}`, color: 'text-amber-500' },
    { label: '已完成', value: `${completedRuns}`, color: 'text-green-500' },
    { label: '任务完成', value: `${totalCompleted}/${totalTasks}`, color: 'text-cyan-500' },
    { label: '总偏差', value: `${totalDeviations}`, color: 'text-amber-500' },
    { label: '总缺陷', value: `${totalBugs}`, color: 'text-red-500' },
    { label: '代码行数', value: totalLines > 1000 ? `${(totalLines / 1000).toFixed(1)}k` : `${totalLines}`, color: 'text-purple-500' },
    { label: 'Tokens', value: totalTokens > 1000000 ? `${(totalTokens / 1000000).toFixed(1)}M` : totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(0)}k` : `${totalTokens}`, color: 'text-teal-500' },
  ]

  // Collect all highlights across runs
  const allHighlights = runs.flatMap((r) => r.highlights.map((h) => ({ ...h, branch: r.branch }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)

  return (
    <div>
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 px-8 py-5 max-lg:grid-cols-2 max-sm:grid-cols-2">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-[#162231] border border-[#1e2d3d] rounded-[10px] px-5 py-[18px] text-center">
            <div className={`text-[28px] font-bold mb-1 ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-[#6b7b8d] uppercase tracking-wide">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 px-8 pb-5 max-md:grid-cols-1">
        {/* Charts */}
        <ChartCard title="需求状态分布">
          <RequirementStatusChart runs={runs} />
        </ChartCard>

        <ChartCard title="团队效率对比">
          <TeamEfficiencyChart developers={allDevs} />
        </ChartCard>

        {/* Requirements List */}
        <ChartCard title="需求列表" full>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">分支</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">标题</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">状态</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">任务</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">偏差</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">Bug</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">开发者</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">开始时间</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.branch}
                  className="hover:bg-[#1a2e40] cursor-pointer"
                  onClick={() => onSelectBranch(r.branch)}
                >
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-blue-400 hover:underline">{r.branch}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d]">{r.title || '-'}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d]">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                      r.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                      r.status === 'in-progress' ? 'bg-amber-900/30 text-amber-400' :
                      'bg-[#1e2d3d] text-[#6b7b8d]'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d]">{r.totals.completedTasks}/{r.totals.tasks}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-amber-500">{r.totals.deviations}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-red-500">{r.totals.bugs}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d]">{r.developers.map((d) => d.name).join(', ')}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d]">{formatDate(r.startTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        {/* Developer Table */}
        <ChartCard title="团队成员汇总" full>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">开发者</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">任务</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">偏差</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">Bug</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">+行数</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">AI 工时</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">Tokens</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium">模块</th>
              </tr>
            </thead>
            <tbody>
              {allDevs.map((d) => (
                <tr key={d.name} className="hover:bg-[#1a2e40]">
                  <td className="px-3 py-2 border-b border-[#1e2d3d] font-medium text-[#e0e6ed]">{d.name}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d]">
                    <span className="text-green-500">{d.completedTasks}</span>/{d.tasks}
                  </td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-amber-500">{d.deviations}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-red-500">{d.bugs}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d]">{d.linesAdded.toLocaleString()}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-teal-500">{formatSeconds(d.actualWorkSeconds)}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d]">{d.totalTokens > 1000 ? `${(d.totalTokens / 1000).toFixed(0)}k` : d.totalTokens}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d]">{d.modules.join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        {/* Highlights */}
        {allHighlights.length > 0 && (
          <ChartCard title="业务价值亮点" full>
            <div className="space-y-3">
              {allHighlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-[#1e2d3d] last:border-b-0">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5 ${
                    h.source === 'auto' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'
                  }`}>{h.source === 'auto' ? 'AI' : '手动'}</span>
                  <div className="flex-1 text-[13px] text-[#e0e6ed]">{h.content}</div>
                  <div className="text-[11px] text-[#6b7b8d] shrink-0">
                    <span className="text-blue-400">{(h as { branch?: string }).branch}</span> {formatDate(h.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  )
}
