import { notFound } from 'next/navigation'
import { ParentChildDetails } from '@/components/parent/child-details'
import { requireFacilityRole } from '@/lib/auth/server'
import { getDatabase } from '@/lib/db'
import { canAccessChild } from '@/lib/facility-access'
import ParentHome from '@/app/parent/page'
import ParentFiles from '@/app/parent/files/page'
import ParentMessages from '@/app/parent/messages/page'
import ParentNotebook from '@/app/parent/notebook/page'
import ParentNotices from '@/app/parent/notices/page'
import ParentSettings from '@/app/parent/settings/page'
import ParentHelp from '@/app/parent/settings/help/page'
import ParentPrivacy from '@/app/parent/settings/privacy/page'
import ParentTerms from '@/app/parent/settings/terms/page'
import TeacherDashboard from '@/app/teacher/page'
import TeacherAudit from '@/app/teacher/audit/page'
import TeacherCalendar from '@/app/teacher/calendar/page'
import TeacherChildren from '@/app/teacher/children/page'
import TeacherFiles from '@/app/teacher/files/page'
import TeacherManagement from '@/app/teacher/management/page'
import TeacherMessages from '@/app/teacher/messages/page'
import TeacherNotices from '@/app/teacher/notices/page'

const parentPages: Record<string, React.ComponentType> = {
  '': ParentHome,
  files: ParentFiles,
  messages: ParentMessages,
  notebook: ParentNotebook,
  notices: ParentNotices,
  settings: ParentSettings,
  'settings/help': ParentHelp,
  'settings/privacy': ParentPrivacy,
  'settings/terms': ParentTerms,
}

const teacherPages: Record<string, React.ComponentType> = {
  '': TeacherDashboard,
  audit: TeacherAudit,
  calendar: TeacherCalendar,
  children: TeacherChildren,
  files: TeacherFiles,
  management: TeacherManagement,
  messages: TeacherMessages,
  notices: TeacherNotices,
}

export default async function FacilityPage({
  params,
}: {
  params: Promise<{ facilitySlug: string; role: string; section?: string[] }>
}) {
  const { facilitySlug, role, section = [] } = await params
  if (
    role === 'parent' &&
    section.length === 3 &&
    section[0] === 'settings' &&
    section[1] === 'children'
  ) {
    const user = await requireFacilityRole(facilitySlug, 'parent')
    if (!(await canAccessChild(await getDatabase(), user, section[2]))) notFound()
    return <ParentChildDetails childId={section[2]} />
  }
  if (role === 'teacher' && (section[0] === 'audit' || section[0] === 'management')) {
    const user = await requireFacilityRole(facilitySlug, 'teacher')
    if (!user.canManageFacility) notFound()
  }
  const pages = role === 'parent' ? parentPages : role === 'teacher' ? teacherPages : undefined
  const Page = pages?.[section.join('/')]
  if (!Page) notFound()
  return <Page />
}
