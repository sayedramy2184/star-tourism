'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { TrendingUp, Wallet, Clock, Handshake, Users, Building2 } from 'lucide-react'

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0)
}
function eur2(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

const PRESETS = [
  { key: 'annee', label: 'Cette année' },
  { key: '12mois', label: '12 derniers mois' },
  { key: 'mois', label: 'Ce mois' },
] as const

function presetRange(key: string): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (key === 'mois') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to }
  }
  if (key === '12mois') {
    const d = new Date(now); d.setMonth(d.getMonth() - 11); d.setDate(1)
    return { from: d.toISOString().slice(0, 10), to }
  }
  return { from: `${now.getFullYear()}-01-01`, to }
}

export default function RapportsPage() {
  const [preset, setPreset] = useState('annee')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (key: string) => {
    setLoading(true)
    const { from, to } = presetRange(key)
    try {
      const res = await fetch(`/api/rapports?from=${from}&to=${to}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setData(json.data)
    } catch (err: any) {
      toast.error(err.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(preset) }, [preset, load])

  const maxMois = data ? Math.max(1, ...data.serieMois.map((m: any) => m.ca)) : 1

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <span className="section-title">Rapports & analytics</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: preset === p.key ? '#16130e' : '#fff', border: `1.5px solid ${preset === p.key ? '#16130e' : '#d8d2c8'}`, color: preset === p.key ? '#fff' : '#5a564e' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#8a8478' }}>Chargement…</div>
      ) : !data ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#8a8478' }}>Aucune donnée</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <Kpi icon={<TrendingUp size={16} />} label="CA dossiers HT" value={eur(data.dossiers.caHt)} sub={`${data.dossiers.nb} dossier${data.dossiers.nb > 1 ? 's' : ''}`} />
            <Kpi icon={<Wallet size={16} />} label="Facturé TTC" value={eur(data.revenus.factureTtc)} sub="hors annulées" />
            <Kpi icon={<Wallet size={16} />} label="Encaissé" value={eur(data.revenus.encaisse)} sub="factures payées" color="#1e5e3a" />
            <Kpi icon={<Clock size={16} />} label="En attente" value={eur(data.revenus.enAttente)} sub="à encaisser" color="#7a5c10" />
            <Kpi icon={<Handshake size={16} />} label="Marge sous-traitance" value={eur(data.sousTraitance.marge)} sub={`${data.sousTraitance.nb} prestation${data.sousTraitance.nb > 1 ? 's' : ''} · coût ${eur(data.sousTraitance.cout)}`} color={data.sousTraitance.marge >= 0 ? '#1e5e3a' : '#9e2a2a'} />
          </div>

          {/* CA par mois */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><span className="card-header-title">Chiffre d'affaires par mois (HT)</span></div>
            <div style={{ padding: '20px 16px 12px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', minHeight: '160px', minWidth: `${data.serieMois.length * 34}px` }}>
                {data.serieMois.map((m: any) => (
                  <div key={m.mois} style={{ flex: 1, minWidth: '26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontSize: '8px', color: '#8a8478', fontFamily: 'JetBrains Mono,monospace' }}>{m.ca > 0 ? Math.round(m.ca / 1000) + 'k' : ''}</div>
                    <div title={eur2(m.ca)}
                      style={{ width: '100%', height: `${Math.round((m.ca / maxMois) * 130)}px`, minHeight: m.ca > 0 ? '3px' : '0', background: 'linear-gradient(to top, #9a7a28, #c9a84c)', transition: 'height .2s' }} />
                    <div style={{ fontSize: '8px', color: '#5a564e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {format(parseISO(m.mois + '-01'), 'MMM', { locale: fr })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="detail-grid">
            {/* Colonne gauche */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Top clients */}
              <div className="card">
                <div className="card-header"><span className="card-header-title"><Building2 size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Top clients</span></div>
                <div style={{ padding: '4px 0' }}>
                  {data.topClients.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Aucun dossier sur la période</div>
                  ) : data.topClients.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px', borderBottom: '1px solid #ede9e2' }}>
                      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#c2bdb4', width: '18px' }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#16130e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
                        <div style={{ fontSize: '10px', color: '#8a8478' }}>{c.dossiers} dossier{c.dossiers > 1 ? 's' : ''}</div>
                      </div>
                      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#9a7a28', fontWeight: 600 }}>{eur(c.ca)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Colonne droite */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Répartition prestations */}
              <div className="card">
                <div className="card-header"><span className="card-header-title">Répartition des prestations</span></div>
                <div style={{ padding: '16px' }}>
                  <Repartition mad={data.prestations.nbMad} transfert={data.prestations.nbTransfert} />
                </div>
              </div>

              {/* Activité chauffeurs */}
              <div className="card">
                <div className="card-header"><span className="card-header-title"><Users size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />Activité chauffeurs</span></div>
                <div style={{ padding: '4px 0' }}>
                  {data.activiteChauffeurs.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Aucune mission affectée</div>
                  ) : data.activiteChauffeurs.slice(0, 10).map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderBottom: '1px solid #ede9e2' }}>
                      <span style={{ fontSize: '13px', color: '#16130e', flex: 1 }}>{c.nom}</span>
                      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#1e3f70', fontWeight: 600 }}>{c.missions}</span>
                      <span style={{ fontSize: '10px', color: '#8a8478' }}>mission{c.missions > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, sub, color = '#16130e' }: { icon: React.ReactNode; label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0d9cd', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a7a28', marginBottom: '10px' }}>
        {icon}
        <span style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#8a8478' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '26px', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#8a8478', marginTop: '6px' }}>{sub}</div>
    </div>
  )
}

function Repartition({ mad, transfert }: { mad: number; transfert: number }) {
  const total = mad + transfert
  const pMad = total ? Math.round((mad / total) * 100) : 0
  const pTr = 100 - pMad
  return (
    <div>
      <div style={{ display: 'flex', height: '14px', overflow: 'hidden', border: '1px solid #d8d2c8', marginBottom: '12px' }}>
        <div style={{ width: `${total ? pTr : 50}%`, background: '#1e3f70' }} />
        <div style={{ width: `${total ? pMad : 50}%`, background: '#a6432a' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#1e3f70' }} /> Transferts <b>{transfert}</b> <span style={{ color: '#8a8478' }}>({pTr}%)</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#a6432a' }} /> MAD <b>{mad}</b> <span style={{ color: '#8a8478' }}>({pMad}%)</span>
        </span>
      </div>
    </div>
  )
}
