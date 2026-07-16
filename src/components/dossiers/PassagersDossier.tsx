'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Trash2, Users, Briefcase } from 'lucide-react'

// Drapeau emoji depuis un code ISO 2 lettres (ex. FR → 🇫🇷)
export function flag(code?: string | null) {
  if (!code) return ''
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65, 0x1f1e6 + c.charCodeAt(1) - 65)
}

const empty = { nom: '', nationalite: '', telephone: '', nb_bagages: 0 }

export default function PassagersDossier({ dossierId }: { dossierId: string }) {
  const router = useRouter()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  function load() {
    setLoading(true)
    fetch(`/api/dossiers/${dossierId}/passagers`).then(r => r.json()).then(({ data }) => setList(data ?? [])).finally(() => setLoading(false))
  }

  async function add() {
    if (!form.nom.trim()) return toast.error('Nom requis')
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/passagers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setList(prev => [...prev, json.data]); setForm(empty); setShowForm(false)
      toast.success('Passager ajouté')
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/passagers/${id}`, { method: 'DELETE' })
    if (res.ok) { setList(prev => prev.filter(p => p.id !== id)); toast.success('Passager retiré'); router.refresh() }
    else toast.error('Erreur')
  }

  const totalBagages = list.reduce((s, p) => s + (p.nb_bagages ?? 0), 0)

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-header-title"><Users size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Passagers ({list.length})</span>
        <button className="btn-or" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={() => setShowForm(s => !s)}>
          <Plus size={12} /> Ajouter un passager
        </button>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {showForm && (
          <div style={{ background: '#f5f2ed', border: '1.5px solid #9a7a28', padding: '12px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: '8px', alignItems: 'end' }}>
            <div style={{ gridColumn: 'span 3', display: 'grid', gridTemplateColumns: '1fr 90px', gap: '8px' }}>
              <div><label className="form-label">Nom du passager *</label><input className="input" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="M. Ahmed AL FALASI" /></div>
              <div><label className="form-label">Nationalité</label><input className="input" value={form.nationalite} onChange={e => setForm({ ...form, nationalite: e.target.value.toUpperCase() })} placeholder="AE" maxLength={2} /></div>
            </div>
            <div style={{ gridColumn: 'span 1' }}><label className="form-label">Téléphone</label><input className="input" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} /></div>
            <div><label className="form-label">Bagages</label><input type="number" className="input" min={0} value={form.nb_bagages} onChange={e => setForm({ ...form, nb_bagages: Number(e.target.value) })} /></div>
            <button className="btn-or" style={{ justifyContent: 'center' }} onClick={add} disabled={saving}>{saving ? '…' : 'Ajouter'}</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Chargement…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: '14px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Aucun passager renseigné</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {list.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: '#faf9f7', border: '1px solid #ede9e2' }}>
                  <span style={{ fontSize: '15px' }}>{flag(p.nationalite) || '👤'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#16130e' }}>{p.nom}</span>
                    {p.telephone && <span style={{ fontSize: '10px', color: '#8a8478', marginLeft: '8px' }}>{p.telephone}</span>}
                  </div>
                  {p.nb_bagages > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#5a564e' }}><Briefcase size={11} /> {p.nb_bagages}</span>}
                  <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e2a2a' }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '8px', fontSize: '11px', color: '#8a8478' }}>
              <span>{list.length} passager{list.length > 1 ? 's' : ''}</span>
              <span><Briefcase size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {totalBagages} bagage{totalBagages > 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
