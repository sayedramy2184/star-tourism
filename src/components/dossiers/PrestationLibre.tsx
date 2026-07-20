'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Plus, X, Sparkles, Pencil, Trash2 } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

// ── Modal (création ou édition) ────────────────
function LibreModal({ dossierId, dateDefaut, prestation, onClose }: {
  dossierId: string; dateDefaut: string; prestation?: any; onClose: () => void
}) {
  const router = useRouter()
  const isEdit = !!prestation
  const [libelle, setLibelle] = useState(prestation?.libelle ?? '')
  const [montant, setMontant] = useState(String(prestation?.tarif_fixe_ht ?? prestation?.montant_ht ?? ''))
  const [date, setDate] = useState((prestation?.date_debut ?? dateDefaut) ?? '')
  const [notes, setNotes] = useState(prestation?.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!libelle.trim()) return toast.error('Libellé requis')
    const m = parseFloat(montant)
    if (!m || m <= 0) return toast.error('Montant HT invalide')
    setSaving(true)
    try {
      const payload = { libelle: libelle.trim(), tarif_fixe_ht: m, date_debut: date || dateDefaut, date_fin: date || dateDefaut, notes: notes || null }
      const res = isEdit
        ? await fetch(`/api/prestations/${prestation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/prestations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dossier_id: dossierId, type: 'libre', validation_statut: 'validee', statut: 'confirme', ...payload }) })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      toast.success(isEdit ? 'Prestation mise à jour' : 'Prestation ajoutée')
      onClose(); router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '460px', maxWidth: '96vw', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '19px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>{isEdit ? 'Modifier la prestation' : 'Prestation libre'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={save} style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label className="form-label">Libellé *</label>
            <input className="input" autoFocus value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="Guide francophone, billetterie, meet & greet…" />
          </div>
          <div className="form-grid-2" style={{ marginBottom: '12px' }}>
            <div><label className="form-label">Montant HT (€) *</label>
              <input type="number" min={0} step={0.01} className="input" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0,00" /></div>
            <div><label className="form-label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Précisions…" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', borderTop: '1.5px solid #b8b0a4' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Bouton d'ajout (barre des prestations) ─────
export function BoutonPrestationLibre({ dossierId, dateDefaut }: { dossierId: string; dateDefaut: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={() => setOpen(true)}>
        <Sparkles size={12} /> Prestation libre
      </button>
      {open && <LibreModal dossierId={dossierId} dateDefaut={dateDefaut} onClose={() => setOpen(false)} />}
    </>
  )
}

// ── Carte d'une prestation libre ───────────────
export function PrestationLibreCard({ p, dossierId }: { p: any; dossierId: string }) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)

  async function supprimer() {
    if (!confirm('Supprimer cette prestation ?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/prestations/${p.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      toast.success('Prestation supprimée'); router.refresh()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>

      {/* Header — même structure que les autres prestations */}
      <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1.5px solid #b8b0a4' }}>
        <div style={{ width: '5px', background: '#9a7a28', flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: '#8a8478', background: '#f5f2ed', border: '1px solid #d8d2c8', padding: '2px 8px' }}>
            P-0{p.ordre}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#9a7a28' }}>
            <Sparkles size={11} /> Prestation libre
          </span>
          {p.date_debut && (
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#2e2b25' }}>
              {format(parseISO(p.date_debut), 'dd/MM/yyyy', { locale: fr })}
            </span>
          )}
        </div>
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #d8d2c8', flexShrink: 0 }}>
          <button onClick={() => setEdit(true)} disabled={busy} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px' }}>
            <Pencil size={11} /> Modifier
          </button>
          <button onClick={supprimer} disabled={busy} style={{ background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', padding: '4px 8px', cursor: 'pointer', color: '#9e2a2a', display: 'inline-flex', alignItems: 'center' }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Body — mêmes libellés/tailles que les autres prestations */}
      <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#8a8478', marginBottom: '3px' }}>Désignation</div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#16130e' }}>{p.libelle || 'Prestation'}</div>
          {p.notes && <div style={{ fontSize: '11px', color: '#8a8478', marginTop: '4px', fontStyle: 'italic' }}>{p.notes}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#8a8478', marginBottom: '3px' }}>Montant HT</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 700, color: '#9a7a28' }}>{fmt(p.montant_ht ?? 0)}</div>
        </div>
      </div>

      {edit && <LibreModal dossierId={dossierId} dateDefaut={p.date_debut} prestation={p} onClose={() => setEdit(false)} />}
    </div>
  )
}
