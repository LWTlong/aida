import type { TimelineItem } from '../types'
import { formatShortDate } from '../utils/date'

interface Props {
  items: TimelineItem[]
  prdPhases?: string[]
}

const prdTagColors: Record<string, { bg: string; text: string }> = {}
const prdColorList = [
  { bg: '#1e3a5f', text: '#60a5fa' },
  { bg: '#3b1f5e', text: '#c084fc' },
  { bg: '#14532d', text: '#4ade80' },
  { bg: '#422006', text: '#fbbf24' },
]

function getPrdColor(prd: string): { bg: string; text: string } {
  if (!prdTagColors[prd]) {
    const idx = Object.keys(prdTagColors).length
    prdTagColors[prd] = prdColorList[idx % prdColorList.length]
  }
  return prdTagColors[prd]
}

export function Timeline({ items, prdPhases }: Props) {
  if (prdPhases) {
    prdPhases.forEach((p) => getPrdColor(p))
  }

  if (items.length === 0) {
    return <div className="text-[#6b7b8d] text-sm py-8 text-center">暂无时间线数据</div>
  }

  return (
    <div className="px-5 max-h-[420px] overflow-y-auto">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-4 py-2 border-l-2 border-[#1e2d3d] ml-2 pl-4 relative before:content-[''] before:w-2.5 before:h-2.5 before:rounded-full before:bg-green-500 before:absolute before:left-[-6px] before:top-3"
        >
          <div className="text-[11px] text-[#6b7b8d] min-w-[46px] shrink-0">
            {formatShortDate(item.timestamp)}
          </div>
          <div className="text-xs">
            {item.title}
            {item.prdPhase && (
              <span
                className="inline-block px-2 py-0.5 rounded ml-1.5 text-[11px]"
                style={{
                  backgroundColor: getPrdColor(item.prdPhase).bg,
                  color: getPrdColor(item.prdPhase).text,
                }}
              >
                {item.prdPhase}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
