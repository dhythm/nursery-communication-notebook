import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/server'
import { facilityPagePath } from '@/lib/facility-path'

export default async function TeacherLayout() {
  const user = await requireRole('teacher')
  redirect(facilityPagePath(user.facilitySlug, 'teacher'))
}
