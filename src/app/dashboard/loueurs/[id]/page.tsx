import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import { coutLocation } from '@/lib/coutLocation'
import PaiementsPanel from '@/components/loueurs/PaiementsPanel'

export const dynamic = 'force-dynamic'

const PERIODE_SUFFIX: Record<string, string> = { jour: '/jour', semaine: '/sem.', mois: '/mois' }
function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function LoueurDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: loueur, error } = await supabase
    .from('loueurs').select('*').eq('id', params.id).single()
  if (error || !loueur) notFound()

  const [{ data: vehicules }, { data: paiements }] = await Promise.all([
    supabase.from('vehicules')
      .select('id, marque, modele, immatriculation, loyer_ht, loyer_periode, contrat_debut, contrat_fin, date_entree_parc, date_sortie_parc, mode_acquisition, statut')
      .eq('loueur_id', params.id).order('marque'),
    supabase.from('paiements_loueur')
      .select('id, montant, date_paiement, moyen, note')
      .eq('loueur_id', params.id).order('date_paiement', { ascending: false }),
  ])

  const today = new Date()
  const vehs = (vehicules ?? []).map(v => ({ v, c: coutLocation(v, today) }))
  const coutCouru = vehs.reduce((s, { c }) => s + c.coutCouru, 0)
  const paye  = (paiements ?? []).reduce((s, p) => s + Number(p.montant), 0)
  const solde = Math.round((coutCouru - paye) * 100) / 100

  return (
    <div>
      <div style={{ marginBottom:'20px' }}>
        <Link href="/dashboard/loueurs" style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#8a8478', textDecoration:'none' }}>
          <ArrowLeft size={13} /> Retour aux loueurs
        </Link>
      </div>

      <div className="detail-grid">
        {/* ── PRINCIPAL ── */}
        <div>
          {/* En-tête loueur */}
          <div className="card" style={{ marginBottom:'16px' }}>
            <div className="card-header"><span className="card-header-title">Loueur</span></div>
            <div style={{ padding:'18px 22px' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'26px', fontWeight:500, color:'#16130e' }}>{loueur.nom}</div>
              <div style={{ fontSize:'11px', color:'#5a564e', marginTop:'4px' }}>
                {[loueur.contact_nom, loueur.telephone, loueur.email].filter(Boolean).join(' · ') || 'Aucun contact renseigné'}
              </div>
              {loueur.notes && <div style={{ fontSize:'11px', color:'#8a8478', marginTop:'8px', fontStyle:'italic' }}>{loueur.notes}</div>}
            </div>
          </div>

          {/* Véhicules loués */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <span className="section-title">Véhicules loués</span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#8a8478' }}>{vehs.length} véhicule{vehs.length > 1 ? 's' : ''}</span>
          </div>

          <div className="table-container">
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead className="table-head">
                <tr>
                  {['Véhicule','Loyer','Depuis','Jours','Coût couru HT','Total contrat','État'].map((h,i) => (
                    <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehs.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding:'50px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
                    Aucun véhicule rattaché à ce loueur. Rattachez-les depuis la fiche véhicule (champ « Loueur »).
                  </td></tr>
                ) : vehs.map(({ v, c }) => (
                  <tr key={v.id} className="tr-body">
                    <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                      <Link href={`/dashboard/vehicules/${v.id}`} style={{ textDecoration:'none' }}>
                        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontWeight:500, color:'#16130e' }}>{v.marque} {v.modele}</div>
                        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#8a8478' }}>{v.immatriculation}</div>
                      </Link>
                    </td>
                    <td className="td">
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28' }}>
                        {v.loyer_ht ? `${fmt(v.loyer_ht)}${PERIODE_SUFFIX[v.loyer_periode] ?? '/mois'}` : '—'}
                      </span>
                    </td>
                    <td className="td">
                      <span style={{ fontSize:'11px', color:'#5a564e' }}>{c.debut ? format(parseISO(c.debut),'dd/MM/yy',{locale:fr}) : '—'}</span>
                    </td>
                    <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>{c.joursCourus || '—'}</span></td>
                    <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#9a7a28' }}>{fmt(c.coutCouru)}</span></td>
                    <td className="td"><span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#5a564e' }}>{c.coutTotalContrat != null ? fmt(c.coutTotalContrat) : '—'}</span></td>
                    <td className="td">
                      <span style={{ fontSize:'9px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color: c.actif ? '#1e5e3a' : '#8a8478' }}>
                        {c.actif ? '● En cours' : 'Terminé'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          {/* Solde */}
          <div className="card" style={{ borderColor: solde > 0 ? '#9e2a2a' : '#1e5e3a' }}>
            <div style={{ background: solde > 0 ? '#9e2a2a' : '#1e5e3a', padding:'10px 16px' }}>
              <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#fff' }}>
                {solde > 0 ? 'Reste à payer' : 'Compte soldé'}
              </span>
            </div>
            <div style={{ padding:'16px' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'34px', fontWeight:400, color: solde > 0 ? '#9e2a2a' : '#1e5e3a', lineHeight:1, marginBottom:'12px' }}>
                {fmt(Math.max(0, solde))}
              </div>
              {[
                { label:'Coût couru HT', value: fmt(coutCouru), color:'#9a7a28' },
                { label:'Total versé',   value: fmt(paye),       color:'#1e5e3a' },
                { label:'Solde',         value: fmt(solde),      color: solde > 0 ? '#9e2a2a' : '#1e5e3a', strong:true },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #d8d2c8' }}>
                  <span style={{ fontSize:'11px', color:'#5a564e' }}>{s.label}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:(s as any).strong ? 700 : 500, color:s.color }}>{s.value}</span>
                </div>
              ))}
              <div style={{ fontSize:'9px', color:'#8a8478', marginTop:'10px', lineHeight:1.5 }}>
                Coût couru = loyers cumulés depuis le début de chaque location jusqu'à aujourd'hui (ou fin de contrat / sortie du parc).
              </div>
            </div>
          </div>

          {/* Paiements */}
          <PaiementsPanel loueurId={loueur.id} initial={(paiements ?? []) as any} />
        </div>
      </div>
    </div>
  )
}
