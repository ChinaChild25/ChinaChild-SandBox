import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/lib/auth-context"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
})

export const metadata: Metadata = {
  title: "ChinaChild — кабинет ученика",
  description: "Личный кабинет ученика: занятия, курсы, прогресс и настройки.",
  keywords: ["ChinaChild", "китайский язык", "HSK", "образовательная платформа"],
}

export const viewport: Viewport = {
  themeColor: "#f4f6fb",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
