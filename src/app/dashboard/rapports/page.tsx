'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { TrendingUp, Wallet, Clock, Handshake, Users, Building2, Car, FileText, Download, Percent, KeyRound, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { exportCsv } from '@/lib/exportCsv'

/* ── Tokens (charte luxe) ── */
const INK = '#16130e', INK2 = '#5a564e', MUTED = '#8a8478', LINE = '#e4e0d8'
const GOLD = '#9a7a28', GOLD_L = '#c9a84c'
const POS = '#1e5e3a', NEG = '#9e2a2a'
const C_CA = '#9a7a28', C_COUT = '#b0472c'
const C_CH = '#2166a6', C_ST = '#7a4fb0', C_LOY = '#b0472c'
const SERIF = 'Cormorant Garamond,serif', MONO = 'JetBrains Mono,monospace'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0)
const eur2 = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
const kEur = (n: number) => Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))

const PRESETS = [{ key: 'mois', label: 'Ce mois' }, { key: '12mois', label: '12 mois' }, { key: 'annee', label: 'Année' }] as const
function presetRange(key: string): { from: string; to: string } {
  const now = new Date(); const to = now.toISOString().slice(0, 10)
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
      Dossier: d.numero, Client: d.client, 'CA HT': d.ca, 'Cout direct': d.cout, 'Marge directe': d.marge,
    })))
  }

  return (
    <div style={{ paddingBottom: '30px' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: '32px', fontWeight: 500, color: INK, lineHeight: 1 }}>Rapports</div>
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px', letterSpacing: '0.3px' }}>
            {data ? `${format(parseISO(range.from), 'd MMM yyyy', { locale: fr })} — ${format(parseISO(range.to), 'd MMM yyyy', { locale: fr })} · ${data.periode.jours} jours` : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {PRESETS.map(p => {
            const active = !custom && preset === p.key
            return <button key={p.key} onClick={() => { setCustom(null); setPreset(p.key) }}
              style={{ padding: '7px 13px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', borderRadius: '999px', background: active ? INK : '#fff', border: `1.5px solid ${active ? INK : LINE}`, color: active ? '#fff' : INK2, transition: 'all .15s' }}>{p.label}</button>
          })}
          <input type="date" value={range.from} onChange={e => setCustom({ from: e.target.value, to: range.to })} style={dateInput} />
          <span style={{ color: MUTED, fontSize: '11px' }}>→</span>
          <input type="date" value={range.to} onChange={e => setCustom({ from: range.from, to: e.target.value })} style={dateInput} />
          <a href={`/api/rapports/pdf?from=${range.from}&to=${range.to}`} target="_blank" rel="noreferrer" style={ghostBtn}><FileText size={12} /> PDF</a>
          <button onClick={exportExcel} style={ghostBtn}><Download size={12} /> Excel</button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '22px', flexWrap: 'wrap', borderBottom: `1.5px solid ${LINE}` }}>
        {TABS.map(t => {
          const Icon = t.icon; const active = tab === t.key
          return <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2.5px solid ${active ? GOLD : 'transparent'}`, color: active ? INK : MUTED, marginBottom: '-1.5px', transition: 'all .15s' }}>
            <Icon size={14} /> {t.label}</button>
        })}
      </div>

      {loading ? <Skeleton /> : !data ? (
        <div style={{ padding: '80px', textAlign: 'center', color: MUTED }}>Aucune donnée sur la période</div>
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

/* ═══════════ RENTABILITÉ ═══════════ */
function TabRentabilite({ data }: { data: any }) {
  const r = data.rentabilite
  const pos = r.margeNette >= 0
  return (
    <>
      {/* Hero sombre */}
      <div style={{ background: `linear-gradient(135deg, ${INK} 0%, #241f16 100%)`, borderRadius: '16px', padding: '28px 30px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD_L})` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Marge nette</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: SERIF, fontSize: '56px', fontWeight: 500, color: '#fff', lineHeight: 0.9 }}>{eur(r.margeNette)}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', background: pos ? 'rgba(46,157,109,0.2)' : 'rgba(214,90,74,0.2)', color: pos ? '#7bd3a8' : '#e8998c', fontSize: '13px', fontWeight: 700, fontFamily: MONO }}>
                {pos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{r.tauxMarge} %
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '10px' }}>sur {eur(r.revenus)} de revenus HT</div>
          </div>
          {/* Mini-décompte vertical */}
          <div style={{ minWidth: '230px', flex: '0 0 auto' }}>
            {[['Revenus HT', r.revenus, GOLD_L, '+'], ['Paie chauffeurs', r.coutChauffeurs, '#e8998c', '−'], ['Sous-traitance', r.coutSousTraitance, '#e8998c', '−'], ['Loyers', r.coutLoyers, '#e8998c', '−']].map(([l, v, col, sg]: any) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{l}</span>
                <span style={{ fontFamily: MONO, fontSize: '12px', color: col }}>{sg} {eur(v)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Marge</span>
              <span style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 700, color: pos ? '#7bd3a8' : '#e8998c' }}>{eur(r.margeNette)}</span>
            </div>
          </div>
        </div>
      </div>

      <Panel title="Chiffre d'affaires & coûts par mois">
        <MonthlyBars data={data.serieMois} series={[{ key: 'ca', name: 'CA HT', color: C_CA }, { key: 'cout', name: 'Coûts', color: C_COUT }]} />
      </Panel>

      <Panel title="Rentabilité par dossier" note="Marge directe = CA − (paie chauffeurs + sous-traitance). Hors loyers & charges fixes.">
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ position: 'sticky', top: 0, background: '#faf9f7', zIndex: 1 }}>
              {['Dossier', 'CA HT', 'Coût', 'Marge', ''].map((h, i) => <th key={h} style={{ textAlign: i === 0 || i === 4 ? 'left' : 'right', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: MUTED, padding: '10px 14px', fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.parDossier.slice(0, 50).map((d: any) => {
                const tx = d.ca > 0 ? Math.round((d.marge / d.ca) * 100) : 0
                return (
                  <tr key={d.numero} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: '9px 14px' }}><span style={{ fontFamily: MONO, fontSize: '11px', color: GOLD, fontWeight: 600 }}>{d.numero}</span><div style={{ fontSize: '11px', color: INK2 }}>{d.client}</div></td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: MONO, fontSize: '11px' }}>{eur(d.ca)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: MONO, fontSize: '11px', color: NEG }}>{eur(d.cout)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: MONO, fontSize: '12px', fontWeight: 700, color: d.marge >= 0 ? POS : NEG }}>{eur(d.marge)}</td>
                    <td style={{ padding: '9px 14px', width: '60px' }}><MiniPct pct={tx} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}

/* ═══════════ FINANCIER ═══════════ */
function TabFinancier({ data }: { data: any }) {
  const f = data.financier
  return (
    <>
      <TileRow tiles={[
        { icon: <TrendingUp size={15} />, label: 'CA HT', value: eur(f.caHt), sub: 'prestations' },
        { icon: <Wallet size={15} />, label: 'Facturé TTC', value: eur(f.factureTtc), sub: `${f.nbFactures} facture${f.nbFactures > 1 ? 's' : ''}` },
        { icon: <Wallet size={15} />, label: 'Encaissé', value: eur(f.encaisse), sub: 'payées', color: POS },
        { icon: <Clock size={15} />, label: 'En attente', value: eur(f.enAttente), sub: 'à encaisser', color: '#7a5c10' },
        { icon: <Clock size={15} />, label: 'Impayés échus', value: eur(f.impayes), sub: 'en retard', color: NEG },
        { icon: <Percent size={15} />, label: 'TVA collectée', value: eur(f.tvaCollectee), sub: `HT ${eur(f.factureHt)}` },
      ]} />
      <Panel title="Chiffre d'affaires HT par mois">
        <MonthlyBars data={data.serieMois} series={[{ key: 'ca', name: 'CA HT', color: C_CA }]} />
      </Panel>
    </>
  )
}

/* ═══════════ COMMERCIAL ═══════════ */
function TabCommercial({ data }: { data: any }) {
  const c = data.commercial
  const maxCA = Math.max(1, ...c.topClients.map((x: any) => x.ca))
  const totalMix = c.nbMad + c.nbTransfert
  const pTr = totalMix ? Math.round((c.nbTransfert / totalMix) * 100) : 50
  const totalCanal = Math.max(1, c.caAgence + c.caDirect)
  return (
    <>
      <TileRow tiles={[
        { icon: <Building2 size={15} />, label: 'Dossiers', value: String(c.nbDossiers), sub: 'sur la période' },
        { icon: <TrendingUp size={15} />, label: 'Panier moyen', value: eur(c.panierMoyen), sub: 'CA / dossier' },
        { icon: <Building2 size={15} />, label: 'CA agences', value: eur(c.caAgence), sub: 'partenaires' },
        { icon: <Users size={15} />, label: 'CA directs', value: eur(c.caDirect), sub: 'clients directs' },
      ]} />
      <div className="detail-grid">
        <Panel title="Top clients">
          <div style={{ padding: '6px 0' }}>
            {c.topClients.length === 0 ? <Empty /> : c.topClients.map((cl: any, i: number) => (
              <div key={i} style={{ padding: '9px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '5px' }}>
                  <span style={{ fontFamily: MONO, fontSize: '11px', color: '#c2bdb4', width: '16px' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cl.nom}</span>
                  <span style={{ fontFamily: MONO, fontSize: '12px', color: GOLD, fontWeight: 700 }}>{eur(cl.ca)}</span>
                </div>
                <div style={{ height: '5px', background: '#f0eeeb', borderRadius: '3px', overflow: 'hidden', marginLeft: '28px' }}>
                  <div style={{ width: `${(cl.ca / maxCA) * 100}%`, height: '100%', background: GOLD, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <Panel title="Répartition des prestations">
            <div style={{ padding: '18px' }}>
              <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', gap: '2px' }}>
                <div style={{ width: `${pTr}%`, background: '#1e3f70' }} />
                <div style={{ width: `${100 - pTr}%`, background: '#a6432a' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '12px' }}>
                <Dot color="#1e3f70" label="Transferts" val={c.nbTransfert} />
                <Dot color="#a6432a" label="MAD" val={c.nbMad} />
              </div>
            </div>
          </Panel>
          <Panel title="Agences vs directs">
            <div style={{ padding: '18px' }}>
              <BarLine label="Agences" value={c.caAgence} max={totalCanal} color={C_ST} />
              <BarLine label="Directs" value={c.caDirect} max={totalCanal} color={C_CH} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

/* ═══════════ OPÉRATIONNEL ═══════════ */
function TabOperationnel({ data }: { data: any }) {
  const o = data.operationnel
  const maxCout = Math.max(1, ...o.activiteChauffeurs.map((x: any) => x.cout))
  return (
    <>
      <TileRow tiles={[
        { icon: <Users size={15} />, label: 'Chauffeurs actifs', value: String(o.activiteChauffeurs.length), sub: 'avec mission' },
        { icon: <Car size={15} />, label: 'Véhicules utilisés', value: String(o.flotte.length), sub: 'sur la période' },
        { icon: <Percent size={15} />, label: 'Occupation moyenne', value: `${o.tauxOccupationMoyen} %`, sub: 'jours / période' },
      ]} />
      <div className="detail-grid">
        <Panel title="Activité chauffeurs" note="Coût = rémunération (200 €/jour MAD, 50 €/transfert).">
          <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px 0' }}>
            {o.activiteChauffeurs.length === 0 ? <Empty /> : o.activiteChauffeurs.map((ch: any, i: number) => (
              <div key={i} style={{ padding: '8px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: INK }}>{ch.nom}</span>
                  <span style={{ fontFamily: MONO, fontSize: '11px', color: '#1e3f70', fontWeight: 600 }}>{ch.missions} mission{ch.missions > 1 ? 's' : ''}</span>
                  <span style={{ fontFamily: MONO, fontSize: '12px', color: GOLD, fontWeight: 700, width: '64px', textAlign: 'right' }}>{eur(ch.cout)}</span>
                </div>
                <div style={{ height: '5px', background: '#f0eeeb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(ch.cout / maxCout) * 100}%`, height: '100%', background: C_CH, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Occupation de la flotte">
          <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '10px 0' }}>
            {o.flotte.length === 0 ? <Empty /> : o.flotte.map((v: any, i: number) => (
              <div key={i} style={{ padding: '9px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color: INK }}>{v.vehicule} <span style={{ fontSize: '9px', color: MUTED, fontFamily: MONO }}>{v.immatriculation}</span></span>
                  <span style={{ fontFamily: MONO, fontSize: '11px', color: INK2 }}>{v.joursOccupes} j · {v.taux}%</span>
                </div>
                <div style={{ height: '6px', background: '#f0eeeb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, v.taux)}%`, height: '100%', background: `linear-gradient(90deg, ${GOLD}, ${GOLD_L})`, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}

/* ═══════════ Graphique mensuel (barres groupées, hover, repères) ═══════════ */
function niceMax(v: number) {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}
function MonthlyBars({ data, series }: { data: any[]; series: { key: string; name: string; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const H = 190, GUTTER = 40
  const max = niceMax(Math.max(1, ...data.flatMap((m: any) => series.map(s => m[s.key]))))
  const grid = [0, 0.25, 0.5, 0.75, 1]
  const hm = hover !== null ? data[hover] : null

  return (
    <div style={{ padding: '14px 18px 12px' }}>
      {/* Ligne d'info (survol) — évite tout tooltip flottant qui déborde */}
      <div style={{ height: '24px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px', paddingLeft: `${GUTTER}px` }}>
        {hm ? (
          <>
            <span style={{ fontSize: '11px', fontWeight: 700, color: INK, textTransform: 'capitalize', minWidth: '90px' }}>{format(parseISO(hm.mois + '-01'), 'MMMM yyyy', { locale: fr })}</span>
            {series.map(s => (
              <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: INK2 }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: s.color }} />{s.name} <b style={{ fontFamily: MONO, color: INK }}>{eur(hm[s.key])}</b>
              </span>
            ))}
            {series.length > 1 && <span style={{ fontSize: '11px', color: INK2 }}>Marge <b style={{ fontFamily: MONO, color: hm.marge >= 0 ? POS : NEG }}>{eur(hm.marge)}</b></span>}
          </>
        ) : (
          <span style={{ fontSize: '10px', color: MUTED, fontStyle: 'italic' }}>Survolez un mois pour le détail</span>
        )}
      </div>

      {/* Zone de tracé */}
      <div style={{ position: 'relative', height: `${H}px`, paddingLeft: `${GUTTER}px` }}>
        {/* Repères + axe (dans la gouttière gauche) */}
        {grid.map(g => (
          <div key={g} style={{ position: 'absolute', left: `${GUTTER}px`, right: 0, bottom: `${g * H}px`, borderTop: `1px solid ${g === 0 ? '#d8d2c8' : '#f0ede7'}`, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', left: `-${GUTTER}px`, top: '-6px', width: `${GUTTER - 6}px`, textAlign: 'right', fontSize: '8px', color: MUTED, fontFamily: MONO }}>{kEur(max * g)}</span>
          </div>
        ))}
        {/* Barres */}
        <div style={{ display: 'flex', gap: '3px', height: `${H}px`, alignItems: 'flex-end' }}>
          {data.map((m: any, i: number) => (
            <div key={m.mois} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', background: hover === i ? 'rgba(154,122,40,0.06)' : 'transparent', borderRadius: '4px', transition: 'background .12s' }}>
              {series.map(s => (
                <div key={s.key} title={`${s.name} ${eur2(m[s.key])}`}
                  style={{ width: series.length > 1 ? '38%' : '58%', maxWidth: '18px', height: `${m[s.key] > 0 ? Math.max(3, (m[s.key] / max) * H) : 0}px`, background: s.color, borderRadius: '4px 4px 0 0', transition: 'opacity .15s', opacity: hover === null || hover === i ? 1 : 0.3 }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Étiquettes des mois */}
      <div style={{ display: 'flex', gap: '3px', paddingLeft: `${GUTTER}px`, marginTop: '6px' }}>
        {data.map((m: any, i: number) => (
          <div key={m.mois} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '8px', color: hover === i ? INK : MUTED, fontWeight: hover === i ? 700 : 400, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {format(parseISO(m.mois + '-01'), 'MMM', { locale: fr })}
          </div>
        ))}
      </div>

      {series.length > 1 && (
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
          {series.map(s => <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: INK2 }}><span style={{ width: '11px', height: '11px', borderRadius: '3px', background: s.color }} /> {s.name}</span>)}
        </div>
      )}
    </div>
  )
}

/* ═══════════ Composants ═══════════ */
const dateInput: React.CSSProperties = { padding: '6px 9px', fontSize: '11px', border: `1.5px solid ${LINE}`, borderRadius: '8px', color: INK, fontFamily: 'inherit' }
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 13px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#fff', border: `1.5px solid ${LINE}`, borderRadius: '8px', color: INK2, textDecoration: 'none' }

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: '14px', marginBottom: '18px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: GOLD }}>{title}</span>
      </div>
      {children}
      {note && <div style={{ fontSize: '10px', color: MUTED, padding: '2px 18px 12px', fontStyle: 'italic' }}>{note}</div>}
    </div>
  )
}

function TileRow({ tiles }: { tiles: { icon: React.ReactNode; label: string; value: string; sub: string; color?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
      {tiles.map(t => (
        <div key={t.label} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: '14px', padding: '16px 18px', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: t.color ?? GOLD, opacity: 0.5 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: GOLD, marginBottom: '10px' }}>{t.icon}<span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: MUTED }}>{t.label}</span></div>
          <div style={{ fontFamily: SERIF, fontSize: '28px', fontWeight: 500, color: t.color ?? INK, lineHeight: 1 }}>{t.value}</div>
          <div style={{ fontSize: '10px', color: MUTED, marginTop: '6px' }}>{t.sub}</div>
        </div>
      ))}
    </div>
  )
}

function BarLine({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '11px', color: INK2 }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color }}>{eur2(value)}</span>
      </div>
      <div style={{ height: '8px', background: '#f0eeeb', borderRadius: '4px', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px' }} /></div>
    </div>
  )
}

function MiniPct({ pct }: { pct: number }) {
  const pos = pct >= 0
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', fontWeight: 700, fontFamily: MONO, color: pos ? POS : NEG }}>{pos ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(pct)}%</span>
}
function Dot({ color, label, val }: { color: string; label: string; val: number }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: color }} /> {label} <b>{val}</b></span>
}
function Empty() { return <div style={{ padding: '36px', textAlign: 'center', color: MUTED, fontSize: '12px' }}>Aucune donnée</div> }
function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
      {[0, 1, 2, 3].map(i => <div key={i} style={{ height: '96px', background: 'linear-gradient(100deg,#f4f2ee,#faf9f7,#f4f2ee)', borderRadius: '14px' }} />)}
    </div>
  )
}
