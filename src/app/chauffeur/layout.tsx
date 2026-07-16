import type { Metadata, Viewport } from 'next'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Star Tourism Services — Chauffeur',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Star Chauffeur',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#16130e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function ChauffeurLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#16130e', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: '480px', minHeight: '100dvh',
        background: '#ede9e2', position: 'relative',
        boxShadow: '0 0 40px rgba(0,0,0,0.25)',
      }}>
        {children}
      </div>
      <ServiceWorkerRegister />
    </div>
  )
}
