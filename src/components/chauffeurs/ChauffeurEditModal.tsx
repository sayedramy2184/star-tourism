'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Edit, X } from 'lucide-react'
import { LANGUES, COMPETENCES } from '@/types'

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  disponible:   { label: 'Disponible',   color: '#1e5e3a', bg: '#eaf4ee' },
  en_mission:   { label: 'En mission',   color: '#1e3f70', bg: '#e8eef8' },
  indisponible: { label: 'Indisponible', color: '#9e2a2a', bg: '#faeaea' },
  conge:        { label: 'Congé',        color: '#7a5c10', bg: '#fdf3dc' },
}
const d = (s: string | null | undefined) => s?.slice(0, 10) ?? ''

function Sep({ label }: { label: string }) {
  return <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a7a28', margin: '18px 0 10px', paddingBottom: '6px', borderBottom: '1px solid #b8b0a4' }}>{label}</div>
}

export default function ChauffeurEditModal({ chauffeur }: { chauffeur: any }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    nom: chauffeur.nom ?? '', prenom: chauffeur.prenom ?? '', telephone: chauffeur.telephone ?? '',
    email: chauffeur.email ?? '', statut: chauffeur.statut ?? 'disponible',
    matricule: chauffeur.matricule ?? '', nationalite: chauffeur.nationalite ?? '',
    date_naissance: d(chauffeur.date_naissance),
    adresse: chauffeur.adresse ?? '', code_postal: chauffeur.code_postal ?? '', ville: chauffeur.ville ?? '',
    interne: chauffeur.interne ?? true, coefficient: chauffeur.coefficient ?? '', date_embauche: d(chauffeur.date_embauche),
    vtc_card_numero: chauffeur.vtc_card_numero ?? '', vtc_card_expiry: d(chauffeur.vtc_card_expiry),
    permis_expiry: d(chauffeur.permis_expiry),
    visite_medicale_date: d(chauffeur.visite_medicale_date), visite_medicale_expiry: d(chauffeur.visite_medicale_expiry),
    carte_sejour_numero: chauffeur.carte_sejour_numero ?? '', carte_sejour_expiry: d(chauffeur.carte_sejour_expiry),
    carte_qualif_expiry: d(chauffeur.carte_qualif_expiry),
    langues: (chauffeur.langues ?? []) as string[],
    competences: (chauffeur.competences ?? []) as string[],
    notes: chauffeur.notes ?? '',
  })

  const toggle = (arr: string[], k: string) => arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k]

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/chauffeurs/${chauffeur.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: f.nom, prenom: f.prenom, telephone: f.telephone, email: f.email || null, statut: f.statut,
          matricule: f.matricule || null, nationalite: f.nationalite || null, date_naissance: f.date_naissance || null,
          adresse: f.adresse || null, code_postal: f.code_postal || null, ville: f.ville || null,
          interne: f.interne, coefficient: f.coefficient === '' ? null : Number(f.coefficient), date_embauche: f.date_embauche || null,
          vtc_card_numero: f.vtc_card_numero || null, vtc_card_expiry: f.vtc_card_expiry || null, permis_expiry: f.permis_expiry || null,
          visite_medicale_date: f.visite_medicale_date || null, visite_medicale_expiry: f.visite_medicale_expiry || null,
          carte_sejour_numero: f.carte_sejour_numero || null, carte_sejour_expiry: f.carte_sejour_expiry || null,
          carte_qualif_expiry: f.carte_qualif_expiry || null,
          langues: f.langues, competences: f.competences, notes: f.notes || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      toast.success('Chauffeur mis à jour')
      setOpen(false)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}
        style={{ padding: '5px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }}>
        <Edit size={11} /> Modifier
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '640px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 5 }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '19px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>Fiche chauffeur</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save} style={{ padding: '18px 24px 24px' }}>

              <Sep label="Identité" />
              <div className="form-grid-2" style={{ marginBottom: '10px' }}>
                <div><label className="form-label">Prénom *</label><input className="input" required value={f.prenom} onChange={e => setF({ ...f, prenom: e.target.value })} /></div>
                <div><label className="form-label">Nom *</label><input className="input" required value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} /></div>
                <div><label className="form-label">Matricule</label><input className="input" value={f.matricule} onChange={e => setF({ ...f, matricule: e.target.value })} /></div>
                <div><label className="form-label">Nationalité</label><input className="input" value={f.nationalite} onChange={e => setF({ ...f, nationalite: e.target.value })} /></div>
                <div><label className="form-label">Date de naissance</label><input type="date" className="input" value={f.date_naissance} onChange={e => setF({ ...f, date_naissance: e.target.value })} /></div>
                <div><label className="form-label">Statut</label>
                  <select className="select" value={f.statut} onChange={e => setF({ ...f, statut: e.target.value })}>
                    {Object.entries(STATUTS).map(([s, si]) => <option key={s} value={s}>{si.label}</option>)}
                  </select>
                </div>
              </div>

              <Sep label="Coordonnées" />
              <div className="form-grid-2" style={{ marginBottom: '10px' }}>
                <div><label className="form-label">Téléphone *</label><input type="tel" className="input" required value={f.telephone} onChange={e => setF({ ...f, telephone: e.target.value })} /></div>
                <div><label className="form-label">Email</label><input type="email" className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
                <div style={{ gridColumn: 'span 2' }}><label className="form-label">Adresse</label><input className="input" value={f.adresse} onChange={e => setF({ ...f, adresse: e.target.value })} /></div>
                <div><label className="form-label">Code postal</label><input className="input" value={f.code_postal} onChange={e => setF({ ...f, code_postal: e.target.value })} /></div>
                <div><label className="form-label">Ville</label><input className="input" value={f.ville} onChange={e => setF({ ...f, ville: e.target.value })} /></div>
              </div>

              <Sep label="Contrat" />
              <div className="form-grid-3" style={{ marginBottom: '10px', alignItems: 'end' }}>
                <div>
                  <label className="form-label">Type</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[[true, 'Interne'], [false, 'Partenaire']].map(([v, l]) => (
                      <button type="button" key={String(v)} onClick={() => setF({ ...f, interne: v as boolean })}
                        style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: f.interne === v ? '#16130e' : '#fff', border: `1.5px solid ${f.interne === v ? '#16130e' : '#b8b0a4'}`, color: f.interne === v ? '#fff' : '#5a564e' }}>{l as string}</button>
                    ))}
                  </div>
                </div>
                <div><label className="form-label">Coefficient</label><input type="number" className="input" step={0.01} value={f.coefficient} onChange={e => setF({ ...f, coefficient: e.target.value })} /></div>
                <div><label className="form-label">Date d'embauche</label><input type="date" className="input" value={f.date_embauche} onChange={e => setF({ ...f, date_embauche: e.target.value })} /></div>
              </div>

              <Sep label="Documents & validités" />
              <div className="form-grid-3" style={{ marginBottom: '10px' }}>
                <div><label className="form-label">N° carte VTC</label><input className="input" value={f.vtc_card_numero} onChange={e => setF({ ...f, vtc_card_numero: e.target.value })} /></div>
                <div><label className="form-label">Validité carte VTC</label><input type="date" className="input" value={f.vtc_card_expiry} onChange={e => setF({ ...f, vtc_card_expiry: e.target.value })} /></div>
                <div><label className="form-label">Validité permis</label><input type="date" className="input" value={f.permis_expiry} onChange={e => setF({ ...f, permis_expiry: e.target.value })} /></div>
                <div><label className="form-label">Dernière visite médicale</label><input type="date" className="input" value={f.visite_medicale_date} onChange={e => setF({ ...f, visite_medicale_date: e.target.value })} /></div>
                <div><label className="form-label">Validité visite médicale</label><input type="date" className="input" value={f.visite_medicale_expiry} onChange={e => setF({ ...f, visite_medicale_expiry: e.target.value })} /></div>
                <div><label className="form-label">Validité carte qualif.</label><input type="date" className="input" value={f.carte_qualif_expiry} onChange={e => setF({ ...f, carte_qualif_expiry: e.target.value })} /></div>
                <div><label className="form-label">N° carte de séjour</label><input className="input" value={f.carte_sejour_numero} onChange={e => setF({ ...f, carte_sejour_numero: e.target.value })} /></div>
                <div><label className="form-label">Validité carte de séjour</label><input type="date" className="input" value={f.carte_sejour_expiry} onChange={e => setF({ ...f, carte_sejour_expiry: e.target.value })} /></div>
              </div>

              <Sep label="Langues" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {LANGUES.map(l => {
                  const on = f.langues.includes(l.key)
                  return <button type="button" key={l.key} onClick={() => setF({ ...f, langues: toggle(f.langues, l.key) })}
                    style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: on ? '#fdf6e3' : '#fff', border: `1.5px solid ${on ? '#9a7a28' : '#b8b0a4'}`, color: on ? '#9a7a28' : '#5a564e' }}>{l.label}</button>
                })}
              </div>

              <Sep label="Compétences / critères" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {COMPETENCES.map(c => {
                  const on = f.competences.includes(c.key)
                  return <button type="button" key={c.key} onClick={() => setF({ ...f, competences: toggle(f.competences, c.key) })}
                    style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: on ? '#e8eef8' : '#fff', border: `1.5px solid ${on ? '#1e3f70' : '#b8b0a4'}`, color: on ? '#1e3f70' : '#5a564e' }}>{c.label}</button>
                })}
              </div>

              <div style={{ marginTop: '10px' }}>
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', marginTop: '8px', borderTop: '1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
