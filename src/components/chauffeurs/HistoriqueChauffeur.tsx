'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface HistoItem {
  id: string
  kind: 'mad' | 'transfert'
  date: string            // yyyy-mm-dd
  heure: string | null
  jourSemaine?: string | null
  clientNom: string
  dossierId: string | null
  dossierNumero: string | null
  details: string
  tarif: number
  statut: string
}

const STATUTS: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: '#7a5c10' },
  confirme:   { label: 'Confirmé',   color: '#1e5e3a' },
  en_cours:   { label: 'En cours',   color: '#1e3f70' },
  termine:    { label: 'Terminé',    color: '#8a8478' },
  annule:     { label: 'Annulé',     color: '#9e2a2a' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

const emptyFilters = { type: 'tous', statut: 'tous', client: 'tous', du: '', au: '' }

export default function HistoriqueChauffeur({ items }: { items: HistoItem[] }) {
  const [f, setF] = useState(emptyFilters)

  // Clients distincts présents dans l'historique (pour le sélecteur)
  const clients = useMemo(
    () => Array.from(new Set(items.map(i => i.clientNom).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  )

  const filtered = useMemo(() => {
    return items
      .filter(i => f.type === 'tous' || i.kind === f.type)
      .filter(i => f.statut === 'tous' || i.statut === f.statut)
      .filter(i => f.client === 'tous' || i.clientNom === f.client)
      .filter(i => !f.du || i.date >= f.du)
      .filter(i => !f.au || i.date <= f.au)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [items, f])

  const caFiltre = filtered.reduce((s, i) => s + (i.tarif ?? 0), 0)
  const active = f.type !== 'tous' || f.statut !== 'tous' || f.client !== 'tous' || !!f.du || !!f.au

  return (
    <div>
      {/* En-tête */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
        <span className="section-title">Historique des prestations</span>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#8a8478' }}>
          {filtered.length} prestation{filtered.length > 1 ? 's' : ''} · CA filtré {fmt(caFiltre)}
        </span>
      </div>

      {/* Barre de filtres */}
      <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', padding:'10px 12px', marginBottom:'12px', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'flex-end' }}>
        {/* Type */}
        <div style={{ display:'flex', gap:'4px' }}>
          {([['tous','Tous'],['mad','MAD'],['transfert','Transfert']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setF({ ...f, type: v })}
              className={`filter-chip${f.type === v ? ' active' : ''}`}>{l}</button>
          ))}
        </div>

        {/* Statut */}
        <div>
          <label className="form-label">Statut</label>
          <select className="select" style={{ minWidth:'130px' }} value={f.statut} onChange={e => setF({ ...f, statut: e.target.value })}>
            <option value="tous">Tous statuts</option>
            {Object.entries(STATUTS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>

        {/* Client */}
        <div>
          <label className="form-label">Client</label>
          <select className="select" style={{ minWidth:'160px', maxWidth:'220px' }} value={f.client} onChange={e => setF({ ...f, client: e.target.value })}>
            <option value="tous">Tous clients</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Période */}
        <div>
          <label className="form-label">Du</label>
          <input type="date" className="input" style={{ width:'150px' }} value={f.du} onChange={e => setF({ ...f, du: e.target.value })} />
        </div>
        <div>
          <label className="form-label">Au</label>
          <input type="date" className="input" style={{ width:'150px' }} value={f.au} onChange={e => setF({ ...f, au: e.target.value })} />
        </div>

        {active && (
          <button className="btn-ghost" style={{ padding:'7px 12px', fontSize:'11px' }} onClick={() => setF(emptyFilters)}>
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* Liste mobile (cartes) */}
      <div className="md:hidden" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding:'30px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>{items.length === 0 ? 'Aucune prestation pour ce chauffeur' : 'Aucune prestation ne correspond aux filtres'}</div>
        ) : filtered.map(i => {
          const s = STATUTS[i.statut] ?? { label: i.statut, color: '#8a8478' }
          const card = (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                  <span className={i.kind === 'mad' ? 'pill-mad' : 'pill-transfer'}>{i.kind === 'mad' ? 'MAD' : 'Transfert'}</span>
                  <span className="mono" style={{ fontSize:'11px' }}>{i.jourSemaine ? `${i.jourSemaine} ` : ''}{format(parseISO(i.date),'dd/MM/yy',{locale:fr})}{i.heure ? ` · ${i.heure}` : ''}</span>
                </div>
                <span style={{ fontSize:'10px', fontWeight:700, color:s.color }}>{s.label}</span>
              </div>
              <div style={{ fontWeight:600, fontSize:'13px', marginTop:'6px' }}>{i.clientNom}</div>
              <div className="mono" style={{ fontSize:'9px', color:'#9a7a28' }}>{i.dossierNumero}</div>
              {i.details && <div style={{ fontSize:'11px', color:'#5a564e', marginTop:'4px', whiteSpace:'pre-line' }}>{i.details}</div>}
              <div className="mono" style={{ fontSize:'12px', color:'#9a7a28', marginTop:'6px', textAlign:'right' }}>{i.tarif ? fmt(i.tarif) : '—'}</div>
            </>
          )
          const boxStyle = { display:'block', background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', padding:'12px', textDecoration:'none', color:'inherit' as const }
          return i.dossierId
            ? <Link key={i.id} href={`/dashboard/dossiers/${i.dossierId}`} style={boxStyle}>{card}</Link>
            : <div key={i.id} style={boxStyle}>{card}</div>
        })}
      </div>

      {/* Tableau (desktop) */}
      <div className="table-container hidden md:block">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Date','Type','Client / Dossier','Détails','Tarif HT','Statut'].map((h, i) => (
                <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding:'50px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
                {items.length === 0 ? 'Aucune prestation pour ce chauffeur' : 'Aucune prestation ne correspond aux filtres'}
              </td></tr>
            ) : filtered.map(i => {
              const s = STATUTS[i.statut] ?? { label: i.statut, color: '#8a8478' }
              return (
                <tr key={i.id} className="tr-body">
                  <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>
                      {i.jourSemaine ? `${i.jourSemaine} ` : ''}{format(parseISO(i.date),'dd/MM/yyyy',{locale:fr})}
                      {i.heure && <div style={{ fontSize:'10px', color:'#8a8478' }}>{i.heure}</div>}
                    </div>
                  </td>
                  <td className="td"><span className={i.kind === 'mad' ? 'pill-mad' : 'pill-transfer'}>{i.kind === 'mad' ? 'MAD' : 'Transfert'}</span></td>
                  <td className="td">
                    <div style={{ fontWeight:600, fontSize:'12px' }}>{i.clientNom}</div>
                    {i.dossierId
                      ? <Link href={`/dashboard/dossiers/${i.dossierId}`} style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#9a7a28', textDecoration:'none' }}>{i.dossierNumero}</Link>
                      : <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#9a7a28' }}>{i.dossierNumero}</span>}
                  </td>
                  <td className="td"><div style={{ fontSize:'11px', color:'#5a564e', whiteSpace:'pre-line' }}>{i.details}</div></td>
                  <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28' }}>{i.tarif ? fmt(i.tarif) : '—'}</span></td>
                  <td className="td"><span style={{ fontSize:'10px', fontWeight:700, color: s.color }}>{s.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
