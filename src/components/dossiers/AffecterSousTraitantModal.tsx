'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Users, X } from 'lucide-react'

interface SousTraitant {
  id: string; societe: string; contact_nom: string | null; telephone: string | null
}

interface Props {
  prestationId: string
  dossierId: string
  prixClient: number
  nbJours?: number
  sousTraitantActuel?: { societe: string; chauffeurNom?: string } | null
  onAffecter?: (data: any) => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function AffecterSousTraitantModal({ prestationId, dossierId, prixClient, nbJours = 1, sousTraitantActuel, onAffecter }: Props) {
  const router = useRouter()
  const [open,         setOpen]         = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [sousTrait,    setSousTrait]    = useState<SousTraitant[]>([])
  const [selectedId,   setSelectedId]   = useState('')

  // Détails du sous-traitant
  const [chauffeurNom, setChauffeurNom] = useState('')
  const [chauffeurTel, setChauffeurTel] = useState('')
  const [vehiculeMarq, setVehiculeMarq] = useState('')
  const [vehiculeMod,  setVehiculeMod]  = useState('')
  const [vehiculeImat, setVehiculeImat] = useState('')
  const [coutHT,       setCoutHT]       = useState(0)

  useEffect(() => {
    if (!open) return
    fetch('/api/sous-traitants').then(r => r.json()).then(d => setSousTrait(d.data ?? []))
  }, [open])

  const coutTotal = coutHT * nbJours
  const marge     = prixClient - coutTotal
  const margePct  = prixClient > 0 ? Math.round((marge / prixClient) * 100) : 0

  async function handleSave() {
    if (!selectedId) return toast.error('Sélectionnez un sous-traitant')
    if (coutHT <= 0)  return toast.error('Saisissez le coût sous-traitant')
    setSaving(true)
    try {
      const res = await fetch(`/api/prestations/${prestationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sous_traitant_id:       selectedId,
          st_chauffeur_nom:       chauffeurNom || null,
          st_chauffeur_telephone: chauffeurTel || null,
          st_vehicule_marque:     vehiculeMarq || null,
          st_vehicule_modele:     vehiculeMod  || null,
          st_vehicule_immat:      vehiculeImat || null,
          st_cout_ht:             coutTotal,
          st_marge_ht:            marge,
          chauffeur_id:           null,
          vehicule_id:            null,
          affectation_differee:   false,
        }),
      })
      if (!res.ok) throw new Error()
      const st = sousTrait.find(s => s.id === selectedId)
      onAffecter?.({
        sous_traitant_id:   selectedId,
        st_chauffeur_nom:   chauffeurNom || null,
        st_vehicule_marque: vehiculeMarq || null,
        st_vehicule_modele: vehiculeMod  || null,
        st_vehicule_immat:  vehiculeImat || null,
        st_cout_ht:         coutTotal,
        st_marge_ht:        marge,
        sous_traitant:      st ? { societe: st.societe } : null,
      })
      toast.success('Sous-traitant affecté !')
      setOpen(false)
      router.push(`/dashboard/dossiers/${dossierId}`)
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  async function handleRetirer() {
    setSaving(true)
    try {
      await fetch(`/api/prestations/${prestationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sous_traitant_id: null, st_chauffeur_nom: null,
          st_chauffeur_telephone: null, st_vehicule_marque: null,
          st_vehicule_modele: null, st_vehicule_immat: null,
          st_cout_ht: 0, st_marge_ht: null,
        }),
      })
      onAffecter?.({
        sous_traitant_id: null, st_chauffeur_nom: null,
        st_vehicule_marque: null, st_vehicule_modele: null,
        st_vehicule_immat: null, st_marge_ht: null,
        sous_traitant: null,
      })
      toast.success('Sous-traitant retiré')
      setOpen(false)
      router.push(`/dashboard/dossiers/${dossierId}`)
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost"
        style={{ padding:'4px 10px', fontSize:'10px', borderColor: sousTraitantActuel ? '#4a2a6e' : undefined, color: sousTraitantActuel ? '#4a2a6e' : undefined }}
        onClick={() => setOpen(true)}>
        <Users size={11}/>
        {sousTraitantActuel ? `ST: ${sousTraitantActuel.societe}` : 'Sous-traitant'}
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'560px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.3)', border:'1.5px solid #b8b0a4' }}>

            <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
                Affecter un sous-traitant
              </span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
                <X size={18}/>
              </button>
            </div>

            <div style={{ padding:'20px 24px' }}>

              {/* Sélection sous-traitant */}
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
                Société sous-traitante
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'16px' }}>
                {sousTrait.length === 0 ? (
                  <div style={{ padding:'12px', background:'#fdf3dc', border:'1px solid rgba(122,92,16,0.2)', fontSize:'11px', color:'#7a5c10' }}>
                    Aucun sous-traitant — <a href="/dashboard/sous-traitants" style={{ color:'#9a7a28', textDecoration:'underline' }}>en ajouter un</a>
                  </div>
                ) : (
                  <select className="select" value={selectedId} onChange={e => setSelectedId(e.target.value)}
                    style={{ width:'100%', fontFamily:'Cormorant Garamond,serif', fontSize:'15px' }}>
                    <option value="">— Sélectionner un sous-traitant —</option>
                    {sousTrait.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.societe}{st.contact_nom ? ` — ${st.contact_nom}` : ''}{st.telephone ? ` · ${st.telephone}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Détails chauffeur envoyé */}
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
                Chauffeur envoyé par le sous-traitant
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                <div>
                  <label className="form-label">Nom du chauffeur</label>
                  <input type="text" className="input" value={chauffeurNom}
                    onChange={e => setChauffeurNom(e.target.value)} placeholder="Prénom Nom" />
                </div>
                <div>
                  <label className="form-label">Téléphone</label>
                  <input type="tel" className="input" value={chauffeurTel}
                    onChange={e => setChauffeurTel(e.target.value)} placeholder="+33 6 ..." />
                </div>
              </div>

              {/* Véhicule envoyé */}
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
                Véhicule du sous-traitant
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                <div>
                  <label className="form-label">Marque</label>
                  <input type="text" className="input" value={vehiculeMarq}
                    onChange={e => setVehiculeMarq(e.target.value)} placeholder="Mercedes" />
                </div>
                <div>
                  <label className="form-label">Modèle</label>
                  <input type="text" className="input" value={vehiculeMod}
                    onChange={e => setVehiculeMod(e.target.value)} placeholder="Classe E" />
                </div>
                <div>
                  <label className="form-label">Immatriculation</label>
                  <input type="text" className="input" value={vehiculeImat}
                    onChange={e => setVehiculeImat(e.target.value.toUpperCase())} placeholder="AB-123-CD" />
                </div>
              </div>

              {/* Coût et marge */}
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
                Tarification
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                <div>
                  <label className="form-label">Prix client HT</label>
                  <input readOnly className="input" value={fmt(prixClient)}
                    style={{ background:'#f5f2ed', cursor:'default', color:'#9a7a28', fontFamily:'JetBrains Mono,monospace' }} />
                </div>
                <div>
                  <label className="form-label">
                    Coût / jour HT *
                    {nbJours > 1 && <span style={{ color:'#8a8478', fontSize:'9px', marginLeft:'4px' }}>× {nbJours} j</span>}
                  </label>
                  <input type="number" className="input" value={coutHT || ''}
                    onChange={e => setCoutHT(parseFloat(e.target.value) || 0)}
                    placeholder="0,00" min={0} step={0.01}
                    style={{ fontFamily:'JetBrains Mono,monospace' }} />
                  {nbJours > 1 && coutHT > 0 && (
                    <div style={{ fontSize:'10px', color:'#9a7a28', marginTop:'3px', fontFamily:'JetBrains Mono,monospace' }}>
                      Total : {fmt(coutTotal)}
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Marge</label>
                  <input readOnly className="input" value={coutHT > 0 ? `${fmt(marge)} (${margePct}%)` : '—'}
                    style={{
                      background:'#f5f2ed', cursor:'default', fontFamily:'JetBrains Mono,monospace',
                      color: marge > 0 ? '#1e5e3a' : marge < 0 ? '#9e2a2a' : '#8a8478',
                      fontWeight: 600,
                    }} />
                </div>
              </div>

              {/* Alerte marge négative */}
              {coutHT > 0 && marge < 0 && (
                <div style={{ padding:'10px 14px', background:'#faeaea', border:'1px solid rgba(158,42,42,0.3)', borderLeft:'3px solid #9e2a2a', fontSize:'11px', color:'#9e2a2a', fontWeight:600, marginBottom:'12px' }}>
                  ⚠ Marge négative — le coût sous-traitant dépasse le prix client !
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <div>
                  {sousTraitantActuel && (
                    <button className="btn-ghost" onClick={handleRetirer} disabled={saving}
                      style={{ color:'#9e2a2a', borderColor:'rgba(158,42,42,0.3)' }}>
                      Retirer le sous-traitant
                    </button>
                  )}
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving || !selectedId}>
                    {saving ? 'Affectation…' : 'Affecter'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
