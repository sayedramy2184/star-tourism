'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { calcStatutClient, STATUT_MAP, type PrestationStatut } from '@/lib/statut'
import FlightBlock from '@/components/dossiers/FlightBlock'
import { flag } from '@/components/dossiers/PassagersDossier'
import { useSearchPaginate } from '@/lib/useSearchPaginate'
import { SearchBar, Pager } from '@/components/ui/ListControls'
import { UserX, CalendarClock, PlayCircle, Receipt, Coins } from 'lucide-react'

function one(v: any) { return Array.isArray(v) ? v[0] : v }
function eur(n: number) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0) }

const STATUT_ORDER: PrestationStatut[] = ['en_attente', 'confirme', 'en_cours', 'termine', 'annule']

function effectif(m: any): PrestationStatut {
  return calcStatutClient({
    statut: m.statut, type: m.type, date_debut: m.date_debut, date_fin: m.date_fin,
    heure_depart: m.heure_depart, heure_debut_journee: m.heure_debut_journee, heure_fin_journee: m.heure_fin_journee,
  }) as PrestationStatut
}
function aAffecter(m: any): boolean {
  if (m.type === 'transfert') return !m.chauffeur_id && !m.sous_traitant_id
  const jours = m.jours ?? []
  if (jours.length === 0) return true
  return jours.some((j: any) => !j.chauffeur_id && !j.sous_traitant_id)
}

