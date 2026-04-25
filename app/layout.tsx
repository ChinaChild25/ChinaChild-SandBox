import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppProviders } from "@/components/app-providers"
import { AppEnvironmentBadge } from "@/components/app-environment-badge"
import { AuthProvider } from "@/lib/auth-context"
import { getAppEnvironmentLabel } from "@/lib/app-environment"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
})

const appEnvironmentLabel = getAppEnvironmentLabel()

export const metadata: Metadata = {
  title: appEnvironmentLabel
    ? `ChinaChild ${appEnvironmentLabel} — кабинет ученика и преподавателя`
    : "ChinaChild — кабинет ученика и преподавателя",
  description: "Личный кабинет: занятия, курсы, прогресс, журнал преподавателя и настройки.",
  keywords: ["ChinaChild", "китайский язык", "HSK", "образовательная платформа"],
}

export const viewport: Viewport = {
  themeColor: "#f5f5f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /** Android Chrome: вьюпорт подстраивается под клавиатуру, меньше рассинхрона с iOS-фиксом выше */
  interactiveWidget: "resizes-content"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppEnvironmentBadge />
        <AppProviders>
          <AuthProvider>{children}</AuthProvider>
        </AppProviders>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
