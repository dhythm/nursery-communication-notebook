import { notFound } from 'next/navigation'
import { ParentShell } from '@/components/parent/parent-shell'
import { TeacherShell } from '@/components/teacher/teacher-shell'
import { requireFacilityRole } from '@/lib/auth/server'
import type { Role } from '@/lib/types'

export default async function FacilityRoleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ facilitySlug: string; role: string }>
}) {
  const { facilitySlug, role: roleParam } = await params
  if (roleParam !== 'parent' && roleParam !== 'teacher') notFound()
  const role: Role = roleParam
  await requireFacilityRole(facilitySlug, role)
  return role === 'parent' ? (
    <ParentShell>{children}</ParentShell>
  ) : (
    <TeacherShell>{children}</TeacherShell>
  )
}
