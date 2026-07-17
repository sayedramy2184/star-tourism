'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'
import {
  FolderOpen, Calendar, Car, Users, UserCheck,
  Building2, Receipt, BarChart3, LogOut, Settings, Handshake, LayoutDashboard, KeyRound
} from 'lucide-react'
import clsx from 'clsx'

interface SidebarProps {
  profile: Profile & { company?: { nom: string } }
  mobileOpen?: boolean
  onClose?: () => void
}

const navSections = [
  {
    label: 'Opérations',
    items: [
      { href: '/dashboard/dispatch',    label: 'Dispatch',      icon: LayoutDashboard, badge: null },
      { href: '/dashboard/dossiers',    label: 'Dossiers',      icon: FolderOpen,  badge: null },
      { href: '/dashboard/planning',    label: 'Planning',      icon: Calendar,    badge: null },
      { href: '/dashboard/vehicules',   label: 'Véhicules',     icon: Car,         badge: null },
      { href: '/dashboard/loueurs',     label: 'Loueurs',       icon: KeyRound,    badge: null },
    ],
  },
  {
    label: 'Ressources',
    items: [
      { href: '/dashboard/chauffeurs',  label: 'Chauffeurs',    icon: UserCheck,   badge: null },
      { href: '/dashboard/clients',     label: 'Clients',       icon: Building2,   badge: null },
      { href: '/dashboard/sous-traitants', label: 'Sous-traitants', icon: Handshake,      badge: null },
    ],
  },
  {
    label: 'Finances',
    items: [
      { href: '/dashboard/facturation', label: 'Facturation',   icon: Receipt,     badge: null },
      { href: '/dashboard/rapports',    label: 'Rapports',      icon: BarChart3,   badge: null },
    ],
  },
  {
    label: 'Compte',
    items: [
      { href: '/dashboard/parametres', label: 'Paramètres', icon: Settings, badge: null },
    ],
  },
]

export default function Sidebar({ profile, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const initials = `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase()

  return (
    <aside className={clsx(
      'fixed top-0 left-0 bottom-0 w-[232px] bg-noir flex flex-col z-50',
      'transition-transform duration-200 ease-out md:translate-x-0',
      mobileOpen ? 'translate-x-0' : '-translate-x-full'
    )}>

      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Star Tourism Services"
               className="w-9 h-9 object-contain flex-shrink-0" />
          <span className="font-display text-[15px] font-medium text-white tracking-[2px]">
            STAR TOURISM
          </span>
        </div>
        <div className="text-[8px] tracking-[3px] text-white/25 uppercase mt-1.5">
          {profile.company?.nom ?? 'Star Tourism Services'}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map(section => (
          <div key={section.label} className="py-4">
            <div className="px-5 mb-1 text-[8px] tracking-[3px] text-white/25 uppercase font-semibold">
              {section.label}
            </div>
            {section.items.map(item => {
              const Icon    = item.icon
              const active  = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    'nav-item',
                    active && 'nav-item-active'
                  )}
                >
                  <Icon size={13} className="flex-shrink-0 opacity-70" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-or text-white text-[9px] font-bold
                                     px-1.5 py-px rounded-full font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-5 py-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-or/20 border border-or
                          flex items-center justify-center text-[10px]
                          text-or font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white font-medium truncate">
              {profile.prenom} {profile.nom}
            </div>
            <div className="text-[10px] text-white/35 capitalize">{profile.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/25 hover:text-white/70 transition-colors p-1"
            title="Déconnexion"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

    </aside>
  )
}
