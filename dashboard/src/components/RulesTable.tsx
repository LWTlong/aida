import type { RuleItem, DeviationItem } from '../types'
import { deviationCategoryLabel } from '../labelMap'

interface Props {
  rules: RuleItem[]
  deviations: DeviationItem[]
}

export function RulesTable({ rules, deviations }: Props) {
  const sedimented = rules.filter((r) => r.status !== 'pending')
  const pending = rules.filter((r) => r.status === 'pending')

  if (rules.length === 0) {
    return <div className="text-[#6b7b8d] text-sm py-4 text-center">暂无沉淀规则</div>
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">来源</th>
          <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">类别</th>
          <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[200px]">规则</th>
          <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[150px]">目标文件</th>
        </tr>
      </thead>
      <tbody>
        {sedimented.map((rule) => {
          const dev = deviations.find((d) => d.deviationId === rule.sourceDeviation)
          const category = dev ? deviationCategoryLabel(dev.deviationCategory) : ''
          return (
            <tr key={rule.ruleId} className="hover:bg-[#1a2e40]">
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{rule.sourceDeviation}</td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">
                {category && (
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#1e3a5f] text-[#60a5fa]">
                    {category}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[200px]">{rule.content}</td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d] min-w-[150px]">{rule.file}</td>
            </tr>
          )
        })}
        {pending.map((rule) => {
          const dev = deviations.find((d) => d.deviationId === rule.sourceDeviation)
          const category = dev ? deviationCategoryLabel(dev.deviationCategory) : ''
          return (
            <tr key={rule.ruleId} className="hover:bg-[#1a2e40] opacity-60">
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{rule.sourceDeviation}</td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">
                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#1e2d3d] text-[#94a3b8]">
                  {category}
                </span>
              </td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[200px]">{rule.content}</td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] text-xs text-[#6b7b8d] italic min-w-[150px]">（待沉淀）</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
