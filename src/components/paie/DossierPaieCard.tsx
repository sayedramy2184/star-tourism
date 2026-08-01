'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Plus, Trash2, X, Pencil, Check } from 'lucide-react'
import { fmtEur, round2, TARIF_MAD_JOUR, TARIF_TRANSFERT } from '@/lib/salaireChauffeur'
import type { DossierPaie } from '@/lib/paieData'

const MOYENS = [
  { val: 'virement', label: 'Virement' },
  { val: 'especes', label: 'Espèces' },
  { val: 'cheque', label: 'Chèque' },
  { val: 'carte', label: 'Carte' },
  { val: 'autre', label: 'Autre' },
]

export default function DossierPaieCard({ chauffeurId, dossier, dossierHref }: {
  chauffeurId: string
  dossier: DossierPaie
  dossierHref: string
}) {
  const router = useRouter()
  const [list, setList] = useState(dossier.paiements)
  const [editTarif, setEditTarif] = useState(false)
  const [savingTarif, setSavingTarif] = useState(false)
  const [tJour, setTJour] = useState(String(dossier.tarifJour))
  const [tTransf, setTTransf] = useState(String(dossier.tarifTransfert))
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), moyen: 'virement', note: '' })

  const verse = round2(list.reduce((s, p) => s + Number(p.montant), 0))
  const restant = round2(dossier.salaire - verse)

  async function saveTarif() {
    setSavingTarif(true)
    try {
      const res = await fetch('/api/salaire-tarifs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chauffeur_id: chauffeurId, dossier_id: dossier.dossierId,
          tarif_jour: tJour === '' ? null : Number(tJour),
          tarif_transfert: tTransf === '' ? null : Number(tTransf),
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Erreur') }
      toast.success('Tarifs mis à jour')
      setEditTarif(false)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSavingTarif(false) }
  }

  function resetTarif() {
    setTJour(String(TARIF_MAD_JOUR)); setTTransf(String(TARIF_TRANSFERT))
  }

  async function addVersement(e: React.FormEvent) {
    e.preventDefault()
    const montant = parseFloat(form.montant)
    if (!montant || montant <= 0) return toast.error('Montant invalide')
    setSaving(true)
    try {
      const res = await fetch('/api/paiements-chauffeur', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chauffeur_id: chauffeurId, dossier_id: dossier.dossierId, ...form, montant }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setList([json.data, ...list])
      setOpen(false)
      setForm({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), moyen: 'virement', note: '' })
      toast.success('Versement enregistré')
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function removeVersement(id: string) {
    if (!confirm('Supprimer ce versement ?')) return
    const res = await fetch(`/api/paiements-chauffeur/${id}`, { method: 'DELETE' })
    if (res.ok) { setList(list.filter(p => p.id !== id)); toast.success('Versement supprimé'); router.refresh() }
    else toast.error('Erreur')
  }

  const enCours = dossier.nbJours > dossier.nbJoursTermine || dossier.nbTransferts > dossier.nbTransfertsTermine

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      {/* En-tête dossier */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 16px', borderBottom: '1px solid #ede9e2', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <Link href={dossierHref} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#1e3f70', fontWeight: 600, textDecoration: 'none' }}>{dossier.numero}</Link>
          <span style={{ fontSize: '12px', color: '#5a564e', marginLeft: '10px' }}>{dossier.clientNom}</span>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '15px', fontWeight: 700, color: '#16130e' }}>{fmtEur(dossier.salaire)}</div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Décompte + tarifs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {!editTarif ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '12px', color: '#5a564e' }}>
                  MAD <span style={{ fontSize: '10px', color: '#8a8478' }}>· {dossier.nbJours} j × {fmtEur(dossier.tarifJour)}</span>
                </span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: '#16130e' }}>{fmtEur(round2(dossier.nbJours * dossier.tarifJour))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '12px', color: '#5a564e' }}>
                  Transferts <span style={{ fontSize: '10px', color: '#8a8478' }}>· {dossier.nbTransferts} × {fmtEur(dossier.tarifTransfert)}</span>
                </span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: '#16130e' }}>{fmtEur(round2(dossier.nbTransferts * dossier.tarifTransfert))}</span>
              </div>
              <div>
                <button onClick={() => setEditTarif(true)} className="btn-ghost" style={{ padding: '3px 8px', fontSize: '10px', marginTop: '2px' }}>
                  <Pencil size={10} /> Modifier les tarifs
                </button>
                {dossier.hasOverride && <span style={{ fontSize: '9px', color: '#9a7a28', marginLeft: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tarif ajusté</span>}
              </div>
            </>
          ) : (
            <div style={{ background: '#faf9f7', border: '1px solid #ede9e2', padding: '10px 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <label className="form-label">Tarif / jour MAD (€)</label>
                  <input type="number" min={0} step={0.01} className="input" value={tJour} onChange={e => setTJour(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Tarif / transfert (€)</label>
                  <input type="number" min={0} step={0.01} className="input" value={tTransf} onChange={e => setTTransf(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={saveTarif} className="btn-primary" style={{ padding: '5px 12px', fontSize: '11px' }} disabled={savingTarif}>
                  <Check size={11} /> {savingTarif ? '…' : 'Valider'}
                </button>
                <button onClick={() => { setEditTarif(false); setTJour(String(dossier.tarifJour)); setTTransf(String(dossier.tarifTransfert)) }} className="btn-ghost" style={{ padding: '5px 10px', fontSize: '11px' }}>Annuler</button>
                <button onClick={resetTarif} className="btn-ghost" style={{ padding: '5px 10px', fontSize: '10px', marginLeft: 'auto' }} title="Revenir aux tarifs par défaut (200 / 50)">Défaut</button>
              </div>
            </div>
          )}
        </div>

        {/* Ligne salaire / statut */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '8px', borderTop: '1.5px solid #d8d2c8', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#5a564e' }}>
            Salaire dossier
            {enCours && <span style={{ fontSize: '9px', color: '#7a5c10', marginLeft: '8px', letterSpacing: '0.3px' }}>· acquis {fmtEur(dossier.salaireAcquis)}</span>}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '15px', fontWeight: 700, color: '#16130e' }}>{fmtEur(dossier.salaire)}</span>
        </div>

        {/* Versé / restant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <div style={{ background: '#eaf4ee', border: '1px solid #1e5e3a22', padding: '8px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a8478', marginBottom: '3px' }}>Versé</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 700, color: '#1e5e3a' }}>{fmtEur(verse)}</div>
          </div>
          <div style={{ background: restant > 0 ? '#faeaea' : '#eaf4ee', border: `1px solid ${restant > 0 ? '#9e2a2a22' : '#1e5e3a22'}`, padding: '8px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a8478', marginBottom: '3px' }}>Restant dû</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 700, color: restant > 0 ? '#9e2a2a' : '#1e5e3a' }}>{restant <= 0 ? '✓ Soldé' : fmtEur(restant)}</div>
          </div>
        </div>

        {/* Versements du dossier */}
        {list.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
            {list.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 9px', background: '#faf9f7', border: '1px solid #ede9e2' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: 600, color: '#1e5e3a' }}>{fmtEur(Number(p.montant))}</span>
                  <span style={{ fontSize: '10px', color: '#8a8478', marginLeft: '8px' }}>{format(parseISO(p.date_paiement), 'dd/MM/yyyy', { locale: fr })}</span>
                  {p.moyen && <span style={{ fontSize: '9px', color: '#5a564e', marginLeft: '6px', textTransform: 'uppercase' }}>{p.moyen}</span>}
                  {p.note && <span style={{ fontSize: '10px', color: '#8a8478', marginLeft: '6px' }}>· {p.note}</span>}
                </div>
                <button onClick={() => removeVersement(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e2a2a' }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setOpen(true)} className="btn-or" style={{ padding: '5px 12px', fontSize: '11px' }}>
            <Plus size={12} /> Versement
          </button>
          {restant > 0 && (
            <button onClick={() => { setForm(f => ({ ...f, montant: String(restant) })); setOpen(true) }} className="btn-ghost" style={{ padding: '5px 12px', fontSize: '11px' }}>
              Solder ({fmtEur(restant)})
            </button>
          )}
        </div>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '440px', maxWidth: '96vw', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>Versement · {dossier.numero}</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={addVersement} style={{ padding: '22px 24px' }}>
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
