'use client'

import { calcStatutClient, STATUT_MAP } from '@/lib/statut'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  format, addWeeks, addMonths, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, parseISO, isToday, isSameDay
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Calendar, LayoutGrid, Users, Car } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────

interface Chauffeur { id: string; nom: string; prenom: string; statut: string }
interface Vehicule  { id: string; marque: string; modele: string; immatriculation: string; statut: string }

interface JourMad {
  id: string; date: string; tarif_ht: number; statut: string; note: string | null
  chauffeur_id: string | null; sous_traitant_id: string | null; vehicule_id: string | null
  chauffeur: { nom: string; prenom: string } | null
  vehicule:  { marque: string; modele: string; immatriculation: string } | null
  sous_traitant: { id: string; societe: string } | null
  prestation: {
    id: string; statut: string | null; date_debut: string | null; date_fin: string | null
    heure_debut_journee: string | null; heure_fin_journee: string | null
    adresse_depart: string | null; modele_souhaite: string | null
    vehicule: { id: string; marque: string; modele: string; immatriculation: string } | null
    dossier: { id: string; numero: string; client: { nom: string } }
  }
}

// Véhicule effectif d'un jour MAD : celui affecté au jour, sinon celui de la prestation
function jourVehiculeId(j: JourMad): string | null {
  return j.vehicule_id ?? j.prestation?.vehicule?.id ?? null
}

interface Transfert {
  id: string; date_debut: string; heure_depart: string | null; statut: string
  adresse_depart: string | null; adresse_arrivee: string | null; tarif_fixe_ht: number | null
  chauffeur_id: string | null; sous_traitant_id: string | null; vehicule_id: string | null
  chauffeur: { nom: string; prenom: string } | null
  vehicule:  { marque: string; modele: string; immatriculation: string } | null
  sous_traitant: { id: string; societe: string } | null
  dossier: { id: string; numero: string; client: { nom: string } }
}

type ViewMode    = 'semaine' | 'mois'
type PlanningTab = 'missions' | 'chauffeurs' | 'vehicules'

// ── Page principale ───────────────────────────

