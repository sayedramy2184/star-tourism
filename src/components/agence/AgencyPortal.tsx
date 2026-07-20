'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { Plus, Trash2, LogOut, Users, ChevronRight, ListChecks, Send, Pencil } from 'lucide-react'
import { byChrono } from '@/lib/chrono'

// ── Labels ─────────────────────────────────────
// Mêmes catégories que le dashboard (valeurs identiques à modele_souhaite)
const VEHICLES = [
  { value: 'Berline standard', en: 'Standard sedan' },
  { value: 'Berline premium', en: 'Premium sedan' },
  { value: 'Berline prestige', en: 'Prestige sedan' },
  { value: 'Van / Minibus', en: 'Van / Minibus' },
  { value: 'SUV premium', en: 'Premium SUV' },
  { value: 'Électrique', en: 'Electric' },
]

const EXEC: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'Scheduled', color: '#7a5c10', bg: '#fdf3dc' },
  confirme:   { label: 'Confirmed', color: '#1e5e3a', bg: '#eaf4ee' },
  en_cours:   { label: 'In progress', color: '#1e3f70', bg: '#e8eef8' },
  termine:    { label: 'Completed', color: '#8a8478', bg: '#f0eeeb' },
  annule:     { label: 'Cancelled', color: '#9e2a2a', bg: '#faeaea' },
}

function statusOf(p: any): { label: string; color: string; bg: string } {
  if (p.validation_statut === 'a_valider') return { label: 'Pending review', color: '#7a5c10', bg: '#fdf3dc' }
  if (p.validation_statut === 'refusee')   return { label: 'Declined', color: '#9e2a2a', bg: '#faeaea' }
  return EXEC[p.statut] ?? EXEC.en_attente
}

function one(v: any) { return Array.isArray(v) ? v[0] : v }

// ══════════════════════════════════════════════
export default function AgencyPortal({ agencyName }: { agencyName: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'requests' | 'new'>('requests')
  const [dossiers, setDossiers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<{ mode: 'edit' | 'add' | 'edit-service'; dossierId: string; prestationId?: string; initial: any } | null>(null)

  function startNew() { setEdit(null); setTab('new') }
  function startEdit(d: any) { setEdit({ mode: 'edit', dossierId: d.id, initial: initialFromDossier(d) }); setTab('new') }
  function startAdd(d: any) { setEdit({ mode: 'add', dossierId: d.id, initial: { services: [makeService()], passengers: [], notes: '' } }); setTab('new') }
  function startEditService(d: any, p: any) { setEdit({ mode: 'edit-service', dossierId: d.id, prestationId: p.id, initial: { services: [serviceFromPrestation(p)], passengers: [], notes: '', wasValidated: p.validation_statut === 'validee' } }); setTab('new') }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agence/dossiers')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setDossiers(json.data ?? [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/agence/login'); router.refresh()
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#ede9e2' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(155deg,#221b11,#16130e)', padding: 'max(env(safe-area-inset-top),14px) 20px 15px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div style={{ width: '38px', height: '38px', background: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
              <img src="/logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{agencyName}</div>
              <div style={{ fontSize: '9px', letterSpacing: '2.5px', color: 'rgba(212,180,110,0.75)', textTransform: 'uppercase' }}>Agency portal</div>
            </div>
          </div>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '9px' }}><LogOut size={18} /></button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px 16px 0', display: 'flex', gap: '8px' }}>
        {([['requests', 'My requests', <ListChecks size={15} key="a" />], ['new', edit ? (edit.mode === 'add' ? 'Add service' : edit.mode === 'edit-service' ? 'Edit service' : 'Edit request') : 'New request', <Plus size={15} key="b" />]] as const).map(([v, label, icon]) => (
          <button key={v} onClick={() => v === 'new' ? startNew() : setTab(v)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', cursor: 'pointer', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: tab === v ? '#16130e' : '#fff', color: tab === v ? '#fff' : '#5a564e' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px' }}>
        {tab === 'requests'
          ? <RequestsList dossiers={dossiers} loading={loading} onNew={startNew} onEdit={startEdit} onAdd={startAdd} onEditService={startEditService} onReload={load} />
          : <NewRequest key={(edit?.mode ?? 'new') + (edit?.dossierId ?? '') + (edit?.prestationId ?? '')} initial={edit?.initial} mode={edit?.mode ?? 'new'} dossierId={edit?.dossierId} prestationId={edit?.prestationId} onDone={() => { load(); setEdit(null); setTab('requests') }} />}
      </div>
    </div>
  )
}

// ── Requests list ──────────────────────────────
function RequestsList({ dossiers, loading, onNew, onEdit, onAdd, onEditService, onReload }: { dossiers: any[]; loading: boolean; onNew: () => void; onEdit: (d: any) => void; onAdd: (d: any) => void; onEditService: (d: any, p: any) => void; onReload: () => void }) {
  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#8a8478' }}>Loading…</div>
  if (dossiers.length === 0) return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '14px', color: '#5a564e', marginBottom: '14px' }}>No requests yet.</div>
      <button onClick={onNew} className="btn-primary" style={{ display: 'inline-flex' }}><Plus size={15} /> Submit a request</button>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {dossiers.map(d => <DossierCard key={d.id} d={d} onEdit={onEdit} onAdd={onAdd} onEditService={onEditService} onReload={onReload} />)}
    </div>
  )
}

