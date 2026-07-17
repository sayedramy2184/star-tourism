'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, parseISO, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, MapPin, Phone, Navigation, Clock, LogOut, Car, CalendarDays,
  CalendarClock, History, User, Lock, ShieldCheck, Briefcase, Info, Users, Plane, ArrowLeft,
  Check, Flag, Play, Building2,
} from 'lucide-react'
import DocumentsControle from './DocumentsControle'

type AppMode = 'chauffeur' | 'sous_traitant'
const AppModeContext = createContext<AppMode>('chauffeur')

// ── Design tokens ─────────────────────────────
const GOLD = '#9a7a28', DARK = '#16130e', INK = '#16130e', MUTE = '#8a8478', SUB = '#6f6a60'
const CREAM = '#ede9e2', LINE = 'rgba(22,19,14,0.08)'
const MAD = '#a6432a', MAD_SOFT = '#f8ece7', TRANS = '#1e3f70', TRANS_SOFT = '#e8eef8', GREEN = '#1e5e3a'
const R = 16, RS = 11
const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: R, border: '1px solid rgba(22,19,14,0.06)',
  boxShadow: '0 2px 14px rgba(22,19,14,0.05)', overflow: 'hidden',
}

function one(v: any) { return Array.isArray(v) ? v[0] : v }
function todayStr() { return new Date().toISOString().slice(0, 10) }
function flag(code?: string | null) {
  if (!code) return ''
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65, 0x1f1e6 + c.charCodeAt(1) - 65)
}

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'À venir',   color: '#7a5c10', bg: '#fdf3dc' },
  confirme:   { label: 'Confirmée', color: '#1e5e3a', bg: '#eaf4ee' },
  en_cours:   { label: 'En cours',  color: '#1e3f70', bg: '#e8eef8' },
  termine:    { label: 'Terminée',  color: '#8a8478', bg: '#f0eeeb' },
  annule:     { label: 'Annulée',   color: '#9e2a2a', bg: '#faeaea' },
}

function mapsHref(addr: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
}

function StatutChip({ statut }: { statut: string }) {
  const s = STATUTS[statut] ?? STATUTS.en_attente
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.4px', padding: '4px 11px', color: s.color, background: s.bg, borderRadius: '999px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function TypeTag({ kind }: { kind: 'mad' | 'transfert' }) {
  const mad = kind === 'mad'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: mad ? MAD : TRANS, background: mad ? MAD_SOFT : TRANS_SOFT, padding: '4px 10px', borderRadius: '999px' }}>
      {mad ? <Clock size={11} /> : <Navigation size={11} />} {mad ? 'Mise à disposition' : 'Transfert'}
    </span>
  )
}

