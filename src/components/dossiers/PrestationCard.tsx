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
  const typeColor = p.type === 'mad' ? '#7a5c10' : '#1e3f70'
  const typeLabel = p.type === 'mad' ? 'Mise à disposition' : 'Transfert'
  const jours     = p.jours ?? []
  const joursManquants = jours.filter((j: any) => !j.chauffeur_id).length
  const [chauffeurs, setChauffeurs] = useState<any[]>([])
  const [joursState, setJoursState] = useState<Record<string, string>>(
    Object.fromEntries(jours.map((j: any) => [j.id, j.chauffeur_id ?? '']))
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

  useEffect(() => {
    fetch('/api/chauffeurs').then(r => r.json()).then(d => setChauffeurs(d.data ?? []))
  }, [])

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

  async function affecterChauffeurJour(jourId: string, chauffeurId: string) {
    setSavingJour(jourId)
    setJoursState(prev => ({ ...prev, [jourId]: chauffeurId }))
    try {
      await fetch(`/api/jours-mad/${jourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chauffeur_id: chauffeurId || null }),
      })
      toast.success('Chauffeur affecté !')
      router.push(`/dashboard/dossiers/${dossierId}`)
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
      router.push(`/dashboard/dossiers/${dossierId}`)
    } catch { toast.error('Erreur') }
  }

  return (
    <div className="card" style={{ overflow:'hidden' }}>

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
          <StatutSelector prestation={p} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'12px' }}>
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
                {chauffeurs.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
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
          display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px',
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
            <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'6px' }}>
              Détail journalier
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr 80px', gap:'6px', padding:'4px 8px', background:'#faf9f7', marginBottom:'2px' }}>
              {['Date','Chauffeur','Note','Tarif HT'].map(h => (
                <div key={h} style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>{h}</div>
              ))}
            </div>
            {jours.map((j: any) => {
              const missing = !j.chauffeur_id
              return (
                <div key={j.id} style={{
                  display:'grid', gridTemplateColumns:'90px 1fr 1fr 80px', gap:'6px',
                  alignItems:'center', padding:'6px 8px', marginBottom:'2px',
                  background: missing ? '#fdf3dc' : '#f5f2ed',
                  border: missing ? '1px solid rgba(122,92,16,0.3)' : '1px solid #d8d2c8',
                }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color: missing ? '#7a5c10' : '#2e2b25' }}>
                    {j.jour_semaine} {format(new Date(j.date),'dd/MM',{locale:fr})}
                  </span>
                  <select
                    value={joursState[j.id] ?? ''}
                    onChange={e => affecterChauffeurJour(j.id, e.target.value)}
                    disabled={savingJour === j.id}
                    style={{
                      background: missing ? '#fff8e8' : '#fff',
                      border: `1px solid ${missing ? '#9a7a28' : '#b8b0a4'}`,
                      padding:'4px 8px', fontSize:'11px', color:'#16130e',
                      outline:'none', width:'100%', cursor:'pointer',
                    }}>
                    <option value="">— Non affecté —</option>
                    {chauffeurs.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                    ))}
                  </select>
                  <span style={{ fontSize:'10px', color:'#8a8478', fontStyle:'italic' }}>{j.note || '—'}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28', textAlign:'right' }}>
                    {fmt(j.tarif_ht)}
                  </span>
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
