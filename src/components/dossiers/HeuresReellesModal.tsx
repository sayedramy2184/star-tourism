'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Clock, X, ChevronDown, ChevronUp } from 'lucide-react'

interface Forfait {
  id: string
  nom: string
  heures_incluses: number
  tarif_ht: number
  tarif_heure_sup: number
  avec_heures_sup: boolean
}

interface JourMad {
  id: string
  date: string
  jour_semaine: string
  tarif_ht: number
  forfait_id: string | null
  heures_incluses: number | null
  tarif_heure_sup: number | null
  heure_debut_reelle: string | null
  heure_fin_reelle: string | null
  heures_reelles: number | null
  heures_sup: number | null
  montant_sup: number | null
  montant_total: number | null
  chauffeur: { nom: string; prenom: string } | null
}

interface Props {
  prestationId: string
  jours: JourMad[]
  tarifJournalier: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function calcDuree(debut: string, fin: string): number {
  if (!debut || !fin) return 0
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  let minutes = (fh * 60 + fm) - (dh * 60 + dm)
  if (minutes < 0) minutes += 24 * 60 // passage minuit
  return Math.round(minutes / 60 * 100) / 100
}

export default function HeuresReellesModal({ prestationId, jours, tarifJournalier }: Props) {
  const router = useRouter()
  const [open,     setOpen]     = useState(false)
  const [forfaits, setForfaits] = useState<Forfait[]>([])
  const [saving,   setSaving]   = useState<string | null>(null)

  // State local pour chaque jour
  const [joursState, setJoursState] = useState<Record<string, {
    forfait_id: string
    heure_debut: string
    heure_fin: string
    heures_incluses: number
    tarif_heure_sup: number
    avec_heures_sup: boolean
    heures_reelles: number
    heures_sup: number
    montant_sup: number
    montant_total: number
  }>>({})

  useEffect(() => {
    if (!open) return
    fetch('/api/forfaits').then(r => r.json()).then(d => setForfaits(d.data ?? []))

    // Initialise state local depuis les données existantes
    const init: typeof joursState = {}
    jours.forEach(j => {
      const heureDebut = j.heure_debut_reelle?.slice(0, 5) ?? ''
      const heureFin   = j.heure_fin_reelle?.slice(0, 5) ?? ''
      const heuresR    = j.heures_reelles ?? 0
      const heuresInc  = j.heures_incluses ?? 0
      const hSup       = j.heures_sup ?? 0
      const tarifSup   = j.tarif_heure_sup ?? 0

      init[j.id] = {
        forfait_id:      j.forfait_id ?? '',
        heure_debut:     heureDebut,
        heure_fin:       heureFin,
        heures_incluses: heuresInc,
        tarif_heure_sup: tarifSup,
        avec_heures_sup: tarifSup > 0,
        heures_reelles:  heuresR,
        heures_sup:      hSup,
        montant_sup:     j.montant_sup ?? 0,
        montant_total:   j.montant_total ?? j.tarif_ht,
      }
    })
    setJoursState(init)
  }, [open])

  function applyForfait(jourId: string, forfaitId: string) {
    const forfait = forfaits.find(f => f.id === forfaitId)
    if (!forfait) return

    setJoursState(prev => {
      const j = prev[jourId]
      const heuresR   = j?.heure_debut && j?.heure_fin ? calcDuree(j.heure_debut, j.heure_fin) : 0
      const hSup      = Math.max(0, heuresR - forfait.heures_incluses)
      const mSup      = Math.round(hSup * forfait.tarif_heure_sup * 100) / 100
      const mTotal    = Math.round((forfait.tarif_ht + mSup) * 100) / 100

      return {
        ...prev,
        [jourId]: {
          ...j,
          forfait_id:      forfait.id,
          heures_incluses: forfait.heures_incluses,
          tarif_heure_sup: forfait.tarif_heure_sup,
          avec_heures_sup: forfait.avec_heures_sup,
          heures_reelles:  heuresR,
          heures_sup:      forfait.avec_heures_sup ? hSup : 0,
          montant_sup:     forfait.avec_heures_sup ? mSup : 0,
          montant_total:   forfait.avec_heures_sup ? mTotal : forfait.tarif_ht,
        }
      }
    })
  }

  function updateHeures(jourId: string, field: 'heure_debut' | 'heure_fin', value: string) {
    setJoursState(prev => {
      const j = { ...prev[jourId], [field]: value }
      const debut = field === 'heure_debut' ? value : j.heure_debut
      const fin   = field === 'heure_fin'   ? value : j.heure_fin

      if (debut && fin) {
        const heuresR = calcDuree(debut, fin)
        const hSup    = j.avec_heures_sup ? Math.max(0, heuresR - j.heures_incluses) : 0
        const mSup    = Math.round(hSup * j.tarif_heure_sup * 100) / 100

        // Récupère le tarif forfait depuis le forfait sélectionné
        const forfait = forfaits.find(f => f.id === j.forfait_id)
        const tarifForfait = forfait?.tarif_ht ?? tarifJournalier

        j.heures_reelles = heuresR
        j.heures_sup     = hSup
        j.montant_sup    = mSup
        j.montant_total  = Math.round((tarifForfait + mSup) * 100) / 100
      }

      return { ...prev, [jourId]: j }
    })
  }

  async function saveJour(jourId: string) {
    const j = joursState[jourId]
    if (!j) return
    setSaving(jourId)

    try {
      const res = await fetch(`/api/jours-mad/${jourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forfait_id:         j.forfait_id || null,
          heures_incluses:    j.heures_incluses || null,
          tarif_heure_sup:    j.tarif_heure_sup || 0,
          heure_debut_reelle: j.heure_debut || null,
          heure_fin_reelle:   j.heure_fin   || null,
          heures_reelles:     j.heures_reelles || null,
          heures_sup:         j.heures_sup  || 0,
          montant_sup:        j.montant_sup || 0,
          montant_total:      j.montant_total || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Heures enregistrées')
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setSaving(null) }
  }

  async function saveAll() {
    setSaving('all')
    let ok = 0
    for (const jourId of Object.keys(joursState)) {
      const j = joursState[jourId]
      if (!j.heure_debut || !j.heure_fin) continue
      try {
        await fetch(`/api/jours-mad/${jourId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            forfait_id:         j.forfait_id || null,
            heures_incluses:    j.heures_incluses || null,
            tarif_heure_sup:    j.tarif_heure_sup || 0,
            heure_debut_reelle: j.heure_debut,
            heure_fin_reelle:   j.heure_fin,
            heures_reelles:     j.heures_reelles || null,
            heures_sup:         j.heures_sup  || 0,
            montant_sup:        j.montant_sup || 0,
            montant_total:      j.montant_total || null,
          }),
        })
        ok++
      } catch {}
    }
    toast.success(`${ok} jour${ok > 1 ? 's' : ''} enregistré${ok > 1 ? 's' : ''}`)
    setSaving(null)
    router.refresh()
  }

  // Total suppléments
  const totalSup = Object.values(joursState).reduce((s, j) => s + (j.montant_sup ?? 0), 0)
  const totalBase = jours.reduce((s, j) => {
    const forfait = forfaits.find(f => f.id === joursState[j.id]?.forfait_id)
    return s + (forfait?.tarif_ht ?? j.tarif_ht)
  }, 0)

  return (
    <>
      <button
        className="btn-ghost"
        style={{ padding:'5px 12px', fontSize:'11px', display:'inline-flex', alignItems:'center', gap:'6px' }}
        onClick={() => setOpen(true)}
      >
        <Clock size={12} /> Heures réelles
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
          <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'760px', maxWidth:'97vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>

            {/* Header */}
            <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
              <div>
                <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
                  Saisie des heures réelles
                </span>
                <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', marginTop:'2px' }}>
                  {jours.length} jour{jours.length > 1 ? 's' : ''} de mise à disposition
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
                <X size={18}/>
              </button>
            </div>

            <div style={{ padding:'20px 24px' }}>

              {/* Sélection forfait global */}
              {forfaits.length > 0 && (
                <div style={{ marginBottom:'20px', padding:'14px 16px', background:'#f5f2ed', border:'1.5px solid #b8b0a4' }}>
                  <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'10px' }}>
                    Appliquer un forfait à tous les jours
                  </div>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    {forfaits.map(f => (
                      <button key={f.id} type="button"
                        onClick={() => jours.forEach(j => applyForfait(j.id, f.id))}
                        style={{
                          padding:'8px 14px', fontSize:'11px', fontWeight:600, cursor:'pointer',
                          background:'#fff', border:'1.5px solid #b8b0a4', color:'#2e2b25',
                          display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'2px',
                          transition:'all 0.14s', textAlign:'left',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='#9a7a28'; e.currentTarget.style.background='#fdf6e3' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='#b8b0a4'; e.currentTarget.style.background='#fff' }}>
                        <span style={{ fontWeight:700, color:'#16130e' }}>{f.nom}</span>
                        <span style={{ fontSize:'10px', color:'#8a8478' }}>
                          {fmt(f.tarif_ht)} · {f.heures_incluses}h incluses
                          {f.avec_heures_sup && ` · sup: ${fmt(f.tarif_heure_sup)}/h`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grille jours */}
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {jours.map(j => {
                  const state    = joursState[j.id]
                  const forfait  = forfaits.find(f => f.id === state?.forfait_id)
                  const hasSup   = (state?.heures_sup ?? 0) > 0
                  const hasData  = state?.heure_debut && state?.heure_fin

                  return (
                    <div key={j.id} style={{
                      border:`1.5px solid ${hasSup ? '#9a7a28' : hasData ? '#1e5e3a' : '#b8b0a4'}`,
                      background: hasSup ? '#fff8e8' : '#fff',
                      overflow:'hidden',
                    }}>
                      {/* Ligne principale */}
                      <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 1fr 1fr 80px 1fr auto', gap:'8px', alignItems:'center', padding:'10px 14px' }}>

                        {/* Date */}
                        <div>
                          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', fontWeight:600, color:'#16130e' }}>
                            {j.jour_semaine} {format(parseISO(j.date),'dd/MM',{locale:fr})}
                          </div>
                          {j.chauffeur && (
                            <div style={{ fontSize:'9px', color:'#8a8478', marginTop:'2px' }}>
                              {j.chauffeur.prenom} {j.chauffeur.nom}
                            </div>
                          )}
                        </div>

                        {/* Forfait */}
                        <div>
                          <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>Forfait</div>
                          <select
                            value={state?.forfait_id ?? ''}
                            onChange={e => applyForfait(j.id, e.target.value)}
                            style={{ background:'#fff', border:'1.5px solid #b8b0a4', padding:'5px 8px', fontSize:'11px', color:'#16130e', outline:'none', width:'100%' }}>
                            <option value="">— Saisie libre —</option>
                            {forfaits.map(f => (
                              <option key={f.id} value={f.id}>{f.nom} ({fmt(f.tarif_ht)})</option>
                            ))}
                          </select>
                        </div>

                        {/* Heure début réelle */}
                        <div>
                          <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>Heure début</div>
                          <input type="time"
                            value={state?.heure_debut ?? ''}
                            onChange={e => updateHeures(j.id, 'heure_debut', e.target.value)}
                            style={{ background:'#fff', border:'1.5px solid #b8b0a4', padding:'5px 8px', fontSize:'11px', fontFamily:'JetBrains Mono,monospace', outline:'none', width:'100%' }} />
                        </div>

                        {/* Heure fin réelle */}
                        <div>
                          <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>Heure fin</div>
                          <input type="time"
                            value={state?.heure_fin ?? ''}
                            onChange={e => updateHeures(j.id, 'heure_fin', e.target.value)}
                            style={{ background:'#fff', border:'1.5px solid #b8b0a4', padding:'5px 8px', fontSize:'11px', fontFamily:'JetBrains Mono,monospace', outline:'none', width:'100%' }} />
                        </div>

                        {/* Taux heure sup */}
                        <div>
                          <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>
                            Taux sup (€/h)
                          </div>
                          <input type="number"
                            value={state?.tarif_heure_sup ?? 0}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              const jourId = j.id
                              setJoursState(prev => {
                                const jState = { ...prev[jourId], tarif_heure_sup: val }
                                if (jState.heure_debut && jState.heure_fin) {
                                  const hSup = jState.avec_heures_sup ? Math.max(0, jState.heures_reelles - jState.heures_incluses) : 0
                                  jState.montant_sup = Math.round(hSup * val * 100) / 100
                                  const forfait = forfaits.find(f => f.id === jState.forfait_id)
                                  jState.montant_total = Math.round(((forfait?.tarif_ht ?? tarifJournalier) + jState.montant_sup) * 100) / 100
                                }
                                return { ...prev, [jourId]: jState }
                              })
                            }}
                            disabled={!state?.avec_heures_sup}
                            style={{ background: state?.avec_heures_sup ? '#fff' : '#f5f2ed', border:'1.5px solid #b8b0a4', padding:'5px 8px', fontSize:'11px', fontFamily:'JetBrains Mono,monospace', outline:'none', width:'100%', cursor: state?.avec_heures_sup ? 'auto' : 'not-allowed' }}
                          />
                        </div>

                        {/* Calcul */}
                        <div>
                          <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>Résultat</div>
                          {hasData ? (
                            <div>
                              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#16130e', fontWeight:600 }}>
                                {state.heures_reelles}h réelles
                              </div>
                              {hasSup && (
                                <div style={{ fontSize:'10px', color:'#9a7a28', marginTop:'1px' }}>
                                  +{state.heures_sup}h sup → {fmt(state.montant_sup)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize:'10px', color:'#c2bdb4', fontStyle:'italic' }}>Saisir les heures</div>
                          )}
                        </div>

                        {/* Bouton sauvegarder */}
                        <button
                          onClick={() => saveJour(j.id)}
                          disabled={saving === j.id || !hasData}
                          style={{
                            background: hasData ? '#16130e' : '#f5f2ed',
                            color: hasData ? '#fff' : '#c2bdb4',
                            border:'none', padding:'6px 10px', fontSize:'10px', fontWeight:600,
                            cursor: hasData ? 'pointer' : 'not-allowed',
                          }}>
                          {saving === j.id ? '…' : '✓'}
                        </button>
                      </div>

                      {/* Bande récap si heures saisies */}
                      {hasData && (
                        <div style={{
                          background: hasSup ? '#fdf3dc' : '#eaf4ee',
                          borderTop:`1px solid ${hasSup ? 'rgba(122,92,16,0.2)' : 'rgba(30,94,58,0.2)'}`,
                          padding:'6px 14px', display:'flex', gap:'20px', alignItems:'center',
                        }}>
                          <span style={{ fontSize:'10px', color: hasSup ? '#7a5c10' : '#1e5e3a' }}>
                            {forfait ? forfait.nom : 'Saisie libre'} ·{' '}
                            {state.heures_incluses}h incluses ·{' '}
                            {state.heures_reelles}h réelles
                          </span>
                          {hasSup && (
                            <span style={{ fontSize:'10px', color:'#9a7a28', fontWeight:700 }}>
                              ⚠ Dépassement {state.heures_sup}h → +{fmt(state.montant_sup)}
                            </span>
                          )}
                          <span style={{ marginLeft:'auto', fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:600, color:'#16130e' }}>
                            Total : {fmt(state.montant_total)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Récap total */}
              {Object.values(joursState).some(j => j.heure_debut && j.heure_fin) && (
                <div style={{ marginTop:'16px', padding:'14px 16px', background:'#f5f2ed', border:'1.5px solid #b8b0a4', display:'flex', justifyContent:'flex-end', gap:'30px', alignItems:'center' }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'3px' }}>Base forfaits</div>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'13px' }}>{fmt(totalBase)}</div>
                  </div>
                  {totalSup > 0 && (
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'3px' }}>Suppléments</div>
                      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'13px', color:'#9a7a28' }}>+{fmt(totalSup)}</div>
                    </div>
                  )}
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#16130e', marginBottom:'3px' }}>Total HT</div>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'22px', color:'#16130e' }}>{fmt(totalBase + totalSup)}</div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'16px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button className="btn-ghost" onClick={() => setOpen(false)}>Fermer</button>
                <button className="btn-primary" disabled={saving === 'all'} onClick={saveAll}
                  style={{ padding:'8px 20px' }}>
                  {saving === 'all' ? 'Sauvegarde…' : '✓ Tout enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
