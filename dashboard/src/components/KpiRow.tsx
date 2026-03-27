import { useState } from 'react'
import type { RunData } from '../types'
import { Modal } from './Modal'
import { deviationCategoryLabel, rootCauseLabel } from '../labelMap'
import { formatDateTimeSeconds, formatDateTime } from '../utils/date'
import { useLocale } from '../i18n'

interface Props {
  data: RunData
}

type ModalType = 'tasks' | 'prd' | 'deviation' | 'bug' | 'review' | 'files' | 'time' | null

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

export function KpiRow({ data }: Props) {
  const { t } = useLocale()
  const [modal, setModal] = useState<ModalType>(null)
  const s = data.summary
  const m = data.metrics

  const hasPrdPhases = (data.meta.prdPhases || []).length > 0
  const prdValue = hasPrdPhases
    ? `${s.prdPhaseCount}`
    : s.totalTasks > 0
      ? `${s.completedTasks}/${s.totalTasks}`
      : '-'

  const qualityCards: { key: ModalType; label: string; color: string; value: string }[] = [
    { key: hasPrdPhases ? 'prd' : null, label: t.kpiPrd, color: 'text-blue-500', value: prdValue },
    { key: 'tasks', label: t.kpiTasks, color: 'text-green-500', value: `${s.completedTasks}/${s.totalTasks}` },
    { key: 'deviation', label: t.kpiDeviation, color: 'text-amber-500', value: `${s.deviationCount}` },
    { key: 'bug', label: t.kpiBug, color: 'text-red-500', value: `${s.bugCount}` },
  ]

  const efficiencyCards: { key: ModalType; label: string; color: string; value: string }[] = [
    { key: 'review', label: t.kpiReviewRate, color: 'text-purple-500', value: m.reviewPassRate != null ? `${Math.round(m.reviewPassRate)}%` : '-' },
    { key: 'files', label: t.kpiFiles, color: 'text-cyan-500', value: `${s.filesChanged}` },
    { key: 'time', label: t.kpiTime, color: 'text-teal-500', value: m.actualWorkSeconds ? formatSeconds(m.actualWorkSeconds) : '-' },
  ]

  const renderCards = (cards: typeof qualityCards) => (
    <div className={`grid gap-4 max-lg:grid-cols-2 max-sm:grid-cols-2 ${cards.length > 4 ? 'grid-cols-5' : cards.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
      {cards.map((card) => (
        <div
          key={String(card.key)}
          onClick={() => card.key && setModal(card.key)}
          className={`bg-[#162231] border border-[#1e2d3d] rounded-[10px] px-5 py-[18px] text-center transition-colors ${card.key ? 'cursor-pointer hover:border-[#2a4a6b]' : 'cursor-default'}`}
        >
          <div className={`text-[32px] font-bold mb-1 ${card.color}`}>{card.value}</div>
          <div className="text-xs text-[#6b7b8d] uppercase tracking-wide">{card.label}</div>
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
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[120px]">{t.thStartTime}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thDuration}</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">{t.thStatus}</th>
            </tr>
          </thead>
          <tbody>
            {data.tasks.map((task) => {
              const durationSec = task.startedAt && task.completedAt
                ? (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000
                : null
              return (
              <tr key={task.taskId} className="hover:bg-[#1a2e40]">
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{task.taskId}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[200px]">{task.title}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{task.stageName}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-[#1e3a5f] text-[#60a5fa]">{task.prdPhase}</span>
                </td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[120px] text-xs text-[#94a3b8]">{formatDateTime(task.startedAt)}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px] text-xs text-[#94a3b8]">
                  {durationSec != null ? formatSeconds(durationSec) : '-'}
                </td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className={task.status === 'done' ? 'text-green-500' : 'text-amber-500'}>{task.status}</span>
                </td>
              </tr>
              )
            })}
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
        {data.bugs.length > 0 ? (
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
        ) : (
          <div className="text-[#6b7b8d] text-sm text-center py-4">{t.noData}</div>
        )}
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
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[130px] text-xs">{formatDateTimeSeconds(r.reviewedAt)}</td>
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

    </>
  )
}
