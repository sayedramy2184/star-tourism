'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Edit, Plus, Car, X } from 'lucide-react'

// ── Types ─────────────────────────────────────

interface Chauffeur { id: string; nom: string; prenom: string }
interface Vehicule  { id: string; marque: string; modele: string; immatriculation: string; disponible_periode?: boolean }
interface Client    { id: string; nom: string; contact_nom: string | null }

const JOURS_FR = ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.']

const CATEGORIES_VEHICULE = [
  'Berline standard',
  'Berline premium',
  'Berline prestige',
  'Van / Minibus',
  'Van Bagages',
  'SUV premium',
  'Électrique',
] as const

// Statuts dossier — gérés par actions spécifiques, pas manuellement
// en_attente (défaut) → en_cours (bouton Valider) → termine (auto)

function FormSep({ label }: { label: string }) {
  return (
    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4', marginTop:'4px' }}>
      {label}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'580px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
          <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'4px' }}><X size={18}/></button>
        </div>
        <div style={{ padding:'22px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
//  BOUTON MODIFIER DOSSIER
// ══════════════════════════════════════════════

export function BoutonModifierDossier({ dossier }: {
  dossier: { id: string; client_id: string; date_debut: string; date_fin: string; statut: string; notes: string | null }
}) {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [clientId,  setClientId]  = useState(dossier.client_id)
  const [dateDebut, setDateDebut] = useState(dossier.date_debut)
  const [dateFin,   setDateFin]   = useState(dossier.date_fin)
  const [notes,     setNotes]     = useState(dossier.notes ?? '')

  async function handleOpen() {
    const res = await fetch('/api/clients')
    const { data } = await res.json()
    setClients(data ?? [])
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, date_debut: dateDebut, date_fin: dateFin, notes: notes || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dossier mis à jour !')
      setOpen(false)
      router.refresh()
    } catch { toast.error('Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  return (
    <>
      <button
        className="btn-ghost"
        style={{ padding:'5px 12px', fontSize:'11px', color:'rgba(255,255,255,0.5)', borderColor:'rgba(255,255,255,0.15)' }}
        onClick={handleOpen}>
        <Edit size={11} /> Modifier
      </button>

      {open && (
        <Modal title="Modifier le dossier" onClose={() => setOpen(false)}>
          <form onSubmit={handleSave}>
            <div style={{ marginBottom:'12px' }}>
              <label className="form-label">Client</label>
              <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nom}{c.contact_nom ? ` — ${c.contact_nom}` : ''}</option>)}
              </select>
            </div>
            <div className="form-grid-2" style={{ marginBottom:'12px' }}>
              <div>
                <label className="form-label">Date de début</label>
                <input type="date" className="input" value={dateDebut}
                  onChange={e => { setDateDebut(e.target.value); if (dateFin < e.target.value) setDateFin(e.target.value) }} required />
              </div>
              <div>
                <label className="form-label">Date de fin</label>
                <input type="date" className="input" value={dateFin} min={dateDebut} onChange={e => setDateFin(e.target.value)} required />
              </div>
            </div>

            <div style={{ marginBottom:'16px' }}>
              <label className="form-label">Notes internes</label>
              <textarea className="textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instructions, préférences client…" style={{ minHeight:'80px' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

// ══════════════════════════════════════════════
//  BOUTON AJOUTER PRESTATION
// ══════════════════════════════════════════════

export function BoutonAjoutPrestation({ dossierId, dateDebutDossier, dateFinDossier }: {
  dossierId: string; dateDebutDossier: string; dateFinDossier: string
}) {
  const router = useRouter()
  const [open,       setOpen]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [vehicules,  setVehicules]  = useState<Vehicule[]>([])
  const [type,       setType]       = useState<'mad'|'transfert'>('transfert')
  const [sousType,   setSousType]   = useState<'ville'|'gare'|'aeroport'>('ville')
  const [sens,       setSens]       = useState<'depuis'|'vers'>('depuis')
  const [dateDebut,  setDateDebut]  = useState(dateDebutDossier)
  const [dateFin,    setDateFin]    = useState(dateDebutDossier)
  const [heure,      setHeure]      = useState('')
  const [heureDebJ,  setHeureDebJ]  = useState('09:00')
  const [heureFinJ,  setHeureFinJ]  = useState('18:00')
  const [adresseD,   setAdresseD]   = useState('')
  const [adresseA,   setAdresseA]   = useState('')
  const [volNumero,  setVolNumero]  = useState('')
  const [volHeure,   setVolHeure]   = useState('')
  const [volVille,   setVolVille]   = useState('')
  const [volTerminal,setVolTerminal]= useState('')
  const [nbPax,      setNbPax]      = useState(1)
  const [nbBag,      setNbBag]      = useState(0)
  const [tarifFixe,  setTarifFixe]  = useState(0)
  const [tarifJour,  setTarifJour]  = useState(960)
  const [modele,     setModele]     = useState('')
  const [vehiculeId, setVehiculeId] = useState('')
  const [vMode,      setVMode]      = useState<'flotte'|'plus_tard'>('plus_tard')
  const [chauffId,   setChauffId]   = useState('')
  const [jours,      setJours]      = useState<any[]>([])

  async function handleOpen() {
    const [c, v] = await Promise.all([
      fetch('/api/chauffeurs').then(r => r.json()),
      fetch(`/api/vehicules?date_debut=${dateDebutDossier}&date_fin=${dateFinDossier}`).then(r => r.json()),
    ])
    setChauffeurs(c.data ?? [])
    setVehicules(v.data ?? [])
    setOpen(true)
  }

  function regenerateJours(dd: string, df: string, tarif: number) {
    try {
      const days = eachDayOfInterval({ start: parseISO(dd), end: parseISO(df) })
      setJours(days.map(d => ({
        date: format(d,'yyyy-MM-dd'),
        jour_semaine: JOURS_FR[d.getDay()],
        chauffeur_id: '', tarif_ht: tarif, note: '',
      })))
    } catch { setJours([]) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/prestations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossier_id: dossierId,
          type, date_debut: dateDebut, date_fin: dateFin,
          heure_depart: heure || null,
          adresse_depart: adresseD || null, adresse_arrivee: adresseA || null,
          vol_numero:   type==='transfert' && sousType!=='ville' ? (volNumero || null) : null,
          vol_heure:    type==='transfert' && sousType!=='ville' ? (volHeure || null) : null,
          vol_ville:    type==='transfert' && sousType!=='ville' ? (volVille || null) : null,
          vol_terminal: type==='transfert' && sousType!=='ville' ? (volTerminal || null) : null,
          vol_arrivee:  type==='transfert' && sousType!=='ville' ? (sens === 'depuis') : null,
          nb_passagers: nbPax, nb_bagages: nbBag,
          heure_debut_journee: type==='mad' ? heureDebJ : null,
          heure_fin_journee:   type==='mad' ? heureFinJ : null,
          tarif_journalier_ht: type==='mad' ? tarifJour : null,
          tarif_fixe_ht: type==='transfert' ? tarifFixe : null,
          modele_souhaite: modele || null,
          vehicule_id: vMode==='flotte' && vehiculeId ? vehiculeId : null,
          affectation_differee: vMode==='plus_tard',
          chauffeur_id: type==='transfert' && chauffId ? chauffId : null,
          jours: type==='mad' ? jours : [],
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Erreur') }
      toast.success('Prestation ajoutée !')
      setOpen(false)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost" style={{ padding:'5px 12px', fontSize:'11px' }} onClick={handleOpen}>
        <Plus size={11} /> Ajouter prestation
      </button>

      {open && (
        <Modal title="Ajouter une prestation" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit}>
            {/* Type */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              {([['transfert','→ Transfert'],['mad','◷ Mise à dispo']] as const).map(([v,l]) => (
                <button key={v} type="button" onClick={() => setType(v)}
                  style={{ flex:1, padding:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer', background: type===v ? '#16130e' : '#f5f2ed', border:`1.5px solid ${type===v ? '#16130e' : '#b8b0a4'}`, color: type===v ? '#fff' : '#5a564e', transition:'all 0.14s' }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', gap:'12px', marginBottom:'14px' }}>
              <div style={{ width:'100px' }}><label className="form-label">Passagers</label><input type="number" className="input" min={0} value={nbPax} onChange={e => setNbPax(Number(e.target.value))} /></div>
              <div style={{ width:'100px' }}><label className="form-label">Bagages</label><input type="number" className="input" min={0} value={nbBag} onChange={e => setNbBag(Number(e.target.value))} /></div>
            </div>

            {type === 'transfert' && (
              <>
                {/* Sous-type */}
                <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                  {([['ville','🏙️','Ville'],['gare','🚉','Gare'],['aeroport','✈️','Aéroport']] as const).map(([v,icon,l]) => (
                    <button key={v} type="button" onClick={() => setSousType(v)}
                      style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background: sousType===v ? '#fdf6e3' : '#fff', border:`1.5px solid ${sousType===v ? '#9a7a28' : '#b8b0a4'}`, cursor:'pointer', transition:'all 0.14s' }}>
                      <span style={{ fontSize:'18px' }}>{icon}</span>
                      <span style={{ fontSize:'10px', fontWeight:700, color: sousType===v ? '#9a7a28' : '#5a564e' }}>{l}</span>
                    </button>
                  ))}
                </div>
                {sousType !== 'ville' && (
                  <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
                    {([['depuis',sousType==='aeroport'?'🛬':'🚉',`Depuis ${sousType==='aeroport'?"l'aéroport":'la gare'}`],['vers',sousType==='aeroport'?'🛫':'🚆',`Vers ${sousType==='aeroport'?"l'aéroport":'la gare'}`]] as const).map(([v,icon,l]) => (
                      <button key={v} type="button" onClick={() => setSens(v as any)}
                        style={{ flex:1, padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', background: sens===v ? '#e8eef8' : '#fff', border:`1.5px solid ${sens===v ? '#1e3f70' : '#b8b0a4'}`, cursor:'pointer', transition:'all 0.14s' }}>
                        <span style={{ fontSize:'16px' }}>{icon}</span>
                        <span style={{ fontSize:'11px', fontWeight:700, color: sens===v ? '#1e3f70' : '#5a564e' }}>{l}</span>
                      </button>
                    ))}
                  </div>
                )}
                <FormSep label="Détails" />
                <div className="form-grid-4" style={{ marginBottom:'12px' }}>
                  <div><label className="form-label">Date *</label><input type="date" className="input" required value={dateDebut} onChange={e => { setDateDebut(e.target.value); setDateFin(e.target.value) }} /></div>
                  <div><label className="form-label">Heure</label><input type="time" className="input" value={heure} onChange={e => setHeure(e.target.value)} /></div>
                  <div><label className="form-label">Chauffeur</label>
                    <select className="select" value={chauffId} onChange={e => setChauffId(e.target.value)}>
                      <option value="">— Sélectionner —</option>
                      {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                    </select>
                  </div>
                  <div><label className="form-label">Tarif HT (€) *</label><input type="number" className="input" required value={tarifFixe||''} onChange={e => setTarifFixe(parseFloat(e.target.value)||0)} min={0} step={0.01} /></div>
                </div>
                <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                  <div><label className="form-label">{sousType!=='ville'&&sens==='depuis' ? (sousType==='aeroport'?'Aéroport / Terminal':'Gare / Voie') : 'Adresse de départ'}</label>
                    <input type="text" className="input" value={adresseD} onChange={e => setAdresseD(e.target.value)} placeholder="Adresse, ville..." /></div>
                  <div><label className="form-label">{sousType!=='ville'&&sens==='vers' ? (sousType==='aeroport'?'Aéroport / Terminal':'Gare / Voie') : "Adresse d'arrivée"}</label>
                    <input type="text" className="input" value={adresseA} onChange={e => setAdresseA(e.target.value)} placeholder="Adresse, ville..." /></div>
                </div>
                {sousType !== 'ville' && (
                  <>
                    <FormSep label={sousType === 'aeroport' ? 'Suivi du vol' : 'Suivi du train'} />
                    <div className="form-grid-4" style={{ marginBottom:'12px' }}>
                      <div><label className="form-label">{sousType==='aeroport'?'Terminal':'Gare'}</label><input type="text" className="input" value={volTerminal} onChange={e => setVolTerminal(e.target.value)} placeholder={sousType==='aeroport'?'CDG 1':'Gare de Lyon'} /></div>
                      <div><label className="form-label">{sousType==='aeroport'?'N° vol':'N° train'}</label><input type="text" className="input" value={volNumero} onChange={e => setVolNumero(e.target.value.toUpperCase())} placeholder={sousType==='aeroport'?'EY031':'TGV 9012'} /></div>
                      <div><label className="form-label">Heure prog.</label><input type="time" className="input" value={volHeure} onChange={e => setVolHeure(e.target.value)} /></div>
                      <div><label className="form-label">{sens==='depuis'?'Provenance':'Destination'}</label><input type="text" className="input" value={volVille} onChange={e => setVolVille(e.target.value)} placeholder={sens==='depuis'?'Abu Dhabi':'Tokyo'} /></div>
                    </div>
                  </>
                )}
              </>
            )}

            {type === 'mad' && (
              <>
                <FormSep label="Période & tarification" />
                <div className="form-grid-4" style={{ marginBottom:'12px' }}>
                  <div><label className="form-label">Date début *</label><input type="date" className="input" required value={dateDebut} min={dateDebutDossier} max={dateFinDossier} onChange={e => { setDateDebut(e.target.value); regenerateJours(e.target.value, dateFin, tarifJour) }} /></div>
                  <div><label className="form-label">Date fin *</label><input type="date" className="input" required value={dateFin} min={dateDebut} max={dateFinDossier} onChange={e => { setDateFin(e.target.value); regenerateJours(dateDebut, e.target.value, tarifJour) }} /></div>
                  <div><label className="form-label">Jours</label><input readOnly className="input" value={jours.length > 0 ? `${jours.length} j` : '—'} style={{ background:'#faf9f7', color:'#9a7a28', cursor:'default' }} /></div>
                  <div><label className="form-label">Tarif / jour HT (€)</label><input type="number" className="input" value={tarifJour||''} onChange={e => { const v = parseFloat(e.target.value)||0; setTarifJour(v); regenerateJours(dateDebut, dateFin, v) }} min={0} step={0.01} /></div>
                </div>
                <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                  <div><label className="form-label">Lieu principal</label><input type="text" className="input" value={adresseD} onChange={e => setAdresseD(e.target.value)} placeholder="Adresse, ville..." /></div>
                  <div><label className="form-label">Horaires journaliers</label>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <input type="time" className="input" value={heureDebJ} onChange={e => setHeureDebJ(e.target.value)} />
                      <span style={{ color:'#8a8478', flexShrink:0 }}>→</span>
                      <input type="time" className="input" value={heureFinJ} onChange={e => setHeureFinJ(e.target.value)} />
                    </div>
                  </div>
                </div>
                {jours.length > 0 && (
                  <>
                    <FormSep label="Chauffeurs par jour" />
                    <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 60px', gap:'4px', padding:'4px 8px', background:'#faf9f7', marginBottom:'2px' }}>
                      {['Date','Chauffeur','Tarif'].map(h => <div key={h} style={{ fontSize:'8px', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>{h}</div>)}
                    </div>
                    {jours.map((j, ji) => (
                      <div key={j.date} style={{ display:'grid', gridTemplateColumns:'90px 1fr 60px', gap:'4px', alignItems:'center', padding:'5px 8px', marginBottom:'2px', background: !j.chauffeur_id ? '#fff8e8' : '#f5f2ed', border:`1px solid ${!j.chauffeur_id ? 'rgba(154,122,40,0.3)' : '#d8d2c8'}` }}>
                        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px' }}>{j.jour_semaine} {format(parseISO(j.date),'dd/MM')}</span>
                        <select value={j.chauffeur_id} onChange={e => setJours(prev => prev.map((x,i) => i===ji ? {...x, chauffeur_id:e.target.value} : x))}
                          style={{ background:'#fff', border:'1px solid #b8b0a4', padding:'4px 8px', fontSize:'11px', outline:'none', width:'100%' }}>
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

            {/* Catégorie de véhicule souhaitée */}
            <FormSep label="Catégorie de véhicule" />
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'12px' }}>
              {CATEGORIES_VEHICULE.map(cat => (
                <button key={cat} type="button" onClick={() => setModele(modele===cat ? '' : cat)}
                  style={{ padding:'7px 12px', fontSize:'11px', fontWeight:600, cursor:'pointer', background: modele===cat ? '#fdf6e3' : '#fff', border:`1.5px solid ${modele===cat ? '#9a7a28' : '#b8b0a4'}`, color: modele===cat ? '#9a7a28' : '#5a564e', transition:'all 0.14s' }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Véhicule */}
            <FormSep label="Véhicule" />
            <div style={{ display:'flex', gap:'4px', marginBottom:'10px' }}>
              {([['flotte','Flotte'],['plus_tard','Plus tard']] as const).map(([v,l]) => (
                <button key={v} type="button" onClick={() => setVMode(v)}
                  style={{ padding:'6px 14px', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', cursor:'pointer', background: vMode===v ? '#9a7a28' : 'transparent', border:`1.5px solid ${vMode===v ? '#9a7a28' : '#b8b0a4'}`, color: vMode===v ? '#fff' : '#5a564e', transition:'all 0.14s' }}>
                  {l}
                </button>
              ))}
            </div>
            {vMode === 'flotte' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'12px' }}>
                {vehicules.length === 0 ? (
                  <div style={{ gridColumn:'span 2', padding:'10px', background:'#fdf3dc', fontSize:'11px', color:'#7a5c10' }}>Aucun véhicule</div>
                ) : vehicules.map(v => (
                  <div key={v.id} onClick={() => v.disponible_periode !== false && setVehiculeId(v.id)}
                    style={{ background: vehiculeId===v.id ? '#fdf6e3' : '#f5f2ed', border:`1.5px solid ${vehiculeId===v.id ? '#9a7a28' : '#d8d2c8'}`, padding:'8px 10px', cursor: v.disponible_periode===false ? 'not-allowed' : 'pointer', opacity: v.disponible_periode===false ? 0.4 : 1, display:'flex', alignItems:'center', gap:'8px', transition:'all 0.14s' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'11px', fontWeight:600 }}>{v.marque} {v.modele}</div>
                      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#5a564e' }}>{v.immatriculation}</div>
                    </div>
                    <span style={{ fontSize:'8px', fontWeight:700, color: v.disponible_periode===false ? '#9e2a2a' : '#1e5e3a' }}>{v.disponible_periode===false ? 'Occupé' : 'Libre'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding:'10px 12px', background:'#fdf3dc', border:'1px solid rgba(122,92,16,0.2)', fontSize:'11px', color:'#7a5c10', marginBottom:'12px' }}>
                ⏳ Véhicule assignable depuis le dossier ou le planning.
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Ajout…' : 'Ajouter la prestation'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

// ══════════════════════════════════════════════
//  BOUTON AFFECTER VEHICULE
// ══════════════════════════════════════════════

export function BoutonAffecterVehicule({ prestationId, dateDebut, dateFin, vehiculeActuel }: {
  prestationId: string
  dateDebut: string
  dateFin: string
  vehiculeActuel?: { marque: string; modele: string; immatriculation: string } | null
}) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [selected,  setSelected]  = useState('')
  const [saving,    setSaving]    = useState(false)

  async function handleOpen() {
    const res = await fetch(`/api/vehicules?date_debut=${dateDebut}&date_fin=${dateFin}`)
    const { data } = await res.json()
    setVehicules(data ?? [])
    setOpen(true)
  }

  async function handleSave() {
    if (!selected) return toast.error('Sélectionnez un véhicule')
    setSaving(true)
    try {
      const res = await fetch(`/api/prestations/${prestationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicule_id: selected, affectation_differee: false }),
      })
      if (!res.ok) throw new Error()
      toast.success('Véhicule affecté !')
      setOpen(false)
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:'10px' }} onClick={handleOpen}>
        <Car size={11} /> {vehiculeActuel ? 'Changer' : 'Affecter véhicule'}
      </button>

      {open && (
        <Modal title="Affecter un véhicule" onClose={() => setOpen(false)}>
          {vehiculeActuel && (
            <div style={{ padding:'10px 14px', background:'#f5f2ed', border:'1.5px solid #b8b0a4', marginBottom:'16px' }}>
              <div style={{ fontSize:'9px', color:'#8a8478', marginBottom:'3px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase' }}>Véhicule actuel</div>
              <div style={{ fontSize:'13px', fontWeight:600 }}>{vehiculeActuel.marque} {vehiculeActuel.modele}</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#5a564e' }}>{vehiculeActuel.immatriculation}</div>
            </div>
          )}
          <FormSep label="Véhicules disponibles sur la période" />
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'16px' }}>
            {vehicules.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', color:'#8a8478' }}>Aucun véhicule</div>
            ) : vehicules.map(v => {
              const dispo = v.disponible_periode !== false
              return (
                <div key={v.id} onClick={() => dispo && setSelected(v.id)}
                  style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', cursor: dispo ? 'pointer' : 'not-allowed', background: selected===v.id ? '#fdf6e3' : dispo ? '#fff' : '#f5f2ed', border:`1.5px solid ${selected===v.id ? '#9a7a28' : dispo ? '#d8d2c8' : '#b8b0a4'}`, opacity: dispo ? 1 : 0.5, transition:'all 0.14s' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>{v.marque} {v.modele}</div>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#5a564e', marginTop:'2px' }}>{v.immatriculation}</div>
                  </div>
                  <span style={{ fontSize:'9px', fontWeight:700, padding:'3px 8px', background: dispo ? '#eaf4ee' : '#faeaea', color: dispo ? '#1e5e3a' : '#9e2a2a', border:`1px solid ${dispo ? 'rgba(30,94,58,0.2)' : 'rgba(158,42,42,0.2)'}` }}>
                    {dispo ? 'Libre' : 'Occupé'}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !selected}>
              {saving ? 'Affectation…' : 'Affecter ce véhicule'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ══════════════════════════════════════════════
//  BOUTON VALIDER DOSSIER
// ══════════════════════════════════════════════

export function BoutonValiderDossier({ dossierId, statut, numero }: {
  dossierId: string
  statut: string
  numero: string
}) {
  const router  = useRouter()
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  if (statut !== 'en_attente') return null

  async function handleValider() {
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'valider' }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Dossier ${numero} validé — en cours !`)
      setConfirm(false)
      router.refresh()
    } catch { toast.error('Erreur lors de la validation') }
    finally { setSaving(false) }
  }

  return (
    <>
      <button
        className="btn-or"
        style={{ padding:'5px 16px', fontSize:'11px', letterSpacing:'0.5px' }}
        onClick={() => setConfirm(true)}
      >
        ✓ Valider le dossier
      </button>

      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
          <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'420px', boxShadow:'0 24px 60px rgba(0,0,0,0.2)', padding:'28px' }}>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:500, color:'#16130e', marginBottom:'12px' }}>
              Valider le dossier {numero} ?
            </div>
            <div style={{ background:'#fdf3dc', border:'1px solid rgba(122,92,16,0.3)', borderLeft:'3px solid #7a5c10', padding:'10px 14px', marginBottom:'16px', fontSize:'12px', color:'#5a564e', lineHeight:1.7 }}>
              <strong style={{ color:'#7a5c10' }}>⚠ Attention</strong> — Une fois validé, ce dossier <strong>ne pourra plus être supprimé</strong>, même après sa clôture.
            </div>
            <p style={{ fontSize:'12px', color:'#5a564e', lineHeight:1.7, marginBottom:'20px' }}>
              Le dossier passera en statut <strong style={{ color:'#1e3f70' }}>En cours</strong> et confirmera la commande du client.
              Il sera automatiquement clôturé quand toutes les prestations seront terminées.
            </p>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
              <button className="btn-or" disabled={saving} onClick={handleValider}
                style={{ padding:'8px 20px', fontSize:'12px' }}>
                {saving ? 'Validation…' : '✓ Confirmer la validation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════
//  BOUTON SUPPRIMER DOSSIER
// ══════════════════════════════════════════════

export function BoutonSupprimerDossier({ dossierId, statut, numero }: {
  dossierId: string
  statut: string
  numero: string
}) {
  const router  = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [saving,  setSaving]  = useState(false)

  // Caché si dossier validé
  if (statut === 'en_cours' || statut === 'termine') return null

  async function handleSupprimer() {
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success(`Dossier ${numero} supprimé`)
      router.push('/dashboard/dossiers')
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button
        className="btn-ghost"
        style={{ padding:'5px 12px', fontSize:'11px', color:'rgba(255,255,255,0.35)', borderColor:'rgba(255,255,255,0.1)' }}
        onClick={() => setConfirm(true)}
      >
        🗑 Supprimer
      </button>

      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
          <div style={{ background:'#fff', border:'1.5px solid #9e2a2a', width:'400px', boxShadow:'0 24px 60px rgba(0,0,0,0.2)', padding:'28px' }}>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', fontWeight:500, color:'#9e2a2a', marginBottom:'12px' }}>
              Supprimer {numero} ?
            </div>
            <p style={{ fontSize:'12px', color:'#5a564e', lineHeight:1.7, marginBottom:'20px' }}>
              Cette action est <strong>irréversible</strong>. Toutes les prestations et jours associés seront supprimés.
            </p>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
              <button disabled={saving} onClick={handleSupprimer}
                style={{ background:'#9e2a2a', color:'#fff', border:'none', padding:'8px 20px', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'opacity 0.14s' }}>
                {saving ? 'Suppression…' : '🗑 Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