function LocationRow({ label, addr, tone = 'dep' }: { label: string; addr: string; tone?: 'dep' | 'arr' }) {
  const color = tone === 'arr' ? TRANS : GOLD
  const soft = tone === 'arr' ? 'rgba(30,63,112,0.12)' : 'rgba(154,122,40,0.13)'
  return (
    <a href={mapsHref(addr)} target="_blank" rel="noreferrer"
      style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', textDecoration: 'none', padding: '10px 0' }}>
      <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
        <MapPin size={15} style={{ color }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: MUTE, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '14px', color: INK, lineHeight: 1.35, marginTop: '1px' }}>{addr}</div>
      </div>
      <span style={{ width: '34px', height: '34px', borderRadius: '999px', background: TRANS_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Navigation size={16} style={{ color: TRANS }} />
      </span>
    </a>
  )
}

// ══════════════════════════════════════════════
//  SHELL — onglets
// ══════════════════════════════════════════════

type Tab = 'jour' | 'avenir' | 'historique' | 'profil'

export default function MissionsJour({ label, mode = 'chauffeur' }: { label: string; mode?: AppMode }) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('jour')

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/chauffeur/login')
    router.refresh()
  }

  return (
    <AppModeContext.Provider value={mode}>
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: CREAM }}>
      {/* En-tête */}
      <header style={{ background: 'linear-gradient(155deg,#221b11,#16130e)', padding: 'max(env(safe-area-inset-top), 14px) 18px 15px', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
              <img src="/logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', lineHeight: 1.15 }}>{label}</div>
              <div style={{ fontSize: '9px', letterSpacing: '2.5px', color: 'rgba(212,180,110,0.75)', textTransform: 'uppercase', marginTop: '1px' }}>{mode === 'sous_traitant' ? 'Sous-traitant' : 'Espace chauffeur'}</div>
            </div>
          </div>
          <button onClick={logout} aria-label="Déconnexion"
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '9px', display: 'flex' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Contenu selon l'onglet */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
        {tab === 'jour'       && <TabJour />}
        {tab === 'avenir'     && <TabRange mode="avenir" />}
        {tab === 'historique' && <TabRange mode="historique" />}
        {tab === 'profil'     && <TabProfil />}
      </div>

      {/* Barre d'onglets fixe */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: '1px solid ' + LINE, display: 'flex', padding: '8px 8px calc(8px + env(safe-area-inset-bottom))', gap: '4px', zIndex: 30 }}>
        {([
          ['jour', 'Aujourd\'hui', <CalendarDays size={19} key="a" />],
          ['avenir', 'À venir', <CalendarClock size={19} key="b" />],
          ['historique', 'Historique', <History size={19} key="c" />],
          ['profil', 'Profil', <User size={19} key="d" />],
        ] as const).map(([v, label, icon]) => {
          const active = tab === v
          return (
            <button key={v} onClick={() => setTab(v)}
              style={{ flex: 1, background: active ? 'rgba(154,122,40,0.11)' : 'none', border: 'none', borderRadius: '12px', cursor: 'pointer', padding: '8px 4px 7px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: active ? GOLD : MUTE, transition: 'background 0.15s' }}>
              {icon}
              <span style={{ fontSize: '9px', fontWeight: active ? 700 : 500, letterSpacing: '0.2px' }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
    </AppModeContext.Provider>
  )
}

// ══════════════════════════════════════════════
//  ONGLET AUJOURD'HUI — navigation jour + saisie heures
// ══════════════════════════════════════════════

function TabJour() {
  const [date, setDate] = useState(todayStr)
  const [data, setData] = useState<{ jours: any[]; transferts: any[] } | null>(null)
  const [chauffeurInfo, setChauffeurInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chauffeur/missions?date=${d}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setData({ jours: json.data.jours, transferts: json.data.transferts })
      setChauffeurInfo(json.data.chauffeur)
    } catch (err: any) { toast.error(err.message); setData({ jours: [], transferts: [] }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(date) }, [date, load])
  function shiftDay(n: number) { setDate(format(addDays(parseISO(date), n), 'yyyy-MM-dd')) }

  const total = (data?.jours.length ?? 0) + (data?.transferts.length ?? 0)
  const dObj = parseISO(date)

  return (
    <>
      {/* Navigation jour */}
      <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid ' + LINE, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: '69px', zIndex: 15 }}>
        <button onClick={() => shiftDay(-1)} aria-label="Jour précédent"
          style={{ background: '#fff', border: '1px solid ' + LINE, borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 4px rgba(22,19,14,0.05)' }}>
          <ChevronLeft size={19} color={SUB} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '20px', fontWeight: 600, color: INK, lineHeight: 1.05, textTransform: 'capitalize' }}>
            {format(dObj, 'EEEE d MMMM', { locale: fr })}
          </div>
          <button onClick={() => setDate(todayStr())}
            style={{ background: 'none', border: 'none', fontSize: '11px', color: isToday(dObj) ? GOLD : MUTE, cursor: 'pointer', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: isToday(dObj) ? 700 : 500 }}>
            <CalendarDays size={11} /> {isToday(dObj) ? "Aujourd'hui" : "Revenir à aujourd'hui"}
          </button>
        </div>
        <button onClick={() => shiftDay(1)} aria-label="Jour suivant"
          style={{ background: '#fff', border: '1px solid ' + LINE, borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 4px rgba(22,19,14,0.05)' }}>
          <ChevronRight size={19} color={SUB} />
        </button>
      </div>

      <div style={{ flex: 1, padding: '16px 14px 20px' }}>
        {loading ? (
          <LoadingState />
        ) : total === 0 ? (
          <EmptyState icon={<CalendarDays size={34} />} text="Aucune mission ce jour" />
        ) : (
          <>
            <div style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: MUTE, marginBottom: '12px', fontWeight: 600 }}>
              {total} mission{total > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(data?.transferts ?? []).map((t: any) => <TransfertCard key={t.id} t={t} />)}
              {(data?.jours ?? []).map((j: any) => <MadCard key={j.id} j={j} onSaved={() => load(date)} />)}
            </div>
          </>
        )}
      </div>

      {chauffeurInfo && (
        <DocumentsControle jours={data?.jours ?? []} transferts={data?.transferts ?? []} chauffeur={chauffeurInfo} />
      )}
    </>
  )
}

function LoadingState() {
  return <div style={{ textAlign: 'center', padding: '70px 0', color: MUTE, fontSize: '13px' }}>Chargement…</div>
}
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '70px 20px', color: MUTE }}>
      <div style={{ width: '72px', height: '72px', borderRadius: '999px', background: '#fff', border: '1px solid ' + LINE, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#c2bdb4', boxShadow: '0 2px 12px rgba(22,19,14,0.05)' }}>{icon}</div>
      <div style={{ fontSize: '14px', color: SUB }}>{text}</div>
    </div>
  )
}

// ══════════════════════════════════════════════
//  ONGLET À VENIR / HISTORIQUE — liste groupée par jour
// ══════════════════════════════════════════════

function TabRange({ mode }: { mode: 'avenir' | 'historique' }) {
  const [items, setItems] = useState<any[] | null>(null)

  useEffect(() => {
    const from = mode === 'avenir' ? format(addDays(new Date(), 1), 'yyyy-MM-dd') : format(addDays(new Date(), -30), 'yyyy-MM-dd')
    const to   = mode === 'avenir' ? format(addDays(new Date(), 21), 'yyyy-MM-dd') : format(addDays(new Date(), -1), 'yyyy-MM-dd')
    fetch(`/api/chauffeur/missions?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(({ data }) => {
        const list = [
          ...(data?.transferts ?? []).map((t: any) => normTransfert(t)),
          ...(data?.jours ?? []).map((j: any) => normJour(j)),
        ].sort((a, b) => (a.date + (a.heure ?? '')).localeCompare(b.date + (b.heure ?? '')) * (mode === 'historique' ? -1 : 1))
        setItems(list)
      })
      .catch(() => setItems([]))
  }, [mode])

  if (items === null) return <LoadingState />
  if (items.length === 0) return (
    <EmptyState
      icon={mode === 'avenir' ? <CalendarClock size={34} /> : <History size={34} />}
      text={mode === 'avenir' ? 'Aucune mission à venir' : 'Aucune mission passée'} />
  )

  // Groupement par date
  const groups: Record<string, any[]> = {}
  for (const it of items) { (groups[it.date] ??= []).push(it) }

  return (
    <div style={{ padding: '16px 14px 20px' }}>
      {Object.entries(groups).map(([d, list]) => (
        <div key={d} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'capitalize', color: GOLD }}>
              {format(parseISO(d), 'EEEE d MMMM', { locale: fr })}
            </span>
            <span style={{ flex: 1, height: '1px', background: LINE }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {list.map(it => <MissionListItem key={it.id} it={it} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function normTransfert(t: any) {
  const dossier = one(t.dossier); const client = one(dossier?.client)
  return {
    id: t.id, kind: 'transfert' as const, raw: t, date: t.date_debut, heure: t.heure_depart?.slice(0, 5) ?? null,
    clientNom: client?.nom ?? '—', dossierNum: dossier?.numero, statut: t.statut,
    lieu: [t.adresse_depart, t.adresse_arrivee].filter(Boolean).join(' → '),
    heuresReelles: null,
  }
}
function normJour(j: any) {
  const prest = one(j.prestation); const dossier = one(prest?.dossier); const client = one(dossier?.client)
  return {
    id: j.id, kind: 'mad' as const, raw: j, date: j.date, heure: prest?.heure_debut_journee?.slice(0, 5) ?? null,
    clientNom: client?.nom ?? '—', dossierNum: dossier?.numero, statut: prest?.statut ?? 'en_attente',
    lieu: prest?.adresse_depart ?? 'Mise à disposition',
    heuresReelles: j.heures_reelles ?? null,
  }
}

function MissionListItem({ it }: { it: any }) {
  const [open, setOpen] = useState(false)
  const mad = it.kind === 'mad'
  const col = mad ? MAD : TRANS
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ textAlign: 'left', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'stretch', gap: '0', padding: 0, ...CARD }}>
        <span style={{ width: '5px', background: col, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: col }}>{mad ? 'MAD' : 'Transfert'}</span>
              {it.heure && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: INK, fontWeight: 700 }}>{it.heure}</span>}
            </span>
            <StatutChip statut={it.statut} />
          </span>
          <span style={{ display: 'block', fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', fontWeight: 600, color: INK, lineHeight: 1.1 }}>{it.clientNom}</span>
          <span style={{ display: 'block', fontSize: '12px', color: SUB, marginTop: '3px' }}>{it.lieu}</span>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            {it.dossierNum && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: GOLD }}>{it.dossierNum}</span>}
            {it.heuresReelles != null && Number(it.heuresReelles) > 0 && (
              <span style={{ fontSize: '11px', color: GREEN, fontWeight: 600 }}>{it.heuresReelles}h faites</span>
            )}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', paddingRight: '10px', color: '#c2bdb4' }}><ChevronRight size={18} /></span>
      </button>
      {open && <MissionDetail mission={it.raw} kind={it.kind} onClose={() => setOpen(false)} />}
    </>
  )
}

// ══════════════════════════════════════════════
//  ONGLET PROFIL
// ══════════════════════════════════════════════

const LANGUES_LBL: Record<string, string> = { francais: 'Français', anglais: 'Anglais', espagnol: 'Espagnol', allemand: 'Allemand', italien: 'Italien', arabe: 'Arabe', chinois: 'Chinois', russe: 'Russe' }
const COMP_LBL: Record<string, string> = { bodyguard: 'Bodyguard', guide: 'Guide', secouriste: 'Secouriste', tpmr: 'TPMR', permis_d: 'Permis D' }

function docState(dateStr: string | null) {
  if (!dateStr) return null
  const days = Math.ceil((parseISO(dateStr).getTime() - Date.now()) / 86400000)
  if (days < 0)  return { label: `Expiré le ${format(parseISO(dateStr), 'dd/MM/yyyy')}`, color: '#9e2a2a', bg: '#faeaea' }
  if (days < 30) return { label: `Expire dans ${days} j`, color: '#7a5c10', bg: '#fdf3dc' }
  return { label: `Valide → ${format(parseISO(dateStr), 'dd/MM/yyyy')}`, color: '#1e5e3a', bg: '#eaf4ee' }
}

function TabProfil() {
  const [d, setD] = useState<{ type?: string; chauffeur?: any; sousTraitant?: any; stats: any } | null>(null)

  useEffect(() => {
    fetch('/api/chauffeur/profil').then(r => r.json()).then(({ data }) => setD(data)).catch(() => setD(null))
  }, [])

  if (!d) return <LoadingState />

  // Mode sous-traitant : fiche société + stats (pas de documents personnels)
  if (d.type === 'sous_traitant') {
    const s = d.sousTraitant ?? {}
    return (
      <div style={{ padding: '18px 14px 20px' }}>
        <div style={{ ...CARD, padding: '20px 18px', marginBottom: '14px', textAlign: 'center' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '999px', margin: '0 auto 12px', background: 'linear-gradient(155deg,#221b11,#16130e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8cf92', boxShadow: '0 4px 16px rgba(22,19,14,0.22)' }}><Building2 size={28} /></div>
          <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', fontWeight: 600, color: INK, lineHeight: 1.1 }}>{s.societe}</div>
          <div style={{ fontSize: '10px', letterSpacing: '2.5px', color: MUTE, textTransform: 'uppercase', marginTop: '4px' }}>Sous-traitant</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
            {s.telephone && <a href={`tel:${s.telephone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: GREEN, textDecoration: 'none', fontWeight: 600, background: '#eaf4ee', padding: '8px 16px', borderRadius: '999px' }}><Phone size={14} /> {s.telephone}</a>}
            {s.contact_nom && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: MUTE }}><User size={13} /> {s.contact_nom}</div>}
            {s.email && <div style={{ fontSize: '12px', color: MUTE }}>{s.email}</div>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <StatCard icon={<Briefcase size={16} />} label="Missions ce mois" value={String(d.stats.missionsMois)} />
          <StatCard icon={<Clock size={16} />} label="Heures ce mois" value={`${d.stats.heuresMois} h`} />
        </div>
      </div>
    )
  }

  const c = d.chauffeur
  const docs = [
    { label: 'Carte VTC', num: c.vtc_card_numero, st: docState(c.vtc_card_expiry) },
    { label: 'Permis', num: null, st: docState(c.permis_expiry) },
    { label: 'Visite médicale', num: null, st: docState(c.visite_medicale_expiry) },
    { label: 'Carte qualification', num: null, st: docState(c.carte_qualif_expiry) },
    { label: 'Carte de séjour', num: c.carte_sejour_numero, st: docState(c.carte_sejour_expiry) },
  ].filter(x => x.num || x.st)

  const initiales = `${(c.prenom?.[0] ?? '')}${(c.nom?.[0] ?? '')}`.toUpperCase()

  return (
    <div style={{ padding: '18px 14px 20px' }}>
      {/* Carte identité avec avatar */}
      <div style={{ ...CARD, padding: '20px 18px', marginBottom: '14px', textAlign: 'center' }}>
        <div style={{ width: '68px', height: '68px', borderRadius: '999px', margin: '0 auto 12px', background: 'linear-gradient(155deg,#221b11,#16130e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8cf92', fontFamily: 'Cormorant Garamond,serif', fontSize: '26px', fontWeight: 600, boxShadow: '0 4px 16px rgba(22,19,14,0.22)' }}>
          {initiales || <User size={26} />}
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', fontWeight: 600, color: INK, lineHeight: 1.1 }}>{c.prenom} {c.nom}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
          {c.telephone && <a href={`tel:${c.telephone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: GREEN, textDecoration: 'none', fontWeight: 600, background: '#eaf4ee', padding: '8px 16px', borderRadius: '999px' }}><Phone size={14} /> {c.telephone}</a>}
          {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: MUTE }}><User size={13} /> {c.email}</div>}
        </div>
        {((c.langues?.length ?? 0) > 0 || (c.competences?.length ?? 0) > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px', justifyContent: 'center' }}>
            {(c.langues ?? []).map((l: string) => <span key={l} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 11px', borderRadius: '999px', background: '#fdf6e3', color: GOLD, border: '1px solid rgba(154,122,40,0.22)' }}>{LANGUES_LBL[l] ?? l}</span>)}
            {(c.competences ?? []).map((k: string) => <span key={k} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 11px', borderRadius: '999px', background: TRANS_SOFT, color: TRANS, border: '1px solid rgba(30,63,112,0.22)' }}>{COMP_LBL[k] ?? k}</span>)}
          </div>
        )}
      </div>

      {/* Stats du mois */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <StatCard icon={<Briefcase size={16} />} label="Missions ce mois" value={String(d.stats.missionsMois)} />
        <StatCard icon={<Clock size={16} />} label="Heures ce mois" value={`${d.stats.heuresMois} h`} />
      </div>

      {/* Documents */}
      {docs.length > 0 && (
        <div style={{ ...CARD, padding: '16px 18px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: GOLD, fontWeight: 800, marginBottom: '12px' }}>Mes documents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {docs.map(doc => (
              <div key={doc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: INK }}>{doc.label}</div>
                  {doc.num && <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: MUTE, marginTop: '1px' }}>{doc.num}</div>}
                </div>
                {doc.st && <span style={{ fontSize: '10px', fontWeight: 700, color: doc.st.color, background: doc.st.bg, padding: '4px 10px', borderRadius: '999px', textAlign: 'right', whiteSpace: 'nowrap' }}>{doc.st.label}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ ...CARD, padding: '15px 16px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(154,122,40,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '28px', fontWeight: 600, color: INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', letterSpacing: '0.4px', textTransform: 'uppercase', color: MUTE, marginTop: '4px' }}>{label}</div>
    </div>
  )
}

// ══════════════════════════════════════════════
//  CARTES (aujourd'hui)
// ══════════════════════════════════════════════

function CardHeader({ kind }: { kind: 'mad' | 'transfert' }) {
  const col = kind === 'mad' ? MAD : TRANS
  return <span style={{ display: 'block', height: '4px', background: `linear-gradient(90deg, ${col}, ${col}66)` }} />
}

function TransfertCard({ t }: { t: any }) {
  const dossier = one(t.dossier); const client = one(dossier?.client); const veh = one(t.vehicule)
  const [open, setOpen] = useState(false)
  const nbPax = (t.passager_ids?.length) || (dossier?.passagers?.length) || t.nb_passagers || 0
  return (
    <div style={CARD}>
      <CardHeader kind="transfert" />
      <div style={{ padding: '13px 15px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '9px' }}>
          <TypeTag kind="transfert" />
          <StatutChip statut={t.statut} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '20px', fontWeight: 600, color: INK, lineHeight: 1.1, minWidth: 0 }}>{client?.nom}</div>
          {t.heure_depart && <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '17px', color: TRANS, fontWeight: 700, flexShrink: 0 }}>{t.heure_depart.slice(0, 5)}</div>}
        </div>
        <MetaLine dossierNum={dossier?.numero} veh={veh} modele={t.modele_souhaite} tel={client?.telephone} />
      </div>
      {(t.vol_numero || t.vol_ville || t.vol_terminal) && <div style={{ padding: '0 15px' }}><FlightInfo m={t} /></div>}
      <div style={{ padding: '0 15px 8px' }}>
        {t.adresse_depart && <LocationRow label="Départ" addr={t.adresse_depart} tone="dep" />}
        {t.adresse_arrivee && <LocationRow label="Arrivée" addr={t.adresse_arrivee} tone="arr" />}
      </div>
      <DetailButton onClick={() => setOpen(true)} nbPax={nbPax} />
      {open && <MissionDetail mission={t} kind="transfert" onClose={() => setOpen(false)} />}
    </div>
  )
}

function DetailButton({ onClick, nbPax }: { onClick: () => void; nbPax: number }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', background: '#faf8f5', border: 'none', borderTop: '1px solid ' + LINE, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: INK }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <Info size={14} color={GOLD} /> Détails de la mission
        {nbPax > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: SUB, fontWeight: 600, background: '#fff', border: '1px solid ' + LINE, padding: '2px 8px', borderRadius: '999px' }}><Users size={11} /> {nbPax}</span>}
      </span>
      <ChevronRight size={16} color={MUTE} />
    </button>
  )
}

function MadCard({ j, onSaved }: { j: any; onSaved: () => void }) {
  const prest = one(j.prestation); const dossier = one(prest?.dossier); const client = one(dossier?.client); const veh = one(j.vehicule)
  const locked = !!dossier?.valide_at   // dossier validé par le dispatch → heures figées
  const [open, setOpen] = useState(false)
  const nbPax = (prest?.passager_ids?.length) || (dossier?.passagers?.length) || prest?.nb_passagers || 0

  return (
    <div style={CARD}>
      <CardHeader kind="mad" />
      <div style={{ padding: '13px 15px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '9px' }}>
          <TypeTag kind="mad" />
          <StatutChip statut={prest?.statut ?? 'en_attente'} />
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '20px', fontWeight: 600, color: INK, lineHeight: 1.1 }}>{client?.nom}</div>
        {(prest?.heure_debut_journee || prest?.heure_fin_journee) && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: MAD, fontWeight: 600, background: MAD_SOFT, padding: '4px 11px', borderRadius: '999px' }}>
            <Clock size={12} />
            {prest.heure_debut_journee?.slice(0, 5)} → {prest.heure_fin_journee?.slice(0, 5)}
          </div>
        )}
        <MetaLine dossierNum={dossier?.numero} veh={veh} modele={prest?.modele_souhaite} tel={client?.telephone} />
      </div>

      {prest?.adresse_depart && (
        <div style={{ padding: '0 15px 4px' }}><LocationRow label="Lieu" addr={prest.adresse_depart} tone="dep" /></div>
      )}

      <HoursEntry j={j} locked={locked} onSaved={onSaved} />
      <DetailButton onClick={() => setOpen(true)} nbPax={nbPax} />
      {open && <MissionDetail mission={j} kind="mad" onClose={() => setOpen(false)} onSaved={onSaved} />}
    </div>
  )
}

// Saisie des heures réelles (réutilisée dans la carte et le détail)
function HoursEntry({ j, locked, onSaved }: { j: any; locked: boolean; onSaved: () => void }) {
  const [debut, setDebut] = useState<string>(j.heure_debut_reelle?.slice(0, 5) ?? '')
  const [fin, setFin] = useState<string>(j.heure_fin_reelle?.slice(0, 5) ?? '')
  const [saving, setSaving] = useState(false)
  const saisi = !!(j.heure_debut_reelle && j.heure_fin_reelle)

  async function save() {
    if (!debut || !fin) return toast.error('Renseignez début et fin')
    setSaving(true)
    try {
      const res = await fetch('/api/chauffeur/heures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jour_id: j.id, heure_debut: debut, heure_fin: fin }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Heures enregistrées'); onSaved()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: locked ? '#f2f0ec' : saisi ? '#eef6f1' : '#faf8f5', borderTop: '1px solid ' + LINE, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: GOLD, fontWeight: 800 }}>Mes heures réelles</span>
        {locked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: GREEN, background: '#eaf4ee', padding: '3px 9px', borderRadius: '999px' }}><ShieldCheck size={12} /> Validé</span>}
      </div>
      {locked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono,monospace', fontSize: '16px', color: INK }}>
          <Lock size={14} color={MUTE} />
          {saisi ? `${debut} → ${fin}` : 'Non saisies'}
          {saisi && <span style={{ fontFamily: 'inherit', fontSize: '12px', color: GREEN, fontWeight: 600, marginLeft: 'auto' }}>{j.heures_reelles ?? 0}h{(j.heures_sup ?? 0) > 0 ? ` · +${j.heures_sup}h sup` : ''}</span>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="time" value={debut} onChange={e => setDebut(e.target.value)} aria-label="Heure de début"
              style={{ flex: 1, background: '#fff', border: '1px solid #c9c2b6', borderRadius: '11px', padding: '12px', fontSize: '16px', fontFamily: 'JetBrains Mono,monospace', textAlign: 'center', outline: 'none', color: INK }} />
            <span style={{ color: MUTE }}>→</span>
            <input type="time" value={fin} onChange={e => setFin(e.target.value)} aria-label="Heure de fin"
              style={{ flex: 1, background: '#fff', border: '1px solid #c9c2b6', borderRadius: '11px', padding: '12px', fontSize: '16px', fontFamily: 'JetBrains Mono,monospace', textAlign: 'center', outline: 'none', color: INK }} />
          </div>
          {saisi && (
            <div style={{ marginTop: '9px', fontSize: '12px', color: GREEN, fontWeight: 600 }}>
              {j.heures_reelles ?? 0}h réelles{(j.heures_sup ?? 0) > 0 ? ` · +${j.heures_sup}h sup` : ''}
            </div>
          )}
          <button onClick={save} disabled={saving}
            style={{ width: '100%', marginTop: '11px', background: saving ? '#4a4438' : 'linear-gradient(155deg,#221b11,#16130e)', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', cursor: 'pointer' }}>
            {saving ? 'Enregistrement…' : saisi ? 'Mettre à jour mes heures' : 'Enregistrer mes heures'}
          </button>
        </>
      )}
    </div>
  )
}

// Bloc vol / train
function FlightInfo({ m }: { m: any }) {
  return (
    <div style={{ background: TRANS_SOFT, border: '1px solid rgba(30,63,112,0.18)', borderRadius: RS, padding: '9px 12px', margin: '2px 0 8px', display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
      <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Plane size={15} style={{ color: TRANS }} />
      </span>
      {m.vol_numero && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 700, color: TRANS }}>{m.vol_numero}</span>}
      {m.vol_heure && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: INK }}>{m.vol_heure.slice(0, 5)}</span>}
      {m.vol_terminal && <span style={{ fontSize: '12px', color: SUB }}>{m.vol_terminal}</span>}
      {m.vol_ville && <span style={{ fontSize: '12px', color: SUB }}>{m.vol_arrivee ? 'de' : 'vers'} {m.vol_ville}</span>}
    </div>
  )
}

// Liste des passagers nommés
function PassagersList({ passagers, assignedIds }: { passagers: any[]; assignedIds?: string[] | null }) {
  const list = (assignedIds?.length ? passagers.filter(p => assignedIds.includes(p.id)) : passagers)
  if (!list?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {list.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 11px', background: '#faf8f5', border: '1px solid ' + LINE, borderRadius: RS }}>
          <span style={{ width: '34px', height: '34px', borderRadius: '999px', background: '#fff', border: '1px solid ' + LINE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{flag(p.nationalite) || '👤'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: INK }}>{p.nom}</div>
            {p.nb_bagages > 0 && <div style={{ fontSize: '11px', color: MUTE, marginTop: '1px' }}>🧳 {p.nb_bagages} bagage{p.nb_bagages > 1 ? 's' : ''}</div>}
          </div>
          {p.telephone && <a href={`tel:${p.telephone}`} style={{ width: '38px', height: '38px', borderRadius: '999px', background: '#eaf4ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN, flexShrink: 0 }}><Phone size={16} /></a>}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════
//  DÉTAIL MISSION (plein écran)
// ══════════════════════════════════════════════

function MissionDetail({ mission, kind, onClose, onSaved }: { mission: any; kind: 'mad' | 'transfert'; onClose: () => void; onSaved?: () => void }) {
  const isMad = kind === 'mad'
  const prest = isMad ? one(mission.prestation) : mission
  const dossier = one(prest?.dossier ?? mission.dossier)
  const client = one(dossier?.client)
  const veh = one(mission.vehicule)
  const locked = !!dossier?.valide_at
  const passagers = dossier?.passagers ?? []
  const col = isMad ? MAD : TRANS
  const notes = prest?.notes || dossier?.notes
  const nbBagages = prest?.nb_bagages ?? mission.nb_bagages ?? 0
  const dateStr = format(parseISO(isMad ? mission.date : mission.date_debut), 'EEE d MMM yyyy', { locale: fr })
  const heureStr = isMad
    ? (prest?.heure_debut_journee ? `${prest.heure_debut_journee.slice(0, 5)} → ${prest.heure_fin_journee?.slice(0, 5) ?? ''}` : null)
    : (mission.heure_depart?.slice(0, 5) ?? null)

  const mode = useContext(AppModeContext)
  const stChauffeurNom = prest?.st_chauffeur_nom || mission.st_chauffeur_nom
  const stChauffeurTel = prest?.st_chauffeur_telephone || mission.st_chauffeur_telephone
  const prestationId = prest?.id
  const [statut, setStatut] = useState<string>(isMad ? (prest?.statut ?? 'en_attente') : mission.statut)
  const [savingStatut, setSavingStatut] = useState(false)

  async function changeStatut(next: string) {
    if (!prestationId) return
    setSavingStatut(true)
    try {
      const res = await fetch('/api/chauffeur/statut', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestation_id: prestationId, statut: next }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setStatut(next); toast.success('Statut mis à jour'); onSaved?.()
    } catch (err: any) { toast.error(err.message) }
    finally { setSavingStatut(false) }
  }

  const STATUT_ACTIONS = [
    { val: 'confirme', label: 'Accepter', icon: <Check size={16} /> },
    { val: 'en_cours', label: 'Démarrer', icon: <Play size={16} /> },
    { val: 'termine',  label: 'Terminer', icon: <Flag size={16} /> },
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: CREAM, zIndex: 60, display: 'flex', flexDirection: 'column' }}>
      {/* En-tête riche */}
      <div style={{ background: 'linear-gradient(160deg,#241d12 0%,#16130e 100%)', padding: 'max(env(safe-area-inset-top), 12px) 18px 20px', position: 'sticky', top: 0, borderBottom: `3px solid ${col}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', display: 'flex', padding: '9px' }}><ArrowLeft size={19} /></button>
          <StatutChip statut={statut} />
        </div>
        <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: isMad ? '#e0a58f' : '#9fbde8', fontWeight: 800, marginBottom: '4px' }}>{isMad ? 'Mise à disposition' : 'Transfert'}</div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '27px', fontWeight: 600, color: '#fff', lineHeight: 1.1 }}>{client?.nom ?? '—'}</div>
        {/* réf. StatutChip dynamique via l'état local */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '13px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#e8e2d6', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '999px', textTransform: 'capitalize' }}>
            <CalendarDays size={13} style={{ color: '#c9a457' }} /> {dateStr}
          </span>
          {heureStr && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'JetBrains Mono,monospace', color: '#fff', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '999px' }}>
              <Clock size={13} style={{ color: '#c9a457' }} /> {heureStr}
            </span>
          )}
          {dossier?.numero && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'JetBrains Mono,monospace', color: '#c9a457', background: 'rgba(201,164,87,0.12)', padding: '6px 12px', borderRadius: '999px' }}>
              {dossier.numero}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px calc(28px + env(safe-area-inset-bottom))' }}>
        {/* Statut — actions rapides (sous-traitant) */}
        {mode === 'sous_traitant' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {STATUT_ACTIONS.map(a => {
              const active = statut === a.val
              return (
                <button key={a.val} onClick={() => changeStatut(a.val)} disabled={savingStatut}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '13px 4px', borderRadius: RS, cursor: 'pointer',
                    border: active ? `1.5px solid ${GOLD}` : '1px solid ' + LINE,
                    background: active ? 'rgba(154,122,40,0.12)' : '#fff',
                    color: active ? GOLD : SUB, fontWeight: 700, fontSize: '12px' }}>
                  {a.icon}{a.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Appel client — action rapide */}
        {client?.telephone && (
          <a href={`tel:${client.telephone}`}
            style={{ display: 'flex', alignItems: 'center', gap: '11px', textDecoration: 'none', ...CARD, padding: '14px 16px', marginBottom: '16px' }}>
            <span style={{ width: '42px', height: '42px', borderRadius: '999px', background: '#eaf4ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN, flexShrink: 0 }}><Phone size={19} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: INK }}>Appeler le client</span>
              <span style={{ display: 'block', fontSize: '12px', color: SUB, fontFamily: 'JetBrains Mono,monospace' }}>{client.telephone}</span>
            </span>
            <ChevronRight size={18} color={MUTE} />
          </a>
        )}

        {/* Infos clés */}
        <Section title="Informations" icon={<Info size={13} />}>
          <InfoRow label="Véhicule" value={veh ? `${veh.marque} ${veh.modele} · ${veh.immatriculation}` : (isMad ? prest?.modele_souhaite : mission.modele_souhaite) ?? '—'} />
          {isMad
            ? <InfoRow label="Horaires prévus" value={heureStr ?? '—'} mono />
            : <InfoRow label="Heure de départ" value={mission.heure_depart?.slice(0, 5) ?? '—'} mono />}
          {stChauffeurNom && <InfoRow label="Chauffeur affecté" value={stChauffeurNom} />}
          {stChauffeurTel && <InfoRow label="Tél. chauffeur" value={stChauffeurTel} mono />}
          <InfoRow label="Dossier" value={dossier?.numero} mono last />
        </Section>

        {/* Vol / train */}
        {(mission.vol_numero || mission.vol_ville || mission.vol_terminal) && (
          <Section title="Vol / Train" icon={<Plane size={13} />}><FlightInfo m={mission} /></Section>
        )}

        {/* Itinéraire */}
        <Section title="Itinéraire" icon={<MapPin size={13} />}>
          {isMad
            ? (prest?.adresse_depart ? <LocationRow label="Lieu" addr={prest.adresse_depart} tone="dep" /> : <Empty>Mise à disposition</Empty>)
            : <>
                {mission.adresse_depart && <LocationRow label="Départ" addr={mission.adresse_depart} tone="dep" />}
                {mission.adresse_arrivee && <LocationRow label="Arrivée" addr={mission.adresse_arrivee} tone="arr" />}
              </>}
        </Section>

        {/* Passagers */}
        <Section title={`Passagers${nbBagages ? ` · 🧳 ${nbBagages}` : ''}`} icon={<Users size={13} />}>
          {passagers.length > 0
            ? <PassagersList passagers={passagers} assignedIds={isMad ? prest?.passager_ids : mission.passager_ids} />
            : <Empty>{(isMad ? prest?.nb_passagers : mission.nb_passagers) || 1} passager(s) — non nommés</Empty>}
        </Section>

        {/* Notes */}
        {notes && (
          <Section title="Instructions" icon={<Info size={13} />}>
            <div style={{ fontSize: '13px', color: SUB, lineHeight: 1.6, fontStyle: 'italic', background: '#fdf9ef', border: '1px solid rgba(154,122,40,0.2)', borderLeft: `3px solid ${GOLD}`, borderRadius: RS, padding: '11px 13px' }}>{notes}</div>
          </Section>
        )}

        {/* Heures (MAD) */}
        {isMad && (
          <Section title="Heures réelles" icon={<Clock size={13} />} flush>
            <HoursEntry j={mission} locked={locked} onSaved={() => onSaved?.()} />
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, children, flush }: { title: string; icon?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: GOLD, marginBottom: '9px', paddingLeft: '2px' }}>
        {icon}{title}
      </div>
      <div style={{ ...CARD, padding: flush ? 0 : '13px 15px' }}>{children}</div>
    </div>
  )
}
function InfoRow({ label, value, mono, cap, last }: { label: string; value?: string | null; mono?: boolean; cap?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: last ? 'none' : '1px solid ' + LINE }}>
      <span style={{ fontSize: '11px', color: MUTE, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: INK, textAlign: 'right', fontFamily: mono ? 'JetBrains Mono,monospace' : 'inherit', textTransform: cap ? 'capitalize' : 'none' }}>{value ?? '—'}</span>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', color: MUTE, fontStyle: 'italic' }}>{children}</div>
}

function MetaLine({ dossierNum, veh, modele, tel }: { dossierNum?: string; veh?: any; modele?: string | null; tel?: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
      {dossierNum && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: GOLD }}>{dossierNum}</span>}
      {(veh || modele) && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: SUB }}>
          <Car size={12} style={{ color: MUTE }} />
          {veh ? `${veh.marque} ${veh.modele}` : modele}
        </span>
      )}
      {tel && (
        <a href={`tel:${tel}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: GREEN, textDecoration: 'none', fontWeight: 700, background: '#eaf4ee', padding: '4px 10px', borderRadius: '999px' }}>
          <Phone size={11} /> Appeler
        </a>
      )}
    </div>
  )
}
