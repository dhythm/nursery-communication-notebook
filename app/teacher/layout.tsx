import { requireRole } from '@/lib/auth/server'
import { TeacherShell } from '@/components/teacher/teacher-shell'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireRole('teacher')
  return <TeacherShell>{children}</TeacherShell>
}
