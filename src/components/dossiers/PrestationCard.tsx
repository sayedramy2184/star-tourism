'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { calcStatutClient, STATUT_MAP, STATUTS_MANUELS, type PrestationStatut } from '@/lib/statut'
import { BoutonAffecterVehicule } from '@/components/dossiers/DossierActions'
import HeuresReellesModal from '@/components/dossiers/HeuresReellesModal'
import ModifierPrestationModal from '@/components/dossiers/ModifierPrestationModal'
import AffecterSousTraitantModal from '@/components/dossiers/AffecterSousTraitantModal'
import FlightBlock from '@/components/dossiers/FlightBlock'
import { flag } from '@/components/dossiers/PassagersDossier'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Dropdown statut ───────────────────────────

function DropdownStatut({ anchorRef, current, onSelect }: {
  anchorRef: React.RefObject<HTMLDivElement>
  current: PrestationStatut
  onSelect: (s: PrestationStatut) => void
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX })
    }
  }, [])

  if (!pos) return null

  return (
    <div style={{ position:'absolute', top:pos.top, left:pos.left, zIndex:9999, minWidth:'200px', background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 8px 28px rgba(0,0,0,0.18)' }}>
      <div style={{ padding:'6px 14px 4px', fontSize:'8px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', borderBottom:'1px solid #f5f2ed' }}>
        Changer le statut
      </div>
      {STATUTS_MANUELS.map((s) => {
        const si = STATUT_MAP[s]
        const isCurrent = s === current
        return (
          <div key={s}
            onMouseDown={() => onSelect(s)}
            style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 14px', cursor:'pointer', background: isCurrent ? si.bg : 'transparent', borderBottom:'1px solid #f5f2ed', transition:'background 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = si.bg)}
            onMouseLeave={e => (e.currentTarget.style.background = isCurrent ? si.bg : 'transparent')}
          >
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:si.dot, flexShrink:0 }} />
            <span style={{ fontSize:'12px', fontWeight:600, color:si.color, flex:1 }}>{si.label}</span>
            {isCurrent && <span style={{ fontSize:'10px', color:si.color, opacity:0.5 }}>✓</span>}
          </div>
        )
      })}
      <div style={{ padding:'6px 14px 8px', background:'#f5f2ed', borderTop:'1px solid #d8d2c8' }}>
        <div style={{ fontSize:'8px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'5px' }}>Automatique (lecture seule)</div>
        {(['en_cours'] as PrestationStatut[]).map(s => {
          const si = STATUT_MAP[s]
          return (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'3px 0', fontSize:'10px', color:si.color, opacity:0.55 }}>
              <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:si.dot, flexShrink:0 }} />
              {si.label}
              <span style={{ fontSize:'9px', color:'#b8b0a4', marginLeft:'auto' }}>calculé selon l'heure</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Sélecteur statut ──────────────────────────

function StatutSelector({ prestation }: { prestation: any }) {
  const anchorRef                     = useRef<HTMLDivElement>(null)
  const [open,         setOpen]       = useState(false)
  const [saving,       setSaving]     = useState(false)
  const [mounted,      setMounted]    = useState(false)
  const [statutLocal,  setStatutLocal] = useState<string>(prestation.statut)

  useEffect(() => { setMounted(true) }, [])
  // Resynchronise si la prestation est rechargée (router.refresh)
  useEffect(() => { setStatutLocal(prestation.statut) }, [prestation.statut])

  // Calcul du statut effectif basé sur le statut manuel stocké
  const statutEffectif = calcStatutClient({
    ...prestation,
    statut: statutLocal,
  }) as PrestationStatut

  const info = STATUT_MAP[statutEffectif] ?? STATUT_MAP.en_attente
  // « auto » = le statut affiché est calculé (diffère du statut manuel stocké)
  const isComputed = statutEffectif !== statutLocal

  async function handleSelect(newStatut: PrestationStatut) {
    setOpen(false)
    if (newStatut === statutLocal) return
    setSaving(true)

    // Mise à jour locale immédiate — pas besoin d'attendre l'API
    setStatutLocal(newStatut)

    try {
      const res = await fetch(`/api/prestations/${prestation.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ statut: newStatut }),
      })
      if (!res.ok) {
        // Rollback si erreur
        setStatutLocal(prestation.statut)
        throw new Error()
      }
      toast.success(`Statut : ${STATUT_MAP[newStatut].label}`)
    } catch {
      toast.error('Erreur lors du changement de statut')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={anchorRef} style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:'6px' }}>
      {/* Badge statut */}
      <span style={{
        display:'inline-flex', alignItems:'center', gap:'5px',
        padding:'3px 10px', background:info.bg, color:info.color,
        border:`1px solid ${info.border}`, fontSize:'10px', fontWeight:700,
      }}>
        <span style={{
          width:'6px', height:'6px', borderRadius:'50%', background:info.dot, flexShrink:0,
          animation: statutEffectif === 'en_cours' ? 'blink 1.6s infinite' : 'none',
        }} />
        {saving ? '…' : info.label}
        {isComputed && <span style={{ fontSize:'8px', opacity:0.6 }}>auto</span>}
      </span>

      {/* Bouton dropdown — toujours disponible : les statuts manuels
          (annuler, terminer…) restent accessibles même pendant « en cours » */}
      <button
        onMouseDown={() => !saving && setOpen(o => !o)}
        disabled={saving}
        style={{ background:'none', border:'1.5px solid #b8b0a4', padding:'3px 8px', fontSize:'11px', fontWeight:700, cursor:'pointer', color:'#5a564e', lineHeight:1 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor='#9a7a28'; e.currentTarget.style.color='#9a7a28' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor='#b8b0a4'; e.currentTarget.style.color='#5a564e' }}
      >
        ▾
      </button>

      {/* Dropdown via portal */}
      {open && mounted && createPortal(
        <>
          <div style={{ position:'fixed', inset:0, zIndex:9998 }} onMouseDown={() => setOpen(false)} />
          <DropdownStatut anchorRef={anchorRef} current={statutLocal as PrestationStatut} onSelect={handleSelect} />
        </>,
        document.body
      )}
    </div>
  )
}

// ── PrestationCard ────────────────────────────

// ── Disponibilité : créneaux horaires (un chauffeur peut enchaîner plusieurs
//    missions/jour ; on ne bloque que si les horaires se chevauchent). ──
const TRANSFER_DUR = 60
function toMin(t?: string | null): number | null {
  if (!t) return null
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return Number.isNaN(h) ? null : h * 60 + (m || 0)
}
function slotsOverlap(cur: { s: number; e: number } | null, slots: { s: number; e: number }[]): boolean {
  if (!cur) return false
  return slots.some(iv => cur.s < iv.e && iv.s < cur.e)
}

export default function PrestationCard({ p, dossierId, passagers = [] }: { p: any; dossierId: string; passagers?: any[] }) {
  const router = useRouter()
  const [paxIds, setPaxIds] = useState<string[]>(p.passager_ids ?? [])

  async function togglePax(id: string) {
    const next = paxIds.includes(id) ? paxIds.filter(x => x !== id) : [...paxIds, id]
    setPaxIds(next)
    try {
      await fetch(`/api/prestations/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passager_ids: next }),
      })
    } catch { toast.error('Erreur') }
  }
  const typeColor = p.type === 'mad' ? '#a6432a' : '#1e3f70'
  const typeLabel = p.type === 'mad' ? 'Mise à disposition' : 'Transfert'
  const jours     = p.jours ?? []
  // Jour « couvert » = chauffeur OU sous-traitant (au jour), OU prestation entièrement sous-traitée
  const joursManquants = p.sous_traitant_id ? 0 : jours.filter((j: any) => !j.chauffeur_id && !j.sous_traitant_id).length
  // Créneau horaire de CETTE prestation (dispo par chevauchement — null = pas d'heure connue)
  const curInterval: { s: number; e: number } | null = p.type === 'mad'
    ? { s: toMin(p.heure_debut_journee) ?? 0, e: toMin(p.heure_fin_journee) ?? 1440 }
    : (() => { const d = toMin(p.heure_depart); return d == null ? null : { s: d, e: Math.min(1440, d + TRANSFER_DUR) } })()
  const [chauffeurs, setChauffeurs] = useState<any[]>([])
  const [vehicules, setVehicules] = useState<any[]>([])
  const [sousTraitants, setSousTraitants] = useState<any[]>([])
  const [joursState, setJoursState] = useState<Record<string, string>>(
    Object.fromEntries(jours.map((j: any) => [j.id, j.chauffeur_id ?? '']))
  )
  const [joursST, setJoursST] = useState<Record<string, string>>(
    Object.fromEntries(jours.map((j: any) => [j.id, j.sous_traitant_id ?? '']))
  )
  const [joursVeh, setJoursVeh] = useState<Record<string, string>>(
    Object.fromEntries(jours.map((j: any) => [j.id, j.vehicule_id ?? '']))
  )
  const [chauffeurTransfert, setChauffeurTransfert] = useState(p.chauffeur_id ?? '')
  const [stLocal, setStLocal] = useState(() => ({
    sous_traitant_id:   p.sous_traitant_id   ?? null as string | null,
    st_chauffeur_nom:   p.st_chauffeur_nom   ?? null as string | null,
    st_vehicule_marque: p.st_vehicule_marque ?? null as string | null,
    st_vehicule_modele: p.st_vehicule_modele ?? null as string | null,
    st_vehicule_immat:  p.st_vehicule_immat  ?? null as string | null,
    st_cout_ht:         p.st_cout_ht         ?? null as number | null,
    st_marge_ht:        p.st_marge_ht        ?? null as number | null,
    sous_traitant:      p.sous_traitant      ?? null as { societe: string } | null,
  }))
  const [savingJour, setSavingJour] = useState<string|null>(null)
  const [valTarif, setValTarif] = useState('')
  const [valBusy, setValBusy] = useState(false)

  async function validerPrestation() {
    const tarif = parseFloat(valTarif)
    if (!tarif || tarif <= 0) return toast.error('Indiquez le tarif HT')
    setValBusy(true)
    try {
      const res = await fetch(`/api/prestations/${p.id}/valider`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'valider', tarif }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      toast.success('Prestation validée'); router.push(`/dashboard/dossiers/${dossierId}`)
    } catch (e: any) { toast.error(e.message) } finally { setValBusy(false) }
  }
  async function refuserPrestation() {
    const motif = prompt('Motif du refus (visible par l\'agence) :') ?? ''
    setValBusy(true)
    try {
      const res = await fetch(`/api/prestations/${p.id}/valider`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refuser', motif }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      toast.success('Prestation refusée'); router.push(`/dashboard/dossiers/${dossierId}`)
    } catch (e: any) { toast.error(e.message) } finally { setValBusy(false) }
  }
  // Disponibilités par date (chauffeurs/véhicules déjà pris ailleurs)
  const [dispo, setDispo] = useState<{ chauffeurs: Record<string, { id: string; s: number; e: number }[]>; vehicules: Record<string, { id: string; s: number; e: number }[]> }>({ chauffeurs: {}, vehicules: {} })

  useEffect(() => {
    fetch('/api/chauffeurs').then(r => r.json()).then(d => setChauffeurs(d.data ?? []))
    fetch('/api/vehicules').then(r => r.json()).then(d => setVehicules(d.data ?? []))
    fetch('/api/sous-traitants').then(r => r.json()).then(d => setSousTraitants(d.data ?? []))
    const from = p.date_debut, to = p.date_fin || p.date_debut
    fetch(`/api/disponibilites?from=${from}&to=${to}&exclude_prestation=${p.id}`)
      .then(r => r.json()).then(d => setDispo(d.data ?? { chauffeurs: {}, vehicules: {} })).catch(() => {})
  }, [p.id, p.date_debut, p.date_fin])

  // Resync depuis les props quand la prestation est rechargée
  useEffect(() => {
    setStLocal({
      sous_traitant_id:   p.sous_traitant_id   ?? null,
      st_chauffeur_nom:   p.st_chauffeur_nom   ?? null,
      st_vehicule_marque: p.st_vehicule_marque ?? null,
      st_vehicule_modele: p.st_vehicule_modele ?? null,
      st_vehicule_immat:  p.st_vehicule_immat  ?? null,
      st_cout_ht:         p.st_cout_ht         ?? null,
      st_marge_ht:        p.st_marge_ht        ?? null,
      sous_traitant:      p.sous_traitant      ?? null,
    })
  }, [p.sous_traitant_id])

  // Affectation d'un jour à un chauffeur interne OU un sous-traitant (l'un exclut l'autre)
  // value : '' | 'ch:<id>' | 'st:<id>'
  async function affecterJour(jourId: string, value: string) {
    const chauffeur_id     = value.startsWith('ch:') ? value.slice(3) : null
    const sous_traitant_id = value.startsWith('st:') ? value.slice(3) : null
    setSavingJour(jourId)
    setJoursState(prev => ({ ...prev, [jourId]: chauffeur_id ?? '' }))
    setJoursST(prev => ({ ...prev, [jourId]: sous_traitant_id ?? '' }))
    try {
      await fetch(`/api/jours-mad/${jourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chauffeur_id, sous_traitant_id }),
      })
      toast.success('Affectation mise à jour')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setSavingJour(null) }
  }

  // Changement de véhicule pour UN jour précis (une MAD peut changer de véhicule en cours)
  async function affecterVehiculeJour(jourId: string, vehiculeId: string) {
    setSavingJour(jourId)
    setJoursVeh(prev => ({ ...prev, [jourId]: vehiculeId }))
    try {
      await fetch(`/api/jours-mad/${jourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicule_id: vehiculeId || null }),
      })
      toast.success('Véhicule du jour mis à jour')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setSavingJour(null) }
  }

  // ── Appliquer à TOUS les jours ──────────────
  async function affecterTous(value: string) {
    const chauffeur_id     = value.startsWith('ch:') ? value.slice(3) : null
    const sous_traitant_id = value.startsWith('st:') ? value.slice(3) : null
    setSavingJour('ALL')
    setJoursState(Object.fromEntries(jours.map((j: any) => [j.id, chauffeur_id ?? ''])))
    setJoursST(Object.fromEntries(jours.map((j: any) => [j.id, sous_traitant_id ?? ''])))
    try {
      await Promise.all(jours.map((j: any) => fetch(`/api/jours-mad/${j.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chauffeur_id, sous_traitant_id }),
      })))
      toast.success('Affectation appliquée à tous les jours')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setSavingJour(null) }
  }

  async function affecterVehiculeTous(vehiculeId: string) {
    setSavingJour('ALL')
    setJoursVeh(Object.fromEntries(jours.map((j: any) => [j.id, vehiculeId])))
    try {
      await Promise.all(jours.map((j: any) => fetch(`/api/jours-mad/${j.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicule_id: vehiculeId || null }),
      })))
      toast.success('Véhicule appliqué à tous les jours')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setSavingJour(null) }
  }

  async function affecterChauffeurTransfert(chauffeurId: string) {
    setChauffeurTransfert(chauffeurId)
    try {
      await fetch(`/api/prestations/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chauffeur_id: chauffeurId || null }),
      })
      toast.success('Chauffeur affecté !')
      router.refresh()
    } catch { toast.error('Erreur') }
  }

  return (
    <div className="card" style={{ overflow:'hidden' }}>

      {/* Bande de validation (demande agence) */}
      {p.validation_statut === 'a_valider' && (
        <div style={{ background:'#fdf3dc', borderBottom:'1.5px solid #9a7a28', padding:'10px 14px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
          <span style={{ fontSize:'10px', fontWeight:800, letterSpacing:'1px', textTransform:'uppercase', color:'#7a5c10' }}>⧗ Demande agence · à valider</span>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginLeft:'auto', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <input type="number" min={0} step={0.01} value={valTarif} onChange={e => setValTarif(e.target.value)}
                placeholder={p.type === 'mad' ? 'Tarif/jour HT' : 'Tarif HT'}
                style={{ width:'110px', background:'#fff', border:'1.5px solid #9a7a28', padding:'6px 8px', fontSize:'12px', outline:'none' }} />
              <span style={{ fontSize:'11px', color:'#7a5c10' }}>€{p.type === 'mad' ? '/j' : ''}</span>
            </div>
            <button onClick={validerPrestation} disabled={valBusy} className="btn-or" style={{ padding:'6px 12px', fontSize:'11px' }}>Valider</button>
            <button onClick={refuserPrestation} disabled={valBusy}
              style={{ padding:'6px 12px', fontSize:'11px', background:'none', border:'1.5px solid rgba(158,42,42,0.4)', color:'#9e2a2a', cursor:'pointer' }}>Refuser</button>
          </div>
        </div>
      )}
      {p.validation_statut === 'refusee' && (
        <div style={{ background:'#faeaea', borderBottom:'1.5px solid rgba(158,42,42,0.3)', padding:'8px 14px', fontSize:'11px', color:'#9e2a2a', fontWeight:600 }}>
          ✕ Prestation refusée{p.refus_motif ? ` — ${p.refus_motif}` : ''}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'stretch', borderBottom:'1.5px solid #b8b0a4' }}>
        <div style={{ width:'5px', background:typeColor, flexShrink:0 }} />
        <div style={{ flex:1, padding:'10px 16px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#8a8478', background:'#f5f2ed', border:'1px solid #d8d2c8', padding:'2px 8px' }}>
            P-0{p.ordre}
          </span>
          <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:typeColor }}>
            {typeLabel}
          </span>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#2e2b25' }}>
            {p.type === 'mad'
              ? `${format(new Date(p.date_debut),'dd/MM',{locale:fr})} → ${format(new Date(p.date_fin),'dd/MM/yyyy',{locale:fr})}`
              : format(new Date(p.date_debut),'dd/MM/yyyy',{locale:fr})}
          </span>
          {p.nb_jours > 1 && (
            <span style={{ background:'#f5f2ed', border:'1px solid #b8b0a4', padding:'2px 9px', fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#5a564e' }}>
              {p.nb_jours} jours
            </span>
          )}
          <span style={{ fontSize:'11px', color:'#5a564e' }}>👤 {p.nb_passagers ?? 1}{(p.nb_bagages ?? 0) > 0 ? ` · 🧳 ${p.nb_bagages}` : ''}</span>
        </div>
        <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', gap:'10px', borderLeft:'1px solid #d8d2c8', flexShrink:0 }}>
          {joursManquants > 0 && (
            <span style={{ fontSize:'9px', color:'#7a5c10', fontWeight:700 }}>⚠ {joursManquants} j. sans chauffeur</span>
          )}
          {p.type === 'mad' && jours.length > 0 && (
            <HeuresReellesModal
              prestationId={p.id}
              jours={jours}
              tarifJournalier={p.tarif_journalier_ht ?? 0}
            />
          )}
          <ModifierPrestationModal p={p} />
          <StatutSelector prestation={p} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'12px', marginBottom:'12px' }}>
          {p.type === 'transfert' && <>
            <div>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Départ</div>
              <div style={{ fontSize:'12px', fontWeight:500 }}>{p.adresse_depart ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Arrivée</div>
              <div style={{ fontSize:'12px', fontWeight:500 }}>{p.adresse_arrivee ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Heure</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px' }}>{p.heure_depart ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Chauffeur</div>
              <select
                value={chauffeurTransfert}
                onChange={e => affecterChauffeurTransfert(e.target.value)}
                style={{ background: !chauffeurTransfert ? '#fff8e8' : '#fff', border:`1px solid ${!chauffeurTransfert ? '#9a7a28' : '#b8b0a4'}`, padding:'5px 8px', fontSize:'11px', color:'#16130e', outline:'none', width:'100%', cursor:'pointer' }}>
                <option value="">— Non affecté —</option>
                {chauffeurs.map((c: any) => {
                  const slots = (dispo.chauffeurs[p.date_debut] ?? []).filter((iv: any) => iv.id === c.id)
                  const conflict = c.id !== chauffeurTransfert && slotsOverlap(curInterval, slots)
                  const sameDay = c.id !== chauffeurTransfert && slots.length > 0 && !conflict
                  return <option key={c.id} value={c.id} disabled={conflict}>{c.prenom} {c.nom}{conflict ? ' · occupé (horaire)' : sameDay ? ' · déjà 1 ce jour' : ''}</option>
                })}
              </select>
            </div>
          </>}
          {p.type === 'mad' && <>
            <div>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Lieu</div>
              <div style={{ fontSize:'12px', fontWeight:500 }}>{p.adresse_depart ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Horaires</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>
                {p.heure_debut_journee ?? '—'} → {p.heure_fin_journee ?? '—'}
              </div>
            </div>
          </>}
          <div>
            <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Tarif HT</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#9a7a28' }}>
              {p.type === 'mad' ? `${fmt(p.tarif_journalier_ht ?? 0)}/j` : fmt(p.tarif_fixe_ht ?? p.montant_ht)}
            </div>
          </div>
          <div>
            <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Modèle souhaité</div>
            <div style={{ fontSize:'12px' }}>{p.modele_souhaite ?? '—'}</div>
          </div>
        </div>

        {(p.vol_numero || p.vol_ville || p.vol_terminal) && (
          <div style={{ marginBottom:'10px' }}>
            <FlightBlock numero={p.vol_numero} heure={p.vol_heure} ville={p.vol_ville} terminal={p.vol_terminal} arrivee={p.vol_arrivee} />
          </div>
        )}

        {/* Passagers affectés à ce véhicule */}
        {passagers.length > 0 && (
          <div style={{ marginBottom:'10px', padding:'8px 12px', background:'#faf9f7', border:'1px solid #ede9e2' }}>
            <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'6px' }}>Passagers dans ce véhicule</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {passagers.map((pax: any) => {
                const on = paxIds.includes(pax.id)
                return (
                  <button key={pax.id} type="button" onClick={() => togglePax(pax.id)}
                    style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px', fontSize:'11px', fontWeight:500, cursor:'pointer', background: on ? '#e8eef8' : '#fff', border:`1.5px solid ${on ? '#1e3f70' : '#d8d2c8'}`, color: on ? '#1e3f70' : '#5a564e' }}>
                    <span>{flag(pax.nationalite) || '👤'}</span> {pax.nom}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Véhicule */}
        <div style={{
          background:'#f5f2ed', border:'1px solid #b8b0a4', padding:'10px 14px',
          display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px', flexWrap:'wrap',
          borderLeft: p.vehicule_ext ? '3px solid #4a2a6e' : stLocal.sous_traitant_id ? '3px solid #7a2a8a' : p.affectation_differee ? '3px solid #7a5c10' : '3px solid #1e5e3a',
        }}>
          <span style={{ fontSize:'16px' }}>🚗</span>
          <div style={{ flex:1 }}>
            {p.vehicule ? (
              <>
                <div style={{ fontSize:'12px', fontWeight:600 }}>{p.vehicule.marque} {p.vehicule.modele}</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#5a564e' }}>{p.vehicule.immatriculation}</div>
              </>
            ) : p.vehicule_ext ? (
              <>
                <div style={{ fontSize:'12px', fontWeight:600 }}>{p.vehicule_ext.marque} {p.vehicule_ext.modele} <span style={{ color:'#4a2a6e', fontSize:'10px' }}>Externe</span></div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#4a2a6e' }}>{p.vehicule_ext.immatriculation} · {p.vehicule_ext.loueur}</div>
              </>
            ) : stLocal.sous_traitant_id ? (
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:'#4a2a6e' }}>
                  🤝 {stLocal.st_vehicule_marque} {stLocal.st_vehicule_modele}
                  {stLocal.sous_traitant && <span style={{ fontSize:'10px', color:'#4a2a6e', marginLeft:'6px', opacity:0.7 }}>· {stLocal.sous_traitant.societe}</span>}
                </div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#4a2a6e' }}>
                  {stLocal.st_vehicule_immat} · {stLocal.st_chauffeur_nom}
                </div>
              </div>
            ) : (
              <div style={{ fontSize:'12px', color:'#7a5c10', fontStyle:'italic' }}>Véhicule non affecté</div>
            )}
          </div>
          {p.vehicule && (
            <span style={{ fontSize:'8px', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', background:'#eaf4ee', color:'#1e5e3a', border:'1px solid rgba(30,94,58,0.2)', padding:'2px 8px' }}>Flotte</span>
          )}
          {p.vehicule_ext && (
            <span style={{ fontSize:'8px', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', background:'#f0ebfa', color:'#4a2a6e', border:'1px solid rgba(74,42,110,0.2)', padding:'2px 8px' }}>Externe</span>
          )}
          {stLocal.sous_traitant_id && (
            <div style={{ marginLeft:'auto', display:'flex', gap:'16px', alignItems:'flex-end' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'2px' }}>
                <span style={{ fontSize:'9px', color:'#8a8478', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase' }}>Coût ST</span>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:600, color:'#9e2a2a' }}>
                  {fmt(stLocal.st_cout_ht ?? 0)}
                </span>
              </div>
              {stLocal.st_marge_ht !== null && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'2px' }}>
                  <span style={{ fontSize:'9px', color:'#8a8478', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase' }}>Marge</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:700, color: (stLocal.st_marge_ht ?? 0) > 0 ? '#1e5e3a' : '#9e2a2a' }}>
                    {fmt(stLocal.st_marge_ht ?? 0)}
                  </span>
                </div>
              )}
            </div>
          )}
          {false && stLocal.st_marge_ht !== null && (
            <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'2px' }}>
              <span style={{ fontSize:'9px', color:'#8a8478', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase' }}>Marge</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:700, color: (stLocal.st_marge_ht ?? 0) > 0 ? '#1e5e3a' : '#9e2a2a' }}>
                {new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(stLocal.st_marge_ht ?? 0)}
              </span>
            </div>
          )}
          <BoutonAffecterVehicule
            prestationId={p.id}
            dateDebut={p.date_debut}
            dateFin={p.date_fin}
            vehiculeActuel={p.vehicule ?? null}
          />
          <AffecterSousTraitantModal
            prestationId={p.id}
            dossierId={dossierId}
            prixClient={p.montant_ht ?? 0}
            nbJours={p.type === 'mad' ? (jours.length || p.nb_jours || 1) : 1}
            sousTraitantActuel={stLocal.sous_traitant ? { societe: stLocal.sous_traitant.societe, chauffeurNom: stLocal.st_chauffeur_nom } : null}
            onAffecter={(data) => setStLocal(prev => ({ ...prev, ...data }))}
          />
        </div>

        {/* Jours MAD */}
        {p.type === 'mad' && jours.length > 0 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap', marginBottom:'8px' }}>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28' }}>
                Détail journalier
              </div>
              {jours.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', color:'#9a7a28', display:'inline-flex', alignItems:'center', gap:'3px' }}>
                    ⇊ Appliquer à tous
                  </span>
                  <select
                    defaultValue=""
                    disabled={savingJour === 'ALL'}
                    onChange={e => { const v = e.target.value; e.currentTarget.value = ''; if (v) affecterTous(v) }}
                    title="Affecter tous les jours au même chauffeur / sous-traitant"
                    style={{ background:'#fdf6e3', border:'1px solid #9a7a28', padding:'4px 8px', fontSize:'11px', color:'#16130e', outline:'none', cursor:'pointer', maxWidth:'170px' }}>
                    <option value="">Affecté à…</option>
                    <optgroup label="Chauffeurs">
                      {chauffeurs.map((c: any) => <option key={c.id} value={`ch:${c.id}`}>{c.prenom} {c.nom}</option>)}
                    </optgroup>
                    {sousTraitants.length > 0 && (
                      <optgroup label="Sous-traitants">
                        {sousTraitants.map((s: any) => <option key={s.id} value={`st:${s.id}`}>🤝 {s.societe}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <select
                    defaultValue="__none"
                    disabled={savingJour === 'ALL'}
                    onChange={e => { const v = e.target.value; e.currentTarget.value = '__none'; if (v !== '__none') affecterVehiculeTous(v === '__prest' ? '' : v) }}
                    title="Mettre tous les jours sur le même véhicule"
                    style={{ background:'#eef4fb', border:'1px solid #1e3f70', padding:'4px 8px', fontSize:'11px', color:'#16130e', outline:'none', cursor:'pointer', maxWidth:'190px' }}>
                    <option value="__none">Véhicule…</option>
                    <option value="__prest">↳ Véhicule de la prestation</option>
                    {vehicules.map((v: any) => <option key={v.id} value={v.id}>{v.marque} {v.modele} · {v.immatriculation}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'84px 1fr 1fr 74px', gap:'6px', padding:'4px 8px', background:'#faf9f7', marginBottom:'2px' }}>
              {['Date','Affecté à','Véhicule','Tarif HT'].map(h => (
                <div key={h} style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>{h}</div>
              ))}
            </div>
            {jours.map((j: any) => {
              const chJour = joursState[j.id] ?? ''
              const stJour = joursST[j.id] ?? ''
              const affVal = stJour ? `st:${stJour}` : chJour ? `ch:${chJour}` : ''
              // « manquant » = ni chauffeur ni ST au jour, et prestation non sous-traitée
              const missing = !chJour && !stJour && !p.sous_traitant_id
              // Véhicule effectif du jour : celui du jour sinon celui de la prestation
              const vehJour = joursVeh[j.id] ?? ''
              const overridden = !!vehJour && vehJour !== (p.vehicule?.id ?? '')
              const prestVehLabel = p.vehicule ? `${p.vehicule.marque} ${p.vehicule.modele}` : 'véhicule prestation'
              return (
                <div key={j.id} style={{
                  marginBottom:'2px', padding:'6px 8px',
                  background: missing ? '#fdf3dc' : '#f5f2ed',
                  border: missing ? '1px solid rgba(122,92,16,0.3)' : '1px solid #d8d2c8',
                }}>
                  <div style={{ display:'grid', gridTemplateColumns:'84px 1fr 1fr 74px', gap:'6px', alignItems:'center' }}>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color: missing ? '#7a5c10' : '#2e2b25' }}>
                      {j.jour_semaine} {format(new Date(j.date),'dd/MM',{locale:fr})}
                    </span>
                    <select
                      value={affVal}
                      onChange={e => affecterJour(j.id, e.target.value)}
                      disabled={savingJour === j.id || savingJour === 'ALL'}
                      title={stJour ? 'Jour sous-traité' : ''}
                      style={{
                        background: stJour ? '#f0ebfa' : missing ? '#fff8e8' : '#fff',
                        border: `1px solid ${stJour ? '#7a2a8a' : missing ? '#9a7a28' : '#b8b0a4'}`,
                        padding:'4px 8px', fontSize:'11px', color:'#16130e',
                        outline:'none', width:'100%', cursor:'pointer',
                      }}>
                      <option value="">{p.sous_traitant_id ? '↳ ST prestation' : '— Non affecté —'}</option>
                      <optgroup label="Chauffeurs">
                        {chauffeurs.map((c: any) => {
                          const slots = (dispo.chauffeurs[j.date] ?? []).filter((iv: any) => iv.id === c.id)
                          const conflict = c.id !== chJour && slotsOverlap(curInterval, slots)
                          const sameDay = c.id !== chJour && slots.length > 0 && !conflict
                          return <option key={c.id} value={`ch:${c.id}`} disabled={conflict}>{c.prenom} {c.nom}{conflict ? ' · occupé (horaire)' : sameDay ? ' · déjà 1 ce jour' : ''}</option>
                        })}
                      </optgroup>
                      {sousTraitants.length > 0 && (
                        <optgroup label="Sous-traitants">
                          {sousTraitants.map((s: any) => (
                            <option key={s.id} value={`st:${s.id}`}>🤝 {s.societe}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <select
                      value={vehJour}
                      onChange={e => affecterVehiculeJour(j.id, e.target.value)}
                      disabled={savingJour === j.id || savingJour === 'ALL'}
                      title={overridden ? 'Véhicule spécifique à ce jour' : 'Utilise le véhicule de la prestation'}
                      style={{
                        background: overridden ? '#eef4fb' : '#fff',
                        border: `1px solid ${overridden ? '#1e3f70' : '#b8b0a4'}`,
                        padding:'4px 8px', fontSize:'11px', color:'#16130e',
                        outline:'none', width:'100%', cursor:'pointer',
                      }}>
                      <option value="">↳ {prestVehLabel}</option>
                      {vehicules.map((v: any) => {
                        const slots = (dispo.vehicules[j.date] ?? []).filter((iv: any) => iv.id === v.id)
                        const conflict = v.id !== vehJour && slotsOverlap(curInterval, slots)
                        const sameDay = v.id !== vehJour && slots.length > 0 && !conflict
                        return <option key={v.id} value={v.id} disabled={conflict}>{v.marque} {v.modele} · {v.immatriculation}{conflict ? ' · occupé (horaire)' : sameDay ? ' · déjà 1 ce jour' : ''}</option>
                      })}
                    </select>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28', textAlign:'right' }}>
                      {fmt(j.tarif_ht)}
                    </span>
                  </div>
                  {j.note && <div style={{ fontSize:'10px', color:'#8a8478', fontStyle:'italic', marginTop:'3px' }}>{j.note}</div>}
                </div>
              )
            })}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 8px 0', borderTop:'1.5px solid #b8b0a4', marginTop:'4px' }}>
              <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>
                Sous-total · {jours.length} j
              </span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#16130e' }}>
                {fmt(p.montant_ht)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
