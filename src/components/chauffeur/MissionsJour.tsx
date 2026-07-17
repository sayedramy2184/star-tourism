'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, parseISO, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, MapPin, Phone, Navigation, Clock, LogOut, Car, CalendarDays,
  CalendarClock, History, User, Lock, ShieldCheck, Briefcase, Info, Users, Plane, ArrowLeft,
} from 'lucide-react'
import DocumentsControle from './DocumentsControle'

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
    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', padding: '3px 9px', color: s.color, background: s.bg, borderRadius: '2px' }}>
      {s.label}
    </span>
  )
}

function AddressRow({ label, addr }: { label: string; addr: string }) {
  return (
    <a href={mapsHref(addr)} target="_blank" rel="noreferrer"
      style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', textDecoration: 'none', padding: '8px 0', borderTop: '1px solid #e6e0d6' }}>
      <MapPin size={15} style={{ color: '#9a7a28', flexShrink: 0, marginTop: '1px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8478' }}>{label}</div>
        <div style={{ fontSize: '14px', color: '#16130e', lineHeight: 1.35 }}>{addr}</div>
      </div>
      <Navigation size={16} style={{ color: '#1e3f70', flexShrink: 0, marginTop: '2px' }} />
    </a>
  )
}

// ══════════════════════════════════════════════
//  SHELL — onglets
// ══════════════════════════════════════════════

type Tab = 'jour' | 'avenir' | 'historique' | 'profil'

