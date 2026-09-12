'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useFacilityPath } from '@/lib/facility-path-client'

export function SettingsBackLink() {
  const facilityPath = useFacilityPath()

  return (
    <Link
      href={facilityPath('/parent/settings')}
      className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      設定に戻る
    </Link>
  )
}
