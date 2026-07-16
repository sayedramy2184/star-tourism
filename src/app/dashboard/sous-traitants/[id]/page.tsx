'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { ArrowLeft, Phone, Mail, CheckCircle, Clock, Euro, TrendingUp, X } from 'lucide-react'

interface SousTraitant {
  id: string; societe: string; contact_nom: string | null
  telephone: string | null; email: string | null; siret: string | null; notes: string | null
}

interface Prestation {
  id: string
  type: string
  date_debut: string
  date_fin: string
  montant_ht: number
  st_cout_ht: number
  st_marge_ht: number | null
  st_chauffeur_nom: string | null
  st_vehicule_marque: string | null
  st_vehicule_modele: string | null
  st_vehicule_immat: string | null
  st_paiement_statut: 'a_payer' | 'paye'
  st_paiement_date: string | null
  st_paiement_ref: string | null
  dossier: { id: string; numero: string; client: { nom: string } }
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function PaiementModal({ prestation, onClose, onSave }: {
  prestation: Prestation
  onClose: () => void
  onSave: (data: { statut: string; date: string; ref: string }) => void
}) {
  const [statut, setStatut] = useState(prestation.st_paiement_statut)
  const [date,   setDate]   = useState(prestation.st_paiement_date ?? format(new Date(), 'yyyy-MM-dd'))
  const [ref,    setRef]    = useState(prestation.st_paiement_ref ?? '')
  const [saving, setSaving] = useState(false)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', width:'420px', boxShadow:'0 32px 80px rgba(0,0,0,0.3)', border:'1.5px solid #b8b0a4' }}>
        <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'18px', fontWeight:500, color:'#fff' }}>
            Statut du paiement
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ marginBottom:'16px', padding:'10px 14px', background:'#f5f2ed', border:'1.5px solid #b8b0a4' }}>
            <div style={{ fontSize:'10px', color:'#8a8478', marginBottom:'4px' }}>Prestation</div>
            <div style={{ fontSize:'13px', fontWeight:600 }}>
              {prestation.dossier.numero} · {prestation.dossier.client.nom}
            </div>
            <div style={{ fontSize:'11px', color:'#5a564e', marginTop:'2px' }}>
              Coût ST : <strong style={{ fontFamily:'JetBrains Mono,monospace', color:'#9a7a28' }}>{fmt(prestation.st_cout_ht)}</strong>
            </div>
          </div>

          {/* Statut */}
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
            {([['a_payer', '⏳ À payer', '#7a5c10', '#fdf3dc'], ['paye', '✓ Payé', '#1e5e3a', '#eaf4ee']] as const).map(([val, label, color, bg]) => (
              <button key={val} type="button" onClick={() => setStatut(val)}
                style={{ flex:1, padding:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer', background: statut===val ? bg : '#fff', border:`1.5px solid ${statut===val ? color : '#b8b0a4'}`, color: statut===val ? color : '#5a564e', transition:'all 0.14s' }}>
                {label}
              </button>
            ))}
          </div>

          {statut === 'paye' && (
            <>
              <div style={{ marginBottom:'12px' }}>
                <label className="form-label">Date de paiement</label>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label className="form-label">Référence (virement, chèque…)</label>
                <input type="text" className="input" value={ref} onChange={e => setRef(e.target.value)} placeholder="REF-2026-001" />
              </div>
            </>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'14px', borderTop:'1.5px solid #b8b0a4' }}>
            <button className="btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn-primary" disabled={saving}
              onClick={async () => {
                setSaving(true)
                await onSave({ statut, date, ref })
                setSaving(false)
              }}>
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SousTraitantDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [st,          setSt]          = useState<SousTraitant | null>(null)
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modalP,      setModalP]      = useState<Prestation | null>(null)
  const [filtre,      setFiltre]      = useState<'tous' | 'a_payer' | 'paye'>('tous')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [stRes, pRes] = await Promise.all([
      fetch(`/api/sous-traitants/${id}`),
      fetch(`/api/sous-traitants/${id}/prestations`),
    ])
    const { data: stData } = await stRes.json()
    const { data: pData  } = await pRes.json()
    setSt(stData)
    setPrestations(pData ?? [])
    setLoading(false)
  }

  async function savePaiement(prestationId: string, data: { statut: string; date: string; ref: string }) {
    try {
      const res = await fetch(`/api/prestations/${prestationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_paiement_statut: data.statut,
          st_paiement_date:   data.statut === 'paye' ? data.date : null,
          st_paiement_ref:    data.statut === 'paye' ? data.ref  : null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Paiement mis à jour !')
      setModalP(null)
      load()
    } catch { toast.error('Erreur') }
  }

  const filtered   = prestations.filter(p => filtre === 'tous' || p.st_paiement_statut === filtre)
  const totalCout  = prestations.reduce((s, p) => s + (p.st_cout_ht ?? 0), 0)
  const totalMarge = prestations.reduce((s, p) => s + (p.st_marge_ht ?? 0), 0)
  const totalPaye  = prestations.filter(p => p.st_paiement_statut === 'paye').reduce((s, p) => s + (p.st_cout_ht ?? 0), 0)
  const totalDu    = prestations.filter(p => p.st_paiement_statut === 'a_payer').reduce((s, p) => s + (p.st_cout_ht ?? 0), 0)

  if (loading) return <div style={{ padding:'40px', color:'#8a8478' }}>Chargement…</div>
  if (!st)     return <div style={{ padding:'40px', color:'#9e2a2a' }}>Sous-traitant introuvable</div>

  return (
    <div>
      {/* Retour */}
      <Link href="/dashboard/sous-traitants"
        style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#8a8478', textDecoration:'none', marginBottom:'20px' }}>
        <ArrowLeft size={14}/> Retour aux sous-traitants
      </Link>

      {/* Header */}
      <div className="card" style={{ marginBottom:'16px' }}>
        <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
            {st.societe}
          </span>
          <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', letterSpacing:'2px', textTransform:'uppercase' }}>
            Sous-traitant
          </span>
        </div>
        <div style={{ padding:'16px 24px', display:'flex', gap:'24px', flexWrap:'wrap' }}>
          {st.contact_nom && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#5a564e' }}>
              <span style={{ fontSize:'14px' }}>👤</span> {st.contact_nom}
            </div>
          )}
          {st.telephone && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#5a564e' }}>
              <Phone size={13} style={{ color:'#8a8478' }}/> {st.telephone}
            </div>
          )}
          {st.email && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#5a564e' }}>
              <Mail size={13} style={{ color:'#8a8478' }}/> {st.email}
            </div>
          )}
          {st.siret && (
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#8a8478' }}>
              SIRET : {st.siret}
            </div>
          )}
          {st.notes && (
            <div style={{ fontSize:'11px', color:'#8a8478', fontStyle:'italic', borderLeft:'2px solid #b8b0a4', paddingLeft:'12px' }}>
              {st.notes}
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom:'20px' }}>
        <div className="kpi-card">
          <div className="kpi-label">Prestations</div>
          <div className="kpi-value">{prestations.length}</div>
          <div className="kpi-sub">Total sous-traitées</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Coût total HT</div>
          <div className="kpi-value" style={{ color:'#9a7a28', fontSize:'18px' }}>{fmt(totalCout)}</div>
          <div className="kpi-sub">Montant à verser</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Marge totale</div>
          <div className="kpi-value" style={{ color: totalMarge >= 0 ? '#1e5e3a' : '#9e2a2a', fontSize:'18px' }}>{fmt(totalMarge)}</div>
          <div className="kpi-sub">Prix client − coût ST</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Reste à payer</div>
          <div className="kpi-value" style={{ color: totalDu > 0 ? '#9e2a2a' : '#1e5e3a', fontSize:'18px' }}>{fmt(totalDu)}</div>
          <div className="kpi-sub" style={{ color:'#1e5e3a' }}>Payé : {fmt(totalPaye)}</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
        {([['tous','Toutes','#5a564e'],['a_payer','À payer','#7a5c10'],['paye','Payées','#1e5e3a']] as const).map(([val, label, color]) => (
          <button key={val} onClick={() => setFiltre(val)}
            style={{ padding:'6px 14px', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', cursor:'pointer', background: filtre===val ? color+'18' : 'transparent', border:`1.5px solid ${filtre===val ? color : '#b8b0a4'}`, color: filtre===val ? color : '#5a564e', transition:'all 0.14s' }}>
            {label}
            {val !== 'tous' && (
              <span style={{ marginLeft:'6px', background: filtre===val ? color : '#b8b0a4', color:'#fff', fontSize:'9px', padding:'1px 6px', borderRadius:'10px' }}>
                {prestations.filter(p => p.st_paiement_statut === val).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table prestations */}
      <div className="table-container">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Dossier','Client','Date','Type','Chauffeur ST','Véhicule ST','Prix client','Coût ST','Marge','Paiement'].map((h,i) => (
                <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding:'40px', textAlign:'center', color:'#8a8478' }}>
                Aucune prestation
              </td></tr>
            ) : filtered.map(p => {
              const isPaye = p.st_paiement_statut === 'paye'
              const marge  = p.st_marge_ht ?? 0
              return (
                <tr key={p.id} className="tr-body">
                  <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                    <Link href={`/dashboard/dossiers/${p.dossier.id}`}
                      style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28', textDecoration:'none', fontWeight:600 }}>
                      {p.dossier.numero}
                    </Link>
                  </td>
                  <td className="td" style={{ fontSize:'12px', fontWeight:500 }}>{p.dossier.client.nom}</td>
                  <td className="td">
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px' }}>
                      {format(new Date(p.date_debut), 'dd/MM/yy', { locale: fr })}
                    </span>
                  </td>
                  <td className="td">
                    <span style={{ fontSize:'9px', fontWeight:700, padding:'2px 8px', background: p.type==='mad' ? '#fdf3dc' : '#e8eef8', color: p.type==='mad' ? '#7a5c10' : '#1e3f70', border:`1px solid ${p.type==='mad' ? 'rgba(122,92,16,0.2)' : 'rgba(30,63,112,0.2)'}` }}>
                      {p.type === 'mad' ? 'MAD' : 'Transfert'}
                    </span>
                  </td>
                  <td className="td" style={{ fontSize:'11px' }}>
                    {p.st_chauffeur_nom ?? <span style={{ color:'#c2bdb4' }}>—</span>}
                  </td>
                  <td className="td">
                    {p.st_vehicule_marque ? (
                      <div>
                        <div style={{ fontSize:'11px', fontWeight:500 }}>{p.st_vehicule_marque} {p.st_vehicule_modele}</div>
                        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#8a8478' }}>{p.st_vehicule_immat}</div>
                      </div>
                    ) : <span style={{ color:'#c2bdb4', fontSize:'11px' }}>—</span>}
                  </td>
                  <td className="td">
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28' }}>{fmt(p.montant_ht)}</span>
                  </td>
                  <td className="td">
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', fontWeight:600 }}>{fmt(p.st_cout_ht)}</span>
                  </td>
                  <td className="td">
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', fontWeight:700, color: marge > 0 ? '#1e5e3a' : '#9e2a2a' }}>
                      {fmt(marge)}
                    </span>
                  </td>
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModalP(p)}
                      style={{
                        display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px',
                        fontSize:'10px', fontWeight:700, cursor:'pointer',
                        background: isPaye ? '#eaf4ee' : '#fdf3dc',
                        border:`1.5px solid ${isPaye ? 'rgba(30,94,58,0.3)' : 'rgba(122,92,16,0.3)'}`,
                        color: isPaye ? '#1e5e3a' : '#7a5c10',
                        transition:'all 0.14s',
                      }}>
                      {isPaye ? <CheckCircle size={11}/> : <Clock size={11}/>}
                      {isPaye ? 'Payé' : 'À payer'}
                    </button>
                    {isPaye && p.st_paiement_date && (
                      <div style={{ fontSize:'9px', color:'#8a8478', marginTop:'2px', fontFamily:'JetBrains Mono,monospace' }}>
                        {format(new Date(p.st_paiement_date), 'dd/MM/yy')}
                        {p.st_paiement_ref && ` · ${p.st_paiement_ref}`}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background:'#f5f2ed', borderTop:'2px solid #b8b0a4' }}>
                <td colSpan={6} className="td" style={{ fontWeight:700, fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase' }}>
                  Total ({filtered.length} prestations)
                </td>
                <td className="td">
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#9a7a28', fontWeight:700 }}>
                    {fmt(filtered.reduce((s,p) => s + p.montant_ht, 0))}
                  </span>
                </td>
                <td className="td">
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:700 }}>
                    {fmt(filtered.reduce((s,p) => s + p.st_cout_ht, 0))}
                  </span>
                </td>
                <td className="td">
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:700, color: filtered.reduce((s,p) => s + (p.st_marge_ht??0), 0) >= 0 ? '#1e5e3a' : '#9e2a2a' }}>
                    {fmt(filtered.reduce((s,p) => s + (p.st_marge_ht??0), 0))}
                  </span>
                </td>
                <td className="td"/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modal paiement */}
      {modalP && (
        <PaiementModal
          prestation={modalP}
          onClose={() => setModalP(null)}
          onSave={(data) => savePaiement(modalP.id, data)}
        />
      )}
    </div>
  )
}
