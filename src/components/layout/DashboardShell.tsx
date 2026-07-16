'use client'

import { useState } from 'react'
import type { Profile } from '@/types'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface Props {
  profile: Profile & { company?: { nom: string } }
  children: React.ReactNode
}

export default function DashboardShell({ profile, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* min-w-0 : empêche les tableaux larges de déborder du viewport */}
      <div className="flex-1 flex flex-col md:ml-[232px] min-w-0">
        <TopBar profile={profile} onBurger={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-8 bg-bg min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
