'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, parseISO, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, MapPin, Phone, Navigation, Clock, LogOut, Car, CalendarDays,
} from 'lucide-react'
import DocumentsControle from './DocumentsControle'

// Supabase renvoie parfois les relations 1-1 sous forme de tableau : on normalise.
function one(v: any) { return Array.isArray(v) ? v[0] : v }

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

export default function MissionsJour({ chauffeurNom }: { chauffeurNom: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<{ jours: any[]; transferts: any[] } | null>(null)
  const [chauffeurInfo, setChauffeurInfo] = useState<{ prenom: string; nom: string; vtc_card_numero: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chauffeur/missions?date=${d}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setData({ jours: json.data.jours, transferts: json.data.transferts })
      setChauffeurInfo(json.data.chauffeur)
    } catch (err: any) {
      toast.error(err.message)
      setData({ jours: [], transferts: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  function shiftDay(n: number) {
    setDate(format(addDays(parseISO(date), n), 'yyyy-MM-dd'))
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/chauffeur/login')
    router.refresh()
  }

  const total = (data?.jours.length ?? 0) + (data?.transferts.length ?? 0)
  const dObj = parseISO(date)

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── En-tête ── */}
      <header style={{ background: '#16130e', padding: 'max(env(safe-area-inset-top), 14px) 18px 14px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', border: '1.5px solid #9a7a28', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', color: '#9a7a28', fontWeight: 600 }}>✦</div>
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

      {/* ── Navigation jour ── */}
      <div style={{ background: '#fff', borderBottom: '1.5px solid #d8d2c8', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: '62px', zIndex: 15 }}>
        <button onClick={() => shiftDay(-1)} aria-label="Jour précédent"
          style={{ background: '#f5f2ed', border: '1.5px solid #d8d2c8', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={18} color="#5a564e" />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', color: '#16130e', lineHeight: 1.1, textTransform: 'capitalize' }}>
            {format(dObj, 'EEEE d MMMM', { locale: fr })}
          </div>
          <button onClick={() => setDate(new Date().toISOString().slice(0, 10))}
            style={{ background: 'none', border: 'none', fontSize: '11px', color: isToday(dObj) ? '#9a7a28' : '#8a8478', cursor: 'pointer', marginTop: '1px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CalendarDays size={11} /> {isToday(dObj) ? "Aujourd'hui" : "Revenir à aujourd'hui"}
          </button>
        </div>
        <button onClick={() => shiftDay(1)} aria-label="Jour suivant"
          style={{ background: '#f5f2ed', border: '1.5px solid #d8d2c8', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronRight size={18} color="#5a564e" />
        </button>
      </div>

      {/* ── Contenu ── */}
      <div style={{ flex: 1, padding: '14px 12px 96px' }}>
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

      {/* ── Documents de contrôle (bouton fixe + centre plein écran) ── */}
      {chauffeurInfo && (
        <DocumentsControle
          jours={data?.jours ?? []}
          transferts={data?.transferts ?? []}
          chauffeur={chauffeurInfo}
        />
      )}
    </div>
  )
}

// ── Carte transfert ───────────────────────────
function TransfertCard({ t }: { t: any }) {
  const dossier = one(t.dossier)
  const client = one(dossier?.client)
  const veh = one(t.vehicule)
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
      <div style={{ padding: '0 14px 10px' }}>
        {t.adresse_depart && <AddressRow label="Départ" addr={t.adresse_depart} />}
        {t.adresse_arrivee && <AddressRow label="Arrivée" addr={t.adresse_arrivee} />}
      </div>
    </div>
  )
}

// ── Carte MAD (avec saisie heures) ────────────
function MadCard({ j, onSaved }: { j: any; onSaved: () => void }) {
  const prest = one(j.prestation)
  const dossier = one(prest?.dossier)
  const client = one(dossier?.client)
  const veh = one(j.vehicule)

  const [debut, setDebut] = useState<string>(j.heure_debut_reelle?.slice(0, 5) ?? '')
  const [fin, setFin] = useState<string>(j.heure_fin_reelle?.slice(0, 5) ?? '')
  const [saving, setSaving] = useState(false)
  const saisi = !!(j.heure_debut_reelle && j.heure_fin_reelle)

  async function save() {
    if (!debut || !fin) return toast.error('Renseignez début et fin')
    setSaving(true)
    try {
      const res = await fetch('/api/chauffeur/heures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jour_id: j.id, heure_debut: debut, heure_fin: fin }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Heures enregistrées')
      onSaved()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', borderLeft: '3px solid #7a5c10', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#7a5c10' }}>
            ◷ Mise à disposition
          </span>
          <StatutChip statut={prest?.statut ?? 'en_attente'} />
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '18px', color: '#16130e', lineHeight: 1.15 }}>{client?.nom}</div>
        {(prest?.heure_debut_journee || prest?.heure_fin_journee) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '13px', color: '#5a564e' }}>
            <Clock size={13} style={{ color: '#7a5c10' }} />
            Prévu : {prest.heure_debut_journee?.slice(0, 5)} → {prest.heure_fin_journee?.slice(0, 5)}
          </div>
        )}
        <MetaLine dossierNum={dossier?.numero} veh={veh} modele={prest?.modele_souhaite} tel={client?.telephone} />
      </div>

      {prest?.adresse_depart && (
        <div style={{ padding: '0 14px 4px' }}>
          <AddressRow label="Lieu" addr={prest.adresse_depart} />
        </div>
      )}

      {/* Saisie heures réelles */}
      <div style={{ background: saisi ? '#eaf4ee' : '#faf9f7', borderTop: '1px solid #e6e0d6', padding: '12px 14px' }}>
        <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9a7a28', fontWeight: 700, marginBottom: '8px' }}>
          Mes heures réelles
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="time" value={debut} onChange={e => setDebut(e.target.value)} aria-label="Heure de début"
            style={{ flex: 1, background: '#fff', border: '1.5px solid #b8b0a4', padding: '11px', fontSize: '16px', fontFamily: 'JetBrains Mono,monospace', textAlign: 'center', outline: 'none' }} />
          <span style={{ color: '#8a8478' }}>→</span>
          <input type="time" value={fin} onChange={e => setFin(e.target.value)} aria-label="Heure de fin"
            style={{ flex: 1, background: '#fff', border: '1.5px solid #b8b0a4', padding: '11px', fontSize: '16px', fontFamily: 'JetBrains Mono,monospace', textAlign: 'center', outline: 'none' }} />
        </div>

        {saisi && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
            <span style={{ color: '#1e5e3a', fontWeight: 600 }}>
              {j.heures_reelles ?? 0}h réelles{(j.heures_sup ?? 0) > 0 ? ` · +${j.heures_sup}h sup` : ''}
            </span>
          </div>
        )}

        <button onClick={save} disabled={saving}
          style={{ width: '100%', marginTop: '10px', background: '#16130e', color: '#fff', border: 'none', padding: '13px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer' }}>
          {saving ? 'Enregistrement…' : saisi ? 'Mettre à jour mes heures' : 'Enregistrer mes heures'}
        </button>
      </div>
    </div>
  )
}

// ── Ligne méta (dossier · véhicule · appel) ───
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
