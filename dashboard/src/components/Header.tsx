import type { RunSummary, RunMeta } from '../types'
import { ALL_PROJECT_ID } from '../hooks/useRunData'
import { formatDate } from '../utils/date'
import { useLocale } from '../i18n'

interface Props {
  runs: RunSummary[]
  currentRunId: string
  onSelectRun: (id: string) => void
  meta: RunMeta | null
  connected: boolean
}

export function Header({ runs, currentRunId, onSelectRun, meta, connected }: Props) {
  const { locale, setLocale, t } = useLocale()
  const isOverview = currentRunId === ALL_PROJECT_ID

  const formatPeriod = (m: RunMeta): string => {
    const parts = [`${t.branch}: ${m.branch}`, `${t.developer}: ${m.developer}`]
    if (m.aiModel) parts.push(`AI: ${m.aiModel}`)
    if (m.startTime) {
      const start = formatDate(m.startTime)
      const end = m.endTime ? formatDate(m.endTime) : ''
      const period = end ? `${start} ~ ${end}` : `${start} ~`
      if (start) parts.push(`${t.cycle}: ${period}`)
    }
    return parts.join(' | ')
  }

  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-[#1e2d3d]">
      <div className="flex items-center gap-4">
        <h1 className="text-[22px] font-semibold text-white">
          {isOverview ? (
            <><span className="text-blue-500">AIDevOS</span> {t.projectOverviewTitle.replace('AIDevOS ', '')}</>
          ) : meta ? (
            <><span className="text-blue-500">{meta.branch}</span> {t.dashboardTitle}</>
          ) : (
            <><span className="text-blue-500">AIDevOS</span> {t.dashboardTitle}</>
          )}
        </h1>
        <select
          value={currentRunId}
          onChange={(e) => onSelectRun(e.target.value)}
          className="appearance-none bg-[#162231] text-[#e0e6ed] border border-[#1e2d3d] rounded-lg px-3 py-2 text-[13px] cursor-pointer outline-none hover:border-[#2a4a6b]"
        >
          {runs.length === 0 && <option value="">{t.loading}</option>}
          <option value={ALL_PROJECT_ID}>{t.projectOverviewNav}</option>
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
          title={connected ? t.sseConnected : t.sseDisconnected}
        />
        <button
          onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
          className="text-[11px] text-[#6b7b8d] hover:text-white border border-[#1e2d3d] hover:border-[#2a4a6b] rounded px-2 py-1 cursor-pointer transition-colors"
        >
          {locale === 'zh' ? 'EN' : '中文'}
        </button>
      </div>
      {meta && !isOverview && (
        <div className="text-[13px] text-[#6b7b8d]">
          {formatPeriod(meta)}
        </div>
      )}
    </div>
  )
}
