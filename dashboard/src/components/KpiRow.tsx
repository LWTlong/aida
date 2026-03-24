import { useState } from 'react'
import type { RunData } from '../types'
import { Modal } from './Modal'
import { deviationCategoryLabel, rootCauseLabel } from '../labelMap'
import { formatLocalDate } from '../utils/date'
import { updateRunCost, updateConfig } from '../api'
import { useLocale } from '../i18n'

interface Props {
  data: RunData
  runId?: string
  onDataUpdate?: () => void
}

type ModalType = 'tasks' | 'prd' | 'deviation' | 'bug' | 'review' | 'files' | 'time' | 'roi' | 'tokens' | null

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

export function KpiRow({ data, runId, onDataUpdate }: Props) {
  const { t } = useLocale()
  const [modal, setModal] = useState<ModalType>(null)
  const [manualHours, setManualHours] = useState('')
  const [hourlyRateInput, setHourlyRateInput] = useState('')
  const [saving, setSaving] = useState(false)
  const s = data.summary
  const m = data.metrics
  const cur = t.currency
  const rate = parseFloat(t.exchangeRate) || 1

  const fmtMoney = (v: number) => {
    const converted = v * rate
    return `${cur}${Math.abs(converted) < 1 ? converted.toFixed(2) : Math.round(converted).toLocaleString()}`
  }

  const qualityCards: { key: ModalType; label: string; color: string; value: string }[] = [
    { key: 'prd', label: t.kpiPrd, color: 'text-blue-500', value: s.prdPhaseCount ? `${s.prdPhaseCount}` : '-' },
    { key: 'tasks', label: t.kpiTasks, color: 'text-green-500', value: `${s.completedTasks}/${s.totalTasks}` },
    { key: 'deviation', label: t.kpiDeviation, color: 'text-amber-500', value: `${s.deviationCount}` },
    { key: 'bug', label: t.kpiBug, color: 'text-red-500', value: `${s.bugCount}` },
  ]

  const totalTokens = data.cost?.totalTokens || 0

  const efficiencyCards: { key: ModalType; label: string; color: string; value: string }[] = [
    { key: 'review', label: t.kpiReviewRate, color: 'text-purple-500', value: m.reviewPassRate != null ? `${Math.round(m.reviewPassRate)}%` : '-' },
    { key: 'tokens', label: t.kpiTokens, color: 'text-orange-500', value: totalTokens > 0 ? formatTokens(totalTokens) : '-' },
    { key: 'files', label: t.kpiFiles, color: 'text-cyan-500', value: `${s.filesChanged}` },
    { key: 'time', label: t.kpiTime, color: 'text-teal-500', value: m.actualWorkSeconds ? formatSeconds(m.actualWorkSeconds) : '-' },
    { key: 'roi', label: t.kpiRoi, color: 'text-emerald-500', value: m.moneySaved != null ? fmtMoney(m.moneySaved) : '-' },
  ]

  const needsRoiSetup = m.roi == null && runId

  const renderCards = (cards: typeof qualityCards) => (
    <div className={`grid gap-4 max-lg:grid-cols-2 max-sm:grid-cols-2 ${cards.length > 4 ? 'grid-cols-5' : 'grid-cols-4'}`}>
      {cards.map((card) => (
        <div
          key={card.key}
          onClick={() => setModal(card.key)}
          className="bg-[#162231] border border-[#1e2d3d] rounded-[10px] px-5 py-[18px] text-center cursor-pointer hover:border-[#2a4a6b] transition-colors"
        >
          <div className={`text-[32px] font-bold mb-1 ${card.color}`}>{card.value}</div>
          <div className="text-xs text-[#6b7b8d] uppercase tracking-wide">{card.label}</div>
          {card.key === 'roi' && needsRoiSetup && (
            <div className="text-[10px] text-amber-400/70 mt-1">{t.clickToSet}</div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <>
      <div className="px-8 py-5 space-y-4">
        {renderCards(qualityCards)}
        {renderCards(efficiencyCards)}
      </div>

      {/* Tasks Modal */}
      <Modal title={t.modalTasks} open={modal === 'tasks'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thId}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[200px]">{t.thTitle}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">{t.thPhase}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thPrd}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thStatus}</th>
            </tr>
          </thead>
          <tbody>
            {data.tasks.map((task) => (
              <tr key={task.taskId} className="hover:bg-[#1a2e40]">
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{task.taskId}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[200px]">{task.title}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{task.stageName}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-[#1e3a5f] text-[#60a5fa]">{task.prdPhase}</span>
                </td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className={task.status === 'done' ? 'text-green-500' : 'text-amber-500'}>{task.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {/* Deviation Modal */}
      <Modal title={t.modalDeviation} open={modal === 'deviation'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thId}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">{t.thTitle}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">{t.thRootCause}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">{t.thCategory}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">{t.thFiles}</th>
            </tr>
          </thead>
          <tbody>
            {data.deviations.map((d) => (
              <tr key={d.deviationId} className="hover:bg-[#1a2e40]">
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{d.deviationId}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[150px]">{d.title}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{rootCauseLabel(d.rootCauseCategory, t)}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{deviationCategoryLabel(d.deviationCategory, t)}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d] min-w-[150px]">{d.files.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {/* Bug Modal */}
      <Modal title={t.modalBug} open={modal === 'bug'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thId}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">{t.thTitle}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">{t.thSeverity}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thStatus}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">{t.thFix}</th>
            </tr>
          </thead>
          <tbody>
            {data.bugs.map((b) => (
              <tr key={b.bugId} className="hover:bg-[#1a2e40]">
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{b.bugId}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[150px]">{b.title}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{b.severity}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className={b.status === 'fixed' ? 'text-green-500' : 'text-red-500'}>{b.status}</span>
                </td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d] min-w-[150px]">{b.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {/* PRD Modal */}
      <Modal title={t.modalPrd} open={modal === 'prd'} onClose={() => setModal(null)}>
        <div className="space-y-3">
          {(data.meta.prdPhases || []).map((phase) => {
            const tasks = data.tasks.filter((task) => task.prdPhase === phase)
            const done = tasks.filter((task) => task.status === 'done').length
            return (
              <div key={phase} className="bg-[#0f1923] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{phase}</span>
                  <span className="text-xs text-[#6b7b8d]">{done}/{tasks.length} {t.tasksCompleted}</span>
                </div>
                <div className="w-full bg-[#1e2d3d] rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal title={t.modalReview} open={modal === 'review'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thNumber}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">{t.thDate}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[200px]">{t.thScope}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thIssueCount}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thResult}</th>
            </tr>
          </thead>
          <tbody>
            {data.reviews.map((r) => (
              <tr key={r.reviewId} className="hover:bg-[#1a2e40]">
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{r.reviewId}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{formatLocalDate(r.reviewedAt)}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[200px]">{r.scope}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{r.issueCount}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className={r.result === 'pass' ? 'text-green-500' : 'text-red-500'}>{r.result}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {/* Files Modal */}
      <Modal title={t.modalFiles} open={modal === 'files'} onClose={() => setModal(null)}>
        {data.files.length > 0 ? (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[250px]">{t.thFilePath}</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thOperation}</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">{t.thLineChanges}</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">{t.thChangeCount}</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((f) => (
                <tr key={f.path} className="hover:bg-[#1a2e40]">
                  <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[250px]">{f.path}</td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                    <span className={f.changeType === 'created' ? 'text-green-500' : f.changeType === 'deleted' ? 'text-red-500' : 'text-blue-500'}>
                      {f.changeType}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">
                    <span className="text-green-500">+{f.linesAdded}</span>{' '}
                    <span className="text-red-500">-{f.linesRemoved}</span>
                  </td>
                  <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{f.changeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-[#6b7b8d] text-sm text-center py-4">{t.noData}</div>
        )}
      </Modal>

      {/* Time Modal */}
      <Modal title={t.modalTime} open={modal === 'time'} onClose={() => setModal(null)}>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.timeActualAi}</span>
            <span className="text-teal-500 font-medium">{m.actualWorkSeconds ? formatSeconds(m.actualWorkSeconds) : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.timeEstManual}</span>
            <span className="text-[#e0e6ed]">{data.cost.estimatedManualHours ? `${data.cost.estimatedManualHours}h` : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.timeEfficiency}</span>
            <span className="text-emerald-500 font-medium">{m.efficiencyMultiplier ? `${m.efficiencyMultiplier.toFixed(1)}x` : '-'}</span>
          </div>
          {m.nodeTimeBreakdown && Object.keys(m.nodeTimeBreakdown).length > 0 && (
            <div className="pt-3 border-t border-[#1e2d3d]">
              <div className="text-[#6b7b8d] text-xs mb-2">{t.timeNodeDetail}</div>
              {Object.entries(m.nodeTimeBreakdown).map(([node, sec]) => (
                <div key={node} className="flex justify-between py-1 text-xs">
                  <span className="text-[#94a3b8]">{node}</span>
                  <span className="text-[#e0e6ed]">{formatSeconds(sec)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ROI Modal */}
      <Modal title={t.modalRoi} open={modal === 'roi'} onClose={() => setModal(null)}>
        <div className="space-y-3 text-[13px]">
          {/* Always show ROI settings when runId is available */}
          {runId && (
            <div className="bg-[#1a2a3a] border border-[#2a4a6b] rounded-lg p-4 mb-4">
              <div className="text-blue-400 text-sm font-medium mb-2">{t.roiSettingTitle}</div>
              <div className="text-[#6b7b8d] text-xs mb-3">{t.roiSettingHint}</div>

              <div className="flex items-center gap-3 mb-3">
                <label className="text-[#94a3b8] text-xs whitespace-nowrap min-w-[100px]">{t.roiEstManualHours}</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder={data.cost?.estimatedManualHours ? `${data.cost.estimatedManualHours}` : `${t.eg}: 8`}
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  className="flex-1 bg-[#0f1923] border border-[#1e2d3d] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-[#3b82f6] transition-colors"
                />
                <span className="text-[#6b7b8d] text-xs">{t.hours}</span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <label className="text-[#94a3b8] text-xs whitespace-nowrap min-w-[100px]">{t.roiHourlyRate}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={m.moneySaved != null && data.cost?.estimatedManualHours ? '' : `${t.eg}: 50`}
                  value={hourlyRateInput}
                  onChange={(e) => setHourlyRateInput(e.target.value)}
                  className="flex-1 bg-[#0f1923] border border-[#1e2d3d] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-[#3b82f6] transition-colors"
                />
                <span className="text-[#6b7b8d] text-xs">{t.perHour}</span>
              </div>

              <button
                disabled={saving || (!manualHours && !hourlyRateInput)}
                onClick={async () => {
                  setSaving(true)
                  try {
                    if (manualHours && runId) {
                      await updateRunCost(runId, { estimatedManualHours: parseFloat(manualHours) })
                    }
                    if (hourlyRateInput) {
                      await updateConfig({ hourlyRate: parseFloat(hourlyRateInput) / rate })
                    }
                    setManualHours('')
                    setHourlyRateInput('')
                    onDataUpdate?.()
                  } finally {
                    setSaving(false)
                  }
                }}
                className="mt-1 px-4 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
              >
                {saving ? t.saving : t.save}
              </button>
            </div>
          )}

          <div className="text-[#6b7b8d] text-xs mb-1">{t.roiCostComparison}</div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.roiEstManualHours}</span>
            <span className="text-[#e0e6ed]">{data.cost?.estimatedManualHours ? `${data.cost.estimatedManualHours}h` : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.roiManualCost}</span>
            <span className="text-[#e0e6ed]">
              {data.cost?.estimatedManualHours && m.moneySaved != null && m.tokenCost != null
                ? fmtMoney(m.moneySaved + m.tokenCost)
                : '-'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.roiAiCost}</span>
            <span className="text-red-400">{m.tokenCost != null ? fmtMoney(m.tokenCost) : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.roiSaved}</span>
            <span className="text-emerald-500 font-medium">{m.moneySaved != null ? fmtMoney(m.moneySaved) : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.roiValue}</span>
            <span className="text-emerald-500 font-bold text-lg">{m.roi != null ? fmtMoney(Math.round(m.roi / 100)) : '-'}</span>
          </div>
          <div className="pt-3 border-t border-[#1e2d3d] mt-1">
            <div className="text-[#6b7b8d] text-xs mb-1">{t.roiTimeComparison}</div>
            <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
              <span className="text-[#6b7b8d]">{t.roiHoursSaved}</span>
              <span className={`${m.hoursSaved != null && m.hoursSaved > 0 ? 'text-emerald-500' : 'text-[#e0e6ed]'}`}>
                {m.hoursSaved != null ? `${m.hoursSaved.toFixed(1)}h` : '-'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
              <span className="text-[#6b7b8d]">{t.roiAiProcessTime}</span>
              <span className="text-[#e0e6ed]">{m.actualWorkSeconds ? formatSeconds(m.actualWorkSeconds) : '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
              <span className="text-[#6b7b8d]">{t.timeEfficiency}</span>
              <span className="text-blue-400 font-medium">{m.efficiencyMultiplier ? `${m.efficiencyMultiplier.toFixed(1)}x` : '-'}</span>
            </div>
          </div>
          <div className="flex justify-between py-2 mt-1">
            <span className="text-[#6b7b8d]">{t.tokenTotal}</span>
            <span className="text-[#e0e6ed]">{data.cost?.totalTokens ? data.cost.totalTokens.toLocaleString() : '-'}</span>
          </div>
        </div>
      </Modal>

      {/* Tokens Modal */}
      <Modal title={t.modalTokens} open={modal === 'tokens'} onClose={() => setModal(null)}>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">{t.tokenTotal}</span>
            <span className="text-orange-500 font-bold text-lg">{totalTokens ? totalTokens.toLocaleString() : '-'}</span>
          </div>
          {data.cost?.tokenDetail && (
            <>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">{t.tokenInput}</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.inputTokens?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">{t.tokenOutput}</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.outputTokens?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">{t.tokenCacheCreation}</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.cacheCreationTokens?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">{t.tokenCacheRead}</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.cacheReadTokens?.toLocaleString() || '0'}</span>
              </div>
            </>
          )}
          {data.cost?.tokenBreakdown && data.cost.tokenBreakdown.length > 0 && (
            <div className="pt-3 border-t border-[#1e2d3d]">
              <div className="text-[#6b7b8d] text-xs mb-2">{t.tokenPerPhase}</div>
              {data.cost.tokenBreakdown.map((item) => (
                <div key={item.stage} className="flex justify-between py-1 text-xs">
                  <span className="text-[#94a3b8]">{item.stage}</span>
                  <span className="text-[#e0e6ed]">{item.tokens.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
