'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { TrendingUp, Wallet, Clock, Handshake, Users, Building2, Car, FileText, Download, PieChart, Percent, KeyRound } from 'lucide-react'
import { exportCsv } from '@/lib/exportCsv'

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0)
}
function eur2(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

const PRESETS = [
  { key: 'mois', label: 'Ce mois' },
  { key: '12mois', label: '12 mois' },
  { key: 'annee', label: 'Cette année' },
] as const

function presetRange(key: string): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (key === 'mois') return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to }
  if (key === '12mois') { const d = new Date(now); d.setMonth(d.getMonth() - 11); d.setDate(1); return { from: d.toISOString().slice(0, 10), to } }
  return { from: `${now.getFullYear()}-01-01`, to }
}

const TABS = [
  { key: 'rentabilite', label: 'Rentabilité', icon: Percent },
  { key: 'financier', label: 'Financier', icon: Wallet },
  { key: 'commercial', label: 'Commercial', icon: TrendingUp },
  { key: 'operationnel', label: 'Opérationnel', icon: Car },
] as const

export default function RapportsPage() {
  const [preset, setPreset] = useState('annee')
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [tab, setTab] = useState<string>('rentabilite')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const range = custom ?? presetRange(preset)

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rapports?from=${from}&to=${to}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setData(json.data)
    } catch (err: any) { toast.error(err.message); setData(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(range.from, range.to) }, [range.from, range.to, load])

  function exportExcel() {
    if (!data) return
    exportCsv(`rapport-dossiers-${range.from}_${range.to}.csv`, data.parDossier.map((d: any) => ({
      Dossier: d.numero, Client: d.client, 'CA HT': d.ca, 'Coût direct': d.cout, 'Marge directe': d.marge,
    })))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <span className="section-title">Rapports</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => { setCustom(null); setPreset(p.key) }}
              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: !custom && preset === p.key ? '#16130e' : '#fff', border: `1.5px solid ${!custom && preset === p.key ? '#16130e' : '#d8d2c8'}`, color: !custom && preset === p.key ? '#fff' : '#5a564e' }}>
              {p.label}
            </button>
          ))}
          <input type="date" value={range.from} onChange={e => setCustom({ from: e.target.value, to: range.to })}
            style={{ padding: '5px 8px', fontSize: '11px', border: '1.5px solid #d8d2c8', borderRadius: '4px' }} />
          <span style={{ color: '#8a8478', fontSize: '11px' }}>→</span>
          <input type="date" value={range.to} onChange={e => setCustom({ from: range.from, to: e.target.value })}
            style={{ padding: '5px 8px', fontSize: '11px', border: '1.5px solid #d8d2c8', borderRadius: '4px' }} />
          <a href={`/api/rapports/pdf?from=${range.from}&to=${range.to}`} target="_blank" rel="noreferrer"
            className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px', textDecoration: 'none' }}><FileText size={12} /> PDF</a>
          <button onClick={exportExcel} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}><Download size={12} /> Excel</button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1.5px solid #e4e6ea' }}>
        {TABS.map(t => {
          const Icon = t.icon; const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${active ? '#9a7a28' : 'transparent'}`, color: active ? '#16130e' : '#8a8478', marginBottom: '-1.5px' }}>
              <Icon size={13} /> {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#63605a' }}>Chargement…</div>
      ) : !data ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#63605a' }}>Aucune donnée</div>
      ) : (
        <>
          {tab === 'rentabilite' && <TabRentabilite data={data} />}
          {tab === 'financier' && <TabFinancier data={data} />}
          {tab === 'commercial' && <TabCommercial data={data} />}
          {tab === 'operationnel' && <TabOperationnel data={data} />}
        </>
      )}
    </div>
  )
}

/* ──────────── RENTABILITÉ ──────────── */
function TabRentabilite({ data }: { data: any }) {
  const r = data.rentabilite
  const maxM = Math.max(1, ...data.serieMois.map((m: any) => m.ca))
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <Kpi icon={<TrendingUp size={16} />} label="Revenus HT" value={eur(r.revenus)} sub="prestations non annulées" />
        <Kpi icon={<Wallet size={16} />} label="Coûts totaux" value={eur(r.coutTotal)} sub="chauffeurs + ST + loyers" color="#9e2a2a" />
        <Kpi icon={<Percent size={16} />} label="Marge nette" value={eur(r.margeNette)} sub={`${r.tauxMarge} % du CA`} color={r.margeNette >= 0 ? '#1e5e3a' : '#9e2a2a'} />
      </div>

      {/* Décomposition des coûts */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><span className="card-header-title">Décomposition</span></div>
        <div style={{ padding: '16px' }}>
          <CoutBar label="Revenus HT" value={r.revenus} max={r.revenus} color="#9a7a28" />
          <CoutBar label="Paie chauffeurs" value={r.coutChauffeurs} max={r.revenus} color="#1e3f70" icon={<Users size={12} />} />
          <CoutBar label="Sous-traitance" value={r.coutSousTraitance} max={r.revenus} color="#4a2a6e" icon={<Handshake size={12} />} />
          <CoutBar label="Loyers véhicules" value={r.coutLoyers} max={r.revenus} color="#a6432a" icon={<KeyRound size={12} />} />
          <div style={{ borderTop: '1.5px solid #d8d2c8', marginTop: '10px', paddingTop: '10px' }}>
            <CoutBar label="Marge nette" value={r.margeNette} max={r.revenus} color={r.margeNette >= 0 ? '#1e5e3a' : '#9e2a2a'} bold />
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><span className="card-header-title">Marge par mois (CA vs coûts)</span></div>
          <div style={{ padding: '20px 16px 12px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', minHeight: '150px', minWidth: `${data.serieMois.length * 40}px` }}>
              {data.serieMois.map((m: any) => (
                <div key={m.mois} style={{ flex: 1, minWidth: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px' }}>
                    <div title={`CA ${eur2(m.ca)}`} style={{ width: '10px', height: `${Math.round((m.ca / maxM) * 118)}px`, background: '#9a7a28' }} />
                    <div title={`Coûts ${eur2(m.cout)}`} style={{ width: '10px', height: `${Math.round((m.cout / maxM) * 118)}px`, background: '#c98b7a' }} />
                  </div>
                  <div style={{ fontSize: '8px', color: m.marge >= 0 ? '#1e5e3a' : '#9e2a2a', fontFamily: 'JetBrains Mono,monospace' }}>{m.marge > 0 ? '+' : ''}{Math.round(m.marge / 1000)}k</div>
                  <div style={{ fontSize: '8px', color: '#5a564e', textTransform: 'uppercase' }}>{format(parseISO(m.mois + '-01'), 'MMM', { locale: fr })}</div>
                </div>
              ))}
            </div>
            <Legend items={[['CA HT', '#9a7a28'], ['Coûts', '#c98b7a']]} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-header-title">Rentabilité par dossier</span></div>
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ position: 'sticky', top: 0, background: '#faf9f7' }}>
                {['Dossier', 'CA', 'Coût', 'Marge'].map((h, i) => <th key={h} style={{ textAlign: i ? 'right' : 'left', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#8a8478', padding: '8px 12px', fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.parDossier.slice(0, 40).map((d: any) => (
                  <tr key={d.numero} style={{ borderBottom: '1px solid #f4f5f7' }}>
                    <td style={{ padding: '7px 12px', fontSize: '11px' }}><span style={{ fontFamily: 'JetBrains Mono,monospace', color: '#9a7a28' }}>{d.numero}</span><div style={{ fontSize: '10px', color: '#8a8478' }}>{d.client}</div></td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: '11px' }}>{eur(d.ca)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9e2a2a' }}>{eur(d.cout)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', fontWeight: 700, color: d.marge >= 0 ? '#1e5e3a' : '#9e2a2a' }}>{eur(d.marge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '9px', color: '#8a8478', padding: '8px 12px', fontStyle: 'italic' }}>Marge directe = CA − (paie chauffeurs + sous-traitance). Hors loyers/charges fixes.</div>
        </div>
      </div>
    </>
  )
}

/* ──────────── FINANCIER ──────────── */
function TabFinancier({ data }: { data: any }) {
  const f = data.financier
  const maxM = Math.max(1, ...data.serieMois.map((m: any) => m.ca))
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <Kpi icon={<TrendingUp size={16} />} label="CA HT" value={eur(f.caHt)} sub="prestations" />
        <Kpi icon={<Wallet size={16} />} label="Facturé TTC" value={eur(f.factureTtc)} sub={`${f.nbFactures} facture${f.nbFactures > 1 ? 's' : ''}`} />
        <Kpi icon={<Wallet size={16} />} label="Encaissé" value={eur(f.encaisse)} sub="factures payées" color="#1e5e3a" />
        <Kpi icon={<Clock size={16} />} label="En attente" value={eur(f.enAttente)} sub="à encaisser" color="#7a5c10" />
        <Kpi icon={<Clock size={16} />} label="Impayés échus" value={eur(f.impayes)} sub="factures en retard" color="#9e2a2a" />
        <Kpi icon={<Percent size={16} />} label="TVA collectée" value={eur(f.tvaCollectee)} sub={`HT facturé ${eur(f.factureHt)}`} />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-header-title">Chiffre d'affaires HT par mois</span></div>
        <div style={{ padding: '20px 16px 12px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', minHeight: '160px', minWidth: `${data.serieMois.length * 34}px` }}>
            {data.serieMois.map((m: any) => (
              <div key={m.mois} style={{ flex: 1, minWidth: '26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ fontSize: '8px', color: '#63605a', fontFamily: 'JetBrains Mono,monospace' }}>{m.ca > 0 ? Math.round(m.ca / 1000) + 'k' : ''}</div>
                <div title={eur2(m.ca)} style={{ width: '100%', height: `${Math.round((m.ca / maxM) * 130)}px`, minHeight: m.ca > 0 ? '3px' : '0', background: 'linear-gradient(to top, #9a7a28, #c9a84c)' }} />
                <div style={{ fontSize: '8px', color: '#5a564e', textTransform: 'uppercase' }}>{format(parseISO(m.mois + '-01'), 'MMM', { locale: fr })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ──────────── COMMERCIAL ──────────── */
function TabCommercial({ data }: { data: any }) {
  const c = data.commercial
  const totalMix = c.nbMad + c.nbTransfert
  const pMad = totalMix ? Math.round((c.nbMad / totalMix) * 100) : 0
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <Kpi icon={<Building2 size={16} />} label="Dossiers" value={String(c.nbDossiers)} sub="sur la période" />
        <Kpi icon={<TrendingUp size={16} />} label="Panier moyen" value={eur(c.panierMoyen)} sub="CA HT / dossier" />
        <Kpi icon={<Building2 size={16} />} label="CA agences" value={eur(c.caAgence)} sub="clients partenaires" />
        <Kpi icon={<Users size={16} />} label="CA directs" value={eur(c.caDirect)} sub="clients directs" />
      </div>
      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><span className="card-header-title"><Building2 size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Top clients</span></div>
          <div style={{ padding: '4px 0' }}>
            {c.topClients.length === 0 ? <div style={{ padding: '30px', textAlign: 'center', color: '#63605a', fontSize: '12px' }}>Aucun dossier</div> :
              c.topClients.map((cl: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px', borderBottom: '1px solid #f4f5f7' }}>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#c2bdb4', width: '18px' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#16130e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cl.nom}</div>
                    <div style={{ fontSize: '10px', color: '#63605a' }}>{cl.dossiers} dossier{cl.dossiers > 1 ? 's' : ''}</div>
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#9a7a28', fontWeight: 600 }}>{eur(cl.ca)}</span>
                </div>
              ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header"><span className="card-header-title"><PieChart size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Répartition des prestations</span></div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', height: '14px', overflow: 'hidden', border: '1px solid #d8d2c8', marginBottom: '12px' }}>
                <div style={{ width: `${totalMix ? 100 - pMad : 50}%`, background: '#1e3f70' }} />
                <div style={{ width: `${totalMix ? pMad : 50}%`, background: '#a6432a' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: '#1e3f70' }} /> Transferts <b>{c.nbTransfert}</b></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: '#a6432a' }} /> MAD <b>{c.nbMad}</b></span>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-header-title">Agences vs directs</span></div>
            <div style={{ padding: '16px' }}>
              <CoutBar label="Agences" value={c.caAgence} max={Math.max(1, c.caAgence + c.caDirect)} color="#4a2a6e" />
              <CoutBar label="Directs" value={c.caDirect} max={Math.max(1, c.caAgence + c.caDirect)} color="#1e3f70" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ──────────── OPÉRATIONNEL ──────────── */
function TabOperationnel({ data }: { data: any }) {
  const o = data.operationnel
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <Kpi icon={<Users size={16} />} label="Chauffeurs actifs" value={String(o.activiteChauffeurs.length)} sub="avec mission" />
        <Kpi icon={<Car size={16} />} label="Véhicules utilisés" value={String(o.flotte.length)} sub="sur la période" />
        <Kpi icon={<Percent size={16} />} label="Taux d'occupation moyen" value={`${o.tauxOccupationMoyen} %`} sub="jours occupés / période" />
      </div>
      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><span className="card-header-title"><Users size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Activité chauffeurs</span></div>
          <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '4px 0' }}>
            {o.activiteChauffeurs.length === 0 ? <div style={{ padding: '30px', textAlign: 'center', color: '#63605a', fontSize: '12px' }}>Aucune mission</div> :
              o.activiteChauffeurs.map((ch: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderBottom: '1px solid #f4f5f7' }}>
                  <span style={{ fontSize: '13px', color: '#16130e', flex: 1 }}>{ch.nom}</span>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#1e3f70', fontWeight: 600 }}>{ch.missions}</span>
                  <span style={{ fontSize: '10px', color: '#63605a', width: '52px' }}>mission{ch.missions > 1 ? 's' : ''}</span>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#9a7a28', fontWeight: 600, width: '70px', textAlign: 'right' }}>{eur(ch.cout)}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-header-title"><Car size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Occupation de la flotte</span></div>
          <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px 0' }}>
            {o.flotte.length === 0 ? <div style={{ padding: '30px', textAlign: 'center', color: '#63605a', fontSize: '12px' }}>Aucun véhicule affecté</div> :
              o.flotte.map((v: any, i: number) => (
                <div key={i} style={{ padding: '8px 16px', borderBottom: '1px solid #f4f5f7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#16130e' }}>{v.vehicule} <span style={{ fontSize: '9px', color: '#8a8478', fontFamily: 'JetBrains Mono,monospace' }}>{v.immatriculation}</span></span>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#5a564e' }}>{v.joursOccupes} j · {v.taux}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#f0eeeb', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, v.taux)}%`, height: '100%', background: '#9a7a28' }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ──────────── Composants ──────────── */
function Kpi({ icon, label, value, sub, color = '#16130e' }: { icon: React.ReactNode; label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0d9cd', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a7a28', marginBottom: '10px' }}>{icon}<span style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#63605a' }}>{label}</span></div>
      <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '26px', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#63605a', marginTop: '6px' }}>{sub}</div>
    </div>
  )
}

function CoutBar({ label, value, max, color, icon, bold }: { label: string; value: number; max: number; color: string; icon?: React.ReactNode; bold?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: '#5a564e', fontWeight: bold ? 700 : 400, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>{icon}{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: bold ? 700 : 600, color }}>{eur2(value)}</span>
      </div>
      <div style={{ height: '8px', background: '#f0eeeb', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: color }} /></div>
    </div>
  )
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '10px' }}>
      {items.map(([label, color]) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#5a564e' }}>
          <span style={{ width: '10px', height: '10px', background: color }} /> {label}
        </span>
      ))}
    </div>
  )
}
