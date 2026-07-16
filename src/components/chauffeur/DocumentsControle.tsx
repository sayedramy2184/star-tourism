'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  ShieldCheck, X, ChevronLeft, FileText, FileCheck2, ScrollText,
  Maximize2, ExternalLink, AlertCircle,
} from 'lucide-react'

function one(v: any) { return Array.isArray(v) ? v[0] : v }

interface Mission {
  id: string
  kind: 'Transfert' | 'Mise à disposition'
  dossierNum?: string
  clientNom?: string
  vehicule?: string | null
  date?: string
  heureDebut?: string | null
  heureFin?: string | null
  adresse?: string | null
  passagers?: { nom: string; nationalite?: string | null }[]
}

// Drapeau ISO2 → emoji
function flagE(code?: string | null) {
  if (!code) return ''
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65, 0x1f1e6 + c.charCodeAt(1) - 65)
}
function resolvePax(dossier: any, passagerIds: string[] | null | undefined) {
  const all = dossier?.passagers ?? []
  return (passagerIds?.length ? all.filter((p: any) => passagerIds.includes(p.id)) : all)
}

interface DocsData {
  societe: { nom: string | null; gerant_nom: string | null; adresse: string | null; code_postal: string | null; ville: string | null; siret: string | null; numero_tva: string | null; telephone: string | null }
  signature: { url: string; kind: string } | null
  attestation: { url: string; kind: 'pdf' | 'image' } | null
  licence: { url: string; kind: 'pdf' | 'image' } | null
}

type View = 'menu' | 'pick' | 'ordre' | 'attestation' | 'licence'

function normalize(jours: any[], transferts: any[]): Mission[] {
  const t = transferts.map((x): Mission => {
    const d = one(x.dossier); const c = one(d?.client); const v = one(x.vehicule)
    return {
      id: x.id, kind: 'Transfert',
      dossierNum: d?.numero, clientNom: c?.nom,
      vehicule: v ? `${v.marque} ${v.modele} · ${v.immatriculation}` : (x.modele_souhaite ?? null),
      date: x.date_debut, heureDebut: x.heure_depart?.slice(0, 5) ?? null, heureFin: null,
      adresse: x.adresse_depart ?? null,
      passagers: resolvePax(d, x.passager_ids),
    }
  })
  const m = jours.map((x): Mission => {
    const p = one(x.prestation); const d = one(p?.dossier); const c = one(d?.client); const v = one(x.vehicule)
    return {
      id: x.id, kind: 'Mise à disposition',
      dossierNum: d?.numero, clientNom: c?.nom,
      vehicule: v ? `${v.marque} ${v.modele} · ${v.immatriculation}` : (p?.modele_souhaite ?? null),
      date: x.date, heureDebut: p?.heure_debut_journee?.slice(0, 5) ?? null, heureFin: p?.heure_fin_journee?.slice(0, 5) ?? null,
      adresse: p?.adresse_depart ?? null,
      passagers: resolvePax(d, p?.passager_ids),
    }
  })
  return [...t, ...m]
}

