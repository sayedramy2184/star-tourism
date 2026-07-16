'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'

const empty = { nom: '', contact_nom: '', telephone: '', email: '', notes: '' }

export default function NouveauLoueurButton() {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [form, setForm]   = useState(empty)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) return toast.error('Le nom est requis')
    setSaving(true)
    try {
      const res = await fetch('/api/loueurs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Loueur créé')
      setOpen(false); setForm(empty)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={14} /> Ajouter un loueur</button>
      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)', padding:'16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'480px', maxWidth:'96vw', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>Nouveau loueur</span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save} style={{ padding:'22px 24px' }}>
              <div style={{ marginBottom:'12px' }}>
                <label className="form-label">Nom du loueur *</label>
                <input className="input" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="ALD Automotive, Arval, Leasys…" />
              </div>
              <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                <div><label className="form-label">Contact</label><input className="input" value={form.contact_nom} onChange={e => setForm({ ...form, contact_nom: e.target.value })} /></div>
                <div><label className="form-label">Téléphone</label><input className="input" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} /></div>
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label className="form-label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label className="form-label">Notes</label><textarea className="textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Création…' : 'Créer le loueur'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
