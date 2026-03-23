import type { ReactNode } from 'react'

interface Props {
  title: string
  full?: boolean
  children: ReactNode
}

export function ChartCard({ title, full, children }: Props) {
  return (
    <div className={`bg-[#162231] border border-[#1e2d3d] rounded-[10px] p-5 ${full ? 'col-span-full' : ''}`}>
      <h3 className="text-sm font-semibold text-[#94a3b8] mb-4 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  )
}
