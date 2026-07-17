'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Pencil, X } from 'lucide-react'

const CATEGORIES = ['Berline standard', 'Berline premium', 'Berline prestige', 'Van / Minibus', 'SUV premium', 'Électrique']

export default function ModifierPrestationModal({ p }: { p: any }) {
  const router = useRouter()
  const isMad = p.type === 'mad'
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Pré-remplissage depuis la prestation
  const [date, setDate]                 = useState<string>(p.date_debut ?? '')
  const [heure, setHeure]               = useState<string>(p.heure_depart?.slice(0, 5) ?? '')
  const [adresseDepart, setAdresseDep]  = useState<string>(p.adresse_depart ?? '')
  const [adresseArrivee, setAdresseArr] = useState<string>(p.adresse_arrivee ?? '')
  const [heureDebJ, setHeureDebJ]       = useState<string>(p.heure_debut_journee?.slice(0, 5) ?? '09:00')
  const [heureFinJ, setHeureFinJ]       = useState<string>(p.heure_fin_journee?.slice(0, 5) ?? '18:00')
  const [tarifFixe, setTarifFixe]       = useState<number>(p.tarif_fixe_ht ?? p.montant_ht ?? 0)
  const [tarifJour, setTarifJour]       = useState<number>(p.tarif_journalier_ht ?? 0)
  const [modele, setModele]             = useState<string>(p.modele_souhaite ?? '')
  const [notes, setNotes]               = useState<string>(p.notes ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, any> = {
        adresse_depart: adresseDepart || null,
        modele_souhaite: modele || null,
        notes: notes || null,
      }
      if (isMad) {
        body.heure_debut_journee = heureDebJ || null
        body.heure_fin_journee = heureFinJ || null
        body.tarif_journalier_ht = tarifJour
      } else {
        body.date_debut = date
        body.heure_depart = heure || null
        body.adresse_arrivee = adresseArrivee || null
        body.tarif_fixe_ht = tarifFixe
      }
      const res = await fetch(`/api/prestations/${p.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Erreur') }
      toast.success('Prestation modifiée')
      setOpen(false)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px' }} title="Modifier la prestation">
        <Pencil size={11} /> Modifier
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '560px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '19px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>
                Modifier la prestation · {isMad ? 'Mise à disposition' : 'Transfert'}
              </span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '22px 24px' }}>
              {!isMad ? (
                <>
                  <FormSep label="Détails du transfert" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div><label className="form-label">Date *</label><input type="date" className="input" required value={date} onChange={e => setDate(e.target.value)} /></div>
                    <div><label className="form-label">Heure</label><input type="time" className="input" value={heure} onChange={e => setHeure(e.target.value)} /></div>
                    <div><label className="form-label">Tarif HT (€) *</label><input type="number" className="input" required value={tarifFixe || ''} onChange={e => setTarifFixe(parseFloat(e.target.value) || 0)} min={0} step={0.01} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div><label className="form-label">Adresse de départ</label><input type="text" className="input" value={adresseDepart} onChange={e => setAdresseDep(e.target.value)} placeholder="Adresse, ville…" /></div>
                    <div><label className="form-label">Adresse d'arrivée</label><input type="text" className="input" value={adresseArrivee} onChange={e => setAdresseArr(e.target.value)} placeholder="Adresse, ville…" /></div>
                  </div>
                </>
              ) : (
                <>
                  <FormSep label="Mise à disposition" />
                  <div style={{ padding: '8px 12px', background: '#f5f2ed', border: '1px solid #d8d2c8', fontSize: '11px', color: '#5a564e', marginBottom: '12px' }}>
                    Période : <strong style={{ fontFamily: 'JetBrains Mono,monospace' }}>{p.date_debut} → {p.date_fin}</strong> ({p.nb_jours} j).
                    Pour changer les dates, gérez les jours dans la prestation.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div><label className="form-label">Lieu principal</label><input type="text" className="input" value={adresseDepart} onChange={e => setAdresseDep(e.target.value)} placeholder="Adresse, ville…" /></div>
                    <div>
                      <label className="form-label">Horaires journaliers</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input type="time" className="input" value={heureDebJ} onChange={e => setHeureDebJ(e.target.value)} />
                        <span style={{ color: '#8a8478', flexShrink: 0 }}>→</span>
                        <input type="time" className="input" value={heureFinJ} onChange={e => setHeureFinJ(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label className="form-label">Tarif / jour HT (€)</label>
                    <input type="number" className="input" value={tarifJour || ''} onChange={e => setTarifJour(parseFloat(e.target.value) || 0)} min={0} step={0.01} />
                    <div style={{ fontSize: '10px', color: '#8a8478', marginTop: '4px' }}>S'applique à tous les jours de la période et recalcule le montant.</div>
                  </div>
                </>
              )}

              <FormSep label="Véhicule & notes" />
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Catégorie souhaitée</label>
                <select className="select" value={modele} onChange={e => setModele(e.target.value)}>
                  <option value="">— Aucune —</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '4px' }}>
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instructions, précisions…" style={{ minHeight: '60px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
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
    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a7a28', marginBottom: '10px', marginTop: '4px', paddingBottom: '6px', borderBottom: '1px solid #b8b0a4' }}>
      {label}
    </div>
  )
}