function paxLine(passagers: any[]): string {
  const names = (passagers ?? []).map(p => p.nom).filter(Boolean)
  if (names.length === 0) return ''
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

function DossierCard({ d, onEdit, onAdd, onEditService, onReload }: { d: any; onEdit: (d: any) => void; onAdd: (d: any) => void; onEditService: (d: any, p: any) => void; onReload: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const prestations = [...(d.prestations ?? [])].sort(byChrono)
  const pending = prestations.filter((p: any) => p.validation_statut === 'a_valider').length
  // Modifiable (edit complet) tant que toutes les prestations sont encore « à valider »
  const editable = prestations.length > 0 && prestations.every((p: any) => p.validation_statut === 'a_valider')
  const canAdd = d.statut !== 'termine'
  const pax = paxLine(d.passagers)

  async function cancel() {
    if (!confirm('Cancel this request? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/agence/dossiers/${d.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      toast.success('Request cancelled'); onReload()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', borderRadius: '12px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9a7a28' }}>{d.numero}</div>
          <div style={{ fontSize: '13px', color: '#16130e', marginTop: '2px' }}>
            {format(parseISO(d.date_debut), 'dd MMM yyyy')} → {format(parseISO(d.date_fin), 'dd MMM yyyy')} · {prestations.length} service{prestations.length > 1 ? 's' : ''}
          </div>
          {pax && <div style={{ fontSize: '12px', color: '#5a564e', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={12} /> {pax}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pending > 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: '#7a5c10', background: '#fdf3dc', padding: '3px 9px', borderRadius: '999px' }}>{pending} pending</span>}
          <ChevronRight size={16} color="#8a8478" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
        </div>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #ede9e2', padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {prestations.map((p: any) => <ServiceLine key={p.id} p={p} onEdit={() => onEditService(d, p)} />)}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            {canAdd && (
              <button onClick={() => onAdd(d)} disabled={busy} className="btn-primary" style={{ flex: '1 1 140px', justifyContent: 'center', gap: '6px' }}><Plus size={14} /> Add service</button>
            )}
            {editable && (
              <>
                <button onClick={() => onEdit(d)} disabled={busy} className="btn-ghost" style={{ flex: '1 1 120px', justifyContent: 'center', gap: '6px' }}><Pencil size={13} /> Edit</button>
                <button onClick={cancel} disabled={busy} style={{ flex: '1 1 120px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'none', border: '1.5px solid rgba(158,42,42,0.35)', color: '#9e2a2a', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}><Trash2 size={13} /> Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Reconstruit le formulaire depuis un dossier existant (édition)
function initialFromDossier(d: any) {
  const services = (d.prestations ?? []).map((p: any) => ({
    type: p.type,
    date_debut: p.date_debut ?? '', date_fin: p.date_fin ?? '',
    heure_depart: p.heure_depart?.slice(0, 5) ?? '',
    heure_debut_journee: p.heure_debut_journee?.slice(0, 5) ?? '09:00',
    heure_fin_journee: p.heure_fin_journee?.slice(0, 5) ?? '18:00',
    adresse_depart: p.adresse_depart ?? '', adresse_arrivee: p.adresse_arrivee ?? '',
    vol_numero: p.vol_numero ?? '', vol_heure: p.vol_heure?.slice(0, 5) ?? '', vol_ville: p.vol_ville ?? '', vol_terminal: p.vol_terminal ?? '',
    modele_souhaite: p.modele_souhaite ?? '', nb_passagers: p.nb_passagers ?? 1, nb_bagages: p.nb_bagages ?? 0,
  }))
  const passengers = (d.passagers ?? []).map((p: any) => ({ nom: p.nom ?? '', nationalite: p.nationalite ?? '', telephone: p.telephone ?? '', nb_bagages: p.nb_bagages ?? 0 }))
  return { services: services.length ? services : [makeService()], passengers, notes: d.notes ?? '' }
}

// Reconstruit un service (formulaire) depuis une prestation existante
function serviceFromPrestation(p: any) {
  return {
    type: p.type,
    date_debut: p.date_debut ?? '', date_fin: p.date_fin ?? '',
    heure_depart: p.heure_depart?.slice(0, 5) ?? '',
    heure_debut_journee: p.heure_debut_journee?.slice(0, 5) ?? '09:00',
    heure_fin_journee: p.heure_fin_journee?.slice(0, 5) ?? '18:00',
    adresse_depart: p.adresse_depart ?? '', adresse_arrivee: p.adresse_arrivee ?? '',
    vol_numero: p.vol_numero ?? '', vol_heure: p.vol_heure?.slice(0, 5) ?? '', vol_ville: p.vol_ville ?? '', vol_terminal: p.vol_terminal ?? '',
    modele_souhaite: p.modele_souhaite ?? '', nb_passagers: p.nb_passagers ?? 1, nb_bagages: p.nb_bagages ?? 0,
  }
}

// Chauffeur(s) + véhicule affectés — pour un transfert (niveau prestation)
// ou une MAD (affectation par jour dans jours_mad).
function assignedInfo(p: any): { chauffeurs: { nom: string; tel: string | null }[]; veh: string | null } {
  if (p.type !== 'mad') {
    const ch = one(p.chauffeur); const veh = one(p.vehicule) || one(p.vehicule_ext)
    return {
      chauffeurs: ch ? [{ nom: `${ch.prenom} ${ch.nom}`.trim(), tel: ch.telephone ?? null }] : [],
      veh: veh ? `${veh.marque} ${veh.modele}` : null,
    }
  }
  const map = new Map<string, { nom: string; tel: string | null }>()
  let veh: string | null = null
  for (const j of p.jours_mad ?? []) {
    const c = one(j.chauffeur)
    if (c) { const nom = `${c.prenom} ${c.nom}`.trim(); if (nom && !map.has(nom)) map.set(nom, { nom, tel: c.telephone ?? null }) }
    const v = one(j.vehicule) || one(j.vehicule_ext)
    if (v && !veh) veh = `${v.marque} ${v.modele}`
  }
  return { chauffeurs: Array.from(map.values()), veh }
}

function DRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', lineHeight: 1.4 }}>
      <span style={{ flexShrink: 0, width: '92px', color: '#8a8478', fontSize: '10px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', paddingTop: '1px' }}>{label}</span>
      <span style={{ flex: 1, color: '#16130e', minWidth: 0 }}>{children}</span>
    </div>
  )
}

function ServiceLine({ p, onEdit }: { p: any; onEdit?: () => void }) {
  const s = statusOf(p)
  const isMad = p.type === 'mad'
  const color = isMad ? '#a6432a' : '#1e3f70'
  const asg = assignedInfo(p)
  const validated = p.validation_statut === 'validee'
  const canEdit = p.validation_statut !== 'refusee' && p.statut !== 'termine'
  const price = Number(p.montant_ht) || 0
  const vehLbl = VEHICLES.find(v => v.value === p.modele_souhaite)?.en ?? p.modele_souhaite

  return (
    <div style={{ background: '#faf9f7', border: '1px solid #ede9e2', borderLeft: `3px solid ${color}`, borderRadius: '8px', padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '9px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color }}>
          {isMad ? 'Chauffeur service' : 'Transfer'}
        </span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: s.color, background: s.bg, padding: '3px 9px', borderRadius: '999px' }}>{s.label}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <DRow label="Date">
          {format(parseISO(p.date_debut), 'EEE dd MMM yyyy')}{isMad && p.date_fin !== p.date_debut ? ` → ${format(parseISO(p.date_fin), 'EEE dd MMM yyyy')}` : ''}
        </DRow>
        <DRow label={isMad ? 'Hours' : 'Pick-up'}>
          {isMad
            ? `${p.heure_debut_journee?.slice(0, 5) ?? '—'} → ${p.heure_fin_journee?.slice(0, 5) ?? '—'}`
            : (p.heure_depart?.slice(0, 5) ?? '—')}
        </DRow>
        <DRow label={isMad ? 'Location' : 'From'}>{p.adresse_depart || '—'}</DRow>
        {!isMad && <DRow label="To">{p.adresse_arrivee || '—'}</DRow>}
        {(p.vol_numero || p.vol_ville || p.vol_terminal) && (
          <DRow label="Flight">
            <span style={{ color: '#1e3f70' }}>✈ {[p.vol_numero, p.vol_heure?.slice(0, 5), p.vol_ville, p.vol_terminal ? `T. ${p.vol_terminal}` : ''].filter(Boolean).join(' · ')}</span>
          </DRow>
        )}
        {vehLbl && <DRow label="Vehicle">{vehLbl}</DRow>}
        <DRow label="Passengers">{p.nb_passagers ?? 1}{(p.nb_bagages ?? 0) > 0 ? ` · ${p.nb_bagages} bag(s)` : ''}</DRow>
        {(asg.chauffeurs.length > 0 || asg.veh) && (
          <DRow label={asg.chauffeurs.length > 1 ? 'Drivers' : 'Driver'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {asg.chauffeurs.map((c, k) => (
                <span key={k} style={{ color: '#1e5e3a', fontWeight: 600 }}>
                  {c.nom}{c.tel ? <> · <a href={`tel:${c.tel}`} style={{ color: '#1e5e3a', textDecoration: 'none' }}>{c.tel}</a></> : ''}
                </span>
              ))}
              {asg.veh && <span style={{ color: '#16130e' }}>{asg.veh}</span>}
            </div>
          </DRow>
        )}
        {validated && price > 0 && (
          <DRow label="Price"><span style={{ fontWeight: 700 }}>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price)} <span style={{ fontSize: '10px', color: '#8a8478', fontWeight: 400 }}>excl. VAT</span></span></DRow>
        )}
        {p.validation_statut === 'refusee' && p.refus_motif && (
          <DRow label="Reason"><span style={{ color: '#9e2a2a' }}>{p.refus_motif}</span></DRow>
        )}
      </div>

      {canEdit && onEdit && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={onEdit} className="btn-ghost" style={{ padding: '5px 12px', fontSize: '11px', gap: '5px' }}><Pencil size={12} /> Edit service</button>
          {validated && <span style={{ fontSize: '10px', color: '#8a8478', fontStyle: 'italic' }}>Editing sends it back for review.</span>}
        </div>
      )}
    </div>
  )
}

// ── New request form ───────────────────────────
function makeService(): any {
  return { type: 'transfert', date_debut: '', date_fin: '', heure_depart: '', heure_debut_journee: '09:00', heure_fin_journee: '18:00', adresse_depart: '', adresse_arrivee: '', vol_numero: '', vol_heure: '', vol_ville: '', vol_terminal: '', modele_souhaite: '', nb_passagers: 1, nb_bagages: 0 }
}

function NewRequest({ onDone, initial, mode = 'new', dossierId, prestationId }: { onDone: () => void; initial?: any; mode?: 'new' | 'edit' | 'add' | 'edit-service'; dossierId?: string; prestationId?: string }) {
  const [services, setServices] = useState<any[]>(initial?.services ?? [makeService()])
  const [passengers, setPassengers] = useState<any[]>(initial?.passengers ?? [])
  const [notes, setNotes] = useState<string>(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const isEditService = mode === 'edit-service'

  function upd(i: number, patch: any) { setServices(prev => prev.map((s, k) => k === i ? { ...s, ...patch } : s)) }

  async function submit() {
    if (services.some(s => !s.date_debut)) return toast.error('Please set a date for each service')
    setSaving(true)
    try {
      if (isEditService) {
        // Édition d'un seul service → repasse en validation dispatch
        const res = await fetch(`/api/agence/prestations/${prestationId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(services[0]),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error')
        toast.success('Service updated — sent for review')
        onDone()
        return
      }
      const url = mode === 'new' ? '/api/agence/dossiers'
        : mode === 'add' ? `/api/agence/dossiers/${dossierId}/services`
        : `/api/agence/dossiers/${dossierId}`
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, prestations: services, passagers: passengers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      toast.success(mode === 'new' ? `Request ${json.data.numero} submitted` : mode === 'add' ? 'Service(s) added' : 'Request updated')
      onDone()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', background: '#fff', border: '1.5px solid #c9c2b6', borderRadius: '8px', padding: '9px 11px', fontSize: '13px', outline: 'none', color: '#16130e' }
  const lbl: React.CSSProperties = { fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#8a8478', display: 'block', marginBottom: '4px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {isEditService && (
        <div style={{ background: '#fdf3dc', border: '1px solid rgba(122,92,16,0.3)', borderRadius: '10px', padding: '11px 13px', fontSize: '12px', color: '#7a5c10', lineHeight: 1.5 }}>
          {initial?.wasValidated
            ? 'This service is confirmed. Saving your changes will send it back to Star Tourism Services for review and re-pricing.'
            : 'Edit this service — it will be reviewed by Star Tourism Services.'}
        </div>
      )}
      {services.map((s, i) => {
        const isMad = s.type === 'mad'
        return (
          <div key={i} style={{ background: '#fff', border: '1.5px solid #d8d2c8', borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['transfert', 'mad'] as const).map(t => (
                  <button key={t} onClick={() => upd(i, { type: t })}
                    style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '8px', border: 'none', background: s.type === t ? '#16130e' : '#f0eeeb', color: s.type === t ? '#fff' : '#5a564e' }}>
                    {t === 'transfert' ? 'Transfer' : 'Chauffeur service'}
                  </button>
                ))}
              </div>
              {services.length > 1 && <button onClick={() => setServices(prev => prev.filter((_, k) => k !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e2a2a' }}><Trash2 size={16} /></button>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div><label style={lbl}>{isMad ? 'Start date' : 'Date'}</label><input type="date" style={inp} value={s.date_debut} onChange={e => upd(i, { date_debut: e.target.value, ...(isMad ? {} : { date_fin: e.target.value }) })} /></div>
              {isMad
                ? <div><label style={lbl}>End date</label><input type="date" style={inp} value={s.date_fin} min={s.date_debut} onChange={e => upd(i, { date_fin: e.target.value })} /></div>
                : <div><label style={lbl}>Pick-up time</label><input type="time" style={inp} value={s.heure_depart} onChange={e => upd(i, { heure_depart: e.target.value })} /></div>}
            </div>

            {isMad && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div><label style={lbl}>From</label><input type="time" style={inp} value={s.heure_debut_journee} onChange={e => upd(i, { heure_debut_journee: e.target.value })} /></div>
                <div><label style={lbl}>To</label><input type="time" style={inp} value={s.heure_fin_journee} onChange={e => upd(i, { heure_fin_journee: e.target.value })} /></div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isMad ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div><label style={lbl}>{isMad ? 'Location' : 'Pick-up address'}</label><input style={inp} value={s.adresse_depart} onChange={e => upd(i, { adresse_depart: e.target.value })} placeholder="Address, city, hotel…" /></div>
              {!isMad && <div><label style={lbl}>Drop-off address</label><input style={inp} value={s.adresse_arrivee} onChange={e => upd(i, { adresse_arrivee: e.target.value })} placeholder="Address, city, airport…" /></div>}
            </div>

            {!isMad && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div><label style={lbl}>Flight / train no.</label><input style={inp} value={s.vol_numero} onChange={e => upd(i, { vol_numero: e.target.value.toUpperCase() })} placeholder="EY031" /></div>
                <div><label style={lbl}>Flight time</label><input type="time" style={inp} value={s.vol_heure} onChange={e => upd(i, { vol_heure: e.target.value })} /></div>
                <div><label style={lbl}>From/To city</label><input style={inp} value={s.vol_ville} onChange={e => upd(i, { vol_ville: e.target.value })} placeholder="Abu Dhabi" /></div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr', gap: '10px' }}>
              <div><label style={lbl}>Vehicle preference</label>
                <select style={inp} value={s.modele_souhaite} onChange={e => upd(i, { modele_souhaite: e.target.value })}>
                  <option value="">Any</option>
                  {VEHICLES.map(v => <option key={v.value} value={v.value}>{v.en}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Passengers</label><input type="number" min={1} style={inp} value={s.nb_passagers} onChange={e => upd(i, { nb_passagers: Number(e.target.value) })} /></div>
              <div><label style={lbl}>Bags</label><input type="number" min={0} style={inp} value={s.nb_bagages} onChange={e => upd(i, { nb_bagages: Number(e.target.value) })} /></div>
            </div>
          </div>
        )
      })}

      {!isEditService && (
        <button onClick={() => setServices(prev => [...prev, makeService()])} className="btn-ghost" style={{ justifyContent: 'center' }}><Plus size={14} /> Add another service</button>
      )}

      {/* Passengers */}
      {!isEditService && (
        <div style={{ background: '#fff', border: '1.5px solid #d8d2c8', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16130e', display: 'flex', alignItems: 'center', gap: '7px' }}><Users size={15} /> Passengers (optional)</span>
            <button onClick={() => setPassengers(prev => [...prev, { nom: '', nationalite: '', telephone: '', nb_bagages: 0 }])} className="btn-or" style={{ padding: '6px 12px', fontSize: '11px' }}><Plus size={12} /> Add</button>
          </div>
          {passengers.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 150px' }}><label style={lbl}>Name</label><input style={inp} value={p.nom} onChange={e => setPassengers(prev => prev.map((x, k) => k === i ? { ...x, nom: e.target.value } : x))} placeholder="Mr John Smith" /></div>
              <div style={{ flex: '0 1 70px' }}><label style={lbl}>Country</label><input style={inp} maxLength={2} value={p.nationalite} onChange={e => setPassengers(prev => prev.map((x, k) => k === i ? { ...x, nationalite: e.target.value.toUpperCase() } : x))} placeholder="AE" /></div>
              <div style={{ flex: '1 1 120px' }}><label style={lbl}>Phone</label><input style={inp} value={p.telephone} onChange={e => setPassengers(prev => prev.map((x, k) => k === i ? { ...x, telephone: e.target.value } : x))} /></div>
              <button onClick={() => setPassengers(prev => prev.filter((_, k) => k !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e2a2a', paddingBottom: '8px' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {!isEditService && (
        <div><label style={lbl}>Notes / instructions (optional)</label><textarea style={{ ...inp, minHeight: '64px', resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special request…" /></div>
      )}

      <button onClick={submit} disabled={saving} className="btn-primary" style={{ justifyContent: 'center', padding: '14px', fontSize: '14px' }}>
        <Send size={16} /> {saving ? 'Saving…' : mode === 'new' ? 'Submit request' : mode === 'add' ? 'Add to request' : isEditService ? 'Save & resubmit' : 'Save changes'}
      </button>
      <p style={{ fontSize: '11px', color: '#8a8478', textAlign: 'center', lineHeight: 1.5 }}>
        Each service will be reviewed and priced by Star Tourism Services. You will see the status update here.
      </p>
    </div>
  )
}
