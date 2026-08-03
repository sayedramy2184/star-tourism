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

function periode(d: DossierPaie) {
  if (!d.dateDebut) return ''
  const deb = format(parseISO(d.dateDebut), 'dd MMM yyyy', { locale: fr })
  if (!d.dateFin || d.dateFin === d.dateDebut) return deb
  return `${format(parseISO(d.dateDebut), 'dd MMM', { locale: fr })} → ${format(parseISO(d.dateFin), 'dd MMM yyyy', { locale: fr })}`
}

export default function DossierPaieCard({ chauffeurId, dossier, dossierHref }: {
  chauffeurId: string
  dossier: DossierPaie
  dossierHref: string
}) {
  const router = useRouter()
  const [list, setList] = useState(dossier.paiements)
  const [editTarif, setEditTarif] = useState(false)
  const [savingTarif, setSavingTarif] = useState(false)
  // rémunérations éditables par unité (string pour permettre le vide = défaut)
  const [tarifs, setTarifs] = useState<Record<string, string>>(
    () => Object.fromEntries(dossier.unites.map(u => [u.id, String(u.tarif)]))
  )
  const [bulk, setBulk] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ montant: '', date_paiement: new Date().toISOString().slice(0, 10), moyen: 'virement', note: '' })

  const verse = round2(list.reduce((s, p) => s + Number(p.montant), 0))
  const restant = round2(dossier.salaire - verse)

  async function saveTarifs() {
    const updates = dossier.unites.map(u => ({
      kind: u.kind, id: u.id,
      montant: tarifs[u.id] === '' ? null : Number(tarifs[u.id]),
    }))
    setSavingTarif(true)
    try {
      const res = await fetch('/api/paie/remuneration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Erreur') }
      toast.success('Tarifs mis à jour')
      setEditTarif(false)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSavingTarif(false) }
  }

  function applyBulk() {
    if (bulk === '') return
    setTarifs(Object.fromEntries(dossier.unites.map(u => [u.id, bulk])))
  }
  function resetAll() {
    setTarifs(Object.fromEntries(dossier.unites.map(u => [u.id, String(u.kind === 'jour' ? TARIF_MAD_JOUR : TARIF_TRANSFERT)])))
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

  const enCours = dossier.salaireAcquis < dossier.salaire

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      {/* En-tête dossier */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 16px', borderBottom: '1px solid #f4f5f7', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <Link href={dossierHref} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#1e3f70', fontWeight: 600, textDecoration: 'none' }}>{dossier.numero}</Link>
          <span style={{ fontSize: '12px', color: '#5a564e', marginLeft: '10px' }}>{dossier.clientNom}</span>
          {periode(dossier) && (
            <div style={{ fontSize: '11px', color: '#63605a', marginTop: '2px' }}>
              {periode(dossier)}
              <span style={{ marginLeft: '8px' }}>· {dossier.nbJours > 0 && `${dossier.nbJours} j MAD`}{dossier.nbJours > 0 && dossier.nbTransferts > 0 && ' · '}{dossier.nbTransferts > 0 && `${dossier.nbTransferts} transfert${dossier.nbTransferts > 1 ? 's' : ''}`}</span>
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '15px', fontWeight: 700, color: '#16130e' }}>{fmtEur(dossier.salaire)}</div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Bouton édition tarifs */}
        {!editTarif ? (
          <div style={{ marginBottom: '12px' }}>
            <button onClick={() => setEditTarif(true)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px' }}>
              <Pencil size={10} /> Modifier les tarifs
            </button>
            {dossier.unites.some(u => !u.isDefault) && <span style={{ fontSize: '9px', color: '#9a7a28', marginLeft: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tarif ajusté</span>}
          </div>
        ) : (
          <div style={{ background: '#faf9f7', border: '1px solid #f4f5f7', padding: '10px 12px', marginBottom: '12px' }}>
            {/* Appliquer à tous */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: '#63605a' }}>Appliquer à tous&nbsp;:</span>
              <input type="number" min={0} step={0.01} value={bulk} onChange={e => setBulk(e.target.value)} className="input" style={{ width: '90px', padding: '4px 8px', fontSize: '12px' }} placeholder="€" />
              <button onClick={applyBulk} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px' }}>Appliquer</button>
              <button onClick={resetAll} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px', marginLeft: 'auto' }} title="Tarifs par défaut (200 / 50)">Défaut</button>
            </div>
            {/* Liste des unités */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
              {dossier.unites.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', flexShrink: 0,
                    background: u.kind === 'jour' ? '#f8ece7' : '#e8eef8', color: u.kind === 'jour' ? '#a6432a' : '#1e3f70',
                  }}>{u.kind === 'jour' ? 'MAD' : 'TR'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '11px', color: '#5a564e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.label}</span>
                  <input type="number" min={0} step={0.01} value={tarifs[u.id] ?? ''} onChange={e => setTarifs({ ...tarifs, [u.id]: e.target.value })}
                    className="input" style={{ width: '80px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }} />
                  <span style={{ fontSize: '10px', color: '#63605a', width: '10px' }}>€</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f4f5f7' }}>
              <button onClick={saveTarifs} className="btn-primary" style={{ padding: '5px 12px', fontSize: '11px' }} disabled={savingTarif}>
                <Check size={11} /> {savingTarif ? '…' : 'Enregistrer les tarifs'}
              </button>
              <button onClick={() => { setEditTarif(false); setTarifs(Object.fromEntries(dossier.unites.map(u => [u.id, String(u.tarif)]))) }} className="btn-ghost" style={{ padding: '5px 10px', fontSize: '11px' }}>Annuler</button>
            </div>
          </div>
        )}

        {/* Ligne salaire / statut */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: '8px', borderBottom: '1.5px solid #d8d2c8', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#5a564e' }}>
            Salaire dossier
            {enCours && <span style={{ fontSize: '9px', color: '#7a5c10', marginLeft: '8px', letterSpacing: '0.3px' }}>· acquis {fmtEur(dossier.salaireAcquis)}</span>}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '15px', fontWeight: 700, color: '#16130e' }}>{fmtEur(dossier.salaire)}</span>
        </div>

        {/* Versé / restant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <div style={{ background: '#eaf4ee', border: '1px solid #1e5e3a22', padding: '8px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#63605a', marginBottom: '3px' }}>Versé</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 700, color: '#1e5e3a' }}>{fmtEur(verse)}</div>
          </div>
          <div style={{ background: restant > 0 ? '#faeaea' : '#eaf4ee', border: `1px solid ${restant > 0 ? '#9e2a2a22' : '#1e5e3a22'}`, padding: '8px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#63605a', marginBottom: '3px' }}>Restant dû</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 700, color: restant > 0 ? '#9e2a2a' : '#1e5e3a' }}>{restant <= 0 ? '✓ Soldé' : fmtEur(restant)}</div>
          </div>
        </div>

        {/* Versements du dossier */}
        {list.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
            {list.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 9px', background: '#faf9f7', border: '1px solid #f4f5f7' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: 600, color: '#1e5e3a' }}>{fmtEur(Number(p.montant))}</span>
                  <span style={{ fontSize: '10px', color: '#63605a', marginLeft: '8px' }}>{format(parseISO(p.date_paiement), 'dd/MM/yyyy', { locale: fr })}</span>
                  {p.moyen && <span style={{ fontSize: '9px', color: '#5a564e', marginLeft: '6px', textTransform: 'uppercase' }}>{p.moyen}</span>}
                  {p.note && <span style={{ fontSize: '10px', color: '#63605a', marginLeft: '6px' }}>· {p.note}</span>}
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
          <div style={{ background: '#fff', border: '1.5px solid #e4e6ea', width: '440px', maxWidth: '96vw', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', borderTop: '1.5px solid #e4e6ea' }}>
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
