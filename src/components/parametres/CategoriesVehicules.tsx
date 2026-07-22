'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, X, Car } from 'lucide-react'

interface Categorie { id: string; nom: string; modeles: string[]; ordre: number }

export default function CategoriesVehicules() {
  const [cats, setCats] = useState<Categorie[]>([])
  const [loading, setLoading] = useState(true)
  const [newCat, setNewCat] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])
  function load() {
    setLoading(true)
    fetch('/api/vehicule-categories').then(r => r.json())
      .then(d => setCats(d.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }

  async function addCategorie() {
    const nom = newCat.trim()
    if (!nom) return
    setBusy(true)
    try {
      const res = await fetch('/api/vehicule-categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, ordre: (cats.at(-1)?.ordre ?? 0) + 1 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setCats(prev => [...prev, json.data]); setNewCat('')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function patchCat(id: string, patch: Partial<Categorie>) {
    setCats(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    try {
      const res = await fetch(`/api/vehicule-categories/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
    } catch (e: any) { toast.error(e.message); load() }
  }

  async function deleteCat(id: string) {
    if (!confirm('Supprimer cette catégorie ?')) return
    setCats(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/vehicule-categories/${id}`, { method: 'DELETE' })
  }

  function addModele(cat: Categorie, m: string) {
    const model = m.trim()
    if (!model || cat.modeles.includes(model)) return
    patchCat(cat.id, { modeles: [...cat.modeles, model] })
  }
  function removeModele(cat: Categorie, m: string) {
    patchCat(cat.id, { modeles: cat.modeles.filter(x => x !== m) })
  }

  return (
    <div className="card">
      <div className="card-header"><span className="card-header-title">Catégories & modèles de véhicules</span></div>
      <div style={{ padding: '18px 22px' }}>
        <p style={{ fontSize: '12px', color: '#5a564e', lineHeight: 1.6, marginBottom: '16px' }}>
          Ces catégories et modèles sont proposés lors de la création d'une prestation (dispatch) et dans le portail agence.
        </p>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cats.map(cat => (
              <div key={cat.id} style={{ border: '1.5px solid #d8d2c8', borderRadius: '8px', padding: '12px 14px', background: '#faf9f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Car size={15} style={{ color: '#9a7a28', flexShrink: 0 }} />
                  <input
                    defaultValue={cat.nom}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== cat.nom) patchCat(cat.id, { nom: v }) }}
                    style={{ flex: 1, background: '#fff', border: '1px solid #c9c2b6', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', fontWeight: 600, color: '#16130e', outline: 'none' }} />
                  <button onClick={() => deleteCat(cat.id)} title="Supprimer la catégorie"
                    style={{ background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#9e2a2a', flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Modèles */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  {cat.modeles.map(m => (
                    <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#4a2a6e', background: '#f0ebfa', border: '1px solid rgba(74,42,110,0.2)', borderRadius: '999px', padding: '3px 4px 3px 10px' }}>
                      {m}
                      <button onClick={() => removeModele(cat, m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a2a6e', display: 'flex', padding: '1px' }}><X size={12} /></button>
                    </span>
                  ))}
                  <ModeleInput onAdd={m => addModele(cat, m)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ajouter une catégorie */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '14px', borderTop: '1.5px solid #b8b0a4' }}>
          <input value={newCat} onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategorie() }}
            placeholder="Nouvelle catégorie (ex. Berline électrique)"
            style={{ flex: 1, background: '#fff', border: '1.5px solid #c9c2b6', borderRadius: '6px', padding: '9px 11px', fontSize: '13px', outline: 'none', color: '#16130e' }} />
          <button onClick={addCategorie} disabled={busy || !newCat.trim()} className="btn-primary" style={{ gap: '6px' }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}

function ModeleInput({ onAdd }: { onAdd: (m: string) => void }) {
  const [v, setV] = useState('')
  return (
    <input
      value={v}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { onAdd(v); setV('') } }}
      onBlur={() => { if (v.trim()) { onAdd(v); setV('') } }}
      placeholder="+ modèle"
      style={{ width: '110px', background: '#fff', border: '1px dashed #b8b0a4', borderRadius: '999px', padding: '4px 10px', fontSize: '11px', outline: 'none', color: '#16130e' }} />
  )
}
