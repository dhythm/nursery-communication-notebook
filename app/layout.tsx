import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { M_PLUS_Rounded_1c, Zen_Maru_Gothic } from 'next/font/google'
import { StoreProvider } from '@/lib/store'
import './globals.css'

const mplus = M_PLUS_Rounded_1c({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-mplus',
  display: 'swap',
})

const zenMaru = Zen_Maru_Gothic({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-zenmaru',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'にじいろ連絡帳 | 保育園と保護者をつなぐ',
  description:
    '保育園と保護者がつながる連絡帳アプリ。連絡帳・メッセージ・お知らせ・資料共有・カレンダーをひとつに。',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f6b93b',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${mplus.variable} ${zenMaru.variable} bg-background`}>
      <body className="font-sans antialiased">
        <StoreProvider>{children}</StoreProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
