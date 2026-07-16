'use client'

import { usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Profile } from '@/types'
import { Menu } from 'lucide-react'
import NotificationsBell from './NotificationsBell'

interface TopBarProps {
  profile: Profile
  onBurger?: () => void
}

const pageTitles: Record<string, string> = {
  '/dashboard/dispatch':       'Dispatch',
  '/dashboard/dossiers':       'Dossiers',
  '/dashboard/planning':       'Planning',
  '/dashboard/vehicules':      'Véhicules',
  '/dashboard/chauffeurs':     'Chauffeurs',
  '/dashboard/clients':        'Clients',
  '/dashboard/sous-traitants': 'Sous-traitants',
  '/dashboard/facturation':    'Facturation',
  '/dashboard/rapports':       'Rapports',
  '/dashboard/parametres':     'Paramètres',
}

export default function TopBar({ profile, onBurger }: TopBarProps) {
  const pathname = usePathname()

  // Cherche le titre correspondant au pathname
  const title = Object.entries(pageTitles).find(
    ([key]) => pathname.startsWith(key)
  )?.[1] ?? 'Dashboard'

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr })
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <header className="bg-surface border-b-2 border-border-dk px-4 md:px-8 h-14
                       flex items-center gap-3 md:gap-4 sticky top-0 z-40 shadow-sm">
      {/* Burger — mobile uniquement */}
      <button
        onClick={onBurger}
        className="md:hidden text-noir p-1 -ml-1"
        aria-label="Ouvrir le menu">
        <Menu size={20} />
      </button>

      <h1 className="font-display text-lg md:text-xl font-medium text-noir tracking-wide truncate">
        {title}
      </h1>

      <div className="hidden sm:block w-px h-5 bg-border-dk" />

      <span className="hidden sm:inline font-mono text-xs text-gris truncate">
        {todayFormatted}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <NotificationsBell />
      </div>
    </header>
  )
}
