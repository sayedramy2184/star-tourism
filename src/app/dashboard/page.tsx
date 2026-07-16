'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  FolderOpen, Calendar, Car, UserCheck, Building2, Handshake, ArrowUpRight,
} from 'lucide-react'

const stats = [
  { key: 'dossiers',       label: 'Dossiers',        href: '/dashboard/dossiers',       icon: FolderOpen,  api: '/api/dossiers' },
  { key: 'clients',        label: 'Clients',         href: '/dashboard/clients',        icon: Building2,   api: '/api/clients' },
  { key: 'vehicules',      label: 'Véhicules',       href: '/dashboard/vehicules',      icon: Car,         api: '/api/vehicules' },
  { key: 'chauffeurs',     label: 'Chauffeurs',      href: '/dashboard/chauffeurs',     icon: UserCheck,   api: '/api/chauffeurs' },
  { key: 'sous-traitants', label: 'Sous-traitants',  href: '/dashboard/sous-traitants', icon: Handshake,   api: '/api/sous-traitants' },
]

const quickLinks = [
  { label: 'Nouveau dossier', href: '/dashboard/dossiers/nouveau', icon: FolderOpen },
  { label: 'Planning',        href: '/dashboard/planning',         icon: Calendar },
]

export default function DashboardHome() {
  const [counts, setCounts] = useState<Record<string, number | null>>({})

  useEffect(() => {
    stats.forEach(s => {
      fetch(s.api)
        .then(r => r.json())
        .then(({ data }) => setCounts(prev => ({ ...prev, [s.key]: Array.isArray(data) ? data.length : 0 })))
        .catch(() => setCounts(prev => ({ ...prev, [s.key]: null })))
    })
  }, [])

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <span className="section-title">Tableau de bord</span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {stats.map(s => {
          const Icon = s.icon
          const value = counts[s.key]
          return (
            <Link
              key={s.key}
              href={s.href}
              style={{
                background: '#fff', border: '1px solid #e0d9cd', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '14px', textDecoration: 'none',
                transition: 'border-color .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Icon size={16} style={{ color: '#9a7a28' }} />
                <ArrowUpRight size={14} style={{ color: '#b8b0a4' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '30px', fontWeight: 500, color: '#16130e', lineHeight: 1 }}>
                  {value === undefined ? '—' : value === null ? '×' : value}
                </div>
                <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#8a8478', marginTop: '6px' }}>
                  {s.label}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Quick actions */}
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a7a28', marginBottom: '14px' }}>
        Accès rapide
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {quickLinks.map(q => {
          const Icon = q.icon
          return (
            <Link key={q.href} href={q.href} className="btn-ghost" style={{ textDecoration: 'none' }}>
              <Icon size={14} /> {q.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
