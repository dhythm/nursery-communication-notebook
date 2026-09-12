import type { Role } from './types'

export const publicDemoAccounts = [
  {
    role: 'parent',
    label: '保護者',
    email: 'sakura@example.com',
    password: 'DemoParent2026!',
  },
  {
    role: 'teacher',
    label: '保育士',
    email: 'yamada@nijiiro.ed.jp',
    password: 'DemoTeacher2026!',
  },
] as const satisfies ReadonlyArray<{
  role: Role
  label: string
  email: string
  password: string
}>
