import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lapendaz Infinity',
  description: 'AI-Guided Meeting & Transformation Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full infinity-bg">{children}</body>
    </html>
  )
}
