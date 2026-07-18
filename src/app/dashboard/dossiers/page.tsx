'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StatutDossierSelector from '@/components/dossiers/StatutDossierSelector'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useSearchPaginate } from '@/lib/useSearchPaginate'
import { SearchBar, Pager } from '@/components/ui/ListControls'
import { exportCsv } from '@/lib/exportCsv'
import { Users } from 'lucide-react'

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function agencePending(d: any): number {
  if (d.origine !== 'agence') return 0
  return (d.prestations ?? []).filter((p: any) => p.validation_statut === 'a_valider').length
}
function AgenceBadge({ d }: { d: any }) {
  if (d.origine !== 'agence') return null
  const n = agencePending(d)
  return (
    <span style={{ fontSize:'8px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', padding:'2px 7px', borderRadius:'999px',
      background: n > 0 ? '#fdf3dc' : '#f0ebfa', color: n > 0 ? '#7a5c10' : '#4a2a6e', border:`1px solid ${n > 0 ? 'rgba(122,92,16,0.25)' : 'rgba(74,42,110,0.2)'}` }}>
      Agence{n > 0 ? ` · ${n} à valider` : ''}
    </span>
  )
}

// Noms des passagers du dossier (affichés sous les prestations pour distinguer
// plusieurs dossiers d'un même client).
function PassagersLine({ passagers }: { passagers?: any[] }) {
  const noms = (passagers ?? []).map((p: any) => p?.nom).filter(Boolean)
  if (!noms.length) return null
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:'4px', marginTop:'5px', fontSize:'11px', color:'#5a564e', lineHeight:1.35 }}>
      <Users size={11} style={{ color:'#8a8478', flexShrink:0, marginTop:'2px' }} />
      <span>{noms.join(', ')}</span>
    </div>
  )
}

