'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Plus, Trash2, X, Wallet } from 'lucide-react'

interface Paiement {
  id: string; montant: number; date_paiement: string; moyen: string | null; note: string | null
}

const MOYENS = [
  { val: 'virement', label: 'Virement' },
  { val: 'especes',  label: 'Espèces' },
  { val: 'cheque',   label: 'Chèque' },
  { val: 'carte',    label: 'Carte' },
  { val: 'autre',    label: 'Autre' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

const CONF = {
  loueur:         { url: '/api/paiements-loueur',         idField: 'loueur_id' },
  sous_traitant:  { url: '/api/paiements-sous-traitant',  idField: 'sous_traitant_id' },
} as const

export default function PaiementsPanel({ kind = 'loueur', entityId, initial, onChange }: {
  kind?: 'loueur' | 'sous_traitant'
  entityId: string
  initial: Paiement[]
  onChange?: (list: Paiement[]) => void
}) {
  const router = useRouter()
  const conf = CONF[kind]
  const [list, setList]     = useState<Paiement[]>(initial)
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), moyen: 'virement', note: '' })

  const total = list.reduce((s, p) => s + Number(p.montant), 0)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const montant = parseFloat(form.montant)
    if (!montant || montant <= 0) return toast.error('Montant invalide')
    setSaving(true)
    try {
      const res = await fetch(conf.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [conf.idField]: entityId, ...form, montant }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      const next = [json.data, ...list]
      setList(next); onChange?.(next)
      setOpen(false)
      setForm({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), moyen: 'virement', note: '' })
      toast.success('Paiement enregistré')
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce paiement ?')) return
    const res = await fetch(`${conf.url}/${id}`, { method: 'DELETE' })
    if (res.ok) { const next = list.filter(p => p.id !== id); setList(next); onChange?.(next); toast.success('Paiement supprimé'); router.refresh() }
    else toast.error('Erreur')
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-header-title"><Wallet size={13} style={{ display:'inline', marginRight:6, verticalAlign:'-2px' }} />Paiements versés</span>
        <button className="btn-or" style={{ padding:'5px 12px', fontSize:'11px' }} onClick={() => setOpen(true)}>
          <Plus size={12} /> Enregistrer un paiement
        </button>
      </div>
      <div style={{ padding:'12px 16px' }}>
        {list.length === 0 ? (
          <div style={{ padding:'16px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>Aucun paiement enregistré</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            {list.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', background:'#faf9f7', border:'1px solid #ede9e2' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'13px', fontWeight:600, color:'#1e5e3a' }}>{fmt(Number(p.montant))}</span>
                  <span style={{ fontSize:'10px', color:'#8a8478', marginLeft:'10px' }}>{format(parseISO(p.date_paiement),'dd/MM/yyyy',{locale:fr})}</span>
                  {p.moyen && <span style={{ fontSize:'9px', color:'#5a564e', marginLeft:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{p.moyen}</span>}
                  {p.note && <div style={{ fontSize:'10px', color:'#8a8478', marginTop:'2px' }}>{p.note}</div>}
                </div>
                <button onClick={() => remove(p.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9e2a2a' }}><Trash2 size={13} /></button>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'8px', borderTop:'1.5px solid #d8d2c8', marginTop:'4px' }}>
              <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', color:'#8a8478' }}>Total versé</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'13px', fontWeight:700, color:'#1e5e3a' }}>{fmt(total)}</span>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)', padding:'16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'440px', maxWidth:'96vw', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>Enregistrer un paiement</span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={add} style={{ padding:'22px 24px' }}>
              <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                <div><label className="form-label">Montant versé (€) *</label>
                  <input type="number" min={0} step={0.01} className="input" autoFocus required value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} placeholder="1000" /></div>
                <div><label className="form-label">Date</label>
                  <input type="date" className="input" value={form.date_paiement} onChange={e => setForm({ ...form, date_paiement: e.target.value })} /></div>
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label className="form-label">Moyen de paiement</label>
                <select className="select" value={form.moyen} onChange={e => setForm({ ...form, moyen: e.target.value })}>
                  {MOYENS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label className="form-label">Note</label>
                <input className="input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Acompte, régularisation…" />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
