import type { Metadata, Viewport } from 'next'
import { Noto_Sans, Noto_Sans_SC } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

const notoSans = Noto_Sans({ 
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
})

const notoSansSC = Noto_Sans_SC({ 
  subsets: ["latin"],
  variable: "--font-chinese",
  weight: ["400", "500", "700"],
  display: "swap"
})

export const metadata: Metadata = {
  title: 'HanYu Academy - Learn Chinese Online',
  description: 'Master Mandarin Chinese with personalized lessons, expert instructors, and interactive learning tools. Start your Chinese language journey today.',
  keywords: ['Chinese', 'Mandarin', 'language learning', 'HSK', 'online courses'],
}

export const viewport: Viewport = {
  themeColor: '#b54839',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${notoSans.variable} ${notoSansSC.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
