import { TriangleAlert } from 'lucide-react'

export function DemoBanner() {
  return (
    <aside
      aria-label="デモ環境のお知らせ"
      className="z-50 shrink-0 bg-amber-700 px-3 py-1.5 text-white shadow-sm"
    >
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-xs font-semibold sm:text-sm">
        <span className="inline-flex items-center gap-1">
          <TriangleAlert aria-hidden="true" className="size-3.5" />
          共用デモ環境
        </span>
        <span className="font-medium">
          実在する個人情報を入力しないでください。入力内容は定期的にリセットされます。
        </span>
      </p>
    </aside>
  )
}
