'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Trash2, ExternalLink } from 'lucide-react'
import { useSearchPaginate } from '@/lib/useSearchPaginate'
import { SearchBar, Pager } from '@/components/ui/ListControls'
import { exportCsv } from '@/lib/exportCsv'
import FactureFormModal from '@/components/factures/FactureFormModal'
import PaiementModal from '@/components/factures/PaiementModal'
import { FileMinus2 } from 'lucide-react'

interface Facture {
  id: string
  numero: string
  type?: string
  statut: string
  date_emission: string
  date_echeance: string
  montant_ht: number
  montant_tva?: number
  montant_ttc: number
  client: { id: string; nom: string } | null
  dossier: { id: string; numero: string } | null
  paiements?: { montant: number }[]
}

const paye = (f: Facture) => (f.paiements ?? []).reduce((s, p) => s + (p.montant ?? 0), 0)

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: '#8a8478', bg: '#f5f2ed' },
  emise:     { label: 'Émise',     color: '#1e3f70', bg: '#e8eef8' },
  envoyee:   { label: 'Envoyée',   color: '#4a2a6e', bg: '#efe8f8' },
  payee:     { label: 'Payée',     color: '#1e5e3a', bg: '#eaf4ee' },
  en_retard: { label: 'En retard', color: '#9e2a2a', bg: '#faeaea' },
  annulee:   { label: 'Annulée',   color: '#8a8478', bg: '#f0eeeb' },
}
const STATUT_ORDER = ['brouillon', 'emise', 'envoyee', 'payee', 'en_retard', 'annulee']

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}
function fmtDate(d: string) {
  const [y, m, j] = d.split('-')
  return j ? `${j}/${m}/${y}` : d
}
function isOverdue(f: Facture) {
  return f.statut !== 'payee' && f.statut !== 'annulee' && f.statut !== 'brouillon'
    && f.date_echeance < new Date().toISOString().slice(0, 10)
}

