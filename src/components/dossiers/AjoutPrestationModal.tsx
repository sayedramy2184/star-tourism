'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'
import VehiculeCategorieSelect from '@/components/ui/VehiculeCategorieSelect'

const JOURS_FR = ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.']

interface Chauffeur { id: string; nom: string; prenom: string }
interface Vehicule  { id: string; marque: string; modele: string; immatriculation: string; disponible_periode?: boolean }

interface JourForm {
  date: string; jour_semaine: string; chauffeur_id: string; tarif_ht: number; note: string
}

interface Props {
  dossierId: string
  dateDebutDossier: string
  dateFinDossier: string
}

export default function AjoutPrestationModal({ dossierId, dateDebutDossier, dateFinDossier }: Props) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [vehicules,  setVehicules]  = useState<Vehicule[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Form state
  const [type,           setType]           = useState<'mad'|'transfert'>('transfert')
  const [sousType,       setSousType]       = useState<'ville'|'gare'|'aeroport'>('ville')
  const [sens,           setSens]           = useState<'depuis'|'vers'>('depuis')
  const [dateDebut,      setDateDebut]      = useState(dateDebutDossier)
  const [dateFin,        setDateFin]        = useState(dateDebutDossier)
  const [heure,          setHeure]          = useState('')
  const [heureDebJ,      setHeureDebJ]      = useState('09:00')
  const [heureFinJ,      setHeureFinJ]      = useState('18:00')
  const [adresseDepart,  setAdresseDepart]  = useState('')
  const [adresseArrivee, setAdresseArrivee] = useState('')
  const [tarifFixe,      setTarifFixe]      = useState(0)
  const [tarifJour,      setTarifJour]      = useState(960)
  const [modeleSouhaite, setModeleSouhaite] = useState('')
  const [vehiculeId,     setVehiculeId]     = useState('')
  const [vehiculeMode,   setVehiculeMode]   = useState<'flotte'|'plus_tard'>('flotte')
  const [chauffeurId,    setChauffeurId]    = useState('')
  const [jours,          setJours]          = useState<JourForm[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/chauffeurs').then(r => r.json()).then(d => setChauffeurs(d.data ?? []))
    fetch('/api/vehicule-categories').then(r => r.json()).then(d => setCategories(d.data ?? [])).catch(() => {})
    fetch(`/api/vehicules?date_debut=${dateDebut}&date_fin=${dateFin}`)
      .then(r => r.json()).then(d => setVehicules(d.data ?? []))
  }, [open])

  useEffect(() => {
    if (type === 'mad' && dateDebut && dateFin) {
      try {
        const days = eachDayOfInterval({ start: parseISO(dateDebut), end: parseISO(dateFin) })
        setJours(days.map(d => ({
          date: format(d,'yyyy-MM-dd'),
          jour_semaine: JOURS_FR[d.getDay()],
          chauffeur_id: chauffeurId,
          tarif_ht: tarifJour,
          note: '',
        })))
      } catch { setJours([]) }
    }
  }, [type, dateDebut, dateFin, tarifJour])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/dossiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // On passe le dossier_id existant pour ajouter une prestation
          dossier_id: dossierId,
          add_prestation: true,
          prestation: {
            type, date_debut: dateDebut, date_fin: dateFin,
            heure_depart: heure || null,
            adresse_depart: adresseDepart || null,
            adresse_arrivee: adresseArrivee || null,
            heure_debut_journee: heureDebJ || null,
            heure_fin_journee: heureFinJ || null,
            tarif_journalier_ht: type === 'mad' ? tarifJour : null,
            tarif_fixe_ht: type === 'transfert' ? tarifFixe : null,
            modele_souhaite: modeleSouhaite || null,
            vehicule_id: vehiculeMode === 'flotte' && vehiculeId ? vehiculeId : null,
            affectation_differee: vehiculeMode === 'plus_tard',
            chauffeur_id: type === 'transfert' && chauffeurId ? chauffeurId : null,
            jours: type === 'mad' ? jours : [],
          }
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Erreur') }
      toast.success('Prestation ajoutée !')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button className="btn-ghost" style={{ padding:'5px 12px', fontSize:'11px' }} onClick={() => setOpen(true)}>
        <Plus size={11} /> Ajouter prestation
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
          <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'600px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>

            {/* Header */}
            <div style={{ background:'#16130e', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>Ajouter une prestation</span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px' }}><X size={18}/></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding:'22px 24px' }}>

              {/* Type selector */}
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>Type de prestation</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {([['transfert','→ Transfert'],['mad','◷ Mise à dispo']] as const).map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setType(v)}
                      style={{ flex:1, padding:'10px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', fontSize:'12px', fontWeight:700, cursor:'pointer', background: type===v ? '#16130e' : '#f5f2ed', border:`1.5px solid ${type===v ? '#16130e' : '#b8b0a4'}`, color: type===v ? '#fff' : '#5a564e', transition:'all 0.14s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* TRANSFERT */}
              {type === 'transfert' && (
                <>
                  {/* Sous-type */}
                  <div style={{ marginBottom:'14px' }}>
                    <label className="form-label" style={{ marginBottom:'8px' }}>Type de transfert</label>
                    <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                      {([['ville','🏙️','Ville'],['gare','🚉','Gare'],['aeroport','✈️','Aéroport']] as const).map(([v,icon,l]) => (
                        <button key={v} type="button" onClick={() => setSousType(v)}
                          style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background: sousType===v ? '#fdf6e3' : '#fff', border:`1.5px solid ${sousType===v ? '#9a7a28' : '#b8b0a4'}`, cursor:'pointer' }}>
                          <span style={{ fontSize:'18px' }}>{icon}</span>
                          <span style={{ fontSize:'10px', fontWeight:700, color: sousType===v ? '#9a7a28' : '#5a564e' }}>{l}</span>
                        </button>
                      ))}
                    </div>
                    {sousType !== 'ville' && (
                      <div style={{ display:'flex', gap:'6px' }}>
                        {([['depuis', sousType==='aeroport'?'🛬':'🚉', `Depuis ${sousType==='aeroport'?"l'aéroport":'la gare'}`],['vers',sousType==='aeroport'?'🛫':'🚆',`Vers ${sousType==='aeroport'?"l'aéroport":'la gare'}`]] as const).map(([v,icon,l]) => (
                          <button key={v} type="button" onClick={() => setSens(v as any)}
                            style={{ flex:1, padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', background: sens===v ? '#e8eef8' : '#fff', border:`1.5px solid ${sens===v ? '#1e3f70' : '#b8b0a4'}`, cursor:'pointer' }}>
                            <span style={{ fontSize:'16px' }}>{icon}</span>
                            <span style={{ fontSize:'11px', fontWeight:700, color: sens===v ? '#1e3f70' : '#5a564e' }}>{l}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <FormSep label="Détails" />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                    <div><label className="form-label">Date *</label><input type="date" className="input" required value={dateDebut} onChange={e => { setDateDebut(e.target.value); setDateFin(e.target.value) }} /></div>
                    <div><label className="form-label">Heure</label><input type="time" className="input" value={heure} onChange={e => setHeure(e.target.value)} /></div>
                    <div>
                      <label className="form-label">Chauffeur</label>
                      <select className="select" value={chauffeurId} onChange={e => setChauffeurId(e.target.value)}>
                        <option value="">— Sélectionner —</option>
                        {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                      </select>
                    </div>
                    <div><label className="form-label">Tarif HT (€) *</label><input type="number" className="input" required value={tarifFixe||''} onChange={e => setTarifFixe(parseFloat(e.target.value)||0)} min={0} step={0.01} /></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                    <div>
                      <label className="form-label">{sousType==='aeroport'&&sens==='depuis' ? 'Aéroport / Terminal' : sousType==='gare'&&sens==='depuis' ? 'Gare / Voie' : 'Adresse de départ'}</label>
                      <input type="text" className="input" value={adresseDepart} onChange={e => setAdresseDepart(e.target.value)} placeholder="Adresse, ville..." />
                    </div>
                    <div>
                      <label className="form-label">{sousType==='aeroport'&&sens==='vers' ? 'Aéroport / Terminal' : sousType==='gare'&&sens==='vers' ? 'Gare / Voie' : "Adresse d'arrivée"}</label>
                      <input type="text" className="input" value={adresseArrivee} onChange={e => setAdresseArrivee(e.target.value)} placeholder="Adresse, ville..." />
                    </div>
                  </div>
                </>
              )}

              {/* MAD */}
              {type === 'mad' && (
                <>
                  <FormSep label="Période & tarification" />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                    <div><label className="form-label">Date début *</label><input type="date" className="input" required value={dateDebut} min={dateDebutDossier} max={dateFinDossier} onChange={e => setDateDebut(e.target.value)} /></div>
                    <div><label className="form-label">Date fin *</label><input type="date" className="input" required value={dateFin} min={dateDebut} max={dateFinDossier} onChange={e => setDateFin(e.target.value)} /></div>
                    <div><label className="form-label">Jours</label><input readOnly className="input" value={jours.length > 0 ? `${jours.length} j` : '—'} style={{ background:'#faf9f7', color:'#9a7a28', cursor:'default', fontFamily:'JetBrains Mono,monospace' }} /></div>
                    <div><label className="form-label">Tarif / jour HT (€)</label><input type="number" className="input" value={tarifJour||''} onChange={e => setTarifJour(parseFloat(e.target.value)||0)} min={0} step={0.01} /></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                    <div><label className="form-label">Lieu principal</label><input type="text" className="input" value={adresseDepart} onChange={e => setAdresseDepart(e.target.value)} placeholder="Adresse, ville..." /></div>
                    <div>
                      <label className="form-label">Horaires journaliers</label>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <input type="time" className="input" value={heureDebJ} onChange={e => setHeureDebJ(e.target.value)} />
                        <span style={{ color:'#8a8478', flexShrink:0 }}>→</span>
                        <input type="time" className="input" value={heureFinJ} onChange={e => setHeureFinJ(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Grille journalière */}
                  {jours.length > 0 && (
                    <>
                      <FormSep label="Chauffeurs par jour" />
                      <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 60px', gap:'4px', padding:'4px 8px', background:'#faf9f7', marginBottom:'2px' }}>
                        {['Date','Chauffeur','Tarif'].map(h => <div key={h} style={{ fontSize:'8px', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>{h}</div>)}
                      </div>
                      {jours.map((j, ji) => (
                        <div key={j.date} style={{ display:'grid', gridTemplateColumns:'90px 1fr 60px', gap:'4px', alignItems:'center', padding:'5px 8px', marginBottom:'2px', background: !j.chauffeur_id ? '#fff8e8' : '#f5f2ed', border:`1px solid ${!j.chauffeur_id ? 'rgba(154,122,40,0.3)' : '#d8d2c8'}` }}>
                          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color: !j.chauffeur_id ? '#9a7a28' : '#2e2b25' }}>{j.jour_semaine} {format(parseISO(j.date),'dd/MM')}</span>
                          <select value={j.chauffeur_id} onChange={e => setJours(prev => prev.map((x,i) => i===ji ? {...x, chauffeur_id:e.target.value} : x))}
                            style={{ background:'#fff', border:`1px solid ${!j.chauffeur_id ? '#9a7a28' : '#b8b0a4'}`, padding:'4px 8px', fontSize:'11px', outline:'none', width:'100%' }}>
                            <option value="">— Non affecté —</option>
                            {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                          </select>
                          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#9a7a28', textAlign:'right' }}>{j.tarif_ht} €</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* Véhicule */}
              <FormSep label="Véhicule" />
              <div style={{ display:'flex', gap:'4px', marginBottom:'10px' }}>
                {([['flotte','Flotte'],['plus_tard','Plus tard']] as const).map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setVehiculeMode(v)}
                    style={{ padding:'6px 14px', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', cursor:'pointer', background: vehiculeMode===v ? '#9a7a28' : 'transparent', border:`1.5px solid ${vehiculeMode===v ? '#9a7a28' : '#b8b0a4'}`, color: vehiculeMode===v ? '#fff' : '#5a564e', transition:'all 0.14s' }}>
                    {l}
                  </button>
                ))}
              </div>

              {vehiculeMode === 'flotte' && (
                <>
                  <div style={{ marginBottom:'8px' }}>
                    <VehiculeCategorieSelect categories={categories} value={modeleSouhaite} onChange={setModeleSouhaite} selectClass="select" />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                    {vehicules.length === 0 ? (
                      <div style={{ gridColumn:'span 2', padding:'10px', background:'#fdf3dc', fontSize:'11px', color:'#7a5c10' }}>Aucun véhicule disponible</div>
                    ) : vehicules.map(v => (
                      <div key={v.id} onClick={() => v.disponible_periode !== false && setVehiculeId(v.id)}
                        style={{ background: vehiculeId===v.id ? '#fdf6e3' : '#f5f2ed', border:`1.5px solid ${vehiculeId===v.id ? '#9a7a28' : '#d8d2c8'}`, padding:'8px 10px', cursor: v.disponible_periode===false ? 'not-allowed' : 'pointer', opacity: v.disponible_periode===false ? 0.4 : 1, display:'flex', alignItems:'center', gap:'8px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'11px', fontWeight:600 }}>{v.marque} {v.modele}</div>
                          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#5a564e' }}>{v.immatriculation}</div>
                        </div>
                        <span style={{ fontSize:'8px', fontWeight:700, color: v.disponible_periode===false ? '#9e2a2a' : '#1e5e3a' }}>{v.disponible_periode===false ? 'Occupé' : 'Libre'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {vehiculeMode === 'plus_tard' && (
                <div style={{ padding:'10px 12px', background:'#fdf3dc', border:'1px solid rgba(122,92,16,0.2)', fontSize:'11px', color:'#7a5c10', fontWeight:500 }}>
                  ⏳ Véhicule assignable depuis le dossier ou le planning.
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'20px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Ajout…' : 'Ajouter la prestation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function FormSep({ label }: { label: string }) {
  return (
    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', marginTop:'4px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
      {label}
    </div>
  )
}
