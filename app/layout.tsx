import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'ChinaChild — образовательная платформа',
  description: 'Личный кабинет ученика: занятия, курсы, прогресс и настройки.',
  keywords: ['ChinaChild', 'китайский язык', 'HSK', 'учебная платформа'],
}

export const viewport: Viewport = {
  themeColor: '#ececec',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
