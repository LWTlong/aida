import { useState } from 'react'
import type { RunData } from '../types'
import { Modal } from './Modal'
import { deviationCategoryLabel, rootCauseLabel } from '../labelMap'
import { formatLocalDate } from '../utils/date'

interface Props {
  data: RunData
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

export function KpiRow({ data }: Props) {
  const [modal, setModal] = useState<ModalType>(null)
  const s = data.summary
  const m = data.metrics

  const qualityCards: { key: ModalType; label: string; color: string; value: string }[] = [
    { key: 'prd', label: 'PRD 进度', color: 'text-blue-500', value: s.prdPhaseCount ? `${s.prdPhaseCount}` : '-' },
    { key: 'tasks', label: '任务完成', color: 'text-green-500', value: `${s.completedTasks}/${s.totalTasks}` },
    { key: 'deviation', label: '偏差发现', color: 'text-amber-500', value: `${s.deviationCount}` },
    { key: 'bug', label: '缺陷修复', color: 'text-red-500', value: `${s.bugCount}` },
  ]

  const totalTokens = data.cost?.totalTokens || 0

  const efficiencyCards: { key: ModalType; label: string; color: string; value: string }[] = [
    { key: 'review', label: '自检通过率', color: 'text-purple-500', value: m.reviewPassRate != null ? `${Math.round(m.reviewPassRate)}%` : '-' },
    { key: 'tokens', label: 'Token 消耗', color: 'text-orange-500', value: totalTokens > 0 ? formatTokens(totalTokens) : '-' },
    { key: 'files', label: '文件变更', color: 'text-cyan-500', value: `${s.filesChanged}` },
    { key: 'time', label: '实际工时', color: 'text-teal-500', value: m.actualWorkSeconds ? formatSeconds(m.actualWorkSeconds) : '-' },
    { key: 'roi', label: 'ROI', color: 'text-emerald-500', value: m.roi != null ? `${Math.round(m.roi)}%` : '-' },
  ]

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
      <Modal title="任务详情" open={modal === 'tasks'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">ID</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[200px]">标题</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">阶段</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">PRD</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">状态</th>
            </tr>
          </thead>
          <tbody>
            {data.tasks.map((t) => (
              <tr key={t.taskId} className="hover:bg-[#1a2e40]">
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{t.taskId}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[200px]">{t.title}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{t.stageName}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-[#1e3a5f] text-[#60a5fa]">{t.prdPhase}</span>
                </td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">
                  <span className={t.status === 'done' ? 'text-green-500' : 'text-amber-500'}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {/* Deviation Modal */}
      <Modal title="偏差详情" open={modal === 'deviation'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">ID</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">标题</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">根因</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">类别</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">涉及文件</th>
            </tr>
          </thead>
          <tbody>
            {data.deviations.map((d) => (
              <tr key={d.deviationId} className="hover:bg-[#1a2e40]">
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{d.deviationId}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[150px]">{d.title}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{rootCauseLabel(d.rootCauseCategory)}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{deviationCategoryLabel(d.deviationCategory)}</td>
                <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d] min-w-[150px]">{d.files.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {/* Bug Modal */}
      <Modal title="缺陷详情" open={modal === 'bug'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">ID</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">标题</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">严重程度</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">状态</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">修复</th>
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
      <Modal title="PRD 阶段" open={modal === 'prd'} onClose={() => setModal(null)}>
        <div className="space-y-3">
          {(data.meta.prdPhases || []).map((phase) => {
            const tasks = data.tasks.filter((t) => t.prdPhase === phase)
            const done = tasks.filter((t) => t.status === 'done').length
            return (
              <div key={phase} className="bg-[#0f1923] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{phase}</span>
                  <span className="text-xs text-[#6b7b8d]">{done}/{tasks.length} 任务完成</span>
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
      <Modal title="自检报告" open={modal === 'review'} onClose={() => setModal(null)}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">编号</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">日期</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[200px]">范围</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">问题数</th>
              <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">结果</th>
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
      <Modal title="变更文件" open={modal === 'files'} onClose={() => setModal(null)}>
        {data.files.length > 0 ? (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[250px]">文件路径</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">操作</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">+/-</th>
                <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">修改次数</th>
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
          <div className="text-[#6b7b8d] text-sm text-center py-4">暂无数据</div>
        )}
      </Modal>

      {/* Time Modal */}
      <Modal title="工时详情" open={modal === 'time'} onClose={() => setModal(null)}>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">实际 AI 工时</span>
            <span className="text-teal-500 font-medium">{m.actualWorkSeconds ? formatSeconds(m.actualWorkSeconds) : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">预估人工工时</span>
            <span className="text-[#e0e6ed]">{data.cost.estimatedManualHours ? `${data.cost.estimatedManualHours}h` : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">效率倍数</span>
            <span className="text-emerald-500 font-medium">{m.efficiencyMultiplier ? `${m.efficiencyMultiplier.toFixed(1)}x` : '-'}</span>
          </div>
          {m.nodeTimeBreakdown && Object.keys(m.nodeTimeBreakdown).length > 0 && (
            <div className="pt-3 border-t border-[#1e2d3d]">
              <div className="text-[#6b7b8d] text-xs mb-2">节点耗时明细</div>
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
      <Modal title="ROI 详情" open={modal === 'roi'} onClose={() => setModal(null)}>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">Token 成本</span>
            <span className="text-red-400">{m.tokenCost != null ? `$${m.tokenCost.toFixed(2)}` : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">节省工时</span>
            <span className="text-[#e0e6ed]">{m.hoursSaved != null ? `${m.hoursSaved.toFixed(1)}h` : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">节省费用</span>
            <span className="text-emerald-500">{m.moneySaved != null ? `$${m.moneySaved.toFixed(0)}` : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">ROI</span>
            <span className="text-emerald-500 font-bold text-lg">{m.roi != null ? `${Math.round(m.roi)}%` : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">Total Tokens</span>
            <span className="text-[#e0e6ed]">{data.cost.totalTokens ? data.cost.totalTokens.toLocaleString() : '-'}</span>
          </div>
        </div>
      </Modal>

      {/* Tokens Modal */}
      <Modal title="Token 消耗详情" open={modal === 'tokens'} onClose={() => setModal(null)}>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
            <span className="text-[#6b7b8d]">总 Token</span>
            <span className="text-orange-500 font-bold text-lg">{totalTokens ? totalTokens.toLocaleString() : '-'}</span>
          </div>
          {data.cost?.tokenDetail && (
            <>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">Input Tokens</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.inputTokens?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">Output Tokens</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.outputTokens?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">Cache Creation</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.cacheCreationTokens?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e2d3d]">
                <span className="text-[#6b7b8d]">Cache Read</span>
                <span className="text-[#e0e6ed]">{data.cost.tokenDetail.cacheReadTokens?.toLocaleString() || '0'}</span>
              </div>
            </>
          )}
          {data.cost?.tokenBreakdown && data.cost.tokenBreakdown.length > 0 && (
            <div className="pt-3 border-t border-[#1e2d3d]">
              <div className="text-[#6b7b8d] text-xs mb-2">各阶段 Token 消耗</div>
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
