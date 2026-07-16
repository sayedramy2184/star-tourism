'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Wallet, X } from 'lucide-react'

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
}
const MOYENS = [['virement', 'Virement'], ['cb', 'Carte'], ['especes', 'Espèces'], ['cheque', 'Chèque'], ['autre', 'Autre']] as const

export default function PaiementModal({ factureId, numero, montantTtc, dejaPaye, onDone }: {
  factureId: string; numero: string; montantTtc: number; dejaPaye: number; onDone?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paies, setPaies] = useState<any[]>([])
  const solde = Math.round((montantTtc - dejaPaye) * 100) / 100

  const [montant, setMontant] = useState(solde > 0 ? solde : 0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [moyen, setMoyen] = useState('virement')
  const [reference, setReference] = useState('')

  useEffect(() => {
    if (!open) return
    setMontant(solde > 0 ? solde : 0)
    fetch(`/api/factures/${factureId}/paiements`).then(r => r.json()).then(d => setPaies(d.data ?? []))
  }, [open])

  async function submit() {
    if (montant <= 0) return toast.error('Montant invalide')
    setSaving(true)
    try {
      const res = await fetch(`/api/factures/${factureId}/paiements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montant, date_paiement: date, moyen, reference: reference || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success(json.data.solde <= 0 ? 'Facture soldée !' : `Paiement enregistré · reste ${eur(json.data.solde)}`)
      setOpen(false)
      onDone?.()
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)} style={{ padding: '4px 10px', fontSize: '10px' }}>
        <Wallet size={11} /> Paiement
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '480px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>Paiement — {numero}</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                {[['Montant TTC', eur(montantTtc), '#16130e'], ['Déjà réglé', eur(dejaPaye), '#1e5e3a'], ['Reste dû', eur(solde), solde > 0 ? '#7a5c10' : '#1e5e3a']].map(([l, v, col]) => (
                  <div key={l} style={{ flex: 1, background: '#f5f2ed', border: '1px solid #d8d2c8', padding: '10px 12px' }}>
                    <div style={{ fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8478', marginBottom: '4px' }}>{l}</div>
                    <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: col as string, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="form-grid-2" style={{ marginBottom: '12px' }}>
                <div><label className="form-label">Montant *</label><input type="number" className="input" value={montant || ''} min={0} step={0.01} onChange={e => setMontant(Number(e.target.value) || 0)} style={{ fontFamily: 'JetBrains Mono,monospace' }} /></div>
                <div><label className="form-label">Date</label><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
                <div><label className="form-label">Moyen</label>
                  <select className="select" value={moyen} onChange={e => setMoyen(e.target.value)}>
                    {MOYENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Référence</label><input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° virement, chèque…" /></div>
              </div>

              {paies.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div className="form-label" style={{ marginBottom: '6px' }}>Historique</div>
                  {paies.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '5px 0', borderBottom: '1px solid #ede9e2' }}>
                      <span style={{ color: '#5a564e' }}>{p.date_paiement} · {p.moyen}{p.reference ? ` · ${p.reference}` : ''}</span>
                      <span style={{ fontFamily: 'JetBrains Mono,monospace', color: '#1e5e3a' }}>{eur(p.montant)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1.5px solid #b8b0a4' }}>
                <button className="btn-ghost" onClick={() => setOpen(false)}>Fermer</button>
                <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le paiement'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
