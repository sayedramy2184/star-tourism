'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Edit, X } from 'lucide-react'

interface Client {
  id: string; type: string; nom: string; contact_nom: string | null
  email: string | null; telephone: string | null
  adresse: string | null; code_postal: string | null; ville: string | null; pays: string | null
  numero_tva: string | null; notes: string | null
  profile_id?: string | null
}

const TYPES = [
  { val: 'agence', label: 'Agence (partenaire)' },
  { val: 'entreprise', label: 'Entreprise' },
  { val: 'particulier', label: 'Particulier' },
]

export default function ClientEditModal({ client }: { client: Client }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: client.type ?? 'entreprise',
    nom: client.nom ?? '',
    contact_nom: client.contact_nom ?? '',
    email: client.email ?? '',
    telephone: client.telephone ?? '',
    adresse: client.adresse ?? '',
    code_postal: client.code_postal ?? '',
    ville: client.ville ?? '',
    pays: client.pays ?? 'France',
    numero_tva: client.numero_tva ?? '',
    notes: client.notes ?? '',
  })

  const aAcces = !!client.profile_id

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) return toast.error('Le nom est requis')
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Client mis à jour')
      setOpen(false)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}
        style={{ padding: '5px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.25)' }}>
        <Edit size={11} /> Modifier
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '560px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '19px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>Modifier le client</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={save} style={{ padding: '22px 24px' }}>
              <div className="form-grid-2" style={{ marginBottom: '12px' }}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="select" value={form.type} disabled={aAcces}
                    onChange={e => setForm({ ...form, type: e.target.value })}>
                    {TYPES.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                  </select>
                  {aAcces && <p style={{ fontSize: '9px', color: '#8a8478', marginTop: '3px' }}>Accès portail actif — révoquez-le pour changer le type.</p>}
                </div>
                <div>
                  <label className="form-label">{form.type === 'particulier' ? 'Nom complet *' : 'Raison sociale *'}</label>
                  <input className="input" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: '12px' }}>
                <div><label className="form-label">Contact</label>
                  <input className="input" value={form.contact_nom} onChange={e => setForm({ ...form, contact_nom: e.target.value })} placeholder="Prénom Nom" /></div>
                <div><label className="form-label">N° TVA</label>
                  <input className="input" value={form.numero_tva} onChange={e => setForm({ ...form, numero_tva: e.target.value })} placeholder="FR12 345 678 901" /></div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: '12px' }}>
                <div><label className="form-label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><label className="form-label">Téléphone</label>
                  <input type="tel" className="input" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} /></div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Adresse</label>
                <input className="input" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} placeholder="14 Place Vendôme" />
              </div>

              <div className="form-grid-3" style={{ marginBottom: '12px' }}>
                <div><label className="form-label">Code postal</label>
                  <input className="input" value={form.code_postal} onChange={e => setForm({ ...form, code_postal: e.target.value })} /></div>
                <div><label className="form-label">Ville</label>
                  <input className="input" value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })} /></div>
                <div><label className="form-label">Pays</label>
                  <input className="input" value={form.pays} onChange={e => setForm({ ...form, pays: e.target.value })} /></div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', borderTop: '1.5px solid #b8b0a4' }}>
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
