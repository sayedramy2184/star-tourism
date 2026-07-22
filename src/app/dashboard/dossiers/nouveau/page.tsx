'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, eachDayOfInterval, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Plus, Trash2, ChevronDown, ChevronUp, Users, Briefcase } from 'lucide-react'
import { flag } from '@/components/dossiers/PassagersDossier'
import VehiculeCategorieSelect from '@/components/ui/VehiculeCategorieSelect'
import type { Client, Vehicule, Chauffeur } from '@/types'

// ── Types ─────────────────────────────────────

type PrestationType    = 'mad' | 'transfert'
type TransfertSousType = 'ville' | 'gare' | 'aeroport'
type TransfertSens     = 'depuis' | 'vers'
type VehiculeMode      = 'flotte' | 'externe' | 'plus_tard'

interface JourForm {
  date: string
  jour_semaine: string
  chauffeur_id: string
  tarif_ht: number
  note: string
}

interface PassagerForm {
  id: string
  nom: string
  nationalite: string
  telephone: string
  nb_bagages: number
}

interface PrestationForm {
  id: string
  ordre: number
  type: PrestationType
  transfert_sous_type: TransfertSousType
  transfert_sens: TransfertSens
  date_debut: string
  date_fin: string
  heure_depart: string
  adresse_depart: string
  adresse_arrivee: string
  vol_numero: string
  vol_heure: string
  vol_ville: string
  vol_terminal: string
  nb_passagers: number
  nb_bagages: number
  heure_debut_journee: string
  heure_fin_journee: string
  tarif_journalier_ht: number
  tarif_fixe_ht: number
  modele_souhaite: string
  vehicule_id: string
  vehicule_mode: VehiculeMode
  ext_marque: string
  ext_modele: string
  ext_immatriculation: string
  ext_loueur: string
  ext_cout_ht: number
  chauffeur_id: string
  notes: string
  jours: JourForm[]
  collapsed: boolean
}

const JOURS_FR = ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.']

function makePrestation(ordre: number): PrestationForm {
  return {
    id: Math.random().toString(36).slice(2),
    ordre,
    type: 'transfert',
    transfert_sous_type: 'ville',
    transfert_sens: 'depuis',
    date_debut: '',
    date_fin: '',
    heure_depart: '',
    adresse_depart: '',
    adresse_arrivee: '',
    vol_numero: '',
    vol_heure: '',
    vol_ville: '',
    vol_terminal: '',
    nb_passagers: 1,
    nb_bagages: 0,
    heure_debut_journee: '09:00',
    heure_fin_journee: '18:00',
    tarif_journalier_ht: 960,
    tarif_fixe_ht: 0,
    modele_souhaite: '',
    vehicule_id: '',
    vehicule_mode: 'flotte',
    ext_marque: '',
    ext_modele: '',
    ext_immatriculation: '',
    ext_loueur: '',
    ext_cout_ht: 0,
    chauffeur_id: '',
    notes: '',
    jours: [],
    collapsed: false,
  }
}

