import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ENVITED-X Simulation Asset Search',
  description:
    'Natural language search for ENVITED-X simulation assets using ontology-based SPARQL generation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
