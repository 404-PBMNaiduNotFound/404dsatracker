import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'DSA Preparation Tracker',
  description: 'Master DSA with a personalised comprehensive plan',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DSA⁴⁰⁴',
  },
  icons: {
    icon: '/app-icon-circular.png',
    apple: '/app-icon-circular.png',
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2ead8' },
    { media: '(prefers-color-scheme: dark)', color: '#1a160e' },
  ],
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ backgroundColor: '#f2ead8', colorScheme: 'light dark' }}>
      <head>
        {/* Prevent white flash before CSS loads — must be synchronous */}
        <style dangerouslySetInnerHTML={{ __html: `
          html { background-color: #f2ead8; }
          @media (prefers-color-scheme: dark) { html:not(.light) { background-color: #1a160e; } }
          .dark { background-color: #1a160e; }
        `}} />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
