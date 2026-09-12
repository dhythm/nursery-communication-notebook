import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/server'
import { facilityPagePath } from '@/lib/facility-path'

export default async function ParentLayout() {
  const user = await requireRole('parent')
  redirect(facilityPagePath(user.facilitySlug, 'parent'))
}
