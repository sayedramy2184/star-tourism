import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { coutLocation } from '@/lib/coutLocation'
import NouveauLoueurButton from '@/components/loueurs/NouveauLoueurButton'

export const dynamic = 'force-dynamic'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function LoueursPage() {
  const supabase = createClient()

  const [{ data: loueurs }, { data: vehicules }, { data: paiements }] = await Promise.all([
    supabase.from('loueurs').select('id, nom, contact_nom, telephone').order('nom'),
    supabase.from('vehicules').select('id, loueur_id, loyer_ht, loyer_periode, contrat_debut, contrat_fin, date_entree_parc, date_sortie_parc, mode_acquisition'),
    supabase.from('paiements_loueur').select('loueur_id, montant'),
  ])

  const today = new Date()
  const rows = (loueurs ?? []).map(l => {
    const vehs = (vehicules ?? []).filter(v => v.loueur_id === l.id)
    const coutCouru = vehs.reduce((s, v) => s + coutLocation(v, today).coutCouru, 0)
    const paye = (paiements ?? []).filter(p => p.loueur_id === l.id).reduce((s, p) => s + Number(p.montant), 0)
    const solde = coutCouru - paye
    return { ...l, nbVehicules: vehs.length, coutCouru, paye, solde }
  })

  const totalDu = rows.reduce((s, r) => s + Math.max(0, r.solde), 0)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <span className="section-title">Loueurs — Bailleurs de véhicules</span>
        <NouveauLoueurButton />
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom:'22px' }}>
        {[
          { label:'Loueurs',        value: rows.length, color:'#16130e' },
          { label:'Véhicules loués', value: rows.reduce((s,r)=>s+r.nbVehicules,0), color:'#1e3f70' },
          { label:'Total dû (soldes)', value: fmt(totalDu), color: totalDu > 0 ? '#9e2a2a' : '#1e5e3a', small:true },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:(k as any).small ? '24px' : '34px' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="table-container">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Loueur','Véhicules','Coût couru HT','Payé','Solde dû','Statut',''].map((h,i) => (
                <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding:'60px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
                Aucun loueur — ajoutez-en un puis rattachez vos véhicules loués.
              </td></tr>
            ) : rows.map(r => {
              const solde = Math.round(r.solde * 100) / 100
              const statut = solde > 0
                ? { label:'À payer', color:'#9e2a2a', bg:'#faeaea' }
                : { label:'Soldé',   color:'#1e5e3a', bg:'#eaf4ee' }
              return (
                <tr key={r.id} className="tr-body">
                  <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                    <Link href={`/dashboard/loueurs/${r.id}`} style={{ textDecoration:'none' }}>
                      <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500, color:'#16130e' }}>{r.nom}</div>
                      {r.contact_nom && <div style={{ fontSize:'10px', color:'#8a8478' }}>{r.contact_nom}{r.telephone ? ` · ${r.telephone}` : ''}</div>}
                    </Link>
                  </td>
                  <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px' }}>{r.nbVehicules}</span></td>
                  <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#9a7a28' }}>{fmt(r.coutCouru)}</span></td>
                  <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#1e5e3a' }}>{fmt(r.paye)}</span></td>
                  <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'13px', fontWeight:700, color: solde > 0 ? '#9e2a2a' : '#1e5e3a' }}>{fmt(solde)}</span></td>
                  <td className="td">
                    <span style={{ padding:'3px 10px', fontSize:'10px', fontWeight:700, background:statut.bg, color:statut.color, border:`1px solid ${statut.color}33` }}>{statut.label}</span>
                  </td>
                  <td className="td">
                    <Link href={`/dashboard/loueurs/${r.id}`} className="btn-ghost" style={{ padding:'4px 10px', fontSize:'10px', textDecoration:'none' }}>Détail</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
