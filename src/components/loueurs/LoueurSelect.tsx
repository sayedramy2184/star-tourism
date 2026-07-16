'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'

interface Loueur { id: string; nom: string }

// Sélecteur de loueur avec création inline (sans quitter le formulaire véhicule)
export default function LoueurSelect({ value, onChange }: {
  value: string
  onChange: (id: string, nom: string) => void
}) {
  const [loueurs, setLoueurs] = useState<Loueur[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ nom: '', contact_nom: '', telephone: '' })

  useEffect(() => { load() }, [])
  function load() {
    fetch('/api/loueurs').then(r => r.json()).then(({ data }) => setLoueurs(data ?? []))
  }

  async function create() {
    if (!form.nom.trim()) return toast.error('Nom du loueur requis')
    setSaving(true)
    try {
      const res = await fetch('/api/loueurs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setLoueurs(prev => [...prev, json.data].sort((a, b) => a.nom.localeCompare(b.nom)))
      onChange(json.data.id, json.data.nom)
      setForm({ nom: '', contact_nom: '', telephone: '' })
      setShowAdd(false)
      toast.success('Loueur créé')
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
        <label className="form-label" style={{ marginBottom:0 }}>Loueur / Bailleur</label>
        <button type="button" onClick={() => setShowAdd(s => !s)}
          style={{ fontSize:'9px', fontWeight:700, letterSpacing:'1px', color:'#9a7a28', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>
          + Nouveau loueur
        </button>
      </div>

      <select className="select" value={value} onChange={e => {
        const l = loueurs.find(x => x.id === e.target.value)
        onChange(e.target.value, l?.nom ?? '')
      }}>
        <option value="">— Sélectionner —</option>
        {loueurs.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
      </select>

      {showAdd && (
        <div style={{ marginTop:'8px', padding:'12px', background:'#f5f2ed', border:'1.5px solid #9a7a28', borderTop:'3px solid #9a7a28' }}>
          <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'8px' }}>
            Nouveau loueur
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
            <div style={{ gridColumn:'span 2' }}>
              <label className="form-label">Nom *</label>
              <input className="input" autoFocus value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create() } }}
                placeholder="ALD Automotive, Arval, Leasys…" />
            </div>
            <div><label className="form-label">Contact</label>
              <input className="input" value={form.contact_nom} onChange={e => setForm({ ...form, contact_nom: e.target.value })} /></div>
            <div><label className="form-label">Téléphone</label>
              <input className="input" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} /></div>
          </div>
          <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
            <button type="button" className="btn-ghost" style={{ padding:'5px 12px', fontSize:'10px' }} onClick={() => setShowAdd(false)}>Annuler</button>
            <button type="button" className="btn-or" style={{ padding:'5px 12px', fontSize:'10px' }} disabled={saving} onClick={create}>
              {saving ? 'Création…' : '+ Créer et sélectionner'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