function generateJours(p: PrestationForm): JourForm[] {
  if (!p.date_debut || !p.date_fin || p.type !== 'mad') return []
  try {
    return eachDayOfInterval({ start: parseISO(p.date_debut), end: parseISO(p.date_fin) })
      .map(d => ({
        date: format(d, 'yyyy-MM-dd'),
        jour_semaine: JOURS_FR[d.getDay()],
        chauffeur_id: p.chauffeur_id || '',
        tarif_ht: p.tarif_journalier_ht || 0,
        note: '',
      }))
  } catch { return [] }
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Page principale ───────────────────────────

export default function NouveauDossierPage() {
  const router = useRouter()
  const [clients,    setClients]    = useState<Client[]>([])
  const [showNouveauClient, setShowNouveauClient] = useState(false)
  const [nouveauClientForm, setNouveauClientForm] = useState({
    type: 'agence', nom: '', contact_nom: '', email: '', telephone: '', pays: 'France'
  })
  const [savingClient, setSavingClient] = useState(false)
  const [vehicules,  setVehicules]  = useState<any[]>([])
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [forfaits,   setForfaits]   = useState<any[]>([])
  const [clientTarifs, setClientTarifs] = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [clientId,   setClientId]   = useState('')
  const [dateDebut,  setDateDebut]  = useState('')
  const [dateFin,    setDateFin]    = useState('')
  const [statut,     setStatut]     = useState('en_attente')
  const [notes,      setNotes]      = useState('')
  const [passagers,  setPassagers]  = useState<PassagerForm[]>([])
  const [prestations, setPrestations] = useState<PrestationForm[]>([makePrestation(1)])

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/chauffeurs').then(r => r.json()),
      fetch('/api/forfaits').then(r => r.json()),
    ]).then(([c, ch, f]) => {
      setClients(c.data ?? [])
      setChauffeurs(ch.data ?? [])
      setForfaits(f.data ?? [])
    })
  }, [])

  useEffect(() => {
    if (!dateDebut || !dateFin) return
    fetch(`/api/vehicules?date_debut=${dateDebut}&date_fin=${dateFin}`)
      .then(r => r.json()).then(v => setVehicules(v.data ?? []))
  }, [dateDebut, dateFin])

  // Charge les tarifs dédiés du client sélectionné
  useEffect(() => {
    if (!clientId) { setClientTarifs([]); return }
    fetch(`/api/clients/${clientId}/tarifs`)
      .then(r => r.json()).then(({ data }) => {
        const tarifs = data ?? []
        setClientTarifs(tarifs)
        if (tarifs.length === 0) return
        // Application auto : si UN seul tarif correspond au type d'une prestation encore vide
        setPrestations(prev => prev.map(p => {
          const match = tarifs.filter((t: any) => t.type === p.type)
          if (match.length !== 1) return p
          const t = match[0]
          if (p.type === 'transfert' && !p.tarif_fixe_ht) {
            const u = { ...p, tarif_fixe_ht: t.prix_ht }
            return u
          }
          if (p.type === 'mad' && (p.tarif_journalier_ht === 960 || !p.tarif_journalier_ht)) {
            const u = { ...p, tarif_journalier_ht: t.prix_ht }
            u.jours = generateJours(u)
            return u
          }
          return p
        }))
      })
      .catch(() => setClientTarifs([]))
  }, [clientId])

  function updatePrestation(id: string, updates: Partial<PrestationForm>) {
    setPrestations(prev => prev.map(p => {
      if (p.id !== id) return p
      const u = { ...p, ...updates }
      if (u.type === 'mad' &&
        (updates.date_debut !== undefined || updates.date_fin !== undefined || updates.tarif_journalier_ht !== undefined)) {
        u.jours = generateJours(u)
      }
      return u
    }))
  }

  function updateJour(prestId: string, ji: number, updates: Partial<JourForm>) {
    setPrestations(prev => prev.map(p => {
      if (p.id !== prestId) return p
      const j = [...p.jours]
      j[ji] = { ...j[ji], ...updates }
      return { ...p, jours: j }
    }))
  }

  function addPassager() {
    setPassagers(prev => [...prev, { id: Math.random().toString(36).slice(2), nom: '', nationalite: '', telephone: '', nb_bagages: 0 }])
  }
  function updatePassager(id: string, updates: Partial<PassagerForm>) {
    setPassagers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }
  function removePassager(id: string) {
    setPassagers(prev => prev.filter(p => p.id !== id))
  }

  const totalHT = prestations.reduce((s, p) =>
    s + (p.type === 'mad' ? p.jours.reduce((a, j) => a + j.tarif_ht, 0) : (p.tarif_fixe_ht || 0)), 0)
  const tva      = Math.round(totalHT * 0.10 * 100) / 100
  const totalTTC = totalHT + tva
  const nbJours  = dateDebut && dateFin ? differenceInDays(parseISO(dateFin), parseISO(dateDebut)) + 1 : 0

  async function handleCreateClient(e?: React.FormEvent) {
    e?.preventDefault()
    if (!nouveauClientForm.nom.trim()) return toast.error('Le nom est requis')
    setSavingClient(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nouveauClientForm),
      })
      const { data, error } = await res.json()
      if (error) throw new Error(error)
      setClients(prev => [...prev, data])
      setClientId(data.id)
      setShowNouveauClient(false)
      setNouveauClientForm({ type:'entreprise', nom:'', contact_nom:'', email:'', telephone:'', pays:'France' })
      toast.success('Client créé !')
    } catch (err: any) { toast.error(err.message) }
    finally { setSavingClient(false) }
  }

  async function handleSubmit(e: React.FormEvent, draft = false) {
    e.preventDefault()
    if (!clientId)  return toast.error('Sélectionnez un client')
    if (!dateDebut) return toast.error('Indiquez une date de début')
    if (!dateFin)   return toast.error('Indiquez une date de fin')
    if (prestations.some(p => !p.date_debut || !p.date_fin))
      return toast.error('Toutes les prestations doivent avoir des dates')

    setLoading(true)
    try {
      const res = await fetch('/api/dossiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId, date_debut: dateDebut, date_fin: dateFin,
          statut: draft ? 'brouillon' : statut, notes: notes || null,
          passagers: passagers
            .filter(p => p.nom.trim())
            .map(p => ({
              nom: p.nom.trim(),
              nationalite: p.nationalite || null,
              telephone: p.telephone || null,
              nb_bagages: p.nb_bagages ?? 0,
            })),
          prestations: prestations.map(p => ({
            ordre: p.ordre, type: p.type, date_debut: p.date_debut, date_fin: p.date_fin,
            heure_depart: p.heure_depart || null,
            adresse_depart: p.adresse_depart || null,
            adresse_arrivee: p.adresse_arrivee || null,
            vol_numero:   p.type === 'transfert' && p.transfert_sous_type !== 'ville' ? (p.vol_numero || null) : null,
            vol_heure:    p.type === 'transfert' && p.transfert_sous_type !== 'ville' ? (p.vol_heure || null) : null,
            vol_ville:    p.type === 'transfert' && p.transfert_sous_type !== 'ville' ? (p.vol_ville || null) : null,
            vol_terminal: p.type === 'transfert' && p.transfert_sous_type !== 'ville' ? (p.vol_terminal || null) : null,
            vol_arrivee:  p.type === 'transfert' && p.transfert_sous_type !== 'ville' ? (p.transfert_sens === 'depuis') : null,
            nb_passagers: p.nb_passagers ?? 1,
            nb_bagages:   p.nb_bagages ?? 0,
            heure_debut_journee: p.heure_debut_journee || null,
            heure_fin_journee: p.heure_fin_journee || null,
            tarif_journalier_ht: p.type === 'mad' ? p.tarif_journalier_ht : null,
            tarif_fixe_ht: p.type === 'transfert' ? p.tarif_fixe_ht : null,
            modele_souhaite: p.modele_souhaite || null,
            vehicule_id: p.vehicule_mode === 'flotte' && p.vehicule_id ? p.vehicule_id : null,
            vehicule_ext_id: null,
            ext_marque:          p.vehicule_mode === 'externe' ? (p.ext_marque || null) : null,
            ext_modele:          p.vehicule_mode === 'externe' ? (p.ext_modele || null) : null,
            ext_immatriculation: p.vehicule_mode === 'externe' ? (p.ext_immatriculation || null) : null,
            ext_loueur:          p.vehicule_mode === 'externe' ? (p.ext_loueur || null) : null,
            ext_cout_ht:         p.vehicule_mode === 'externe' ? (p.ext_cout_ht || null) : null,
            affectation_differee: p.vehicule_mode === 'plus_tard',
            chauffeur_id: p.type === 'transfert' && p.chauffeur_id ? p.chauffeur_id : null,
            notes: p.notes || null,
            jours: p.type === 'mad' ? p.jours : [],
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.toString() ?? 'Erreur')
      toast.success(`Dossier ${json.data.numero} créé !`)
      router.push(`/dashboard/dossiers/${json.data.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <span className="section-title">Nouveau dossier</span>
        <button className="btn-ghost" onClick={() => router.back()}>✕ Annuler</button>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Section 1 ── */}
        <div className="card" style={{ marginBottom:'16px' }}>
          <div className="card-header">
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <SectionNum n={1} /><span className="card-header-title">Informations générales</span>
            </div>
          </div>
          <div style={{ padding:'20px' }}>
            <div className="form-grid-2" style={{ marginBottom:'12px' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                  <label className="form-label" style={{ marginBottom:0 }}>Client *</label>
                  <button type="button"
                    onClick={() => setShowNouveauClient(!showNouveauClient)}
                    style={{ fontSize:'9px', fontWeight:700, letterSpacing:'1px', color:'#9a7a28', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>
                    + Nouveau client
                  </button>
                </div>
                <select className="select" value={clientId} onChange={e => setClientId(e.target.value)} required>
                  <option value="">— Sélectionner —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}{c.contact_nom ? ` — ${c.contact_nom}` : ''}</option>)}
                </select>

                {/* Formulaire rapide nouveau client */}
                {showNouveauClient && (
                  <div style={{ marginTop:'10px', padding:'14px', background:'#f5f2ed', border:'1.5px solid #9a7a28', borderTop:'3px solid #9a7a28' }}>
                    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px' }}>
                      Nouveau client
                    </div>
                    <div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                        <div>
                          <label className="form-label">Type</label>
                          <select className="select" value={nouveauClientForm.type} onChange={e => setNouveauClientForm({...nouveauClientForm, type:e.target.value})}>
                            <option value="agence">Agence (partenaire)</option>
                            <option value="entreprise">Entreprise</option>
                            <option value="particulier">Particulier</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">{nouveauClientForm.type === 'particulier' ? 'Nom complet *' : 'Raison sociale *'}</label>
                          <input type="text" className="input" required value={nouveauClientForm.nom}
                            onChange={e => setNouveauClientForm({...nouveauClientForm, nom:e.target.value})}
                            placeholder={nouveauClientForm.type === 'agence' ? 'KTS Voyages' : nouveauClientForm.type === 'entreprise' ? 'Société...' : 'Nom Prénom'} />
                        </div>
                        {nouveauClientForm.type === 'entreprise' && (
                          <div style={{ gridColumn:'span 2' }}>
                            <label className="form-label">Contact sur place</label>
                            <input type="text" className="input" value={nouveauClientForm.contact_nom}
                              onChange={e => setNouveauClientForm({...nouveauClientForm, contact_nom:e.target.value})}
                              placeholder="Prénom Nom" />
                          </div>
                        )}
                        <div>
                          <label className="form-label">Téléphone</label>
                          <input type="tel" className="input" value={nouveauClientForm.telephone}
                            onChange={e => setNouveauClientForm({...nouveauClientForm, telephone:e.target.value})}
                            placeholder="+33 6 ..." />
                        </div>
                        <div>
                          <label className="form-label">Email</label>
                          <input type="email" className="input" value={nouveauClientForm.email}
                            onChange={e => setNouveauClientForm({...nouveauClientForm, email:e.target.value})}
                            placeholder="email@..." />
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                        <button type="button" className="btn-ghost" style={{ padding:'5px 12px', fontSize:'10px' }}
                          onClick={() => setShowNouveauClient(false)}>Annuler</button>
                        <button type="button" className="btn-or" style={{ padding:'5px 12px', fontSize:'10px' }} disabled={savingClient}
                          onClick={() => handleCreateClient()}>
                          {savingClient ? 'Création…' : '+ Créer et sélectionner'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Statut initial</label>
                <select className="select" value={statut} onChange={e => setStatut(e.target.value)}>
                  <option value="en_attente">En attente</option>
                </select>
              </div>
            </div>
            <div className="form-grid-3" style={{ marginBottom:'12px' }}>
              <div>
                <label className="form-label">Date de début *</label>
                <input type="date" className="input" value={dateDebut}
                  onChange={e => { setDateDebut(e.target.value); if (dateFin < e.target.value) setDateFin(e.target.value) }} required />
              </div>
              <div>
                <label className="form-label">Date de fin *</label>
                <input type="date" className="input" value={dateFin} min={dateDebut}
                  onChange={e => setDateFin(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Durée calculée</label>
                <input readOnly className="input mono" value={nbJours > 0 ? `${nbJours} jour${nbJours > 1 ? 's' : ''}` : '—'}
                  style={{ background:'#faf9f7', color:'#9a7a28', cursor:'default' }} />
              </div>
            </div>
            <div>
              <label className="form-label">Notes internes</label>
              <textarea className="textarea" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Instructions, préférences client…" />
            </div>
          </div>
        </div>

        {/* ── Section 2 : Passagers ── */}
        <div className="card" style={{ marginBottom:'16px' }}>
          <div className="card-header">
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <SectionNum n={2} /><span className="card-header-title"><Users size={13} style={{ display:'inline', marginRight:6, verticalAlign:'-2px' }} />Passagers</span>
            </div>
            <button type="button" className="btn-or"
              style={{ padding:'6px 14px', fontSize:'11px' }}
              onClick={addPassager}>
              <Plus size={13} /> Ajouter un passager
            </button>
          </div>
          <div style={{ padding:'16px' }}>
            <p style={{ fontSize:'11px', color:'#8a8478', marginBottom: passagers.length > 0 ? '12px' : 0, lineHeight:1.5 }}>
              Nom des <strong>voyageurs réels</strong> transportés — utile quand le dossier est réservé par une agence.
              Facultatif : vous pourrez aussi les ajouter/modifier après création.
            </p>
            {passagers.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {passagers.map((pax) => (
                  <div key={pax.id} style={{ display:'flex', flexWrap:'wrap', gap:'8px', alignItems:'flex-end', background:'#f5f2ed', border:'1.5px solid #b8b0a4', padding:'10px' }}>
                    <span style={{ fontSize:'18px', paddingBottom:'6px' }}>{flag(pax.nationalite) || '👤'}</span>
                    <div style={{ flex:'2 1 150px', minWidth:'130px' }}>
                      <label className="form-label">Nom du passager *</label>
                      <input className="input" value={pax.nom} onChange={e => updatePassager(pax.id, { nom: e.target.value })} placeholder="M. Ahmed AL FALASI" />
                    </div>
                    <div style={{ flex:'0 1 72px', minWidth:'64px' }}>
                      <label className="form-label">Pays</label>
                      <input className="input" value={pax.nationalite} maxLength={2} onChange={e => updatePassager(pax.id, { nationalite: e.target.value.toUpperCase() })} placeholder="AE" />
                    </div>
                    <div style={{ flex:'1 1 120px', minWidth:'110px' }}>
                      <label className="form-label">Téléphone</label>
                      <input className="input" value={pax.telephone} onChange={e => updatePassager(pax.id, { telephone: e.target.value })} placeholder="+971 …" />
                    </div>
                    <div style={{ flex:'0 1 80px', minWidth:'64px' }}>
                      <label className="form-label">Bagages</label>
                      <input type="number" className="input" min={0} value={pax.nb_bagages} onChange={e => updatePassager(pax.id, { nb_bagages: Number(e.target.value) })} />
                    </div>
                    <button type="button" onClick={() => removePassager(pax.id)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#9e2a2a', paddingBottom:'8px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(() => {
                  const totBag = passagers.reduce((s, p) => s + (p.nb_bagages || 0), 0)
                  return (
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:'14px', fontSize:'11px', color:'#8a8478', paddingTop:'2px' }}>
                      <span>{passagers.length} passager{passagers.length > 1 ? 's' : ''}</span>
                      <span><Briefcase size={11} style={{ display:'inline', verticalAlign:'-1px' }} /> {totBag} bagage{totBag > 1 ? 's' : ''}</span>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3 : Prestations ── */}
        <div className="card" style={{ marginBottom:'16px' }}>
          <div className="card-header">
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <SectionNum n={3} /><span className="card-header-title">Prestations</span>
            </div>
            <button type="button" className="btn-or"
              style={{ padding:'6px 14px', fontSize:'11px' }}
              onClick={() => setPrestations(p => [...p, makePrestation(p.length + 1)])}>
              <Plus size={13} /> Ajouter une prestation
            </button>
          </div>
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
            {prestations.map((p, idx) => (
              <PrestationBlock key={p.id} p={p} idx={idx}
                chauffeurs={chauffeurs} vehicules={vehicules} forfaits={forfaits} clientTarifs={clientTarifs}
                onUpdate={u => updatePrestation(p.id, u)}
                onUpdateJour={(ji, u) => updateJour(p.id, ji, u)}
                onRemove={() => setPrestations(prev => prev.filter(x => x.id !== p.id).map((x, i) => ({ ...x, ordre: i + 1 })))}
                canRemove={prestations.length > 1}
              />
            ))}
          </div>
        </div>

        {/* ── Récap ── */}
        <div className="card" style={{ marginBottom:'16px' }}>
          <div style={{ padding:'16px 20px', display:'flex', justifyContent:'flex-end' }}>
            <div style={{ width:'280px' }}>
              {[['Sous-total HT', fmt(totalHT)], ['TVA 10 %', fmt(tva)]].map(([l, v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #d8d2c8' }}>
                  <span style={{ fontSize:'10px', color:'#5a564e', fontWeight:500, textTransform:'uppercase', letterSpacing:'1px' }}>{l}</span>
                  <span className="mono" style={{ fontSize:'12px' }}>{v}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 0' }}>
                <span style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>Total TTC</span>
                <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', color:'#9a7a28', fontWeight:400 }}>{fmt(totalTTC)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', paddingBottom:'40px' }}>
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Annuler</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Création…' : 'Créer le dossier'}</button>
        </div>
      </form>
    </div>
  )
}

// ── Section number badge ──────────────────────

function SectionNum({ n }: { n: number }) {
  return (
    <div style={{ width:'20px', height:'20px', border:'1.5px solid #9a7a28', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color:'#9a7a28', fontWeight:700, flexShrink:0 }}>
      {n}
    </div>
  )
}

// ── Prestation block ──────────────────────────

function PrestationBlock({ p, idx, chauffeurs, vehicules, forfaits, clientTarifs, onUpdate, onUpdateJour, onRemove, canRemove }: {
  p: PrestationForm
  idx: number
  chauffeurs: Chauffeur[]
  vehicules: any[]
  forfaits: any[]
  clientTarifs: any[]
  onUpdate: (u: Partial<PrestationForm>) => void
  onUpdateJour: (i: number, u: Partial<JourForm>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const tarifsMatch = (clientTarifs ?? []).filter((t: any) => t.type === p.type)
  return (
    <div style={{ background:'#f5f2ed', border:'1.5px solid #b8b0a4', overflow:'hidden' }}>

      {/* ── Header avec sélecteur de type visuel ── */}
      <div style={{ background:'#16130e', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
        <span style={{ color:'rgba(255,255,255,0.25)', fontSize:'14px', cursor:'grab' }}>⠿</span>

        {/* Type selector — boutons radio visuels */}
        <div style={{ display:'flex', gap:'6px' }}>
          <TypeBtn
            active={p.type === 'transfert'}
            icon="→"
            label="Transfert"
            onClick={() => onUpdate({ type:'transfert', jours:[] })}
          />
          <TypeBtn
            active={p.type === 'mad'}
            icon="◷"
            label="Mise à dispo"
            onClick={() => onUpdate({ type:'mad', jours:[] })}
          />
        </div>

        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'rgba(255,255,255,0.25)', marginLeft:'auto' }}>
          P-0{idx + 1}
        </span>
        <button type="button" onClick={() => onUpdate({ collapsed: !p.collapsed })}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
          {p.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {canRemove && (
          <button type="button" onClick={onRemove}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,0.25)', cursor:'pointer' }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {!p.collapsed && (
        <div style={{ padding:'16px' }}>

          {/* ── Tarifs dédiés du client ── */}
          {tarifsMatch.length > 0 && (
            <div style={{ marginBottom:'14px', padding:'10px 12px', background:'#fdf6e3', border:'1.5px solid #9a7a28' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'8px' }}>
                Tarifs dédiés du client
              </div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {tarifsMatch.map((t: any) => {
                  const applied = p.type === 'transfert' ? p.tarif_fixe_ht === t.prix_ht : p.tarif_journalier_ht === t.prix_ht
                  return (
                    <button key={t.id} type="button"
                      onClick={() => p.type === 'transfert' ? onUpdate({ tarif_fixe_ht: t.prix_ht }) : onUpdate({ tarif_journalier_ht: t.prix_ht })}
                      style={{ padding:'7px 12px', fontSize:'11px', fontWeight:600, cursor:'pointer', background: applied ? '#9a7a28' : '#fff', border:`1.5px solid #9a7a28`, color: applied ? '#fff' : '#16130e', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'2px' }}>
                      <span>{t.libelle}</span>
                      <span style={{ fontSize:'10px', opacity:0.85 }}>{new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(t.prix_ht)}{t.type==='mad'?'/j':''}{t.categorie ? ` · ${t.categorie.replace('_',' ')}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Passagers / bagages */}
          <div style={{ display:'flex', gap:'14px', alignItems:'flex-end', marginBottom:'14px' }}>
            <div style={{ width:'110px' }}><label className="form-label">Passagers</label>
              <input type="number" className="input" min={0} value={p.nb_passagers} onChange={e => onUpdate({ nb_passagers: Number(e.target.value) })} /></div>
            <div style={{ width:'110px' }}><label className="form-label">Bagages</label>
              <input type="number" className="input" min={0} value={p.nb_bagages} onChange={e => onUpdate({ nb_bagages: Number(e.target.value) })} /></div>
            <span style={{ fontSize:'10px', color:'#8a8478', paddingBottom:'10px' }}>Nombre total pour cette voiture. Les passagers nommés se saisissent en section 2, puis s'affectent à chaque voiture depuis le dossier.</span>
          </div>

          {/* ── TRANSFERT ── */}
          {p.type === 'transfert' && (
            <>
              {/* ── Sous-type + sens ── */}
              <div style={{ marginBottom:'16px' }}>
                <label className="form-label" style={{ marginBottom:'8px' }}>Type de transfert</label>
                <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                  {([
                    { val:'ville',    icon:'🏙️', label:'Ville' },
                    { val:'gare',     icon:'🚉', label:'Gare' },
                    { val:'aeroport', icon:'✈️', label:'Aéroport' },
                  ] as const).map(st => (
                    <button key={st.val} type="button"
                      onClick={() => onUpdate({ transfert_sous_type: st.val })}
                      style={{
                        flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                        background: p.transfert_sous_type === st.val ? '#fdf6e3' : '#ffffff',
                        border: `1.5px solid ${p.transfert_sous_type === st.val ? '#9a7a28' : '#b8b0a4'}`,
                        cursor:'pointer', transition:'all 0.14s',
                      }}>
                      <span style={{ fontSize:'20px' }}>{st.icon}</span>
                      <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color: p.transfert_sous_type === st.val ? '#9a7a28' : '#5a564e' }}>
                        {st.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Sens — affiché uniquement pour gare et aéroport */}
                {(p.transfert_sous_type === 'gare' || p.transfert_sous_type === 'aeroport') && (
                  <div>
                    <label className="form-label" style={{ marginBottom:'6px' }}>
                      Sens du trajet
                    </label>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button type="button"
                        onClick={() => onUpdate({ transfert_sens: 'depuis' })}
                        style={{
                          flex:1, padding:'9px 12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                          background: p.transfert_sens === 'depuis' ? '#e8eef8' : '#ffffff',
                          border: `1.5px solid ${p.transfert_sens === 'depuis' ? '#1e3f70' : '#b8b0a4'}`,
                          cursor:'pointer', transition:'all 0.14s',
                        }}>
                        <span style={{ fontSize:'16px' }}>
                          {p.transfert_sous_type === 'aeroport' ? '🛬' : '🚉'}
                        </span>
                        <div style={{ textAlign:'left' }}>
                          <div style={{ fontSize:'11px', fontWeight:700, color: p.transfert_sens === 'depuis' ? '#1e3f70' : '#5a564e' }}>
                            Depuis {p.transfert_sous_type === 'aeroport' ? "l'aéroport" : 'la gare'}
                          </div>
                          <div style={{ fontSize:'9px', color:'#8a8478' }}>
                            {p.transfert_sous_type === 'aeroport' ? 'Aéroport → Destination' : 'Gare → Destination'}
                          </div>
                        </div>
                      </button>
                      <button type="button"
                        onClick={() => onUpdate({ transfert_sens: 'vers' })}
                        style={{
                          flex:1, padding:'9px 12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                          background: p.transfert_sens === 'vers' ? '#e8eef8' : '#ffffff',
                          border: `1.5px solid ${p.transfert_sens === 'vers' ? '#1e3f70' : '#b8b0a4'}`,
                          cursor:'pointer', transition:'all 0.14s',
                        }}>
                        <span style={{ fontSize:'16px' }}>
                          {p.transfert_sous_type === 'aeroport' ? '🛫' : '🚆'}
                        </span>
                        <div style={{ textAlign:'left' }}>
                          <div style={{ fontSize:'11px', fontWeight:700, color: p.transfert_sens === 'vers' ? '#1e3f70' : '#5a564e' }}>
                            Vers {p.transfert_sous_type === 'aeroport' ? "l'aéroport" : 'la gare'}
                          </div>
                          <div style={{ fontSize:'9px', color:'#8a8478' }}>
                            {p.transfert_sous_type === 'aeroport' ? 'Départ → Aéroport' : 'Départ → Gare'}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <FormSep label="Détails" />
              <div className="form-grid-4" style={{ marginBottom:'12px' }}>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="input" value={p.date_debut}
                    onChange={e => onUpdate({ date_debut: e.target.value, date_fin: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">
                    {p.transfert_sous_type !== 'ville' && p.transfert_sens === 'depuis'
                      ? 'Heure d\'arrivée'
                      : p.transfert_sous_type !== 'ville' && p.transfert_sens === 'vers'
                        ? 'Heure de départ'
                        : 'Heure'}
                  </label>
                  <input type="time" className="input" value={p.heure_depart}
                    onChange={e => onUpdate({ heure_depart: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Chauffeur</label>
                  <select className="select" value={p.chauffeur_id} onChange={e => onUpdate({ chauffeur_id: e.target.value })}>
                    <option value="">— Sélectionner —</option>
                    {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Tarif HT (€) *</label>
                  <input type="number" className="input" value={p.tarif_fixe_ht || ''}
                    onChange={e => onUpdate({ tarif_fixe_ht: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00" min={0} step={0.01} required />
                </div>
              </div>

              {/* Adresses — ordre adapté selon le sens */}
              <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                {(() => {
                  const isGareAero = p.transfert_sous_type !== 'ville'
                  const sousIcon   = p.transfert_sous_type === 'aeroport' ? '✈️' : p.transfert_sous_type === 'gare' ? '🚉' : '📍'
                  const sousLabel  = p.transfert_sous_type === 'aeroport' ? 'Aéroport / Terminal' : p.transfert_sous_type === 'gare' ? 'Gare / Voie' : null

                  if (isGareAero && p.transfert_sens === 'depuis') {
                    // Depuis aéro/gare → destination : aéro/gare en premier
                    return <>
                      <AddressField
                        label={sousLabel!}
                        value={p.adresse_depart}
                        onChange={v => onUpdate({ adresse_depart: v })}
                        placeholder={p.transfert_sous_type === 'aeroport' ? 'ex: CDG Terminal 2E' : 'ex: Paris Gare de Lyon'}
                        icon={sousIcon}
                      />
                      <AddressField
                        label="Adresse de destination"
                        value={p.adresse_arrivee}
                        onChange={v => onUpdate({ adresse_arrivee: v })}
                        placeholder="Rue, ville, hôtel…"
                        icon="📍"
                      />
                    </>
                  } else if (isGareAero && p.transfert_sens === 'vers') {
                    // Vers aéro/gare : départ en premier, aéro/gare en second
                    return <>
                      <AddressField
                        label="Adresse de départ"
                        value={p.adresse_depart}
                        onChange={v => onUpdate({ adresse_depart: v })}
                        placeholder="Rue, ville, hôtel…"
                        icon="📍"
                      />
                      <AddressField
                        label={sousLabel!}
                        value={p.adresse_arrivee}
                        onChange={v => onUpdate({ adresse_arrivee: v })}
                        placeholder={p.transfert_sous_type === 'aeroport' ? 'ex: CDG Terminal 2E' : 'ex: Paris Gare de Lyon'}
                        icon={sousIcon}
                      />
                    </>
                  } else {
                    // Transfert ville : départ → arrivée standard
                    return <>
                      <AddressField
                        label="Adresse de départ"
                        value={p.adresse_depart}
                        onChange={v => onUpdate({ adresse_depart: v })}
                        placeholder="Rue, ville…"
                        icon="📍"
                      />
                      <AddressField
                        label="Adresse d'arrivée"
                        value={p.adresse_arrivee}
                        onChange={v => onUpdate({ adresse_arrivee: v })}
                        placeholder="Rue, ville…"
                        icon="📍"
                      />
                    </>
                  }
                })()}
              </div>

              {/* Vol / Train (aéroport / gare) */}
              {p.transfert_sous_type !== 'ville' && (
                <>
                  <FormSep label={p.transfert_sous_type === 'aeroport' ? 'Suivi du vol' : 'Suivi du train'} />
                  <div className="form-grid-4" style={{ marginBottom: '12px' }}>
                    <div><label className="form-label">{p.transfert_sous_type === 'aeroport' ? 'Terminal' : 'Gare'}</label>
                      <input type="text" className="input" value={p.vol_terminal} onChange={e => onUpdate({ vol_terminal: e.target.value })} placeholder={p.transfert_sous_type === 'aeroport' ? 'CDG 1' : 'Gare de Lyon'} /></div>
                    <div><label className="form-label">{p.transfert_sous_type === 'aeroport' ? 'N° de vol' : 'N° de train'}</label>
                      <input type="text" className="input" value={p.vol_numero} onChange={e => onUpdate({ vol_numero: e.target.value.toUpperCase() })} placeholder={p.transfert_sous_type === 'aeroport' ? 'EY031' : 'TGV 9012'} /></div>
                    <div><label className="form-label">Heure programmée</label>
                      <input type="time" className="input" value={p.vol_heure} onChange={e => onUpdate({ vol_heure: e.target.value })} /></div>
                    <div><label className="form-label">{p.transfert_sens === 'depuis' ? 'Provenance' : 'Destination'}</label>
                      <input type="text" className="input" value={p.vol_ville} onChange={e => onUpdate({ vol_ville: e.target.value })} placeholder={p.transfert_sens === 'depuis' ? 'Abu Dhabi' : 'Tokyo'} /></div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── MAD ── */}
          {p.type === 'mad' && (
            <>
              <FormSep label="Période & tarification" />
              <div className="form-grid-4" style={{ marginBottom:'12px' }}>
                <div>
                  <label className="form-label">Date début *</label>
                  <input type="date" className="input" value={p.date_debut}
                    onChange={e => onUpdate({ date_debut: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Date fin *</label>
                  <input type="date" className="input" value={p.date_fin} min={p.date_debut}
                    onChange={e => onUpdate({ date_fin: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Jours</label>
                  <input readOnly className="input mono" value={p.jours.length > 0 ? `${p.jours.length} j` : '—'}
                    style={{ background:'#faf9f7', color:'#9a7a28', cursor:'default' }} />
                </div>
                <div>
                  <label className="form-label">Tarif / jour HT (€)</label>
                  <input type="number" className="input" value={p.tarif_journalier_ht || ''}
                    onChange={e => onUpdate({ tarif_journalier_ht: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00" min={0} step={0.01} />
                </div>
              </div>

              {/* Sélecteur de forfait */}
              {forfaits.length > 0 && (
                <div style={{ marginBottom:'12px', padding:'12px 14px', background:'#f5f2ed', border:'1.5px solid #b8b0a4' }}>
                  <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px' }}>
                    Appliquer un forfait prédéfini
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {forfaits.map((f: any) => (
                      <button key={f.id} type="button"
                        onClick={() => onUpdate({ tarif_journalier_ht: f.tarif_ht })}
                        style={{
                          padding:'7px 12px', fontSize:'11px', fontWeight:600, cursor:'pointer',
                          background: p.tarif_journalier_ht === f.tarif_ht ? '#fdf6e3' : '#fff',
                          border: `1.5px solid ${p.tarif_journalier_ht === f.tarif_ht ? '#9a7a28' : '#b8b0a4'}`,
                          color: p.tarif_journalier_ht === f.tarif_ht ? '#9a7a28' : '#5a564e',
                          display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'2px',
                          transition:'all 0.14s',
                        }}>
                        <span style={{ fontWeight:700, color: p.tarif_journalier_ht === f.tarif_ht ? '#9a7a28' : '#16130e' }}>{f.nom}</span>
                        <span style={{ fontSize:'9px', color:'#8a8478' }}>
                          {f.tarif_ht.toLocaleString('fr-FR')} € · {f.heures_incluses}h
                          {f.avec_heures_sup ? ` · sup ${f.tarif_heure_sup}€/h` : ' · fixe'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                <AddressField
                  label="Lieu principal"
                  value={p.adresse_depart}
                  onChange={v => onUpdate({ adresse_depart: v })}
                  placeholder="Adresse, ville…"
                  icon="📍"
                />
                <div>
                  <label className="form-label">Horaires journaliers</label>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <input type="time" className="input" value={p.heure_debut_journee}
                      onChange={e => onUpdate({ heure_debut_journee: e.target.value })} />
                    <span style={{ color:'#8a8478', flexShrink:0 }}>→</span>
                    <input type="time" className="input" value={p.heure_fin_journee}
                      onChange={e => onUpdate({ heure_fin_journee: e.target.value })} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Véhicule ── */}
          <FormSep label="Véhicule" />
          <VehiculeSelector p={p} vehicules={vehicules} onUpdate={onUpdate} />

          {/* ── Jours MAD ── */}
          {p.type === 'mad' && p.jours.length > 0 && (
            <>
              <FormSep label="Chauffeurs par jour" />
              <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr 80px', gap:'6px', padding:'4px 8px', background:'#faf9f7', marginBottom:'2px' }}>
                {['Date','Chauffeur','Note','Tarif HT'].map(h => (
                  <div key={h} style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>{h}</div>
                ))}
              </div>
              {p.jours.map((j, ji) => {
                const missing = !j.chauffeur_id
                return (
                  <div key={j.date} style={{
                    display:'grid', gridTemplateColumns:'90px 1fr 1fr 80px', gap:'6px',
                    alignItems:'center', padding:'6px 8px', marginBottom:'2px',
                    background: missing ? '#fdf3dc' : '#f5f2ed',
                    border: missing ? '1px solid rgba(122,92,16,0.3)' : '1px solid #d8d2c8',
                  }}>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color: missing ? '#7a5c10' : '#2e2b25' }}>
                      {j.jour_semaine} {format(parseISO(j.date),'dd/MM')}
                    </span>
                    <select value={j.chauffeur_id} onChange={e => onUpdateJour(ji, { chauffeur_id: e.target.value })}
                      style={{ background:'#fff', border:`1px solid ${missing ? '#7a5c10' : '#b8b0a4'}`, padding:'5px 8px', fontSize:'11px', color:'#16130e', outline:'none', width:'100%' }}>
                      <option value="">— Non affecté —</option>
                      {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                    </select>
                    <input type="text" value={j.note} onChange={e => onUpdateJour(ji, { note: e.target.value })}
                      placeholder="Note…"
                      style={{ background:'#fff', border:'1px solid #b8b0a4', padding:'5px 8px', fontSize:'11px', outline:'none', width:'100%' }} />
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28', textAlign:'right' }}>
                      {j.tarif_ht.toLocaleString('fr-FR')} €
                    </span>
                  </div>
                )
              })}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 8px 0', borderTop:'1.5px solid #b8b0a4', marginTop:'4px' }}>
                <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>
                  Sous-total · {p.jours.length} j
                </span>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#16130e' }}>
                  {fmt(p.jours.reduce((s, j) => s + j.tarif_ht, 0))}
                </span>
              </div>
            </>
          )}

          <div style={{ marginTop:'12px' }}>
            <label className="form-label">Notes</label>
            <input type="text" className="input" value={p.notes} onChange={e => onUpdate({ notes: e.target.value })}
              placeholder="Instructions particulières pour cette prestation…" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Type button ───────────────────────────────

function TypeBtn({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '7px 14px',
        background: active ? '#9a7a28' : 'rgba(255,255,255,0.06)',
        border: `1.5px solid ${active ? '#9a7a28' : 'rgba(255,255,255,0.15)'}`,
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.5px',
      }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      {label}
    </button>
  )
}

// ── Form separator ────────────────────────────

function FormSep({ label }: { label: string }) {
  return (
    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px', marginTop:'4px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
      {label}
    </div>
  )
}

// ── Address field avec autocomplétion Google Places ──

function AddressField({ label, value, onChange, placeholder, icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; icon: string
}) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSugg, setShowSugg]       = useState(false)

  // Autocomplétion via Google Places si clé disponible
  async function fetchSuggestions(input: string) {
    if (input.length < 3) { setSuggestions([]); return }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
    if (!key) { setSuggestions([]); return }

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&language=fr&components=country:fr&key=${key}`
      )
      const data = await res.json()
      setSuggestions(data.predictions ?? [])
      setShowSugg(true)
    } catch { setSuggestions([]) }
  }

  return (
    <div style={{ position:'relative' }}>
      <label className="form-label">{label}</label>
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'13px', pointerEvents:'none', zIndex:1 }}>
          {icon}
        </span>
        <input
          ref={inputRef}
          type="text"
          className="input"
          value={value}
          placeholder={placeholder}
          style={{ paddingLeft:'32px' }}
          onChange={e => {
            onChange(e.target.value)
            fetchSuggestions(e.target.value)
          }}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          onFocus={() => value.length >= 3 && suggestions.length > 0 && setShowSugg(true)}
          autoComplete="off"
        />
      </div>
      {/* Dropdown suggestions */}
      {showSugg && suggestions.length > 0 && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:50,
          background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 4px 16px rgba(0,0,0,0.12)',
          maxHeight:'200px', overflowY:'auto',
        }}>
          {suggestions.map((s: any) => (
            <div key={s.place_id}
              onMouseDown={() => { onChange(s.description); setSuggestions([]); setShowSugg(false) }}
              style={{ padding:'9px 12px', fontSize:'12px', cursor:'pointer', borderBottom:'1px solid #ede9e2', display:'flex', gap:'8px', alignItems:'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fdf6e3')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              <span style={{ fontSize:'11px' }}>📍</span>
              <div>
                <div style={{ fontWeight:500, color:'#16130e' }}>{s.structured_formatting?.main_text ?? s.description}</div>
                <div style={{ fontSize:'10px', color:'#8a8478' }}>{s.structured_formatting?.secondary_text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message si pas de clé Google */}
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && value.length === 0 && (
        <p style={{ fontSize:'9px', color:'#c2bdb4', marginTop:'3px' }}>
          💡 Ajoutez NEXT_PUBLIC_GOOGLE_MAPS_KEY pour l'autocomplétion
        </p>
      )}
    </div>
  )
}

// ── Véhicule selector ─────────────────────────

function VehiculeSelector({ p, vehicules, onUpdate }: { p: PrestationForm; vehicules: any[]; onUpdate: (u: Partial<PrestationForm>) => void }) {
  const [categories, setCategories] = useState<any[]>([])
  useEffect(() => { fetch('/api/vehicule-categories').then(r => r.json()).then(d => setCategories(d.data ?? [])).catch(() => {}) }, [])
  // Catégorie sélectionnée : modele_souhaite = nom de catégorie OU modèle précis
  const selCat = categories.find((c: any) => c.nom === p.modele_souhaite)
    ?? categories.find((c: any) => (c.modeles ?? []).includes(p.modele_souhaite))
    ?? null
  const catName: string | null = selCat?.nom ?? null

  return (
    <div>
    <div style={{ marginBottom:'12px' }}>
      <label className="form-label">Catégorie de véhicule souhaitée</label>
      <VehiculeCategorieSelect categories={categories} value={p.modele_souhaite} onChange={v => onUpdate({ modele_souhaite: v })} selectClass="select" anyLabel="— Toutes catégories —" />
    </div>
    <div style={{ border:'1.5px solid #b8b0a4', overflow:'hidden', marginBottom:'12px' }}>
      <div style={{ display:'flex', background:'#f5f2ed' }}>
        {([['flotte','Flotte'],['externe','Externe'],['plus_tard','Plus tard']] as const).map(([mode, lbl]) => (
          <button key={mode} type="button"
            onClick={() => onUpdate({ vehicule_mode: mode, ...(mode === 'plus_tard' ? { affectation_differee: true } : {}) })}
            style={{
              flex:1, padding:'9px 8px', textAlign:'center', fontSize:'10px', letterSpacing:'1px',
              textTransform:'uppercase', fontWeight:700, cursor:'pointer', background:'none', border:'none',
              borderBottom: p.vehicule_mode === mode ? '2px solid #9a7a28' : '2px solid transparent',
              color: p.vehicule_mode === mode ? '#9a7a28' : '#5a564e', transition:'all 0.14s',
            }}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ padding:'12px', background:'#fff' }}>
        {p.vehicule_mode === 'flotte' && (
          <>
            {(() => {
              // La flotte stocke le NOM de catégorie (= vehicule_categories.nom)
              const vFiltres = catName ? vehicules.filter(v => v.categorie === catName) : vehicules

              if (vehicules.length === 0) return (
                <div style={{ padding:'10px', background:'#fdf3dc', border:'1px solid rgba(122,92,16,0.2)', fontSize:'11px', color:'#7a5c10' }}>
                  Aucun véhicule — ajoutez des véhicules dans le module Véhicules
                </div>
              )
              if (vFiltres.length === 0) return (
                <div style={{ padding:'10px', background:'#fdf3dc', border:'1px solid rgba(122,92,16,0.2)', fontSize:'11px', color:'#7a5c10' }}>
                  Aucun véhicule de cette catégorie dans la flotte
                </div>
              )
              return (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                  {vFiltres.map(v => (
                    <div key={v.id} onClick={() => v.disponible_periode !== false && onUpdate({ vehicule_id: v.id })}
                      style={{
                        background: p.vehicule_id === v.id ? '#fdf6e3' : '#f5f2ed',
                        border: p.vehicule_id === v.id ? '1.5px solid #9a7a28' : '1.5px solid #d8d2c8',
                        padding:'8px 10px', cursor: v.disponible_periode === false ? 'not-allowed' : 'pointer',
                        opacity: v.disponible_periode === false ? 0.4 : 1,
                        display:'flex', alignItems:'center', gap:'8px', transition:'all 0.14s',
                      }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'11px', fontWeight:600, color:'#16130e' }}>{v.marque} {v.modele}</div>
                        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#5a564e' }}>{v.immatriculation}</div>
                      </div>
                      <span style={{ fontSize:'8px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color: v.disponible_periode === false ? '#9e2a2a' : '#1e5e3a' }}>
                        {v.disponible_periode === false ? 'Occupé' : 'Libre'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </>
        )}

        {p.vehicule_mode === 'externe' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label className="form-label">Marque / Modèle</label><input type="text" className="input" value={p.ext_marque} onChange={e => onUpdate({ ext_marque: e.target.value })} placeholder="ex : Audi A6" /></div>
            <div><label className="form-label">Immatriculation</label><input type="text" className="input" value={p.ext_immatriculation} onChange={e => onUpdate({ ext_immatriculation: e.target.value })} placeholder="AB-999-ZZ" /></div>
            <div><label className="form-label">Loueur / Prestataire</label><input type="text" className="input" value={p.ext_loueur} onChange={e => onUpdate({ ext_loueur: e.target.value })} placeholder="ex : Hertz Paris CDG" /></div>
            <div><label className="form-label">Coût location HT (€)</label><input type="number" className="input" value={p.ext_cout_ht || ''} onChange={e => onUpdate({ ext_cout_ht: parseFloat(e.target.value) || 0 })} placeholder="0,00" min={0} step={0.01} /></div>
          </div>
        )}

        {p.vehicule_mode === 'plus_tard' && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', background:'#fdf3dc', border:'1px solid rgba(122,92,16,0.2)' }}>
            <span style={{ fontSize:'14px' }}>⏳</span>
            <span style={{ fontSize:'11px', color:'#7a5c10', fontWeight:500 }}>Véhicule non affecté — assignable depuis le dossier ou le planning.</span>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