export default function FacturationPage() {
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('Toutes')

  useEffect(() => {
    // Passe d'abord les factures échues en « en retard », puis charge.
    fetch('/api/factures/maj-retards', { method: 'POST' }).catch(() => {}).finally(load)
  }, [])

  function load() {
    setLoading(true)
    fetch('/api/factures')
      .then(r => r.json())
      .then(({ data }) => setFactures(data ?? []))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  async function creerAvoir(id: string, numero: string) {
    if (!confirm(`Créer un avoir pour la facture ${numero} ?\nLa facture d'origine sera annulée.`)) return
    try {
      const res = await fetch(`/api/factures/${id}/avoir`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success(`Avoir ${json.data.numero} créé`)
      window.open(`/api/factures/${json.data.id}/pdf`, '_blank')
      load()
    } catch (err: any) { toast.error(err.message) }
  }

  async function changeStatut(id: string, statut: string) {
    try {
      const res = await fetch(`/api/factures/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      if (!res.ok) throw new Error()
      setFactures(prev => prev.map(f => f.id === id ? { ...f, statut } : f))
      toast.success('Statut mis à jour')
    } catch { toast.error('Erreur') }
  }

  async function supprimer(id: string, numero: string) {
    if (!confirm(`Supprimer la facture ${numero} ?`)) return
    try {
      const res = await fetch(`/api/factures/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setFactures(prev => prev.filter(f => f.id !== id))
      toast.success('Facture supprimée')
    } catch (err: any) { toast.error(err.message) }
  }

  const filtres = ['Toutes', ...STATUT_ORDER]
  const visibles = filtre === 'Toutes'
    ? factures
    : factures.filter(f => f.statut === filtre)
  const sp = useSearchPaginate(visibles, (f: any) =>
    `${f.numero ?? ''} ${f.client?.nom ?? ''} ${f.dossier?.numero ?? ''}`)

  function handleExport() {
    exportCsv('factures-comptable.csv', sp.filtered.map((f: any) => ({
      Type: f.type === 'avoir' ? 'Avoir' : 'Facture',
      Numéro: f.numero, Client: f.client?.nom ?? '', Dossier: f.dossier?.numero ?? '',
      Émission: f.date_emission, Échéance: f.date_echeance,
      'Montant HT': f.montant_ht ?? 0, 'TVA': f.montant_tva ?? 0, 'Montant TTC': f.montant_ttc ?? 0,
      Payé: paye(f), Reste: Math.max(0, (f.montant_ttc ?? 0) - paye(f)), Statut: f.statut,
    })))
  }

  const totalTtc = factures
    .filter(f => f.statut !== 'annulee')
    .reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const totalPaye = factures
    .filter(f => f.statut !== 'annulee')
    .reduce((s, f) => s + paye(f), 0)
  const enAttente = totalTtc - totalPaye

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '10px', flexWrap: 'wrap' }}>
        <span className="section-title">Facturation</span>
        <FactureFormModal onDone={load} />
      </div>

      {/* Récap chiffres */}
      <div className="stat-grid-3" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Facturé (hors annulées)', val: fmt(totalTtc), color: '#16130e' },
          { label: 'Encaissé', val: fmt(totalPaye), color: '#1e5e3a' },
          { label: 'En attente de paiement', val: fmt(enAttente), color: '#7a5c10' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e0d9cd', padding: '16px 18px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#8a8478', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {filtres.map(f => {
          const active = filtre === f
          const label = f === 'Toutes' ? 'Toutes' : STATUTS[f]?.label ?? f
          return (
            <button key={f} onClick={() => setFiltre(f)}
              style={{
                padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                background: active ? '#16130e' : '#fff',
                border: `1.5px solid ${active ? '#16130e' : '#d8d2c8'}`,
                color: active ? '#fff' : '#5a564e', transition: 'all .14s',
              }}>
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <SearchBar value={sp.query} onChange={sp.setQuery} placeholder="Rechercher une facture, client, dossier…" onExport={handleExport} />
      </div>

      {/* Table */}
      {/* Liste mobile (cartes) */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Chargement…</div>
        ) : sp.total === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>{factures.length === 0 ? 'Aucune facture — générez-en une depuis un dossier.' : 'Aucun résultat.'}</div>
        ) : sp.pageItems.map((f: any) => {
          const overdue = isOverdue(f); const st = STATUTS[overdue ? 'en_retard' : f.statut] ?? STATUTS.brouillon
          return (
            <div key={f.id} style={{ background: '#fff', border: '1.5px solid #b8b0a4', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: '#9a7a28', fontWeight: 600 }}>{f.numero}</span>
                  {f.type === 'avoir' && <span style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', color: '#4a2a6e', background: '#f0ebfa', border: '1px solid rgba(74,42,110,0.2)', padding: '1px 5px' }}>Avoir</span>}
                </div>
                <select value={f.statut} onChange={e => changeStatut(f.id, e.target.value)} style={{ fontSize: '10px', fontWeight: 700, padding: '3px 6px', cursor: 'pointer', color: st.color, background: st.bg, border: `1px solid ${st.color}33`, outline: 'none' }}>
                  {STATUT_ORDER.map(s => <option key={s} value={s} style={{ background: '#fff', color: '#16130e' }}>{STATUTS[s].label}</option>)}
                </select>
              </div>
              <div style={{ fontWeight: 600, color: '#16130e', fontSize: '14px', marginTop: '6px' }}>{f.client?.nom ?? '—'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '6px', alignItems: 'flex-end' }}>
                <div className="mono" style={{ fontSize: '10px', color: '#5a564e' }}>
                  {f.dossier && <div>Dossier {f.dossier.numero}</div>}
                  <div>Émis {fmtDate(f.date_emission)}</div>
                  <div style={{ color: overdue ? '#9e2a2a' : '#5a564e', fontWeight: overdue ? 700 : 400 }}>Échéance {fmtDate(f.date_echeance)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '14px', fontWeight: 700 }}>{fmt(f.montant_ttc)}</div>
                  {paye(f) > 0 && f.statut !== 'annulee' && (
                    <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '9px', color: (f.montant_ttc - paye(f)) <= 0 ? '#1e5e3a' : '#7a5c10' }}>{(f.montant_ttc - paye(f)) <= 0 ? '✓ Réglée' : `Reste ${fmt(f.montant_ttc - paye(f))}`}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ede9e2' }}>
                <a href={`/api/factures/${f.id}/pdf`} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}><ExternalLink size={11} /> PDF</a>
                {f.type !== 'avoir' && f.statut === 'brouillon' && <FactureFormModal editId={f.id} onDone={load} />}
                {f.type !== 'avoir' && f.statut !== 'annulee' && <PaiementModal factureId={f.id} numero={f.numero} montantTtc={f.montant_ttc} dejaPaye={paye(f)} onDone={load} />}
                {f.type !== 'avoir' && f.statut !== 'brouillon' && f.statut !== 'annulee' && (
                  <button onClick={() => creerAvoir(f.id, f.numero)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'none', border: '1.5px solid rgba(74,42,110,0.3)', padding: '4px 8px', cursor: 'pointer', color: '#4a2a6e', fontSize: '10px' }}><FileMinus2 size={11} /> Avoir</button>
                )}
                {f.statut === 'brouillon' && <button onClick={() => supprimer(f.id, f.numero)} style={{ background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', padding: '4px 8px', cursor: 'pointer', color: '#9e2a2a' }}><Trash2 size={11} /></button>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Table (desktop) */}
      <div className="table-container hidden md:block">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead className="table-head">
            <tr>
              {['N° Facture', 'Client', 'Dossier', 'Émission', 'Échéance', 'Montant TTC', 'Statut', ''].map((h, i) => (
                <th key={i} className="th" style={i % 2 === 1 ? { background: 'rgba(0,0,0,0.1)' } : {}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="td" style={{ textAlign: 'center', padding: '40px', color: '#8a8478' }}>Chargement…</td></tr>
            ) : sp.total === 0 ? (
              <tr><td colSpan={8} className="td" style={{ textAlign: 'center', padding: '60px', color: '#8a8478' }}>
                {factures.length === 0
                  ? 'Aucune facture — générez-en une depuis un dossier.'
                  : 'Aucun résultat.'}
              </td></tr>
            ) : sp.pageItems.map(f => {
              const overdue = isOverdue(f)
              const st = STATUTS[overdue ? 'en_retard' : f.statut] ?? STATUTS.brouillon
              return (
                <tr key={f.id} className="tr-body">
                  <td className="td" style={{ background: 'rgba(154,122,40,0.04)' }}>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#9a7a28', fontWeight: 600 }}>{f.numero}</span>
                    {f.type === 'avoir' && (
                      <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#4a2a6e', background: '#f0ebfa', border: '1px solid rgba(74,42,110,0.2)', padding: '1px 5px' }}>Avoir</span>
                    )}
                  </td>
                  <td className="td">{f.client?.nom ?? '—'}</td>
                  <td className="td">
                    {f.dossier
                      ? <Link href={`/dashboard/dossiers/${f.dossier.id}`} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#1e3f70', textDecoration: 'none' }}>{f.dossier.numero}</Link>
                      : <span style={{ color: '#c2bdb4' }}>—</span>}
                  </td>
                  <td className="td"><span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px' }}>{fmtDate(f.date_emission)}</span></td>
                  <td className="td">
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: overdue ? '#9e2a2a' : '#5a564e', fontWeight: overdue ? 700 : 400 }}>
                      {fmtDate(f.date_echeance)}
                    </span>
                  </td>
                  <td className="td">
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: 600 }}>{fmt(f.montant_ttc)}</span>
                    {paye(f) > 0 && f.statut !== 'annulee' && (
                      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '9px', color: (f.montant_ttc - paye(f)) <= 0 ? '#1e5e3a' : '#7a5c10', marginTop: '2px' }}>
                        {(f.montant_ttc - paye(f)) <= 0 ? '✓ Réglée' : `Reste ${fmt(f.montant_ttc - paye(f))}`}
                      </div>
                    )}
                  </td>
                  <td className="td">
                    <select value={f.statut} onChange={e => changeStatut(f.id, e.target.value)}
                      style={{ fontSize: '10px', fontWeight: 700, padding: '3px 6px', cursor: 'pointer', color: st.color, background: st.bg, border: `1px solid ${st.color}33`, outline: 'none' }}>
                      {STATUT_ORDER.map(s => <option key={s} value={s} style={{ background: '#fff', color: '#16130e' }}>{STATUTS[s].label}</option>)}
                    </select>
                  </td>
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <a href={`/api/factures/${f.id}/pdf`} target="_blank" rel="noreferrer"
                        className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}>
                        <ExternalLink size={11} /> PDF
                      </a>
                      {f.type !== 'avoir' && f.statut === 'brouillon' && (
                        <FactureFormModal editId={f.id} onDone={load} />
                      )}
                      {f.type !== 'avoir' && f.statut !== 'annulee' && (
                        <PaiementModal factureId={f.id} numero={f.numero} montantTtc={f.montant_ttc} dejaPaye={paye(f)} onDone={load} />
                      )}
                      {f.type !== 'avoir' && f.statut !== 'brouillon' && f.statut !== 'annulee' && (
                        <button onClick={() => creerAvoir(f.id, f.numero)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'none', border: '1.5px solid rgba(74,42,110,0.3)', padding: '4px 8px', cursor: 'pointer', color: '#4a2a6e', fontSize: '10px' }}
                          title="Créer un avoir">
                          <FileMinus2 size={11} /> Avoir
                        </button>
                      )}
                      {f.statut === 'brouillon' && (
                        <button onClick={() => supprimer(f.id, f.numero)}
                          style={{ background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', padding: '4px 8px', cursor: 'pointer', color: '#9e2a2a' }}
                          title="Supprimer">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager page={sp.page} pageCount={sp.pageCount} total={sp.total} onPage={sp.setPage} />
    </div>
  )
}
