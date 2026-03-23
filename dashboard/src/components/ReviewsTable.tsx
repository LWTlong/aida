import { useState } from 'react'
import type { ReviewItem } from '../types'
import { Modal } from './Modal'
import { formatShortDate, formatLocalDate } from '../utils/date'

interface Props {
  reviews: ReviewItem[]
}

export function ReviewsTable({ reviews }: Props) {
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null)

  if (reviews.length === 0) {
    return <div className="text-[#6b7b8d] text-sm py-4 text-center">暂无自检报告</div>
  }

  return (
    <>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[80px]">编号</th>
            <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">日期</th>
            <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[200px]">范围</th>
            <th className="text-left px-3 py-2 text-[#6b7b8d] border-b border-[#1e2d3d] font-medium min-w-[100px]">问题数</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((r) => (
            <tr key={r.reviewId} className="hover:bg-[#1a2e40]">
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[80px]">{r.reviewId}</td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[100px]">{formatShortDate(r.reviewedAt)}</td>
              <td className="px-3 py-2 border-b border-[#1e2d3d] min-w-[200px]">{r.scope}</td>
              <td className="px-3 py-2 border-b border-[#1e2d3d]">
                {r.issueCount > 0 ? (
                  <span
                    className="text-amber-500 cursor-pointer hover:underline"
                    onClick={() => setSelectedReview(r)}
                  >
                    {r.issueCount} 个问题
                  </span>
                ) : (
                  <span className="text-green-500">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal
        title={`自检详情 — ${selectedReview?.reviewId}`}
        open={!!selectedReview}
        onClose={() => setSelectedReview(null)}
      >
        {selectedReview && (
          <div className="space-y-3 text-[13px]">
            <div><span className="text-[#6b7b8d]">范围：</span>{selectedReview.scope}</div>
            <div><span className="text-[#6b7b8d]">日期：</span>{formatLocalDate(selectedReview.reviewedAt)}</div>
            <div><span className="text-[#6b7b8d]">问题数：</span><span className="text-amber-500">{selectedReview.issueCount}</span></div>
            {selectedReview.issues && selectedReview.issues.length > 0 && (
              <div className="pt-3 border-t border-[#1e2d3d] space-y-2">
                <div className="text-[#6b7b8d] text-xs">问题列表：</div>
                {selectedReview.issues.map((issue, idx) => (
                  <div key={idx} className="text-xs pl-3 border-l-2 border-[#1e2d3d] text-[#e0e6ed]">
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
