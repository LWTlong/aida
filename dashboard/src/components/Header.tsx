import type { RunSummary, RunMeta } from '../types'
import { ALL_PROJECT_ID } from '../hooks/useRunData'
import { formatDate } from '../utils/date'

interface Props {
  runs: RunSummary[]
  currentRunId: string
  onSelectRun: (id: string) => void
  meta: RunMeta | null
  connected: boolean
}

function formatPeriod(meta: RunMeta): string {
  const parts = [`分支: ${meta.branch}`, `开发者: ${meta.developer}`]
  if (meta.aiModel) parts.push(`AI: ${meta.aiModel}`)
  if (meta.startTime) {
    const start = formatDate(meta.startTime)
    const end = meta.endTime ? formatDate(meta.endTime) : ''
    const period = end ? `${start} ~ ${end}` : `${start} ~`
    if (start) parts.push(`周期: ${period}`)
  }
  return parts.join(' | ')
}

export function Header({ runs, currentRunId, onSelectRun, meta, connected }: Props) {
  const isOverview = currentRunId === ALL_PROJECT_ID

  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-[#1e2d3d]">
      <div className="flex items-center gap-4">
        <h1 className="text-[22px] font-semibold text-white">
          {isOverview ? (
            <><span className="text-blue-500">AIDevOS</span> 项目总览</>
          ) : meta ? (
            <><span className="text-blue-500">{meta.branch}</span> AI 开发看板</>
          ) : (
            <><span className="text-blue-500">AIDevOS</span> AI 开发看板</>
          )}
        </h1>
        <select
          value={currentRunId}
          onChange={(e) => onSelectRun(e.target.value)}
          className="appearance-none bg-[#162231] text-[#e0e6ed] border border-[#1e2d3d] rounded-lg px-3 py-2 text-[13px] cursor-pointer outline-none hover:border-[#2a4a6b]"
        >
          {runs.length === 0 && <option value="">加载中...</option>}
          <option value={ALL_PROJECT_ID}>项目总览（负责人视角）</option>
          {runs.map((r) => (
            <option key={r.runId} value={r.runId}>
              {r.branch} / {r.developer}
            </option>
          ))}
        </select>
        <div
          className={`w-2 h-2 rounded-full transition-colors ${
            connected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-[#4a5a6a]'
          }`}
          title={connected ? 'SSE 已连接' : 'SSE 未连接'}
        />
      </div>
      {meta && !isOverview && (
        <div className="text-[13px] text-[#6b7b8d]">
          {formatPeriod(meta)}
        </div>
      )}
    </div>
  )
}