export default function DossiersPage() {
  const router = useRouter()
  const [dossiers, setDossiers] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filterActif, setFilterActif] = useState('Toutes')

  useEffect(() => {
    fetch('/api/dossiers')
      .then(r => r.json())
      .then(({ data }) => setDossiers(data ?? []))
      .catch(() => setDossiers([]))
      .finally(() => setLoadingData(false))
  }, [])

  // Statuts dossier officiels : en_attente → en_cours → termine.
  const filtered = dossiers.filter(d => {
    if (filterActif === 'Toutes')   return true
    if (filterActif === 'En cours') return d.statut === 'en_cours'
    // « À venir » = pas encore validé (en_attente, + brouillons hérités)
    if (filterActif === 'À venir')  return d.statut === 'en_attente' || d.statut === 'brouillon'
    if (filterActif === 'Terminés') return d.statut === 'termine'
    return true
  })
  const sp = useSearchPaginate(filtered, (d: any) =>
    `${d.numero ?? ''} ${d.client?.nom ?? ''} ${d.client?.contact_nom ?? ''}`)

  function handleExport() {
    exportCsv('dossiers.csv', sp.filtered.map((d: any) => ({
      Numéro: d.numero, Client: d.client?.nom ?? '', Contact: d.client?.contact_nom ?? '',
      Début: d.date_debut, Fin: d.date_fin, Jours: d.nb_jours,
      Prestations: d.prestations?.length ?? 0, 'Montant HT': d.montant_ht ?? 0, Statut: d.statut,
    })))
  }

  const total    = dossiers?.length ?? 0
  const en_cours = dossiers?.filter(d => d.statut === 'en_cours').length ?? 0
  // CA = somme des prestations NON annulées (exclut statut 'annule')
  const caDossier = (d: any) =>
    (d.prestations ?? []).filter((p: any) => p.statut !== 'annule').reduce((a: number, p: any) => a + (p.montant_ht ?? 0), 0)
  const ca_total = dossiers?.reduce((s, d) => s + caDossier(d), 0) ?? 0

  return (
    <div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom:'24px' }}>
        {[
          { label:'Dossiers actifs', value: total,                   sub:'Ce mois',    color:'#16130e' },
          { label:'En cours',        value: en_cours,                sub:'Aujourd\'hui', color:'#9a7a28' },
          { label:'CA dossiers',     value: formatMontant(ca_total), sub:'HT total',    color:'#16130e' },
          { label:'À affecter',      value: 0,                       sub:'Véhicules',   color:'#7a5c10' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
        <span className="section-title">Tous les dossiers</span>
        <Link href="/dashboard/dossiers/nouveau" className="btn-primary">
          + Nouveau dossier
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
        {['Toutes','En cours','À venir','Terminés'].map((f) => (
          <button key={f}
            onClick={() => setFilterActif(f)}
            className={`filter-chip${filterActif===f?' active':''}`}>{f}</button>
        ))}
      </div>

      <div style={{ marginBottom:'14px' }}>
        <SearchBar value={sp.query} onChange={sp.setQuery} placeholder="Rechercher un dossier, client…" onExport={handleExport} />
      </div>

      {/* Liste mobile (cartes) */}
      <div className="only-mobile" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {loadingData ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>Chargement…</div>
        ) : sp.total === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
            {dossiers.length === 0 ? 'Aucun dossier — créez le premier !' : 'Aucun résultat.'}
          </div>
        ) : sp.pageItems.map((d: any) => {
          const types = d.prestations?.reduce((acc: any, p: any) => { acc[p.type] = (acc[p.type] ?? 0) + 1; return acc }, {}) ?? {}
          return (
            <div key={d.id} style={{ background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderBottom:'1px solid #ede9e2' }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}><span className="mono" style={{ fontSize:'11px', color:'#9a7a28' }}>{d.numero}</span><AgenceBadge d={d} /></span>
                <StatutDossierSelector key={d.id + d.statut} dossierId={d.id} statut={d.statut} onStatutChange={(ns) => setDossiers(prev => prev.map(x => x.id === d.id ? {...x, statut: ns} : x))} />
              </div>
              <Link href={`/dashboard/dossiers/${d.id}`} style={{ display:'block', padding:'10px 12px', textDecoration:'none', color:'inherit' }}>
                <div style={{ fontWeight:600, color:'#16130e', fontSize:'14px' }}>{d.client?.nom}</div>
                {d.client?.contact_nom && <div style={{ fontSize:'11px', color:'#5a564e' }}>{d.client.contact_nom}</div>}
                <div className="mono" style={{ fontSize:'11px', color:'#5a564e', marginTop:'6px' }}>
                  {format(new Date(d.date_debut),'dd/MM/yy',{locale:fr})} → {format(new Date(d.date_fin),'dd/MM/yy',{locale:fr})} · {d.nb_jours} j
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'8px', gap:'8px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                    {types.mad && <span className="pill-mad">MAD ×{types.mad}</span>}
                    {types.transfert && <span className="pill-transfer">Transfert ×{types.transfert}</span>}
                  </div>
                  <span className="mono" style={{ fontSize:'13px', fontWeight:700, color:'#16130e' }}>{formatMontant(d.montant_ht)}</span>
                </div>
                <PassagersLine passagers={d.passagers} />
              </Link>
            </div>
          )
        })}
      </div>

      {/* Table (desktop) */}
      <div className="table-container only-desktop">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['N° Dossier','Client','Période','Durée','Prestations','Montant HT','Statut',''].map((h,i) => (
                <th key={i} className="th"
                  style={i%2===1 ? { background:'rgba(0,0,0,0.1)' } : {}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingData ? (
              <tr><td colSpan={8} style={{ padding:'60px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>Chargement…</td></tr>
            ) : sp.total > 0 ? sp.pageItems.map((d: any) => {
              const types = d.prestations?.reduce((acc: any, p: any) => {
                acc[p.type] = (acc[p.type] ?? 0) + 1; return acc
              }, {}) ?? {}
              return (
                <tr key={d.id} className="tr-body">
                  <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}><span className="mono" style={{ fontSize:'11px', color:'#9a7a28' }}>{d.numero}</span><AgenceBadge d={d} /></span>
                  </td>
                  <td className="td">
                    <div style={{ fontWeight:600, color:'#16130e' }}>{d.client?.nom}</div>
                    {d.client?.contact_nom && (
                      <div style={{ fontSize:'10px', color:'#5a564e', marginTop:'1px' }}>{d.client.contact_nom}</div>
                    )}
                  </td>
                  <td className="td">
                    <span className="mono" style={{ fontSize:'11px' }}>
                      {format(new Date(d.date_debut),'dd/MM/yyyy',{locale:fr})} → {format(new Date(d.date_fin),'dd/MM/yyyy',{locale:fr})}
                    </span>
                  </td>
                  <td className="td">
                    <span style={{ background:'#f5f2ed', border:'1.5px solid #b8b0a4', padding:'2px 8px', fontFamily:'monospace', fontSize:'10px', color:'#5a564e' }}>
                      {d.nb_jours} j
                    </span>
                  </td>
                  <td className="td">
                    <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                      {types.mad      && <span className="pill-mad">MAD ×{types.mad}</span>}
                      {types.transfert && <span className="pill-transfer">Transfert ×{types.transfert}</span>}
                    </div>
                    <PassagersLine passagers={d.passagers} />
                  </td>
                  <td className="td">
                    <span className="mono" style={{ fontSize:'12px' }}>{formatMontant(d.montant_ht)}</span>
                  </td>
                  <td className="td">
                    <StatutDossierSelector key={d.id + d.statut} dossierId={d.id} statut={d.statut} onStatutChange={(newStatut) => setDossiers(prev => prev.map(x => x.id === d.id ? {...x, statut: newStatut} : x))} />
                  </td>
                  <td className="td">
                    <Link href={`/dashboard/dossiers/${d.id}`} className="btn-ghost" style={{ padding:'4px 12px', fontSize:'10px' }}>
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={8} style={{ padding:'60px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
                  {dossiers.length === 0 ? 'Aucun dossier — créez le premier !' : 'Aucun résultat.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={sp.page} pageCount={sp.pageCount} total={sp.total} onPage={sp.setPage} />
    </div>
  )
}