export default function DocumentsControle({ jours, transferts, chauffeur }: {
  jours: any[]
  transferts: any[]
  chauffeur: { prenom: string; nom: string; vtc_card_numero: string | null }
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [docs, setDocs] = useState<DocsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [missionId, setMissionId] = useState<string | null>(null)
  const [presenting, setPresenting] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<any>(null)

  const missions = normalize(jours, transferts)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/chauffeur/documents')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setDocs(json.data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  function openCenter() {
    setView('menu')
    setOpen(true)
    if (!docs) loadDocs()
  }

  function goOrdre() {
    if (missions.length === 0) return toast.error('Aucune mission ce jour')
    if (missions.length === 1) { setMissionId(missions[0].id); setView('ordre') }
    else setView('pick')
  }

  // ── Mode « Présenter aux autorités » : plein écran + veille désactivée ──
  const enterPresent = useCallback(async () => {
    const el = docRef.current
    if (el?.requestFullscreen) {
      try { await el.requestFullscreen() } catch {}
    }
    try {
      const nav: any = navigator
      if (nav.wakeLock?.request) wakeRef.current = await nav.wakeLock.request('screen')
    } catch {}
    setPresenting(true)
  }, [])

  const exitPresent = useCallback(async () => {
    if (document.fullscreenElement) { try { await document.exitFullscreen() } catch {} }
    try { await wakeRef.current?.release?.() } catch {}
    wakeRef.current = null
    setPresenting(false)
  }, [])

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setPresenting(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Réacquiert le wake lock si l'onglet redevient visible en mode présentation
  useEffect(() => {
    const onVis = async () => {
      if (presenting && document.visibilityState === 'visible') {
        try { const nav: any = navigator; if (nav.wakeLock?.request) wakeRef.current = await nav.wakeLock.request('screen') } catch {}
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [presenting])

  function close() { exitPresent(); setOpen(false) }

  const selectedMission = missions.find(m => m.id === missionId)

  return (
    <>
      {/* ── Bouton déclencheur — barre fixe très visible ── */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', padding: '10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)', background: 'linear-gradient(to top, #ede9e2 70%, transparent)', zIndex: 30 }}>
        <button onClick={openCenter}
          style={{ width: '100%', background: '#16130e', color: '#fff', border: '1.5px solid #9a7a28', padding: '15px', fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          <ShieldCheck size={20} style={{ color: '#9a7a28' }} /> Documents de contrôle
        </button>
      </div>

      {!open ? null : (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── Barre supérieure ── */}
          {!presenting && (
            <div style={{ background: '#16130e', padding: 'max(env(safe-area-inset-top), 12px) 14px 12px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {view !== 'menu' ? (
                <button onClick={() => setView(view === 'ordre' && missions.length > 1 ? 'pick' : 'menu')}
                  style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                  <ChevronLeft size={18} /> Retour
                </button>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                  <ShieldCheck size={17} style={{ color: '#9a7a28' }} /> Documents de contrôle
                </span>
              )}
              <button onClick={close} aria-label="Fermer" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
          )}

          {/* ── Contenu ── */}
          <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
            {loading && view === 'menu' ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#8a8478' }}>Chargement…</div>
            ) : view === 'menu' ? (
              <Menu missions={missions} docs={docs} onOrdre={goOrdre}
                onAttestation={() => setView('attestation')} onLicence={() => setView('licence')} />
            ) : view === 'pick' ? (
              <MissionPicker missions={missions} onPick={(id) => { setMissionId(id); setView('ordre') }} />
            ) : view === 'ordre' && selectedMission && docs ? (
              <DocFrame docRef={docRef} presenting={presenting} onPresent={enterPresent} onExit={exitPresent}>
                <OrdreMission mission={selectedMission} chauffeur={chauffeur} docs={docs} />
              </DocFrame>
            ) : view === 'attestation' ? (
              <DocFrame docRef={docRef} presenting={presenting} onPresent={enterPresent} onExit={exitPresent} fileUrl={docs?.attestation?.url}>
                <FileViewer doc={docs?.attestation} label="Attestation d'assurance transport de personnes" />
              </DocFrame>
            ) : view === 'licence' ? (
              <DocFrame docRef={docRef} presenting={presenting} onPresent={enterPresent} onExit={exitPresent} fileUrl={docs?.licence?.url}>
                <FileViewer doc={docs?.licence} label="Licence EVTC" />
              </DocFrame>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

// ── Menu des 3 documents ──
function Menu({ missions, docs, onOrdre, onAttestation, onLicence }: any) {
  const Item = ({ icon, title, sub, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}
      style={{ width: '100%', textAlign: 'left', background: disabled ? '#f5f2ed' : '#fff', border: '1.5px solid #d8d2c8', borderLeft: `4px solid ${disabled ? '#c2bdb4' : '#9a7a28'}`, padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <span style={{ color: disabled ? '#c2bdb4' : '#9a7a28', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#16130e' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12px', color: '#8a8478', marginTop: '2px' }}>{sub}</span>
      </span>
    </button>
  )
  return (
    <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '12px', color: '#5a564e', lineHeight: 1.5, background: '#fdf6e3', border: '1px solid rgba(154,122,40,0.25)', padding: '10px 12px' }}>
        À présenter en cas de contrôle des forces de l'ordre.
      </p>
      <Item icon={<FileText size={22} />} title="Ordre de mission" onClick={onOrdre}
        disabled={missions.length === 0}
        sub={missions.length === 0 ? 'Aucune mission ce jour' : `${missions.length} mission${missions.length > 1 ? 's' : ''} — généré automatiquement`} />
      <Item icon={<FileCheck2 size={22} />} title="Attestation d'assurance" onClick={onAttestation}
        disabled={!docs?.attestation}
        sub={docs?.attestation ? 'Transport de personnes' : 'Non fournie par la société'} />
      <Item icon={<ScrollText size={22} />} title="Licence EVTC" onClick={onLicence}
        disabled={!docs?.licence}
        sub={docs?.licence ? 'Exploitation VTC' : 'Non fournie par la société'} />
    </div>
  )
}

// ── Sélecteur de mission (si plusieurs) ──
function MissionPicker({ missions, onPick }: { missions: Mission[]; onPick: (id: string) => void }) {
  return (
    <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '13px', color: '#5a564e', marginBottom: '2px' }}>Choisissez la mission :</div>
      {missions.map(m => (
        <button key={m.id} onClick={() => onPick(m.id)}
          style={{ textAlign: 'left', background: '#fff', border: '1.5px solid #d8d2c8', borderLeft: `4px solid ${m.kind === 'Transfert' ? '#1e3f70' : '#7a5c10'}`, padding: '13px', cursor: 'pointer' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: m.kind === 'Transfert' ? '#1e3f70' : '#7a5c10' }}>
            {m.kind}{m.heureDebut ? ` · ${m.heureDebut}` : ''}
          </div>
          <div style={{ fontSize: '15px', color: '#16130e', marginTop: '2px' }}>{m.clientNom}</div>
          <div style={{ fontSize: '11px', color: '#8a8478', fontFamily: 'JetBrains Mono,monospace' }}>{m.dossierNum}</div>
        </button>
      ))}
    </div>
  )
}

// ── Cadre document + boutons présentation ──
function DocFrame({ docRef, presenting, onPresent, onExit, fileUrl, children }: any) {
  return (
    <div style={{ position: 'relative', minHeight: '100%', background: '#fff' }}>
      <div ref={docRef} style={{ background: '#fff', minHeight: presenting ? '100dvh' : 'auto' }}>
        {children}
      </div>
      {/* Barre d'actions */}
      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e6e0d6', padding: '10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)', display: 'flex', gap: '8px' }}>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-ghost"
            style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', padding: '13px' }}>
            <ExternalLink size={15} /> Ouvrir
          </a>
        )}
        {presenting ? (
          <button onClick={onExit} style={{ flex: 2, background: '#9e2a2a', color: '#fff', border: 'none', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            Quitter la présentation
          </button>
        ) : (
          <button onClick={onPresent} style={{ flex: 2, background: '#16130e', color: '#fff', border: 'none', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Maximize2 size={16} /> Présenter aux autorités
          </button>
        )}
      </div>
    </div>
  )
}

// ── Visionneuse fichier (image / PDF) ──
function FileViewer({ doc, label }: { doc: { url: string; kind: 'pdf' | 'image' } | null; label: string }) {
  if (!doc) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8a8478' }}>
        <AlertCircle size={28} style={{ color: '#c2bdb4', marginBottom: '10px' }} />
        <div>Document non disponible. Demandez à votre société de le fournir.</div>
      </div>
    )
  }
  return (
    <div style={{ background: '#fff' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e6e0d6', fontSize: '13px', fontWeight: 600, color: '#16130e' }}>{label}</div>
      {doc.kind === 'image' ? (
        <img src={doc.url} alt={label} style={{ width: '100%', display: 'block' }} />
      ) : (
        <iframe src={doc.url} title={label} style={{ width: '100%', height: '78vh', border: 'none', background: '#fff' }} />
      )}
    </div>
  )
}

// ── Ordre de mission (généré) ──
function OrdreMission({ mission, chauffeur, docs }: { mission: Mission; chauffeur: any; docs: DocsData }) {
  const s = docs.societe
  const dateStr = mission.date ? format(parseISO(mission.date), 'EEEE d MMMM yyyy', { locale: fr }) : '—'
  const Field = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
      <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#666' }}>{label}</div>
      <div style={{ fontSize: '16px', color: '#000', marginTop: '3px', fontFamily: mono ? 'JetBrains Mono,monospace' : 'inherit' }}>{value || '—'}</div>
    </div>
  )
  return (
    <div style={{ background: '#fff', color: '#000', padding: '20px 18px 24px', maxWidth: '480px', margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', borderBottom: '2px solid #000' }}>
        <div style={{ width: '46px', height: '46px', border: '2px solid #9a7a28', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#9a7a28', fontWeight: 600, flexShrink: 0 }}>✦</div>
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', fontWeight: 600, color: '#000', lineHeight: 1 }}>{s.nom ?? 'Star Tourism Services'}</div>
          {s.siret && <div style={{ fontSize: '10px', color: '#444', marginTop: '2px' }}>SIRET {s.siret}</div>}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0 6px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '26px', fontWeight: 600, letterSpacing: '2px', color: '#000' }}>ORDRE DE MISSION</div>
        {mission.dossierNum && <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '13px', color: '#9a7a28', marginTop: '2px' }}>{mission.dossierNum}</div>}
      </div>

      <Field label="Chauffeur" value={`${chauffeur.prenom} ${chauffeur.nom}`} />
      <Field label="Carte professionnelle VTC" value={chauffeur.vtc_card_numero} mono />
      <Field label="Véhicule" value={mission.vehicule} />
      <Field label="Client" value={mission.clientNom} />
      {(mission.passagers?.length ?? 0) > 0 && (
        <Field label="Passager(s)" value={mission.passagers!.map(p => `${flagE(p.nationalite)} ${p.nom}`.trim()).join(', ')} />
      )}
      <Field label="Type de prestation" value={mission.kind} />
      <Field label="Date" value={<span style={{ textTransform: 'capitalize' }}>{dateStr}</span>} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <Field label="Heure de début" value={mission.heureDebut} mono />
        <Field label="Heure de fin prévue" value={mission.heureFin} mono />
      </div>
      <Field label="Adresse de prise en charge" value={mission.adresse} />

      {/* Signature */}
      <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: '11px', color: '#444', lineHeight: 1.5 }}>
          <div>Fait à {s.ville ?? '—'}, le {format(new Date(), 'dd/MM/yyyy')}</div>
          <div style={{ marginTop: '4px' }}>Le gérant{s.gerant_nom ? ` — ${s.gerant_nom}` : ''}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '120px' }}>
          {docs.signature?.url
            ? <img src={docs.signature.url} alt="Signature" style={{ maxHeight: '64px', maxWidth: '130px', objectFit: 'contain' } as any} />
            : <div style={{ height: '48px', borderBottom: '1px solid #999' }} />}
          <div style={{ fontSize: '9px', color: '#888', marginTop: '3px', letterSpacing: '1px', textTransform: 'uppercase' }}>Signature / cachet</div>
        </div>
      </div>

      <div style={{ fontSize: '9px', color: '#999', textAlign: 'center', marginTop: '18px' }}>
        Document généré automatiquement — {s.nom ?? 'Star Tourism Services'}
      </div>
    </div>
  )
}
