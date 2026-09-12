'use client'

import Link from 'next/link'
import { ShieldCheck, Clock, NotebookPen, Moon } from 'lucide-react'
import { PageTitle } from '@/components/teacher/page-title'
import { useFacilityPath } from '@/lib/facility-path-client'
import { cn } from '@/lib/utils'
import { RiskPanel } from './risk-panel'
import { PlanPanel } from './plan-panel'
import { AttendancePanel } from './attendance-panel'
import { NapPanel } from './nap-panel'

const sections = [
  { key: 'attendance', label: '出退勤', icon: Clock, panel: AttendancePanel },
  { key: 'risks', label: 'リスク管理', icon: ShieldCheck, panel: RiskPanel },
  { key: 'plans', label: '指導計画', icon: NotebookPen, panel: PlanPanel },
  { key: 'nap', label: '午睡チェック', icon: Moon, panel: NapPanel },
] as const

export function OperationsPage({
  section = 'attendance',
}: {
  section?: 'risks' | 'attendance' | 'plans' | 'nap'
}) {
  const facilityPath = useFacilityPath()
  const selected = sections.find((item) => item.key === section)
  const Panel = selected?.panel
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageTitle title={selected?.label ?? '職員業務'} />
      <nav aria-label="職員業務" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sections.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={facilityPath(`/teacher/operations/${item.key}`)}
              aria-current={item.key === section ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-2xl border border-border p-4 text-sm font-semibold',
                item.key === section ? 'bg-secondary text-primary' : 'bg-card hover:bg-muted',
              )}
            >
              <Icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      {Panel && <Panel key={section} />}
    </div>
  )
}
