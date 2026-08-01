'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Plus, Trash2, X, Wallet } from 'lucide-react'
import { TARIF_MAD_JOUR, TARIF_TRANSFERT, calcSalaire } from '@/lib/salaireChauffeur'

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
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

export default function SalaireChauffeur({ chauffeurId, nbJoursMad, nbTransferts }: {
  chauffeurId: string
  nbJoursMad: number
  nbTransferts: number
}) {
  const salaire = calcSalaire(nbJoursMad, nbTransferts)

  const [list, setList]     = useState<Paiement[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), moyen: 'virement', note: '' })

  useEffect(() => {
    fetch(`/api/paiements-chauffeur?chauffeur_id=${chauffeurId}`)
      .then(r => r.json())
      .then(({ data }) => setList(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [chauffeurId])

  const totalVerse = list.reduce((s, p) => s + Number(p.montant), 0)
  const restant = Math.round((salaire.total - totalVerse) * 100) / 100

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const montant = parseFloat(form.montant)
    if (!montant || montant <= 0) return toast.error('Montant invalide')
    setSaving(true)
    try {
      const res = await fetch('/api/paiements-chauffeur', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chauffeur_id: chauffeurId, ...form, montant }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setList([json.data, ...list])
      setOpen(false)
      setForm({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), moyen: 'virement', note: '' })
      toast.success('Versement enregistré')
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce versement ?')) return
    const res = await fetch(`/api/paiements-chauffeur/${id}`, { method: 'DELETE' })
    if (res.ok) { setList(list.filter(p => p.id !== id)); toast.success('Versement supprimé') }
    else toast.error('Erreur')
  }

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div className="card-header">
        <span className="card-header-title">
          <Wallet size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Paie du chauffeur
        </span>
        <button className="btn-or" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={() => setOpen(true)}>
          <Plus size={12} /> Versement
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Décompte du salaire */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          <LigneDecompte
            label="Mises à disposition"
            detail={`${salaire.nbJoursMad} jour${salaire.nbJoursMad > 1 ? 's' : ''} × ${fmt(TARIF_MAD_JOUR)}`}
            montant={salaire.montantMad}
          />
          <LigneDecompte
            label="Transferts"
            detail={`${salaire.nbTransferts} × ${fmt(TARIF_TRANSFERT)}`}
            montant={salaire.montantTransfert}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '8px', borderTop: '1.5px solid #d8d2c8' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#5a564e' }}>Salaire calculé</span>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '16px', fontWeight: 700, color: '#16130e' }}>{fmt(salaire.total)}</span>
          </div>
        </div>

        {/* Récap versé / restant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <div style={{ background: '#eaf4ee', border: '1px solid #1e5e3a22', padding: '10px 12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a8478', marginBottom: '4px' }}>Versé</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '15px', fontWeight: 700, color: '#1e5e3a' }}>{fmt(totalVerse)}</div>
          </div>
          <div style={{ background: restant > 0 ? '#faeaea' : '#eaf4ee', border: `1px solid ${restant > 0 ? '#9e2a2a22' : '#1e5e3a22'}`, padding: '10px 12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a8478', marginBottom: '4px' }}>Restant dû</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '15px', fontWeight: 700, color: restant > 0 ? '#9e2a2a' : '#1e5e3a' }}>
              {restant <= 0 ? '✓ Soldé' : fmt(restant)}
            </div>
          </div>
        </div>

        {/* Historique des versements */}
        {loading ? (
          <div style={{ padding: '12px', textAlign: 'center', color: '#8a8478', fontSize: '11px' }}>Chargement…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', color: '#8a8478', fontSize: '11px' }}>Aucun versement enregistré</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {list.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#faf9f7', border: '1px solid #ede9e2' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 600, color: '#1e5e3a' }}>{fmt(Number(p.montant))}</span>
                  <span style={{ fontSize: '10px', color: '#8a8478', marginLeft: '10px' }}>{format(parseISO(p.date_paiement), 'dd/MM/yyyy', { locale: fr })}</span>
                  {p.moyen && <span style={{ fontSize: '9px', color: '#5a564e', marginLeft: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{p.moyen}</span>}
                  {p.note && <div style={{ fontSize: '10px', color: '#8a8478', marginTop: '2px' }}>{p.note}</div>}
                </div>
                <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e2a2a' }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '440px', maxWidth: '96vw', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '19px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>Enregistrer un versement</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={add} style={{ padding: '22px 24px' }}>
              {restant > 0 && (
                <button type="button" onClick={() => setForm({ ...form, montant: String(restant) })}
                  style={{ width: '100%', marginBottom: '12px', padding: '7px', fontSize: '11px', background: '#f5f2ed', border: '1px dashed #b8b0a4', cursor: 'pointer', color: '#5a564e' }}>
                  Solder le restant dû ({fmt(restant)})
                </button>
              )}
              <div className="form-grid-2" style={{ marginBottom: '12px' }}>
                <div><label className="form-label">Montant versé (€) *</label>
                  <input type="number" min={0} step={0.01} className="input" autoFocus required value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} placeholder="200" /></div>
                <div><label className="form-label">Date</label>
                  <input type="date" className="input" value={form.date_paiement} onChange={e => setForm({ ...form, date_paiement: e.target.value })} /></div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Moyen de paiement</label>
                <select className="select" value={form.moyen} onChange={e => setForm({ ...form, moyen: e.target.value })}>
                  {MOYENS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Note</label>
                <input className="input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Acompte, régularisation…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', borderTop: '1.5px solid #b8b0a4' }}>
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

function LigneDecompte({ label, detail, montant }: { label: string; detail: string; montant: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: '12px', color: '#5a564e' }}>
        {label} <span style={{ fontSize: '10px', color: '#8a8478' }}>· {detail}</span>
      </span>
      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: '#16130e' }}>{fmt(montant)}</span>
    </div>
  )
}
