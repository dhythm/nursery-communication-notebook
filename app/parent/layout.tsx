import { requireRole } from '@/lib/auth/server'
import { ParentShell } from '@/components/parent/parent-shell'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireRole('parent')
  return <ParentShell>{children}</ParentShell>
}
