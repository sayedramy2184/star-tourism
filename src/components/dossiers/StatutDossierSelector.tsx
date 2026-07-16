'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Statuts dossier — 3 uniquement, gérés automatiquement
type DossierStatut = 'en_attente' | 'en_cours' | 'termine'

const STATUTS: Record<DossierStatut, { label: string; color: string; bg: string; dot: string; desc: string }> = {
  en_attente: { label: 'En attente', color: '#7a5c10', bg: '#fdf3dc', dot: '#7a5c10', desc: 'En attente de validation' },
  en_cours:   { label: 'En cours',   color: '#1e3f70', bg: '#e8eef8', dot: '#1e3f70', desc: 'Dossier validé et actif' },
  termine:    { label: 'Terminé',    color: '#1e5e3a', bg: '#eaf4ee', dot: '#1e5e3a', desc: 'Toutes les prestations terminées' },
}

interface Props {
  dossierId: string
  statut: string
  onStatutChange?: (s: string) => void
}

function InfoDropdown({ anchorRef, statut, onClose }: {
  anchorRef: React.RefObject<HTMLDivElement>
  statut: string
  onClose: () => void
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const info = STATUTS[statut as DossierStatut] ?? STATUTS.en_attente

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX })
    }
  }, [])

  if (!pos) return null

  return (
    <div style={{ position:'absolute', top:pos.top, left:pos.left, zIndex:9999, width:'220px', background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 8px 28px rgba(0,0,0,0.15)', padding:'12px 14px' }}>
      <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'10px' }}>
        Statuts du dossier
      </div>
      {(Object.entries(STATUTS) as [DossierStatut, typeof STATUTS[DossierStatut]][]).map(([key, s]) => (
        <div key={key} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'6px 0', borderBottom:'1px solid #f5f2ed', opacity: statut === key ? 1 : 0.4 }}>
          <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:s.dot, flexShrink:0, marginTop:'3px' }} />
          <div>
            <div style={{ fontSize:'11px', fontWeight:700, color:s.color }}>{s.label}</div>
            <div style={{ fontSize:'9px', color:'#8a8478' }}>{s.desc}</div>
          </div>
          {statut === key && <span style={{ marginLeft:'auto', fontSize:'10px', color:s.color }}>✓</span>}
        </div>
      ))}
      <div style={{ fontSize:'9px', color:'#b8b0a4', marginTop:'8px', fontStyle:'italic' }}>
        Le statut est géré automatiquement
      </div>
    </div>
  )
}

export default function StatutDossierSelector({ dossierId, statut, onStatutChange }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [open,    setOpen]    = useState(false)
  const [current, setCurrent] = useState(statut)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setCurrent(statut) }, [statut])

  const info = STATUTS[current as DossierStatut] ?? STATUTS.en_attente

  return (
    <div ref={anchorRef} style={{ position:'relative', display:'inline-block' }} onClick={e => e.stopPropagation()}>
      <div
        onMouseDown={() => setOpen(o => !o)}
        style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'4px 10px 4px 8px', background:info.bg, border:`1.5px solid ${info.color}44`, cursor:'pointer', userSelect:'none' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:info.dot, flexShrink:0, animation: current==='en_cours' ? 'blink 1.6s infinite' : 'none' }} />
        <span style={{ fontSize:'10px', fontWeight:700, color:info.color }}>{info.label}</span>
        <span style={{ fontSize:'9px', color:info.color, opacity:0.5 }}>ℹ</span>
      </div>

      {open && mounted && createPortal(
        <>
          <div style={{ position:'fixed', inset:0, zIndex:9998 }} onMouseDown={() => setOpen(false)} />
          <InfoDropdown anchorRef={anchorRef} statut={current} onClose={() => setOpen(false)} />
        </>,
        document.body
      )}
    </div>
  )
}
