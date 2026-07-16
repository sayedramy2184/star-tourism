'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, Tag } from 'lucide-react'

const CATS: Record<string, string> = {
  '': 'Toutes catégories', berline_standard: 'Berline standard', berline_premium: 'Berline premium',
  berline_prestige: 'Berline prestige', van_minibus: 'Van / Minibus', van_bagages: 'Van Bagages',
  suv_premium: 'SUV premium', electrique: 'Électrique',
}
function eur(n: number) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0) }
const empty = { libelle: '', type: 'transfert', categorie: '', prix_ht: 0 }

export default function TarifsClient({ clientId }: { clientId: string }) {
  const [tarifs, setTarifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { load() }, [])
  function load() {
    setLoading(true)
    fetch(`/api/clients/${clientId}/tarifs`).then(r => r.json()).then(({ data }) => setTarifs(data ?? [])).finally(() => setLoading(false))
  }

  async function add() {
    if (!form.libelle.trim()) return toast.error('Libellé requis')
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/tarifs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setTarifs(prev => [...prev, json.data])
      setForm(empty); setShowForm(false)
      toast.success('Tarif ajouté')
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce tarif ?')) return
    const res = await fetch(`/api/tarifs-clients/${id}`, { method: 'DELETE' })
    if (res.ok) { setTarifs(prev => prev.filter(t => t.id !== id)); toast.success('Tarif supprimé') }
    else toast.error('Erreur')
  }

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-header-title"><Tag size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Tarifs dédiés</span>
        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)' }} onClick={() => setShowForm(s => !s)}>
          <Plus size={11} /> Ajouter
        </button>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: '11px', color: '#5a564e', marginBottom: '12px', lineHeight: 1.5 }}>
          Ces tarifs sont proposés automatiquement à la création d'un dossier pour ce client.
        </p>

        {showForm && (
          <div style={{ background: '#f5f2ed', border: '1.5px solid #9a7a28', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div><label className="form-label">Libellé *</label><input className="input" value={form.libelle} onChange={e => setForm({ ...form, libelle: e.target.value })} placeholder="Ex. Paris → CDG" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><label className="form-label">Type</label>
                <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="transfert">Transfert</option><option value="mad">Mise à disposition</option>
                </select>
              </div>
              <div><label className="form-label">{form.type === 'mad' ? 'Prix / jour HT' : 'Prix fixe HT'}</label>
                <input type="number" className="input" min={0} step={0.01} value={form.prix_ht || ''} onChange={e => setForm({ ...form, prix_ht: Number(e.target.value) })} /></div>
            </div>
            <div><label className="form-label">Catégorie véhicule (optionnel)</label>
              <select className="select" value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}>
                {Object.entries(CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn-or" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={add} disabled={saving}>{saving ? '…' : 'Ajouter'}</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Chargement…</div>
        ) : tarifs.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Aucun tarif dédié</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tarifs.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f5f2ed', border: '1px solid #d8d2c8' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 6px', color: t.type === 'mad' ? '#a6432a' : '#1e3f70', background: t.type === 'mad' ? '#f8ece7' : '#e8eef8' }}>{t.type === 'mad' ? 'MAD' : 'TRANSF'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#16130e' }}>{t.libelle}</div>
                  {t.categorie && <div style={{ fontSize: '10px', color: '#8a8478' }}>{CATS[t.categorie] ?? t.categorie}</div>}
                </div>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#9a7a28', fontWeight: 600 }}>{eur(t.prix_ht)}{t.type === 'mad' ? '/j' : ''}</span>
                <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e2a2a' }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
