'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell, FileWarning, UserX, AlertTriangle } from 'lucide-react'

interface Alerte { severity: 'danger' | 'warn'; title: string; detail: string; href: string }
interface Data { total: number; danger: number; warn: number; groups: { documents: Alerte[]; nonAffectees: Alerte[]; conflits: Alerte[] } }

export default function NotificationsBell() {
  const [data, setData] = useState<Data | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/alertes').then(r => r.json()).then(j => { if (alive && j.data) setData(j.data) }).catch(() => {})
    load()
    const t = setInterval(load, 5 * 60 * 1000) // rafraîchit toutes les 5 min
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const total = data?.total ?? 0
  const danger = data?.danger ?? 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        className="relative text-gris hover:text-noir transition-colors p-1">
        <Bell size={16} />
        {total > 0 && (
          <span style={{ position: 'absolute', top: '-3px', right: '-4px', minWidth: '15px', height: '15px', padding: '0 3px', borderRadius: '8px', background: danger > 0 ? '#9e2a2a' : '#7a5c10', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '340px', maxWidth: '92vw', maxHeight: '70vh', overflowY: 'auto', background: '#fff', border: '1.5px solid #b8b0a4', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', zIndex: 60 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1.5px solid #d8d2c8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff' }}>
            <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '16px', color: '#16130e' }}>Alertes</span>
            <span style={{ fontSize: '11px', color: '#8a8478' }}>{total} au total</span>
          </div>

          {total === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>
              ✓ Aucune alerte — tout est à jour.
            </div>
          ) : (
            <>
              <Section icon={<AlertTriangle size={13} />} title="Conflits de planning" items={data!.groups.conflits} onNav={() => setOpen(false)} />
              <Section icon={<UserX size={13} />} title="Missions non affectées" items={data!.groups.nonAffectees} onNav={() => setOpen(false)} />
              <Section icon={<FileWarning size={13} />} title="Documents à renouveler" items={data!.groups.documents} onNav={() => setOpen(false)} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ icon, title, items, onNav }: { icon: React.ReactNode; title: string; items: Alerte[]; onNav: () => void }) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ padding: '8px 16px 4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9a7a28', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon} {title} ({items.length})
      </div>
      {items.map((a, i) => (
        <Link key={i} href={a.href} onClick={onNav}
          style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '9px 16px', borderBottom: '1px solid #ede9e2', textDecoration: 'none' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, marginTop: '4px', background: a.severity === 'danger' ? '#9e2a2a' : '#7a5c10' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: '#16130e', fontWeight: 500 }}>{a.title}</div>
            <div style={{ fontSize: '10px', color: '#8a8478', marginTop: '1px' }}>{a.detail}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
