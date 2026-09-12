import LoginPage from '@/components/login-page'
import { getRuntimeConfig } from '@/lib/runtime-config'

export default function HomePage() {
  getRuntimeConfig()
  return <LoginPage />
}