export default function MissionsJour({ chauffeurNom }: { chauffeurNom: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('jour')

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/chauffeur/login')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#ede9e2' }}>
      {/* En-tête */}
      <header style={{ background: '#16130e', padding: 'max(env(safe-area-inset-top), 14px) 18px 14px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div style={{ width: '38px', height: '38px', background: '#fff', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', flexShrink: 0 }}>
              <img src="/logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', lineHeight: 1.1 }}>{chauffeurNom}</div>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Espace chauffeur</div>
            </div>
          </div>
          <button onClick={logout} aria-label="Déconnexion"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '6px' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Contenu selon l'onglet */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
        {tab === 'jour'       && <TabJour />}
        {tab === 'avenir'     && <TabRange mode="avenir" />}
        {tab === 'historique' && <TabRange mode="historique" />}
        {tab === 'profil'     && <TabProfil />}
      </div>

      {/* Barre d'onglets fixe */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1.5px solid #d8d2c8', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 30 }}>
        {([
          ['jour', 'Aujourd\'hui', <CalendarDays size={19} key="a" />],
          ['avenir', 'À venir', <CalendarClock size={19} key="b" />],
          ['historique', 'Historique', <History size={19} key="c" />],
          ['profil', 'Profil', <User size={19} key="d" />],
        ] as const).map(([v, label, icon]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '9px 4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: tab === v ? '#9a7a28' : '#8a8478' }}>
            {icon}
            <span style={{ fontSize: '9px', fontWeight: tab === v ? 700 : 500, letterSpacing: '0.3px' }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
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
      <div style={{ background: '#fff', borderBottom: '1.5px solid #d8d2c8', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: '62px', zIndex: 15 }}>
        <button onClick={() => shiftDay(-1)} aria-label="Jour précédent"
          style={{ background: '#f5f2ed', border: '1.5px solid #d8d2c8', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={18} color="#5a564e" />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', color: '#16130e', lineHeight: 1.1, textTransform: 'capitalize' }}>
            {format(dObj, 'EEEE d MMMM', { locale: fr })}
          </div>
          <button onClick={() => setDate(todayStr())}
            style={{ background: 'none', border: 'none', fontSize: '11px', color: isToday(dObj) ? '#9a7a28' : '#8a8478', cursor: 'pointer', marginTop: '1px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CalendarDays size={11} /> {isToday(dObj) ? "Aujourd'hui" : "Revenir à aujourd'hui"}
          </button>
        </div>
        <button onClick={() => shiftDay(1)} aria-label="Jour suivant"
          style={{ background: '#f5f2ed', border: '1.5px solid #d8d2c8', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronRight size={18} color="#5a564e" />
        </button>
      </div>

      <div style={{ flex: 1, padding: '14px 12px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8478', fontSize: '13px' }}>Chargement…</div>
        ) : total === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 20px', color: '#8a8478' }}>
            <CalendarDays size={30} style={{ color: '#c2bdb4', marginBottom: '12px' }} />
            <div style={{ fontSize: '14px', color: '#5a564e' }}>Aucune mission ce jour</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#8a8478', marginBottom: '10px' }}>
              {total} mission{total > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

// ══════════════════════════════════════════════
//  ONGLET À VENIR / HISTORIQUE — liste groupée par jour
// ══════════════════════════════════════════════

function TabRange({ mode }: { mode: 'avenir' | 'historique' }) {
  const [items, setItems] = useState<any[] | null>(null)

  useEffect(() => {
    const t = todayStr()
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

  if (items === null) return <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8478', fontSize: '13px' }}>Chargement…</div>
  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '70px 20px', color: '#8a8478' }}>
      {mode === 'avenir' ? <CalendarClock size={30} style={{ color: '#c2bdb4', marginBottom: '12px' }} /> : <History size={30} style={{ color: '#c2bdb4', marginBottom: '12px' }} />}
      <div style={{ fontSize: '14px', color: '#5a564e' }}>{mode === 'avenir' ? 'Aucune mission à venir' : 'Aucune mission passée'}</div>
    </div>
  )

  // Groupement par date
  const groups: Record<string, any[]> = {}
  for (const it of items) { (groups[it.date] ??= []).push(it) }

  return (
    <div style={{ padding: '14px 12px 20px' }}>
      {Object.entries(groups).map(([d, list]) => (
        <div key={d} style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'capitalize', color: '#9a7a28', marginBottom: '8px' }}>
            {format(parseISO(d), 'EEEE d MMMM', { locale: fr })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
  const col = it.kind === 'mad' ? '#7a5c10' : '#1e3f70'
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ textAlign: 'left', width: '100%', cursor: 'pointer', background: '#fff', border: '1.5px solid #d8d2c8', borderLeft: `3px solid ${col}`, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: col }}>{it.kind === 'mad' ? 'MAD' : 'Transfert'}</span>
            {it.heure && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: '#16130e', fontWeight: 600 }}>{it.heure}</span>}
          </span>
          <StatutChip statut={it.statut} />
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '16px', color: '#16130e', lineHeight: 1.15 }}>{it.clientNom}</div>
        <div style={{ fontSize: '12px', color: '#5a564e', marginTop: '2px' }}>{it.lieu}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          {it.dossierNum && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: '#9a7a28' }}>{it.dossierNum}</span>}
          {it.heuresReelles != null && Number(it.heuresReelles) > 0 && (
            <span style={{ fontSize: '11px', color: '#1e5e3a', fontWeight: 600 }}>{it.heuresReelles}h faites</span>
          )}
        </div>
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
  if (days < 0)  return { label: `Expiré le ${format(parseISO(dateStr), 'dd/MM/yyyy')}`, color: '#9e2a2a' }
  if (days < 30) return { label: `Expire dans ${days} j`, color: '#7a5c10' }
  return { label: `Valide → ${format(parseISO(dateStr), 'dd/MM/yyyy')}`, color: '#1e5e3a' }
}

function TabProfil() {
  const [d, setD] = useState<{ chauffeur: any; stats: any } | null>(null)

  useEffect(() => {
    fetch('/api/chauffeur/profil').then(r => r.json()).then(({ data }) => setD(data)).catch(() => setD(null))
  }, [])

  if (!d) return <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8478', fontSize: '13px' }}>Chargement…</div>
  const c = d.chauffeur
  const docs = [
    { label: 'Carte VTC', num: c.vtc_card_numero, st: docState(c.vtc_card_expiry) },
    { label: 'Permis', num: null, st: docState(c.permis_expiry) },
    { label: 'Visite médicale', num: null, st: docState(c.visite_medicale_expiry) },
    { label: 'Carte qualification', num: null, st: docState(c.carte_qualif_expiry) },
    { label: 'Carte de séjour', num: c.carte_sejour_numero, st: docState(c.carte_sejour_expiry) },
  ].filter(x => x.num || x.st)

  return (
    <div style={{ padding: '16px 12px 20px' }}>
      {/* Stats du mois */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <StatCard icon={<Briefcase size={16} />} label="Missions ce mois" value={String(d.stats.missionsMois)} />
        <StatCard icon={<Clock size={16} />} label="Heures ce mois" value={`${d.stats.heuresMois} h`} />
      </div>

      {/* Fiche */}
      <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', padding: '16px', marginBottom: '14px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', color: '#16130e' }}>{c.prenom} {c.nom}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
          {c.telephone && <a href={`tel:${c.telephone}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#16130e', textDecoration: 'none' }}><Phone size={14} color="#8a8478" /> {c.telephone}</a>}
          {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#5a564e' }}><User size={14} color="#8a8478" /> {c.email}</div>}
        </div>
        {((c.langues?.length ?? 0) > 0 || (c.competences?.length ?? 0) > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
            {(c.langues ?? []).map((l: string) => <span key={l} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', background: '#fdf6e3', color: '#9a7a28', border: '1px solid rgba(154,122,40,0.25)' }}>{LANGUES_LBL[l] ?? l}</span>)}
            {(c.competences ?? []).map((k: string) => <span key={k} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', background: '#e8eef8', color: '#1e3f70', border: '1px solid rgba(30,63,112,0.25)' }}>{COMP_LBL[k] ?? k}</span>)}
          </div>
        )}
      </div>

      {/* Documents */}
      {docs.length > 0 && (
        <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', padding: '14px 16px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9a7a28', fontWeight: 700, marginBottom: '10px' }}>Mes documents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {docs.map(doc => (
              <div key={doc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#16130e' }}>{doc.label}</div>
                  {doc.num && <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: '#8a8478' }}>{doc.num}</div>}
                </div>
                {doc.st && <span style={{ fontSize: '11px', fontWeight: 600, color: doc.st.color, textAlign: 'right' }}>{doc.st.label}</span>}
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
    <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', padding: '14px' }}>
      <div style={{ color: '#9a7a28', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '26px', color: '#16130e', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#8a8478', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

// ══════════════════════════════════════════════
//  CARTES (aujourd'hui)
// ══════════════════════════════════════════════

function TransfertCard({ t }: { t: any }) {
  const dossier = one(t.dossier); const client = one(dossier?.client); const veh = one(t.vehicule)
  const [open, setOpen] = useState(false)
  const nbPax = (t.passager_ids?.length) || (dossier?.passagers?.length) || t.nb_passagers || 0
  return (
    <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', borderLeft: '3px solid #1e3f70', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#1e3f70' }}>
            → Transfert {t.heure_depart && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '14px', color: '#16130e' }}>{t.heure_depart.slice(0, 5)}</span>}
          </span>
          <StatutChip statut={t.statut} />
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', color: '#16130e', lineHeight: 1.15 }}>{client?.nom}</div>
        <MetaLine dossierNum={dossier?.numero} veh={veh} modele={t.modele_souhaite} tel={client?.telephone} />
      </div>
      {(t.vol_numero || t.vol_ville || t.vol_terminal) && <div style={{ padding: '0 14px' }}><FlightInfo m={t} /></div>}
      <div style={{ padding: '0 14px 10px' }}>
        {t.adresse_depart && <AddressRow label="Départ" addr={t.adresse_depart} />}
        {t.adresse_arrivee && <AddressRow label="Arrivée" addr={t.adresse_arrivee} />}
      </div>
      <DetailButton onClick={() => setOpen(true)} nbPax={nbPax} />
      {open && <MissionDetail mission={t} kind="transfert" onClose={() => setOpen(false)} />}
    </div>
  )
}

function DetailButton({ onClick, nbPax }: { onClick: () => void; nbPax: number }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', background: '#faf9f7', border: 'none', borderTop: '1px solid #e6e0d6', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#16130e' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <Info size={14} color="#9a7a28" /> Détails de la mission
        {nbPax > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#5a564e', fontWeight: 500 }}><Users size={12} /> {nbPax}</span>}
      </span>
      <ChevronRight size={16} color="#8a8478" />
    </button>
  )
}

function MadCard({ j, onSaved }: { j: any; onSaved: () => void }) {
  const prest = one(j.prestation); const dossier = one(prest?.dossier); const client = one(dossier?.client); const veh = one(j.vehicule)
  const locked = !!dossier?.valide_at   // dossier validé par le dispatch → heures figées
  const [open, setOpen] = useState(false)
  const nbPax = (prest?.passager_ids?.length) || (dossier?.passagers?.length) || prest?.nb_passagers || 0

  return (
    <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', borderLeft: '3px solid #a6432a', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#a6432a' }}>◷ Mise à disposition</span>
          <StatutChip statut={prest?.statut ?? 'en_attente'} />
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', color: '#16130e', lineHeight: 1.15 }}>{client?.nom}</div>
        {(prest?.heure_debut_journee || prest?.heure_fin_journee) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '13px', color: '#5a564e' }}>
            <Clock size={13} style={{ color: '#a6432a' }} />
            Prévu : {prest.heure_debut_journee?.slice(0, 5)} → {prest.heure_fin_journee?.slice(0, 5)}
          </div>
        )}
        <MetaLine dossierNum={dossier?.numero} veh={veh} modele={prest?.modele_souhaite} tel={client?.telephone} />
      </div>

      {prest?.adresse_depart && (
        <div style={{ padding: '0 14px 4px' }}><AddressRow label="Lieu" addr={prest.adresse_depart} /></div>
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
    <div style={{ background: locked ? '#f0eeeb' : saisi ? '#eaf4ee' : '#faf9f7', borderTop: '1px solid #e6e0d6', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9a7a28', fontWeight: 700 }}>Mes heures réelles</span>
        {locked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#1e5e3a' }}><ShieldCheck size={12} /> Validé</span>}
      </div>
      {locked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono,monospace', fontSize: '16px', color: '#16130e' }}>
          <Lock size={14} color="#8a8478" />
          {saisi ? `${debut} → ${fin}` : 'Non saisies'}
          {saisi && <span style={{ fontFamily: 'inherit', fontSize: '12px', color: '#1e5e3a', fontWeight: 600, marginLeft: 'auto' }}>{j.heures_reelles ?? 0}h{(j.heures_sup ?? 0) > 0 ? ` · +${j.heures_sup}h sup` : ''}</span>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="time" value={debut} onChange={e => setDebut(e.target.value)} aria-label="Heure de début"
              style={{ flex: 1, background: '#fff', border: '1.5px solid #b8b0a4', padding: '11px', fontSize: '16px', fontFamily: 'JetBrains Mono,monospace', textAlign: 'center', outline: 'none' }} />
            <span style={{ color: '#8a8478' }}>→</span>
            <input type="time" value={fin} onChange={e => setFin(e.target.value)} aria-label="Heure de fin"
              style={{ flex: 1, background: '#fff', border: '1.5px solid #b8b0a4', padding: '11px', fontSize: '16px', fontFamily: 'JetBrains Mono,monospace', textAlign: 'center', outline: 'none' }} />
          </div>
          {saisi && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#1e5e3a', fontWeight: 600 }}>
              {j.heures_reelles ?? 0}h réelles{(j.heures_sup ?? 0) > 0 ? ` · +${j.heures_sup}h sup` : ''}
            </div>
          )}
          <button onClick={save} disabled={saving}
            style={{ width: '100%', marginTop: '10px', background: '#16130e', color: '#fff', border: 'none', padding: '13px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer' }}>
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
    <div style={{ background: '#e8eef8', border: '1px solid rgba(30,63,112,0.2)', borderLeft: '3px solid #1e3f70', padding: '8px 10px', margin: '2px 0 8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <Plane size={15} style={{ color: '#1e3f70' }} />
      {m.vol_numero && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', fontWeight: 700, color: '#1e3f70' }}>{m.vol_numero}</span>}
      {m.vol_heure && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: '#16130e' }}>{m.vol_heure.slice(0, 5)}</span>}
      {m.vol_terminal && <span style={{ fontSize: '12px', color: '#5a564e' }}>{m.vol_terminal}</span>}
      {m.vol_ville && <span style={{ fontSize: '12px', color: '#5a564e' }}>{m.vol_arrivee ? 'de' : 'vers'} {m.vol_ville}</span>}
    </div>
  )
}

// Liste des passagers nommés
function PassagersList({ passagers, assignedIds }: { passagers: any[]; assignedIds?: string[] | null }) {
  const list = (assignedIds?.length ? passagers.filter(p => assignedIds.includes(p.id)) : passagers)
  if (!list?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {list.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#faf9f7', border: '1px solid #e6e0d6' }}>
          <span style={{ fontSize: '16px' }}>{flag(p.nationalite) || '👤'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#16130e' }}>{p.nom}</div>
            {p.nb_bagages > 0 && <div style={{ fontSize: '11px', color: '#8a8478' }}>{p.nb_bagages} bagage{p.nb_bagages > 1 ? 's' : ''}</div>}
          </div>
          {p.telephone && <a href={`tel:${p.telephone}`} style={{ color: '#1e5e3a' }}><Phone size={16} /></a>}
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
  const col = isMad ? '#a6432a' : '#1e3f70'
  const notes = prest?.notes || dossier?.notes
  const nbBagages = prest?.nb_bagages ?? mission.nb_bagages ?? 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ede9e2', zIndex: 60, display: 'flex', flexDirection: 'column' }}>
      {/* Barre */}
      <div style={{ background: '#16130e', padding: 'max(env(safe-area-inset-top), 12px) 16px 12px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0 }}>
        <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: col === '#a6432a' ? '#d98b73' : '#8fb0e0', fontWeight: 700 }}>{isMad ? 'Mise à disposition' : 'Transfert'}</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{client?.nom ?? '—'}</div>
        </div>
        <StatutChip statut={isMad ? (prest?.statut ?? 'en_attente') : mission.statut} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px calc(24px + env(safe-area-inset-bottom))' }}>
        {/* Infos clés */}
        <Section title="Informations">
          <InfoRow label="Dossier" value={dossier?.numero} mono />
          <InfoRow label="Date" value={format(parseISO(isMad ? mission.date : mission.date_debut), 'EEEE d MMMM yyyy', { locale: fr })} cap />
          {isMad
            ? <InfoRow label="Horaires prévus" value={prest?.heure_debut_journee ? `${prest.heure_debut_journee.slice(0,5)} → ${prest.heure_fin_journee?.slice(0,5) ?? ''}` : '—'} />
            : <InfoRow label="Heure" value={mission.heure_depart?.slice(0, 5) ?? '—'} />}
          <InfoRow label="Véhicule" value={veh ? `${veh.marque} ${veh.modele} · ${veh.immatriculation}` : (isMad ? prest?.modele_souhaite : mission.modele_souhaite) ?? '—'} />
          {client?.telephone && (
            <div style={{ paddingTop: '4px' }}>
              <a href={`tel:${client.telephone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1e5e3a', textDecoration: 'none', fontWeight: 600 }}><Phone size={14} /> Appeler le client · {client.telephone}</a>
            </div>
          )}
        </Section>

        {/* Vol / train */}
        {(mission.vol_numero || mission.vol_ville || mission.vol_terminal) && (
          <Section title="Vol / Train"><FlightInfo m={mission} /></Section>
        )}

        {/* Itinéraire */}
        <Section title="Itinéraire">
          {isMad
            ? (prest?.adresse_depart ? <AddressRow label="Lieu" addr={prest.adresse_depart} /> : <Empty>Mise à disposition</Empty>)
            : <>
                {mission.adresse_depart && <AddressRow label="Départ" addr={mission.adresse_depart} />}
                {mission.adresse_arrivee && <AddressRow label="Arrivée" addr={mission.adresse_arrivee} />}
              </>}
        </Section>

        {/* Passagers */}
        <Section title={`Passagers${nbBagages ? ` · 🧳 ${nbBagages} bagage${nbBagages > 1 ? 's' : ''}` : ''}`}>
          {passagers.length > 0
            ? <PassagersList passagers={passagers} assignedIds={isMad ? prest?.passager_ids : mission.passager_ids} />
            : <Empty>{(isMad ? prest?.nb_passagers : mission.nb_passagers) || 1} passager(s) — non nommés</Empty>}
        </Section>

        {/* Notes */}
        {notes && <Section title="Instructions"><div style={{ fontSize: '13px', color: '#5a564e', lineHeight: 1.6, fontStyle: 'italic', background: '#faf9f7', border: '1px solid #e6e0d6', borderLeft: '3px solid #9a7a28', padding: '10px 12px' }}>{notes}</div></Section>}

        {/* Heures (MAD) */}
        {isMad && (
          <Section title="Heures réelles">
            <div style={{ border: '1px solid #e6e0d6' }}>
              <HoursEntry j={mission} locked={locked} onSaved={() => onSaved?.()} />
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#9a7a28', marginBottom: '8px' }}>{title}</div>
      <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', padding: '12px 14px' }}>{children}</div>
    </div>
  )
}
function InfoRow({ label, value, mono, cap }: { label: string; value?: string | null; mono?: boolean; cap?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '5px 0' }}>
      <span style={{ fontSize: '11px', color: '#8a8478', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#16130e', textAlign: 'right', fontFamily: mono ? 'JetBrains Mono,monospace' : 'inherit', textTransform: cap ? 'capitalize' : 'none' }}>{value ?? '—'}</span>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', color: '#8a8478', fontStyle: 'italic' }}>{children}</div>
}

function MetaLine({ dossierNum, veh, modele, tel }: { dossierNum?: string; veh?: any; modele?: string | null; tel?: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
      {dossierNum && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', color: '#9a7a28' }}>{dossierNum}</span>}
      {(veh || modele) && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#5a564e' }}>
          <Car size={12} style={{ color: '#8a8478' }} />
          {veh ? `${veh.marque} ${veh.modele}` : modele}
        </span>
      )}
      {tel && (
        <a href={`tel:${tel}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#1e5e3a', textDecoration: 'none', fontWeight: 600 }}>
          <Phone size={12} /> Appeler le client
        </a>
      )}
    </div>
  )
}
