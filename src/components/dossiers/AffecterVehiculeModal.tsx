'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Car, X } from 'lucide-react'

interface Vehicule {
  id: string; marque: string; modele: string
  immatriculation: string; categorie: string
  disponible_periode?: boolean
}

interface Props {
  prestationId: string
  dateDebut: string
  dateFin: string
  vehiculeActuel?: { marque: string; modele: string; immatriculation: string } | null
}

const CATEGORIES: Record<string, string> = {
  berline_standard: 'Berline Standard', berline_premium: 'Berline Premium',
  berline_prestige: 'Berline Prestige',  van_minibus: 'Van / Minibus',
  suv_premium: 'SUV Premium',           electrique: 'Électrique',
}

export default function AffecterVehiculeModal({ prestationId, dateDebut, dateFin, vehiculeActuel }: Props) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [selected,  setSelected]  = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`/api/vehicules?date_debut=${dateDebut}&date_fin=${dateFin}`)
      .then(r => r.json())
      .then(d => setVehicules(d.data ?? []))
  }, [open])

  async function handleSave() {
    if (!selected) return toast.error('Sélectionnez un véhicule')
    setSaving(true)
    try {
      const res = await fetch(`/api/prestations/${prestationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicule_id: selected, affectation_differee: false }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Véhicule affecté !')
      setOpen(false)
      router.refresh()
    } catch { toast.error('Erreur lors de l\'affectation') }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost" style={{ padding:'5px 12px', fontSize:'11px' }} onClick={() => setOpen(true)}>
        <Car size={11} /> {vehiculeActuel ? 'Changer' : 'Affecter véhicule'}
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
          <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'520px', maxWidth:'96vw', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>

            <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
                Affecter un véhicule
              </span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ padding:'20px 24px' }}>
              {vehiculeActuel && (
                <div style={{ padding:'10px 14px', background:'#f5f2ed', border:'1.5px solid #b8b0a4', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
                  <Car size={14} style={{ color:'#8a8478' }} />
                  <div>
                    <div style={{ fontSize:'11px', color:'#8a8478', marginBottom:'2px' }}>Véhicule actuel</div>
                    <div style={{ fontSize:'13px', fontWeight:600 }}>{vehiculeActuel.marque} {vehiculeActuel.modele}</div>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#5a564e' }}>{vehiculeActuel.immatriculation}</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'12px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
                Véhicules disponibles sur la période
              </div>

              {vehicules.length === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>Chargement…</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {vehicules.map(v => {
                    const dispo = v.disponible_periode !== false
                    const isSelected = selected === v.id
                    return (
                      <div key={v.id}
                        onClick={() => dispo && setSelected(v.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:'12px',
                          padding:'12px 14px', cursor: dispo ? 'pointer' : 'not-allowed',
                          background: isSelected ? '#fdf6e3' : dispo ? '#fff' : '#f5f2ed',
                          border:`1.5px solid ${isSelected ? '#9a7a28' : dispo ? '#d8d2c8' : '#b8b0a4'}`,
                          opacity: dispo ? 1 : 0.5,
                          transition:'all 0.14s',
                        }}>
                        <div style={{ width:'36px', height:'36px', background: isSelected ? '#fdf6e3' : '#f5f2ed', border:`1.5px solid ${isSelected ? '#9a7a28' : '#b8b0a4'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Car size={16} style={{ color: isSelected ? '#9a7a28' : '#8a8478' }} />
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500, color:'#16130e' }}>{v.marque} {v.modele}</div>
                          <div style={{ display:'flex', gap:'8px', alignItems:'center', marginTop:'2px' }}>
                            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#5a564e', letterSpacing:'1px' }}>{v.immatriculation}</span>
                            <span style={{ fontSize:'9px', color:'#8a8478' }}>{CATEGORIES[v.categorie] ?? v.categorie}</span>
                          </div>
                        </div>
                        <span style={{ fontSize:'9px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', padding:'3px 8px', background: dispo ? '#eaf4ee' : '#faeaea', color: dispo ? '#1e5e3a' : '#9e2a2a', border:`1px solid ${dispo ? 'rgba(30,94,58,0.2)' : 'rgba(158,42,42,0.2)'}` }}>
                          {dispo ? 'Libre' : 'Occupé'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'20px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving || !selected}>
                  {saving ? 'Affectation…' : 'Affecter ce véhicule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