export default function DispatchPage() {
  const router = useRouter()
  const today = new Date()
  const [from, setFrom] = useState(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [missions, setMissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statutFiltre, setStatutFiltre] = useState<string>('toutes')

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dispatch?from=${f}&to=${t}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setMissions(json.data)
    } catch (err: any) { toast.error(err.message); setMissions([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(from, to) }, [from, to, load])

  // Compteurs pipeline + KPI (sur statut effectif)
  const counts: Record<string, number> = { en_attente: 0, confirme: 0, en_cours: 0, termine: 0, annule: 0 }
  let nbAffecter = 0, caPeriode = 0
  for (const m of missions) {
    counts[effectif(m)] = (counts[effectif(m)] ?? 0) + 1
    if (aAffecter(m) && effectif(m) !== 'annule' && effectif(m) !== 'termine') nbAffecter++
    if (effectif(m) !== 'annule') caPeriode += m.montant_ht ?? 0
  }
  const enCours = counts.en_cours
  const aFacturer = counts.termine

  // Filtre statut + recherche
  const parStatut = statutFiltre === 'toutes' ? missions : missions.filter(m => effectif(m) === statutFiltre)
  const sp = useSearchPaginate(parStatut, (m: any) => {
    const d = one(m.dossier); const c = one(d?.client)
    return `${d?.numero ?? ''} ${c?.nom ?? ''} ${m.adresse_depart ?? ''} ${m.adresse_arrivee ?? ''} ${m.vol_numero ?? ''}`
  }, 25)

  return (
    <div>
      {/* En-tête + période */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <span className="section-title">Dispatch</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} />
          <span style={{ color: '#8a8478' }}>→</span>
          <input type="date" className="input" value={to} min={from} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
          <Link href="/dashboard/dossiers/nouveau" className="btn-primary" style={{ textDecoration: 'none' }}>+ Dossier</Link>
        </div>
      </div>

      {/* Pipeline de statuts (compteurs) */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
        <PipeChip label="Toutes" count={missions.length} active={statutFiltre === 'toutes'} color="#16130e" onClick={() => setStatutFiltre('toutes')} />
        {STATUT_ORDER.map(s => {
          const si = STATUT_MAP[s]
          return <PipeChip key={s} label={si.label} count={counts[s] ?? 0} active={statutFiltre === s} color={si.color} onClick={() => setStatutFiltre(statutFiltre === s ? 'toutes' : s)} />
        })}
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <Kpi icon={<CalendarClock size={15} />} label="Missions" value={String(missions.length)} />
        <Kpi icon={<UserX size={15} />} label="À affecter" value={String(nbAffecter)} color={nbAffecter > 0 ? '#9e2a2a' : '#1e5e3a'} />
        <Kpi icon={<PlayCircle size={15} />} label="En cours" value={String(enCours)} color="#1e3f70" />
        <Kpi icon={<Receipt size={15} />} label="À facturer" value={String(aFacturer)} color="#7a5c10" />
        <Kpi icon={<Coins size={15} />} label="CA période HT" value={eur(caPeriode)} color="#9a7a28" />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <SearchBar value={sp.query} onChange={sp.setQuery} placeholder="Rechercher mission, client, adresse, vol…" />
      </div>

      {/* Liste mobile (cartes) */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Chargement…</div>
        ) : sp.total === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Aucune mission sur cette période</div>
        ) : sp.pageItems.map((m: any) => <MissionCard key={m.id} m={m} onOpen={() => router.push(`/dashboard/dossiers/${one(m.dossier)?.id}`)} />)}
      </div>

      {/* Tableau missions (desktop) */}
      <div className="table-container hidden md:block">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead className="table-head">
            <tr>{['Mission', 'Type', 'Date · Heure', 'Client', 'Itinéraire', 'Véhicule', 'Chauffeur / Partenaire', 'Statut'].map((h, i) => (
              <th key={i} className="th" style={i % 2 === 1 ? { background: 'rgba(0,0,0,0.1)' } : {}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="td" style={{ textAlign: 'center', padding: '50px', color: '#8a8478' }}>Chargement…</td></tr>
            ) : sp.total === 0 ? (
              <tr><td colSpan={8} className="td" style={{ textAlign: 'center', padding: '60px', color: '#8a8478' }}>Aucune mission sur cette période</td></tr>
            ) : sp.pageItems.map((m: any) => <MissionRow key={m.id} m={m} onOpen={() => router.push(`/dashboard/dossiers/${one(m.dossier)?.id}`)} />)}
          </tbody>
        </table>
      </div>
      <Pager page={sp.page} pageCount={sp.pageCount} total={sp.total} onPage={sp.setPage} />
    </div>
  )
}

function MissionRow({ m, onOpen }: { m: any; onOpen: () => void }) {
  const dossier = one(m.dossier); const client = one(dossier?.client)
  const veh = one(m.vehicule); const ch = one(m.chauffeur); const st = one(m.sous_traitant)
  const isMad = m.type === 'mad'
  const eff = effectif(m); const si = STATUT_MAP[eff]
  const typeCol = isMad ? '#7a5c10' : '#1e3f70'
  const heure = isMad ? m.heure_debut_journee : m.heure_depart

  // Chauffeur / partenaire
  let affLabel: React.ReactNode
  if (st) affLabel = <><span style={{ color: '#4a2a6e', fontWeight: 700 }}>ST · {st.societe}</span>{m.st_chauffeur_nom ? <div style={{ fontSize: '10px', color: '#5a564e' }}>{m.st_chauffeur_nom}</div> : null}</>
  else if (isMad) {
    const jours = m.jours ?? []; const aff = jours.filter((j: any) => j.chauffeur_id || j.sous_traitant_id).length
    affLabel = <span style={{ color: aff === jours.length && jours.length > 0 ? '#1e5e3a' : '#7a5c10' }}>MAD · {aff}/{jours.length} affectés</span>
  }
  else if (ch) affLabel = <><span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: '#8a8478' }}>INTERNE</span><div style={{ fontWeight: 600 }}>{ch.prenom} {ch.nom}</div></>
  else affLabel = <span style={{ color: '#9e2a2a', fontWeight: 600 }}>⚠ À affecter</span>

  return (
    <tr className="tr-body" onClick={onOpen}>
      <td className="td" style={{ background: 'rgba(154,122,40,0.04)', whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9a7a28' }}>{dossier?.numero}</span>
      </td>
      <td className="td">
        <span style={{ display: 'inline-block', width: '4px', height: '20px', background: typeCol, verticalAlign: 'middle', marginRight: '6px' }} />
        <span style={{ fontSize: '10px', fontWeight: 700, color: typeCol }}>{isMad ? 'MAD' : 'TRANSF'}</span>
      </td>
      <td className="td" style={{ whiteSpace: 'nowrap' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px' }}>{format(parseISO(m.date_debut), 'dd/MM', { locale: fr })}</div>
        {heure && <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#16130e', fontWeight: 600 }}>{heure.slice(0, 5)}</div>}
      </td>
      <td className="td">
        <div>{client?.nom ?? '—'}</div>
        {(() => {
          const dPax = dossier?.passagers ?? []
          const assigned = (m.passager_ids?.length ? dPax.filter((p: any) => m.passager_ids.includes(p.id)) : dPax)
          if (assigned.length > 0) return (
            <div style={{ fontSize: '11px', color: '#16130e', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
              {assigned.slice(0, 3).map((p: any) => `${flag(p.nationalite)} ${p.nom}`).join(' · ')}{assigned.length > 3 ? ` +${assigned.length - 3}` : ''}
            </div>
          )
          return <div style={{ fontSize: '10px', color: '#8a8478', marginTop: '2px' }}>👤 {m.nb_passagers ?? 1}{(m.nb_bagages ?? 0) > 0 ? ` · 🧳 ${m.nb_bagages}` : ''}</div>
        })()}
      </td>
      <td className="td" style={{ maxWidth: '300px' }}>
        {isMad ? (
          <span style={{ fontSize: '12px', color: '#5a564e' }}>{m.adresse_depart ?? 'Mise à disposition'}</span>
        ) : (
          <div style={{ fontSize: '12px', color: '#16130e' }}>
            {m.adresse_depart ?? '—'} <span style={{ color: '#9a7a28' }}>→</span> {m.adresse_arrivee ?? '—'}
          </div>
        )}
        {(m.vol_numero || m.vol_ville || m.vol_terminal) && (
          <FlightBlock numero={m.vol_numero} heure={m.vol_heure} ville={m.vol_ville} terminal={m.vol_terminal} arrivee={m.vol_arrivee} compact />
        )}
      </td>
      <td className="td" style={{ whiteSpace: 'nowrap' }}>
        {veh ? <div style={{ fontSize: '11px', fontWeight: 600 }}>{veh.marque} {veh.modele}</div> : m.st_vehicule_marque ? <div style={{ fontSize: '11px', color: '#4a2a6e' }}>{m.st_vehicule_marque}</div> : m.modele_souhaite ? <span style={{ fontSize: '11px', color: '#8a8478' }}>{m.modele_souhaite}</span> : <span style={{ color: '#c2bdb4' }}>—</span>}
      </td>
      <td className="td" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{affLabel}</td>
      <td className="td">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, padding: '3px 9px', color: si.color, background: si.bg, border: `1px solid ${si.border}` }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: si.dot, animation: eff === 'en_cours' ? 'blink 1.6s infinite' : 'none' }} />
          {si.label}
        </span>
      </td>
    </tr>
  )
}

function MissionCard({ m, onOpen }: { m: any; onOpen: () => void }) {
  const dossier = one(m.dossier); const client = one(dossier?.client)
  const veh = one(m.vehicule); const ch = one(m.chauffeur); const st = one(m.sous_traitant)
  const isMad = m.type === 'mad'
  const eff = effectif(m); const si = STATUT_MAP[eff]
  const typeCol = isMad ? '#7a5c10' : '#1e3f70'
  const heure = isMad ? m.heure_debut_journee : m.heure_depart

  let aff: React.ReactNode
  if (st) aff = <span style={{ color: '#4a2a6e', fontWeight: 700 }}>ST · {st.societe}{m.st_chauffeur_nom ? ` · ${m.st_chauffeur_nom}` : ''}</span>
  else if (isMad) { const j = m.jours ?? []; const a = j.filter((x: any) => x.chauffeur_id || x.sous_traitant_id).length; aff = <span style={{ color: a === j.length && j.length > 0 ? '#1e5e3a' : '#7a5c10' }}>{a}/{j.length} affectés</span> }
  else if (ch) aff = <span style={{ fontWeight: 600 }}>{ch.prenom} {ch.nom}</span>
  else aff = <span style={{ color: '#9e2a2a', fontWeight: 600 }}>⚠ À affecter</span>

  return (
    <div onClick={onOpen} style={{ background: '#fff', border: '1.5px solid #b8b0a4', borderLeft: `3px solid ${typeCol}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: '1px solid #ede9e2', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: typeCol }}>{isMad ? 'MAD' : 'TRANSF'}</span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9a7a28' }}>{dossier?.numero}</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, padding: '2px 8px', color: si.color, background: si.bg, border: `1px solid ${si.border}`, flexShrink: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: si.dot }} />{si.label}
        </span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontWeight: 600, color: '#16130e', fontSize: '14px', minWidth: 0 }}>{client?.nom ?? '—'}</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#16130e', fontWeight: 600, flexShrink: 0 }}>
            {format(parseISO(m.date_debut), 'dd/MM', { locale: fr })}{heure ? ` · ${heure.slice(0, 5)}` : ''}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#5a564e', marginTop: '4px' }}>
          {isMad ? (m.adresse_depart ?? 'Mise à disposition') : `${m.adresse_depart ?? '—'} → ${m.adresse_arrivee ?? '—'}`}
        </div>
        {(m.vol_numero || m.vol_ville || m.vol_terminal) && (
          <FlightBlock numero={m.vol_numero} heure={m.vol_heure} ville={m.vol_ville} terminal={m.vol_terminal} arrivee={m.vol_arrivee} compact />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '8px', fontSize: '11px', color: '#5a564e', flexWrap: 'wrap' }}>
          <span>{veh ? `${veh.marque} ${veh.modele}` : m.st_vehicule_marque ? m.st_vehicule_marque : m.modele_souhaite ? m.modele_souhaite : '—'}</span>
          <span>{aff}</span>
        </div>
      </div>
    </div>
  )
}

function PipeChip({ label, count, active, color, onClick }: { label: string; count: number; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', cursor: 'pointer', flexShrink: 0,
      background: active ? color : '#fff', border: `1.5px solid ${active ? color : '#d8d2c8'}`,
      color: active ? '#fff' : '#5a564e', transition: 'all .14s',
    }}>
      <span style={{ fontSize: '11px', fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: 700, minWidth: '18px', height: '18px', borderRadius: '9px', padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(255,255,255,0.2)' : color, color: '#fff' }}>{count}</span>
    </button>
  )
}

function Kpi({ icon, label, value, color = '#16130e' }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0d9cd', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a7a28', marginBottom: '6px' }}>
        {icon}<span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8478' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color, lineHeight: 1 }}>{value}</div>
    </div>
  )
}
