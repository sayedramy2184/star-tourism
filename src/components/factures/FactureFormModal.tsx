'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Trash2, X, FilePlus2, Edit } from 'lucide-react'

interface Ligne { designation: string; description: string; quantite: number; prix_unitaire_ht: number }

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
}
const emptyLigne = (): Ligne => ({ designation: '', description: '', quantite: 1, prix_unitaire_ht: 0 })

export default function FactureFormModal({ onDone, editId }: { onDone?: () => void; editId?: string }) {
  const router = useRouter()
  const isEdit = !!editId
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [tauxTva, setTauxTva] = useState(10)
  const [echeance, setEcheance] = useState('')
  const [notes, setNotes] = useState('')
  const [lignes, setLignes] = useState<Ligne[]>([emptyLigne()])

  useEffect(() => {
    if (!open) return
    fetch('/api/clients').then(r => r.json()).then(d => setClients(d.data ?? []))
    if (isEdit) {
      setLoading(true)
      fetch(`/api/factures/${editId}`).then(r => r.json()).then(({ data }) => {
        if (!data) return
        setClientId(data.client_id ?? '')
        setTauxTva(data.taux_tva ?? 10)
        setEcheance((data.date_echeance ?? '').slice(0, 10))
        setNotes(data.notes ?? '')
        setLignes((data.lignes ?? []).length
          ? data.lignes.map((l: any) => ({ designation: l.designation ?? '', description: l.description ?? '', quantite: l.quantite ?? 1, prix_unitaire_ht: l.prix_unitaire_ht ?? 0 }))
          : [emptyLigne()])
      }).finally(() => setLoading(false))
    }
  }, [open])

  const ht = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0)
  const tva = Math.round(ht * tauxTva) / 100
  const ttc = ht + tva

  function setLigne(i: number, patch: Partial<Ligne>) {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  async function submit() {
    if (!clientId) return toast.error('Sélectionnez un client')
    const valid = lignes.filter(l => l.designation.trim() || l.prix_unitaire_ht > 0)
    if (valid.length === 0) return toast.error('Ajoutez au moins une ligne')
    setSaving(true)
    try {
      const payload = { client_id: clientId, taux_tva: tauxTva, date_echeance: echeance || undefined, notes: notes || undefined, lignes: valid }
      const res = await fetch(isEdit ? `/api/factures/${editId}` : '/api/factures', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success(isEdit ? 'Facture mise à jour' : `Facture ${json.data.numero} créée`)
      if (!isEdit) window.open(`/api/factures/${json.data.id}/pdf`, '_blank')
      setOpen(false)
      if (!isEdit) reset()
      onDone?.()
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  function reset() {
    setClientId(''); setTauxTva(10); setEcheance(''); setNotes(''); setLignes([emptyLigne()])
  }

  return (
    <>
      {isEdit ? (
        <button className="btn-ghost" onClick={() => setOpen(true)} style={{ padding: '4px 10px', fontSize: '10px' }}>
          <Edit size={11} /> Éditer
        </button>
      ) : (
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <FilePlus2 size={14} /> Nouvelle facture
        </button>
      )}

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '720px', maxWidth: '97vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 5 }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '19px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>{isEdit ? 'Éditer la facture' : 'Nouvelle facture manuelle'}</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#8a8478' }}>Chargement…</div>
            ) : (
            <div style={{ padding: '20px 24px' }}>
              <div className="form-grid-3" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="form-label">Client *</label>
                  <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div><label className="form-label">TVA (%)</label><input type="number" className="input" value={tauxTva} onChange={e => setTauxTva(Number(e.target.value) || 0)} min={0} step={0.1} /></div>
                <div><label className="form-label">Échéance</label><input type="date" className="input" value={echeance} onChange={e => setEcheance(e.target.value)} /></div>
              </div>

              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#9a7a28', marginBottom: '8px' }}>Lignes de facturation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 32px', gap: '6px', padding: '0 4px 4px', fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#8a8478' }}>
                <span>Désignation</span><span style={{ textAlign: 'right' }}>Qté</span><span style={{ textAlign: 'right' }}>P.U. HT</span><span style={{ textAlign: 'right' }}>Total</span><span />
              </div>
              {lignes.map((l, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 32px', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <input className="input" placeholder="Désignation" value={l.designation} onChange={e => setLigne(i, { designation: e.target.value })} />
                    <input className="input" placeholder="Description (optionnel)" value={l.description} onChange={e => setLigne(i, { description: e.target.value })} style={{ marginTop: '4px', fontSize: '11px' }} />
                  </div>
                  <input type="number" className="input" value={l.quantite} min={0} step={0.5} onChange={e => setLigne(i, { quantite: Number(e.target.value) })} style={{ textAlign: 'right' }} />
                  <input type="number" className="input" value={l.prix_unitaire_ht || ''} min={0} step={0.01} placeholder="0,00" onChange={e => setLigne(i, { prix_unitaire_ht: Number(e.target.value) })} style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }} />
                  <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#16130e' }}>{eur((Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0))}</span>
                  <button onClick={() => setLignes(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e2a2a', padding: '4px' }}><Trash2 size={13} /></button>
                </div>
              ))}
              <button onClick={() => setLignes(prev => [...prev, emptyLigne()])} className="btn-ghost" style={{ padding: '5px 12px', fontSize: '11px', marginTop: '4px' }}>
                <Plus size={12} /> Ajouter une ligne
              </button>

              <div style={{ marginTop: '14px' }}>
                <label className="form-label">Notes (bas de facture)</label>
                <textarea className="textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mention particulière…" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <div style={{ width: '240px' }}>
                  {[['Total HT', eur(ht)], [`TVA ${tauxTva} %`, eur(tva)]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #d8d2c8' }}>
                      <span style={{ fontSize: '11px', color: '#5a564e' }}>{k}</span>
                      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Total TTC</span>
                    <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '20px', color: '#9a7a28' }}>{eur(ttc)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1.5px solid #b8b0a4' }}>
                <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la facture'}</button>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