export default function PlanningPage() {
  const router = useRouter()
  const [tab,         setTab]         = useState<PlanningTab>('missions')
  const [viewMode,    setViewMode]    = useState<ViewMode>('semaine')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [data,        setData]        = useState<{ chauffeurs: Chauffeur[]; vehicules: Vehicule[]; jours: JourMad[]; transferts: Transfert[] } | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [tooltip,     setTooltip]     = useState<{ x: number; y: number; content: any } | null>(null)
  const [dragJourId,  setDragJourId]  = useState<string | null>(null)
  const [dragOver,    setDragOver]    = useState<string | null>(null) // chauffeur_id

  const dateRange = viewMode === 'semaine'
    ? { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) }
    : { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }

  const days = eachDayOfInterval(dateRange)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/planning?date_debut=${format(dateRange.start,'yyyy-MM-dd')}&date_fin=${format(dateRange.end,'yyyy-MM-dd')}`)
      const { data: d } = await res.json()
      setData(d)
    } catch { toast.error('Erreur de chargement') }
    setLoading(false)
  }, [currentDate, viewMode])

  useEffect(() => { load() }, [load])

  function prev() { setCurrentDate(d => viewMode === 'semaine' ? subWeeks(d,1) : subMonths(d,1)) }
  function next() { setCurrentDate(d => viewMode === 'semaine' ? addWeeks(d,1) : addMonths(d,1)) }

  // Drag & drop : affecter un chauffeur à un jour MAD
  async function handleDrop(chauffeurId: string) {
    if (!dragJourId) return
    setDragOver(null)
    try {
      const res = await fetch('/api/planning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jour_id: dragJourId, chauffeur_id: chauffeurId }),
      })
      if (res.ok) { toast.success('Chauffeur affecté !'); load() }
      else toast.error('Erreur lors de l\'affectation')
    } catch { toast.error('Erreur') }
    setDragJourId(null)
  }

  const periodLabel = viewMode === 'semaine'
    ? `${format(dateRange.start,'d MMM',{locale:fr})} — ${format(dateRange.end,'d MMM yyyy',{locale:fr})}`
    : format(currentDate, 'MMMM yyyy', { locale: fr })

  // Stats alertes
  const joursSansChauf   = data?.jours.filter(j => !j.chauffeur_id && !j.sous_traitant_id) ?? []
  const totalMissions    = (data?.jours.length ?? 0) + (data?.transferts.length ?? 0)
  const joursSansVehicule = data?.jours.filter(j => !jourVehiculeId(j)) ?? []
  const transfertsSansChauf = data?.transferts.filter(t => !t.chauffeur_id && !t.sous_traitant_id) ?? []

  // Conflits : même chauffeur, même jour, 2+ missions
  const conflits: string[] = []
  if (data) {
    days.forEach(day => {
      const dateStr = format(day,'yyyy-MM-dd')
      data.chauffeurs.forEach(c => {
        const nb = (data.jours.filter(j => j.chauffeur_id === c.id && j.date === dateStr).length) +
                   (data.transferts.filter(t => t.chauffeur_id === c.id && t.date_debut === dateStr).length)
        if (nb > 1) conflits.push(`${c.prenom} ${c.nom} — ${format(day,'dd/MM',{locale:fr})}`)
      })
    })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100dvh - 56px - 40px)', minHeight:'420px', overflow:'hidden' }}>

      {/* ══ Toolbar ══ */}
      <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', padding:'10px 16px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', flexWrap:'wrap' }}>

        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
          <NavBtn onClick={prev}><ChevronLeft size={13}/></NavBtn>
          <NavBtn onClick={() => setCurrentDate(new Date())} label="Aujourd'hui" />
          <NavBtn onClick={next}><ChevronRight size={13}/></NavBtn>
        </div>

        {/* Période */}
        <div style={{ minWidth:'190px' }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'18px', fontWeight:500, color:'#16130e', lineHeight:1.1 }}>
            {periodLabel}
          </div>
          {data && (
            <div style={{ fontSize:'10px', color:'#8a8478', marginTop:'1px' }}>
              {totalMissions} mission{totalMissions > 1 ? 's' : ''}
              {(joursSansChauf.length + transfertsSansChauf.length) > 0 && (
                <span style={{ color:'#7a5c10', fontWeight:600 }}> · {joursSansChauf.length + transfertsSansChauf.length} à affecter</span>
              )}
            </div>
          )}
        </div>

        {/* Vue semaine / mois */}
        <div style={{ display:'flex', gap:'3px' }}>
          {([['semaine','Semaine'],['mois','Mois']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{ padding:'5px 12px', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', cursor:'pointer', border:'1.5px solid #b8b0a4', background: viewMode===v ? '#16130e' : 'transparent', color: viewMode===v ? '#fff' : '#5a564e', transition:'all 0.14s' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Onglets missions / chauffeurs / véhicules */}
        <div className="hidden md:flex" style={{ gap:'3px', borderLeft:'1px solid #d8d2c8', paddingLeft:'10px' }}>
          {([
            ['missions',  'Missions',  <Calendar size={11}/>],
            ['chauffeurs','Chauffeurs',<Users size={11}/>],
            ['vehicules', 'Véhicules', <Car size={11}/>],
          ] as const).map(([v,l,icon]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', cursor:'pointer', border:'1.5px solid #b8b0a4', background: tab===v ? '#9a7a28' : 'transparent', color: tab===v ? '#fff' : '#5a564e', transition:'all 0.14s' }}>
              {icon} {l}
            </button>
          ))}
        </div>

        {/* Alertes */}
        <div style={{ marginLeft:'auto', display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
          {joursSansChauf.length > 0 && (
            <Alert color="#7a5c10" bg="#fdf3dc" border="rgba(122,92,16,0.3)">
              <AlertTriangle size={11}/> {joursSansChauf.length + transfertsSansChauf.length} sans chauffeur
            </Alert>
          )}
          {conflits.length > 0 && (
            <Alert color="#9e2a2a" bg="#faeaea" border="rgba(158,42,42,0.3)">
              <AlertTriangle size={11}/> {conflits.length} conflit{conflits.length>1?'s':''}
            </Alert>
          )}
          <Legende />
          <button className="btn-primary" style={{ padding:'6px 14px', fontSize:'11px' }}
            onClick={() => router.push('/dashboard/dossiers/nouveau')}>
            <Plus size={12}/> Mission
          </button>
        </div>
      </div>

      {/* ══ Contenu ══ */}
      <div style={{ flex:1, overflow:'auto', background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#8a8478', fontSize:'12px' }}>
            Chargement…
          </div>
        ) : (
          <>
            {/* ── Mobile : agenda jour par jour ── */}
            <div className="only-mobile">
              <PlanningMobile days={days} data={data} router={router} />
            </div>

            {/* ── Desktop : gantt ── */}
            <div className="only-desktop">
              {tab === 'missions' ? (
                <MissionsView days={days} viewMode={viewMode} data={data} onTooltip={setTooltip} onDragStart={setDragJourId} router={router} />
              ) : tab === 'chauffeurs' ? (
                <ChauffeursView days={days} viewMode={viewMode} data={data} onTooltip={setTooltip} dragJourId={dragJourId} dragOver={dragOver} onDragStart={setDragJourId} onDragOver={setDragOver} onDrop={handleDrop} conflits={conflits} router={router} />
              ) : (
                <VehiculesView days={days} viewMode={viewMode} data={data} onTooltip={setTooltip} router={router} />
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ Tooltip ══ */}
      {tooltip && (
        <Tooltip tooltip={tooltip} onClose={() => setTooltip(null)} router={router} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
//  VUE MISSIONS — toutes les missions visibles
//  Lignes = dossiers, colonnes = jours
// ══════════════════════════════════════════════

function MissionsView({ days, viewMode, data, onTooltip, onDragStart, router }: any) {
  if (!data) return null

  // Regrouper les jours et transferts par dossier
  const dossiersMap = new Map<string, {
    id: string; numero: string; client: string
    jours: JourMad[]; transferts: Transfert[]
  }>()

  data.jours.forEach((j: JourMad) => {
    const key = j.prestation.dossier.id
    if (!dossiersMap.has(key)) {
      dossiersMap.set(key, { id: key, numero: j.prestation.dossier.numero, client: j.prestation.dossier.client.nom, jours: [], transferts: [] })
    }
    dossiersMap.get(key)!.jours.push(j)
  })

  data.transferts.forEach((t: Transfert) => {
    const key = t.dossier.id
    if (!dossiersMap.has(key)) {
      dossiersMap.set(key, { id: key, numero: t.dossier.numero, client: t.dossier.client.nom, jours: [], transferts: [] })
    }
    dossiersMap.get(key)!.transferts.push(t)
  })

  const dossiers = Array.from(dossiersMap.values())

  if (dossiers.length === 0) {
    return (
      <div style={{ padding:'80px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
        Aucune mission sur cette période — <span style={{ color:'#9a7a28', cursor:'pointer', textDecoration:'underline' }} onClick={() => router.push('/dashboard/dossiers/nouveau')}>créer un dossier</span>
      </div>
    )
  }

  const colW = viewMode === 'semaine' ? 104 : 46
  const minWidth = 180 + days.length * colW

  return (
    <table style={{ borderCollapse:'collapse', width:'100%', minWidth, tableLayout:'fixed' }}>
      <colgroup>
        <col style={{ width:'180px' }} />
        {days.map((_: any, i: number) => <col key={i} />)}
      </colgroup>
      <GanttHeader days={days} viewMode={viewMode} firstColLabel="Dossier / Client" />
      <tbody>
        {dossiers.map((dos, idx) => (
          <tr key={dos.id} style={{ borderBottom:'1px solid #d8d2c8' }}>
            {/* Colonne dossier */}
            <td style={{ padding:'8px 12px', background: idx%2===0 ? '#faf9f7' : '#fff', borderRight:'2px solid #b8b0a4', position:'sticky', left:0, zIndex:10, cursor:'pointer' }}
              onClick={() => router.push(`/dashboard/dossiers/${dos.id}`)}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#9a7a28', marginBottom:'2px' }}>{dos.numero}</div>
              <div style={{ fontSize:'12px', fontWeight:600, color:'#16130e', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{dos.client}</div>
            </td>

            {/* Cellules jours */}
            {days.map((day: Date) => {
              const dateStr = format(day,'yyyy-MM-dd')
              const joursDay = dos.jours.filter(j => j.date === dateStr)
              const transDay = dos.transferts.filter(t => t.date_debut === dateStr)
              const today    = isToday(day)
              const weekend  = [0, 6].includes(day.getDay())

              return (
                <td key={dateStr} style={{ padding:'3px', background: today ? '#fdf6e3' : weekend ? '#f1ece4' : idx%2===0 ? '#faf9f7' : '#fff', borderRight:'1px solid #ede9e2', verticalAlign:'top', minHeight:'48px' }}>
                  {joursDay.map(j => {
                    const nonAff = !j.chauffeur_id && !j.sous_traitant_id
                    // Statut calculé pour CE jour précis (et non toute la période de la MAD)
                    const statCalc = calcStatutClient({ statut: j.prestation.statut ?? j.statut, type:'mad', date_debut: j.date, date_fin: j.date, heure_debut_journee: j.prestation.heure_debut_journee, heure_fin_journee: j.prestation.heure_fin_journee })
                    const si = STATUT_MAP[statCalc] ?? STATUT_MAP.en_attente
                    return (
                      <MBlock key={j.id}
                        bg={nonAff ? '#fff8e8' : si.bg} border={nonAff ? '#9a7a28' : si.border.replace('rgba','rgba')} text={nonAff ? '#9a7a28' : si.color}
                        icon="◷" label={`MAD · ${si.label}`}
                        title={nonAff ? '⚠ Sans chauffeur' : `${j.chauffeur?.prenom ?? ''} ${j.chauffeur?.nom ?? ''}`}
                        sub={j.prestation.heure_debut_journee ? `${j.prestation.heure_debut_journee}→${j.prestation.heure_fin_journee}` : null}
                        compact={viewMode==='mois'}
                        draggable={nonAff}
                        onDragStart={() => onDragStart(j.id)}
                        onClick={e => { e.stopPropagation(); onTooltip({ x:e.clientX, y:e.clientY, content: buildMadTooltip(j) }) }}
                      />
                    )
                  })}
                  {transDay.map(t => {
                    const nonAff = !t.chauffeur_id && !t.sous_traitant_id
                    const statCalcT = calcStatutClient({ statut: t.statut, type:'transfert', date_debut: t.date_debut, date_fin: t.date_debut, heure_depart: t.heure_depart })
                    const siT = STATUT_MAP[statCalcT] ?? STATUT_MAP.en_attente
                    return (
                      <MBlock key={t.id}
                        bg={nonAff ? '#eef4fb' : siT.bg} border={nonAff ? '#1e3f70' : siT.color} text={siT.color}
                        icon="→" label={`Transfert · ${siT.label}`}
                        title={nonAff ? '⚠ Sans chauffeur' : `${t.chauffeur?.prenom ?? ''} ${t.chauffeur?.nom ?? ''}`}
                        sub={t.heure_depart ?? null}
                        compact={viewMode==='mois'}
                        draggable={false}
                        onDragStart={() => {}}
                        onClick={e => { e.stopPropagation(); onTooltip({ x:e.clientX, y:e.clientY, content: buildTransTooltip(t) }) }}
                      />
                    )
                  })}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ══════════════════════════════════════════════
//  VUE CHAUFFEURS — disponibilités + affectation
// ══════════════════════════════════════════════

function ChauffeursView({ days, viewMode, data, onTooltip, dragJourId, dragOver, onDragStart, onDragOver, onDrop, conflits, router }: any) {
  if (!data) return null

  const ST: Record<string,{color:string;bg:string}> = {
    disponible:   {color:'#1e5e3a',bg:'#eaf4ee'},
    en_mission:   {color:'#1e3f70',bg:'#e8eef8'},
    indisponible: {color:'#9e2a2a',bg:'#faeaea'},
    conge:        {color:'#7a5c10',bg:'#fdf3dc'},
  }

  // Jours MAD non affectés (ni chauffeur, ni sous-traitant) — pool déplaçable
  const unassigned: JourMad[] = data.jours.filter((j: JourMad) => !j.chauffeur_id && !j.sous_traitant_id)

  const colW = viewMode === 'semaine' ? 104 : 46
  const minWidth = 160 + days.length * colW

  return (
    <table style={{ borderCollapse:'collapse', width:'100%', minWidth, tableLayout:'fixed' }}>
      <colgroup>
        <col style={{ width:'160px' }} />
        {days.map((_: any, i: number) => <col key={i} />)}
      </colgroup>
      <GanttHeader days={days} viewMode={viewMode} firstColLabel="Chauffeur" />
      <tbody>
        {/* ── Ligne « À affecter » : jours MAD sans chauffeur, déplaçables ── */}
        {unassigned.length > 0 && (
          <tr style={{ borderBottom:'2px solid #9a7a28' }}>
            <td style={{ padding:'8px 12px', background:'#fdf3dc', borderRight:'2px solid #9a7a28', position:'sticky', left:0, zIndex:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#7a5c10', fontWeight:700, fontSize:'11px' }}>
                <AlertTriangle size={12}/> À affecter ({unassigned.length})
              </div>
              <div style={{ fontSize:'9px', color:'#8a8478', marginTop:'2px' }}>Glisser vers un chauffeur ↓</div>
            </td>
            {days.map((day: Date) => {
              const dateStr  = format(day,'yyyy-MM-dd')
              const dayJours = unassigned.filter(j => j.date === dateStr)
              const weekend  = [0, 6].includes(day.getDay())
              return (
                <td key={dateStr} style={{ padding:'3px', verticalAlign:'top', background: weekend ? '#f5efe0' : '#fffdf6', borderRight:'1px solid #ede9e2' }}>
                  {dayJours.map(j => (
                    <MBlock key={j.id}
                      bg="#fff8e8" border="#9a7a28" text="#9a7a28"
                      icon="◷" label="MAD · à affecter"
                      title={j.prestation.dossier.client.nom}
                      sub={j.prestation.dossier.numero}
                      compact={viewMode==='mois'}
                      draggable={true}
                      onDragStart={() => onDragStart(j.id)}
                      onClick={e => { e.stopPropagation(); onTooltip({ x:e.clientX, y:e.clientY, content: buildMadTooltip(j) }) }}
                    />
                  ))}
                </td>
              )
            })}
          </tr>
        )}
        {data.chauffeurs.length === 0 ? (
          <tr><td colSpan={days.length+1} style={{ padding:'60px', textAlign:'center', color:'#8a8478' }}>Aucun chauffeur</td></tr>
        ) : data.chauffeurs.map((c: Chauffeur, idx: number) => {
          // Statut dynamique : jours occupés sur la période (indispo/congé stocké prioritaire)
          const busyDays = days.filter((day: Date) => {
            const ds = format(day,'yyyy-MM-dd')
            return data.jours.some((j: JourMad) => j.chauffeur_id === c.id && j.date === ds)
              || data.transferts.some((t: Transfert) => t.chauffeur_id === c.id && t.date_debut === ds)
          }).length
          const indispo     = c.statut === 'indisponible' || c.statut === 'conge'
          const effStatut   = indispo ? c.statut : busyDays > 0 ? 'en_mission' : 'disponible'
          const st          = ST[effStatut] ?? ST.disponible
          const statutLabel = indispo ? c.statut.replace('_',' ') : busyDays > 0 ? `en mission · ${busyDays} j` : 'disponible'
          const initials    = `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase()
          const isDragTarget = dragOver === c.id

          return (
            <tr key={c.id} style={{ borderBottom:'1px solid #d8d2c8' }}>
              <td style={{ padding:'8px 12px', background: idx%2===0 ? '#faf9f7' : '#fff', borderRight:'2px solid #b8b0a4', position:'sticky', left:0, zIndex:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', flexShrink:0, background:st.bg, border:`1.5px solid ${st.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:700, color:st.color }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:600, color:'#16130e' }}>{c.prenom} {c.nom}</div>
                    <div style={{ fontSize:'9px', fontWeight:700, color:st.color, textTransform:'uppercase', letterSpacing:'0.5px' }}>{statutLabel}</div>
                  </div>
                </div>
              </td>

              {days.map((day: Date) => {
                const dateStr   = format(day,'yyyy-MM-dd')
                const jours     = data.jours.filter((j: JourMad) => j.chauffeur_id === c.id && j.date === dateStr)
                const transferts = data.transferts.filter((t: Transfert) => t.chauffeur_id === c.id && t.date_debut === dateStr)
                const conflict  = (jours.length + transferts.length) > 1
                const today     = isToday(day)
                const weekend   = [0, 6].includes(day.getDay())
                const isConge   = c.statut === 'indisponible' || c.statut === 'conge'

                return (
                  <td key={dateStr}
                    style={{
                      padding:'3px', verticalAlign:'top', minHeight:'48px',
                      background: isDragTarget && dragJourId ? '#fdf6e3' : conflict ? 'rgba(158,42,42,0.06)' : isConge ? 'rgba(122,92,16,0.04)' : today ? '#fdf6e3' : weekend ? '#f1ece4' : idx%2===0 ? '#faf9f7' : '#fff',
                      borderRight:'1px solid #ede9e2',
                      outline: isDragTarget && dragJourId ? '2px dashed #9a7a28' : 'none',
                    }}
                    onDragOver={e => { e.preventDefault(); onDragOver(c.id) }}
                    onDragLeave={() => onDragOver(null)}
                    onDrop={() => onDrop(c.id)}
                  >
                    {jours.map((j: JourMad) => (
                      <MBlock key={j.id}
                        bg="#f8ece7" border="#a6432a" text="#a6432a"
                        icon="◷" label="MAD"
                        title={j.prestation.dossier.client.nom}
                        sub={j.prestation.dossier.numero}
                        compact={viewMode==='mois'}
                        draggable={false}
                        onDragStart={() => {}}
                        onClick={e => { e.stopPropagation(); onTooltip({ x:e.clientX, y:e.clientY, content: buildMadTooltip(j) }) }}
                      />
                    ))}
                    {transferts.map((t: Transfert) => (
                      <MBlock key={t.id}
                        bg="#e8eef8" border="#1e3f70" text="#1e3f70"
                        icon="→" label="Transfert"
                        title={t.dossier.client.nom}
                        sub={t.heure_depart ?? t.dossier.numero}
                        compact={viewMode==='mois'}
                        draggable={false}
                        onDragStart={() => {}}
                        onClick={e => { e.stopPropagation(); onTooltip({ x:e.clientX, y:e.clientY, content: buildTransTooltip(t) }) }}
                      />
                    ))}
                    {conflict && (
                      <div style={{ fontSize:'8px', color:'#9e2a2a', fontWeight:700, padding:'1px 4px', background:'rgba(158,42,42,0.1)', display:'flex', alignItems:'center', gap:'2px' }}>
                        <AlertTriangle size={8}/> CONFLIT
                      </div>
                    )}
                    {/* Zone drop */}
                    {isDragTarget && dragJourId && jours.length === 0 && transferts.length === 0 && (
                      <div style={{ height:'36px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'#9a7a28', fontWeight:600 }}>
                        ↓ Déposer ici
                      </div>
                    )}
                    {/* Dispo vide */}
                    {jours.length === 0 && transferts.length === 0 && !isConge && (
                      <div style={{ height:'36px', background:'transparent' }} />
                    )}
                    {isConge && jours.length === 0 && (
                      <div style={{ height:'36px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'9px', color:'#7a5c10', fontWeight:600, letterSpacing:'0.5px' }}>
                          {c.statut === 'conge' ? 'CONGÉ' : 'INDISPO'}
                        </span>
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ══════════════════════════════════════════════
//  VUE VÉHICULES
// ══════════════════════════════════════════════

function VehiculesView({ days, viewMode, data, onTooltip, router }: any) {
  if (!data) return null

  const colW = viewMode === 'semaine' ? 104 : 46
  const minWidth = 160 + days.length * colW

  return (
    <table style={{ borderCollapse:'collapse', width:'100%', minWidth, tableLayout:'fixed' }}>
      <colgroup>
        <col style={{ width:'160px' }} />
        {days.map((_: any, i: number) => <col key={i} />)}
      </colgroup>
      <GanttHeader days={days} viewMode={viewMode} firstColLabel="Véhicule" />
      <tbody>
        {data.vehicules.length === 0 ? (
          <tr><td colSpan={days.length+1} style={{ padding:'60px', textAlign:'center', color:'#8a8478' }}>Aucun véhicule</td></tr>
        ) : data.vehicules.map((v: Vehicule, idx: number) => {
          const ST: Record<string,string> = { disponible:'#1e5e3a', en_mission:'#1e3f70', maintenance:'#7a5c10', inactif:'#8a8478' }

          // Statut dynamique : nombre de jours occupés sur la période affichée
          const busyDays = days.filter((day: Date) => {
            const ds = format(day,'yyyy-MM-dd')
            return data.jours.some((j: JourMad) => jourVehiculeId(j) === v.id && j.date === ds)
              || data.transferts.some((t: Transfert) => t.vehicule_id === v.id && t.date_debut === ds)
          }).length
          const immobilise = v.statut === 'maintenance' || v.statut === 'inactif'
          const effStatut  = immobilise ? v.statut : busyDays > 0 ? 'en_mission' : 'disponible'
          const color      = ST[effStatut] ?? '#8a8478'
          const statutLabel = immobilise
            ? v.statut
            : busyDays > 0 ? `en mission · ${busyDays} j` : 'disponible'

          return (
            <tr key={v.id} style={{ borderBottom:'1px solid #d8d2c8' }}>
              <td style={{ padding:'8px 12px', background: idx%2===0 ? '#faf9f7' : '#fff', borderRight:'2px solid #b8b0a4', position:'sticky', left:0, zIndex:10 }}>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'14px', fontWeight:500, color:'#16130e', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.marque} {v.modele}</div>
                <div style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'2px' }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#8a8478', letterSpacing:'1px' }}>{v.immatriculation}</span>
                  <span style={{ fontSize:'8px', fontWeight:700, color, textTransform:'uppercase' }}>● {statutLabel}</span>
                </div>
              </td>

              {days.map((day: Date) => {
                const dateStr = format(day,'yyyy-MM-dd')
                const jours   = data.jours.filter((j: JourMad) => jourVehiculeId(j) === v.id && j.date === dateStr)
                const trans   = data.transferts.filter((t: Transfert) => t.vehicule_id === v.id && t.date_debut === dateStr)
                const today   = isToday(day)
                const weekend = [0, 6].includes(day.getDay())
                const conflict = (jours.length + trans.length) > 1

                return (
                  <td key={dateStr} style={{ padding:'3px', verticalAlign:'top', background: conflict ? 'rgba(158,42,42,0.06)' : today ? '#fdf6e3' : weekend ? '#f1ece4' : idx%2===0 ? '#faf9f7' : '#fff', borderRight:'1px solid #ede9e2' }}>
                    {jours.map((j: JourMad) => (
                      <MBlock key={j.id} bg="#f8ece7" border="#a6432a" text="#a6432a"
                        icon="◷" label="MAD"
                        title={j.prestation.dossier.client.nom}
                        sub={j.prestation.dossier.numero}
                        compact={viewMode==='mois'}
                        draggable={false} onDragStart={() => {}}
                        onClick={e => { e.stopPropagation(); onTooltip({ x:e.clientX, y:e.clientY, content: buildMadTooltip(j) }) }}
                      />
                    ))}
                    {trans.map((t: Transfert) => (
                      <MBlock key={t.id} bg="#e8eef8" border="#1e3f70" text="#1e3f70"
                        icon="→" label="Transfert"
                        title={t.dossier.client.nom}
                        sub={t.heure_depart ?? t.dossier.numero}
                        compact={viewMode==='mois'}
                        draggable={false} onDragStart={() => {}}
                        onClick={e => { e.stopPropagation(); onTooltip({ x:e.clientX, y:e.clientY, content: buildTransTooltip(t) }) }}
                      />
                    ))}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ══════════════════════════════════════════════
//  COMPOSANTS UI
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  VUE MOBILE — agenda jour par jour (cartes)
// ══════════════════════════════════════════════

function PlanningMobile({ days, data, router }: { days: Date[]; data: any; router: any }) {
  const todayIdx = days.findIndex(d => isToday(d))
  const [sel, setSel] = useState(todayIdx >= 0 ? todayIdx : 0)
  if (!data) return null

  const day = days[Math.min(sel, days.length - 1)] ?? days[0]
  const dateStr = format(day, 'yyyy-MM-dd')
  const jours = (data.jours ?? []).filter((j: JourMad) => j.date === dateStr)
  const transferts = (data.transferts ?? []).filter((t: Transfert) => t.date_debut === dateStr)
  const total = jours.length + transferts.length

  function nbFor(d: Date) {
    const ds = format(d, 'yyyy-MM-dd')
    return (data.jours ?? []).filter((j: JourMad) => j.date === ds).length + (data.transferts ?? []).filter((t: Transfert) => t.date_debut === ds).length
  }

  return (
    <div>
      {/* Sélecteur de jour */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '12px', borderBottom: '1.5px solid #d8d2c8', WebkitOverflowScrolling: 'touch' }}>
        {days.map((d, i) => {
          const on = i === sel; const today = isToday(d); const n = nbFor(d)
          return (
            <button key={d.toISOString()} onClick={() => setSel(i)}
              style={{ flexShrink: 0, minWidth: '46px', padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
                background: on ? '#16130e' : today ? '#fdf6e3' : '#fff', border: `1.5px solid ${on ? '#16130e' : today ? '#9a7a28' : '#d8d2c8'}`,
                color: on ? '#fff' : '#16130e' }}>
              <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7 }}>{format(d, 'EEE', { locale: fr })}</div>
              <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '17px', lineHeight: 1.1 }}>{format(d, 'd', { locale: fr })}</div>
              {n > 0 && <div style={{ fontSize: '8px', fontFamily: 'JetBrains Mono,monospace', color: on ? '#c9a84c' : '#9a7a28' }}>{n}</div>}
            </button>
          )
        })}
      </div>

      {/* Missions du jour */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', color: '#8a8478', fontWeight: 600 }}>
          {format(day, 'EEEE d MMMM', { locale: fr })} · {total} mission{total > 1 ? 's' : ''}
        </div>
        {total === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Aucune mission ce jour</div>
        ) : (
          <>
            {jours.map((j: JourMad) => {
              const stat = calcStatutClient({ statut: j.prestation.statut ?? j.statut, type: 'mad', date_debut: j.date, date_fin: j.date, heure_debut_journee: j.prestation.heure_debut_journee, heure_fin_journee: j.prestation.heure_fin_journee })
              const si = STATUT_MAP[stat] ?? STATUT_MAP.en_attente
              const veh = (data.vehicules ?? []).find((v: any) => v.id === jourVehiculeId(j))
              const chauf = j.chauffeur ? `${j.chauffeur.prenom} ${j.chauffeur.nom}` : j.sous_traitant ? `ST · ${j.sous_traitant.societe}` : null
              return (
                <MobileMissionCard key={j.id} type="MAD" typeColor="#a6432a" client={j.prestation.dossier.client.nom} numero={j.prestation.dossier.numero}
                  heure={j.prestation.heure_debut_journee ? `${j.prestation.heure_debut_journee}→${j.prestation.heure_fin_journee ?? ''}` : null}
                  itineraire={j.prestation.adresse_depart ?? 'Mise à disposition'}
                  chauffeur={chauf} vehicule={veh ? `${veh.marque} ${veh.modele}` : (j.prestation.modele_souhaite ?? null)}
                  siLabel={si.label} siColor={si.color} siBg={si.bg} siBorder={si.border}
                  onOpen={() => router.push(`/dashboard/dossiers/${j.prestation.dossier.id}`)} />
              )
            })}
            {transferts.map((t: Transfert) => {
              const stat = calcStatutClient({ statut: t.statut, type: 'transfert', date_debut: t.date_debut, date_fin: t.date_debut, heure_depart: t.heure_depart })
              const si = STATUT_MAP[stat] ?? STATUT_MAP.en_attente
              const chauf = t.chauffeur ? `${t.chauffeur.prenom} ${t.chauffeur.nom}` : t.sous_traitant ? `ST · ${t.sous_traitant.societe}` : null
              return (
                <MobileMissionCard key={t.id} type="Transfert" typeColor="#1e3f70" client={t.dossier.client.nom} numero={t.dossier.numero}
                  heure={t.heure_depart ?? null}
                  itineraire={`${t.adresse_depart ?? '—'} → ${t.adresse_arrivee ?? '—'}`}
                  chauffeur={chauf} vehicule={t.vehicule ? `${t.vehicule.marque} ${t.vehicule.modele}` : null}
                  siLabel={si.label} siColor={si.color} siBg={si.bg} siBorder={si.border}
                  onOpen={() => router.push(`/dashboard/dossiers/${t.dossier.id}`)} />
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

function MobileMissionCard({ type, typeColor, client, numero, heure, itineraire, chauffeur, vehicule, siLabel, siColor, siBg, siBorder, onOpen }: any) {
  return (
    <div onClick={onOpen} style={{ background: '#fff', border: '1.5px solid #b8b0a4', borderLeft: `3px solid ${typeColor}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '9px 12px', borderBottom: '1px solid #ede9e2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: typeColor }}>{type}</span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9a7a28' }}>{numero}</span>
          {heure && <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#16130e', fontWeight: 600 }}>{heure}</span>}
        </div>
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', fontWeight: 700, padding: '2px 8px', color: siColor, background: siBg, border: `1px solid ${siBorder}` }}>{siLabel}</span>
      </div>
      <div style={{ padding: '9px 12px' }}>
        <div style={{ fontWeight: 600, color: '#16130e', fontSize: '14px' }}>{client}</div>
        <div style={{ fontSize: '12px', color: '#5a564e', marginTop: '2px' }}>{itineraire}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
          <span style={{ color: chauffeur ? '#5a564e' : '#9e2a2a', fontWeight: chauffeur ? 400 : 600 }}>{chauffeur ?? '⚠ À affecter'}</span>
          <span style={{ color: '#8a8478' }}>{vehicule ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}

function GanttHeader({ days, viewMode, firstColLabel }: { days: Date[]; viewMode: ViewMode; firstColLabel: string }) {
  return (
    <thead style={{ position:'sticky', top:0, zIndex:20 }}>
      <tr>
        <th style={{ background:'#16130e', padding:'10px 14px', textAlign:'left', borderRight:'2px solid rgba(255,255,255,0.1)', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', color:'rgba(255,255,255,0.5)', fontWeight:600, position:'sticky', left:0, top:0, zIndex:30 }}>
          {firstColLabel}
        </th>
        {days.map(day => {
          const today = isToday(day)
          const weekend = [0, 6].includes(day.getDay())
          return (
            <th key={day.toISOString()} style={{ background: today ? '#9a7a28' : weekend ? '#2a2419' : '#16130e', padding: viewMode==='semaine' ? '8px 6px' : '6px 3px', textAlign:'center', borderRight:'1px solid rgba(255,255,255,0.08)', color: today ? '#fff' : weekend ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.65)', fontWeight: today ? 700 : 400 }}>
              {viewMode === 'semaine' ? (
                <>
                  <div style={{ fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', opacity:0.7 }}>{format(day,'EEE',{locale:fr})}</div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', marginTop:'1px' }}>{format(day,'d',{locale:fr})}</div>
                </>
              ) : (
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px' }}>{format(day,'d',{locale:fr})}</div>
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

function MBlock({ bg, border, text, icon, label, title, sub, compact, draggable, onDragStart, onClick }: {
  bg: string; border: string; text: string; icon: string; label: string
  title: string; sub: string | null; compact: boolean
  draggable: boolean; onDragStart: () => void; onClick: (e: React.MouseEvent) => void
}) {
  return (
    <div draggable={draggable} onDragStart={onDragStart} onClick={onClick}
      style={{ background:bg, border:`1.5px solid ${border}`, borderLeft:`3px solid ${border}`, padding: compact ? '2px 4px' : '5px 7px', marginBottom:'2px', cursor:'pointer', userSelect:'none', transition:'opacity 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.opacity='0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity='1')}>
      {!compact && (
        <div style={{ fontSize:'8px', fontWeight:700, color:text, letterSpacing:'1px', textTransform:'uppercase', opacity:0.7, marginBottom:'2px' }}>
          {icon} {label}
        </div>
      )}
      <div style={{ fontSize: compact ? '9px' : '11px', fontWeight:600, color:text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {title}
      </div>
      {sub && !compact && (
        <div style={{ fontSize:'9px', color:text, opacity:0.75, marginTop:'1px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sub}</div>
      )}
    </div>
  )
}

function NavBtn({ onClick, children, label }: { onClick: () => void; children?: React.ReactNode; label?: string }) {
  return (
    <button onClick={onClick}
      style={{ background:'none', border:'1.5px solid #b8b0a4', width: label ? 'auto' : '28px', height:'28px', padding: label ? '0 10px' : '0', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, letterSpacing:'1px', color:'#5a564e', transition:'all 0.14s', textTransform:'uppercase' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='#9a7a28'; e.currentTarget.style.color='#9a7a28' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='#b8b0a4'; e.currentTarget.style.color='#5a564e' }}>
      {label ?? children}
    </button>
  )
}

function Alert({ color, bg, border, children }: { color: string; bg: string; border: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', background:bg, border:`1px solid ${border}`, fontSize:'11px', color, fontWeight:600 }}>
      {children}
    </div>
  )
}

function Legende() {
  return (
    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
      {[
        { color:'#f8ece7', border:'#a6432a', label:'MAD' },
        { color:'#e8eef8', border:'#1e3f70', label:'Transfert' },
        { color:'#fff8e8', border:'#9a7a28', label:'Non affecté' },
        { color:'rgba(158,42,42,0.06)', border:'#9e2a2a', label:'Conflit' },
      ].map(l => (
        <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <div style={{ width:'10px', height:'10px', background:l.color, border:`1.5px solid ${l.border}`, flexShrink:0 }} />
          <span style={{ fontSize:'9px', color:'#5a564e', fontWeight:600 }}>{l.label}</span>
        </div>
      ))}
    </div>
  )
}

function Tooltip({ tooltip, onClose, router }: { tooltip: any; onClose: () => void; router: any }) {
  const { x, y, content } = tooltip
  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:99 }} onClick={onClose} />
      <div style={{
        position:'fixed',
        left: Math.min(x + 12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 270),
        top:  Math.min(y + 12, (typeof window !== 'undefined' ? window.innerHeight : 800) - 240),
        zIndex:100, width:'260px',
        background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 8px 24px rgba(0,0,0,0.15)', padding:'14px',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid #d8d2c8' }}>
          <span style={{ padding:'2px 8px', fontSize:'8px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', background: content.type==='MAD' ? '#f8ece7' : '#e8eef8', color: content.type==='MAD' ? '#a6432a' : '#1e3f70' }}>
            {content.type}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#b8b0a4', fontSize:'14px' }}>✕</button>
        </div>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'16px', fontWeight:500, color:'#16130e', marginBottom:'4px' }}>{content.client}</div>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#9a7a28', marginBottom:'10px' }}>{content.dossier}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'12px' }}>
          {[
            { l:'Date',      v: content.date ? format(parseISO(content.date),'dd/MM/yyyy',{locale:fr}) : null },
            { l:'Chauffeur', v: content.chauffeur },
            { l:'Véhicule',  v: content.vehicule },
            { l:'Heure',     v: content.heure },
            { l:'Horaires',  v: content.horaires },
            { l:'Départ',    v: content.depart },
            { l:'Arrivée',   v: content.arrivee },
            { l:'Tarif',     v: content.tarif ? `${Number(content.tarif).toLocaleString('fr-FR')} € HT` : null },
            { l:'Note',      v: content.note },
          ].filter(r => r.v).map(r => (
            <div key={r.l} style={{ display:'flex', gap:'8px', fontSize:'11px' }}>
              <span style={{ color:'#8a8478', fontWeight:600, minWidth:'60px', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', flexShrink:0 }}>{r.l}</span>
              <span style={{ color:'#2e2b25' }}>{r.v}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { router.push(`/dashboard/dossiers/${content.dossier_id}`); onClose() }}
          className="btn-primary" style={{ width:'100%', justifyContent:'center', fontSize:'11px', padding:'7px' }}>
          Ouvrir le dossier →
        </button>
      </div>
    </>
  )
}

// ── Helpers tooltip ───────────────────────────

function buildMadTooltip(j: JourMad) {
  return {
    type: 'MAD',
    client: j.prestation.dossier.client.nom,
    dossier: j.prestation.dossier.numero,
    dossier_id: j.prestation.dossier.id,
    date: j.date,
    chauffeur: j.chauffeur ? `${j.chauffeur.prenom} ${j.chauffeur.nom}` : '⚠ Non affecté',
    vehicule: j.vehicule
      ? `${j.vehicule.marque} ${j.vehicule.modele} — ${j.vehicule.immatriculation}`
      : j.prestation.vehicule
        ? `${j.prestation.vehicule.marque} ${j.prestation.vehicule.modele} — ${j.prestation.vehicule.immatriculation}`
        : j.prestation.modele_souhaite ?? null,
    horaires: j.prestation.heure_debut_journee ? `${j.prestation.heure_debut_journee} → ${j.prestation.heure_fin_journee}` : null,
    tarif: j.tarif_ht,
    note: j.note,
  }
}

function buildTransTooltip(t: Transfert) {
  return {
    type: 'Transfert',
    client: t.dossier.client.nom,
    dossier: t.dossier.numero,
    dossier_id: t.dossier.id,
    date: t.date_debut,
    heure: t.heure_depart,
    chauffeur: t.chauffeur ? `${t.chauffeur.prenom} ${t.chauffeur.nom}` : '⚠ Non affecté',
    vehicule: t.vehicule ? `${t.vehicule.marque} ${t.vehicule.modele} — ${t.vehicule.immatriculation}` : null,
    depart: t.adresse_depart,
    arrivee: t.adresse_arrivee,
    tarif: t.tarif_fixe_ht,
  }
}
