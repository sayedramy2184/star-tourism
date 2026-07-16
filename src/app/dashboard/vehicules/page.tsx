'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Plus, AlertTriangle } from 'lucide-react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useSearchPaginate } from '@/lib/useSearchPaginate'
import { SearchBar, Pager } from '@/components/ui/ListControls'
import { exportCsv } from '@/lib/exportCsv'
import LoueurSelect from '@/components/loueurs/LoueurSelect'

type StatutVehicule  = 'disponible' | 'en_mission' | 'maintenance' | 'inactif'
type CategorieVehicule = 'berline_standard' | 'berline_premium' | 'berline_prestige' | 'van_minibus' | 'van_bagages' | 'suv_premium' | 'electrique'

type ModeAcquisition = 'propriete' | 'lld' | 'leasing' | 'location'

interface Vehicule {
  id: string
  marque: string
  modele: string
  immatriculation: string
  annee: number | null
  categorie: CategorieVehicule
  nb_places: number
  statut: StatutVehicule
  ct_date: string | null
  assurance_date: string | null
  kilometrage: number | null
  chauffeur?: { nom: string; prenom: string } | null
  mode_acquisition: ModeAcquisition
  loueur: string | null
  loyer_ht: number | null
  loyer_periode: LoyerPeriode
  contrat_fin: string | null
  date_entree_parc: string | null
  date_sortie_parc: string | null
}

const MODES: Record<ModeAcquisition, { label: string; short: string; color: string; bg: string }> = {
  propriete: { label: 'Propriété',        short: 'Propre',  color: '#1e5e3a', bg: '#eaf4ee' },
  lld:       { label: 'LLD (longue durée)', short: 'LLD',    color: '#1e3f70', bg: '#e8eef8' },
  leasing:   { label: 'Leasing / LOA',    short: 'Leasing', color: '#4a2a6e', bg: '#f0ebfa' },
  location:  { label: 'Location courte',  short: 'Location',color: '#7a5c10', bg: '#fdf3dc' },
}

type LoyerPeriode = 'jour' | 'semaine' | 'mois'
const PERIODES: Record<LoyerPeriode, { label: string; suffix: string; parMois: number }> = {
  jour:    { label: 'jour',    suffix: '/jour', parMois: 30.4 },
  semaine: { label: 'semaine', suffix: '/sem.', parMois: 4.33 },
  mois:    { label: 'mois',    suffix: '/mois', parMois: 1 },
}
// Équivalent mensuel estimé d'un loyer (pour le KPI budget)
function loyerMensuelEquiv(v: { loyer_ht: number | null; loyer_periode: LoyerPeriode }) {
  if (!v.loyer_ht) return 0
  return v.loyer_ht * (PERIODES[v.loyer_periode]?.parMois ?? 1)
}

const STATUTS: Record<StatutVehicule, { label: string; color: string; bg: string }> = {
  disponible:  { label: 'Disponible',  color: '#1e5e3a', bg: '#eaf4ee' },
  en_mission:  { label: 'En mission',  color: '#1e3f70', bg: '#e8eef8' },
  maintenance: { label: 'Maintenance', color: '#7a5c10', bg: '#fdf3dc' },
  inactif:     { label: 'Inactif',     color: '#8a8478', bg: '#f5f2ed' },
}

const CATEGORIES: Record<CategorieVehicule, string> = {
  berline_standard: 'Berline Standard',
  berline_premium:  'Berline Premium',
  berline_prestige: 'Berline Prestige',
  van_minibus:      'Van / Minibus',
  van_bagages:      'Van Bagages',
  suv_premium:      'SUV Premium',
  electrique:       'Électrique',
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function docAlert(dateStr: string | null) {
  if (!dateStr) return { level: 'none', label: 'Non renseigné', color: '#c2bdb4' }
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days < 0)  return { level: 'danger', label: `Expiré`, color: '#9e2a2a' }
  if (days < 30) return { level: 'warn',   label: `${days}j`, color: '#7a5c10' }
  return { level: 'ok', label: format(parseISO(dateStr),'MM/yyyy'), color: '#1e5e3a' }
}

const emptyForm = {
  marque: '', modele: '', immatriculation: '',
  annee: new Date().getFullYear(),
  categorie: 'berline_premium' as CategorieVehicule,
  nb_places: 4,
  statut: 'disponible' as StatutVehicule,
  ct_date: '', assurance_date: '',
  kilometrage: 0, couleur: '', notes: '',
  // Parc & location
  mode_acquisition: 'propriete' as ModeAcquisition,
  loueur_id: '', loueur: '', loyer_ht: 0, loyer_periode: 'mois' as LoyerPeriode, depot_garantie: 0,
  km_inclus: 0, cout_km_sup: 0,
  contrat_debut: '', contrat_fin: '',
  date_entree_parc: '', date_sortie_parc: '',
}

// Alerte fin de contrat de location
function contratAlert(dateStr: string | null) {
  if (!dateStr) return null
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days < 0)  return { level: 'danger', label: 'Contrat expiré',        color: '#9e2a2a' }
  if (days < 30) return { level: 'warn',   label: `Fin dans ${days}j`,      color: '#7a5c10' }
  return null
}

export default function VehiculesPage() {
  const router = useRouter()
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [filter,    setFilter]    = useState('tous')
  const [form,      setForm]      = useState(emptyForm)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/vehicules')
    const { data } = await res.json()
    setVehicules(data ?? [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/vehicules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        ct_date:        form.ct_date        || null,
        assurance_date: form.assurance_date || null,
        couleur:        form.couleur        || null,
        notes:          (form as any).notes || null,
        // Parc & location — vider les champs non pertinents / vides
        loueur_id:     form.mode_acquisition === 'propriete' ? null : (form.loueur_id || null),
        loueur:        form.mode_acquisition === 'propriete' ? null : (form.loueur || null),
        loyer_ht:      form.mode_acquisition === 'propriete' ? null : (form.loyer_ht || null),
        loyer_periode: form.loyer_periode,
        depot_garantie:   form.depot_garantie   || null,
        km_inclus:        form.km_inclus        || null,
        cout_km_sup:      form.cout_km_sup      || null,
        contrat_debut:    form.contrat_debut    || null,
        contrat_fin:      form.contrat_fin      || null,
        date_entree_parc: form.date_entree_parc || null,
        date_sortie_parc: form.date_sortie_parc || null,
      }),
    })
    const { data, error } = await res.json()
    if (error) { toast.error(error); setSaving(false); return }
    toast.success(`${data.marque} ${data.modele} ajouté !`)
    setVehicules(prev => [data, ...prev])
    setShowForm(false)
    setForm(emptyForm)
    setSaving(false)
  }

  const filtered = vehicules.filter(v => {
    if (filter === 'tous') return true
    if (filter === 'loues')  return v.mode_acquisition !== 'propriete'
    if (filter === 'propres') return v.mode_acquisition === 'propriete'
    if (filter === 'alertes') {
      const ct  = docAlert(v.ct_date)
      const ass = docAlert(v.assurance_date)
      return ct.level === 'danger' || ct.level === 'warn' || ass.level === 'danger' || ass.level === 'warn' || !!contratAlert(v.contrat_fin)
    }
    return v.statut === filter
  })
  const sp = useSearchPaginate(filtered, (v: any) =>
    `${v.marque} ${v.modele} ${v.immatriculation} ${CATEGORIES[v.categorie] ?? ''} ${v.couleur ?? ''}`)

  function handleExport() {
    exportCsv('vehicules.csv', sp.filtered.map((v: any) => ({
      Marque: v.marque, Modèle: v.modele, Immatriculation: v.immatriculation,
      Catégorie: CATEGORIES[v.categorie] ?? v.categorie, Places: v.nb_places, Statut: v.statut,
      Acquisition: MODES[v.mode_acquisition as ModeAcquisition]?.label ?? v.mode_acquisition,
      Loueur: v.loueur ?? '', 'Loyer HT': v.loyer_ht ?? '', Période: PERIODES[v.loyer_periode as LoyerPeriode]?.label ?? '',
      'Fin contrat': v.contrat_fin ?? '', 'Entrée parc': v.date_entree_parc ?? '', 'Sortie parc': v.date_sortie_parc ?? '',
      'Contrôle technique': v.ct_date ?? '', Assurance: v.assurance_date ?? '', Kilométrage: v.kilometrage ?? '',
    })))
  }

  const loues       = vehicules.filter(v => v.mode_acquisition !== 'propriete').length
  const coutMensuel = vehicules.reduce((s, v) => s + loyerMensuelEquiv(v), 0)
  const alertes = vehicules.filter(v => {
    const ct = docAlert(v.ct_date); const ass = docAlert(v.assurance_date)
    return ct.level !== 'ok' || ass.level !== 'ok' || !!contratAlert(v.contrat_fin)
  }).length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <span className="section-title">Véhicules — Flotte</span>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Ajouter un véhicule
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom:'22px' }}>
        {[
          { label:'Flotte totale',      value: vehicules.length, color:'#16130e' },
          { label:'Véhicules loués',    value: loues,   color:'#1e3f70' },
          { label:'Coût mensuel est. HT', value: coutMensuel > 0 ? fmtEur(coutMensuel) : '—', color:'#9a7a28', small:true },
          { label:'Alertes',            value: alertes, color: alertes > 0 ? '#9e2a2a' : '#16130e' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color, fontSize: (k as any).small ? '22px' : '34px' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
        {[
          { val:'tous',        label:'Tous' },
          { val:'loues',       label:'Loués' },
          { val:'propres',     label:'En propriété' },
          { val:'disponible',  label:'Disponibles' },
          { val:'maintenance', label:'Maintenance' },
          { val:'alertes',     label:'⚠ Alertes' },
        ].map(f => (
          <button key={f.val}
            onClick={() => setFilter(f.val)}
            className={`filter-chip${filter === f.val ? ' active' : ''}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom:'14px' }}>
        <SearchBar value={sp.query} onChange={sp.setQuery} placeholder="Rechercher un véhicule, plaque, catégorie…" onExport={handleExport} />
      </div>

      {/* Liste mobile (cartes) */}
      <div className="md:hidden" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {loading ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>Chargement…</div>
        ) : sp.total === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>{vehicules.length === 0 ? 'Aucun véhicule — ajoutez le premier !' : 'Aucun résultat'}</div>
        ) : sp.pageItems.map((v: any) => {
          const stt = STATUTS[v.statut]; const m = MODES[v.mode_acquisition] ?? MODES.propriete
          const ct = docAlert(v.ct_date); const ass = docAlert(v.assurance_date); const ca = contratAlert(v.contrat_fin)
          return (
            <Link key={v.id} href={`/dashboard/vehicules/${v.id}`} style={{ display:'block', background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', padding:'12px', textDecoration:'none', color:'inherit' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'16px', fontWeight:500, color:'#16130e' }}>{v.marque} {v.modele}</div>
                  <div className="mono" style={{ fontSize:'11px', color:'#5a564e', marginTop:'2px' }}>{v.immatriculation} · {CATEGORIES[v.categorie]}</div>
                </div>
                <span style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 10px', fontSize:'10px', fontWeight:700, background:stt.bg, color:stt.color, border:`1px solid ${stt.color}33` }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:stt.color }} />{stt.label}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'10px', flexWrap:'wrap' }}>
                <span style={{ padding:'2px 8px', fontSize:'9px', fontWeight:700, textTransform:'uppercase', background:m.bg, color:m.color, border:`1px solid ${m.color}33` }}>{m.short}</span>
                {v.mode_acquisition !== 'propriete' && v.loyer_ht ? <span className="mono" style={{ fontSize:'10px', color:'#9a7a28' }}>{fmtEur(v.loyer_ht)}{PERIODES[v.loyer_periode]?.suffix ?? '/mois'}</span> : null}
                {(ct.level === 'danger' || ct.level === 'warn') && <span style={{ fontSize:'9px', fontWeight:700, color:'#9e2a2a' }}>CT {ct.label}</span>}
                {(ass.level === 'danger' || ass.level === 'warn') && <span style={{ fontSize:'9px', fontWeight:700, color:'#9e2a2a' }}>Assur. {ass.label}</span>}
                {ca && <span style={{ fontSize:'9px', fontWeight:700, color:ca.color }}>{ca.label}</span>}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Table (desktop) */}
      <div className="table-container hidden md:block">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Véhicule','Plaque','Catégorie','Statut','Contrôle tech.','Assurance','Parc / Location','Actions'].map((h,i) => (
                <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center', color:'#8a8478' }}>Chargement…</td></tr>
            ) : sp.total === 0 ? (
              <tr><td colSpan={8} style={{ padding:'60px', textAlign:'center', color:'#8a8478' }}>
                {vehicules.length === 0 ? 'Aucun véhicule — ajoutez le premier !' : 'Aucun résultat'}
              </td></tr>
            ) : sp.pageItems.map(v => {
              const st  = STATUTS[v.statut]
              const ct  = docAlert(v.ct_date)
              const ass = docAlert(v.assurance_date)
              return (
                <tr key={v.id} className="tr-body" onClick={() => router.push(`/dashboard/vehicules/${v.id}`)}>
                  <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'15px', fontWeight:500 }}>
                      {v.marque} {v.modele}
                    </div>
                    {v.annee && <div style={{ fontSize:'10px', color:'#8a8478' }}>{v.annee} · {v.nb_places} places</div>}
                    {v.chauffeur && (
                      <div style={{ fontSize:'10px', color:'#5a564e', marginTop:'2px' }}>
                        👤 {v.chauffeur.prenom} {v.chauffeur.nom}
                      </div>
                    )}
                  </td>
                  <td className="td">
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', letterSpacing:'1.5px', background:'#f5f2ed', border:'1px solid #b8b0a4', padding:'3px 8px' }}>
                      {v.immatriculation}
                    </span>
                  </td>
                  <td className="td">
                    <span style={{ fontSize:'11px', color:'#5a564e' }}>{CATEGORIES[v.categorie]}</span>
                  </td>
                  <td className="td">
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:'5px',
                      padding:'3px 10px', fontSize:'10px', fontWeight:700,
                      background: st.bg, color: st.color, border:`1px solid ${st.color}33`,
                    }}>
                      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: st.color,
                        animation: v.statut === 'en_mission' ? 'blink 1.6s infinite' : 'none' }} />
                      {st.label}
                    </span>
                  </td>
                  <td className="td">
                    <AlertCell status={ct} date={v.ct_date} />
                  </td>
                  <td className="td">
                    <AlertCell status={ass} date={v.assurance_date} />
                  </td>
                  <td className="td">
                    {(() => {
                      const m = MODES[v.mode_acquisition] ?? MODES.propriete
                      const ca = contratAlert(v.contrat_fin)
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', alignSelf:'flex-start', gap:'4px', padding:'2px 8px', fontSize:'9px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', background:m.bg, color:m.color, border:`1px solid ${m.color}33` }}>
                            {m.short}
                          </span>
                          {v.mode_acquisition !== 'propriete' && (
                            <>
                              {v.loueur && <span style={{ fontSize:'10px', color:'#5a564e' }}>{v.loueur}</span>}
                              {v.loyer_ht ? <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#9a7a28' }}>{fmtEur(v.loyer_ht)}{PERIODES[v.loyer_periode]?.suffix ?? '/mois'}</span> : null}
                              {ca && <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', fontSize:'9px', fontWeight:700, color:ca.color }}><AlertTriangle size={9}/> {ca.label}</span>}
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:'10px' }}
                      onClick={() => router.push(`/dashboard/vehicules/${v.id}`)}>
                      Fiche
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager page={sp.page} pageCount={sp.pageCount} total={sp.total} onPage={sp.setPage} />

      {/* Modal création */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{ background:'#fff', width:'560px', maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background:'#16130e', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
                Ajouter un véhicule
              </span>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px' }}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ padding:'22px 24px' }}>

              <VFormSection label="Identification">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div><label className="form-label">Marque *</label>
                    <input type="text" className="input" required value={form.marque} onChange={e => setForm({...form, marque:e.target.value})} placeholder="Mercedes-Benz" /></div>
                  <div><label className="form-label">Modèle *</label>
                    <input type="text" className="input" required value={form.modele} onChange={e => setForm({...form, modele:e.target.value})} placeholder="Classe E" /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div><label className="form-label">Immatriculation *</label>
                    <input type="text" className="input" required value={form.immatriculation} onChange={e => setForm({...form, immatriculation:e.target.value.toUpperCase()})} placeholder="AB-421-CD" /></div>
                  <div><label className="form-label">Année</label>
                    <input type="number" className="input" value={form.annee ?? ''} onChange={e => setForm({...form, annee:parseInt(e.target.value)||null as any})} min={2000} max={2030} /></div>
                  <div><label className="form-label">Nb places</label>
                    <input type="number" className="input" value={form.nb_places} onChange={e => setForm({...form, nb_places:parseInt(e.target.value)||4})} min={1} max={20} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label className="form-label">Catégorie</label>
                    <select className="select" value={form.categorie} onChange={e => setForm({...form, categorie:e.target.value as CategorieVehicule})}>
                      {(Object.entries(CATEGORIES) as [CategorieVehicule,string][]).map(([val,lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Couleur</label>
                    <input type="text" className="input" value={form.couleur} onChange={e => setForm({...form, couleur:e.target.value})} placeholder="Noir, Blanc…" />
                  </div>
                </div>
              </VFormSection>

              <VFormSection label="Documents & suivi">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div><label className="form-label">Date contrôle technique</label>
                    <input type="date" className="input" value={form.ct_date} onChange={e => setForm({...form, ct_date:e.target.value})} /></div>
                  <div><label className="form-label">Date fin assurance</label>
                    <input type="date" className="input" value={form.assurance_date} onChange={e => setForm({...form, assurance_date:e.target.value})} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div><label className="form-label">Kilométrage actuel</label>
                    <input type="number" className="input" value={form.kilometrage || ''} onChange={e => setForm({...form, kilometrage:parseInt(e.target.value)||0})} placeholder="0" /></div>
                  <div>
                    <label className="form-label">Statut initial</label>
                    <select className="select" value={form.statut} onChange={e => setForm({...form, statut:e.target.value as StatutVehicule})}>
                      {(Object.entries(STATUTS) as [StatutVehicule, typeof STATUTS[StatutVehicule]][]).map(([val,s]) => (
                        <option key={val} value={val}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </VFormSection>

              <VFormSection label="Parc & location">
                <div style={{ marginBottom:'12px' }}>
                  <label className="form-label">Mode d'acquisition</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
                    {(Object.entries(MODES) as [ModeAcquisition, typeof MODES[ModeAcquisition]][]).map(([val, m]) => (
                      <button key={val} type="button" onClick={() => setForm({ ...form, mode_acquisition: val })}
                        style={{ padding:'8px 6px', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', cursor:'pointer',
                          background: form.mode_acquisition === val ? m.bg : '#fff',
                          border: `1.5px solid ${form.mode_acquisition === val ? m.color : '#b8b0a4'}`,
                          color: form.mode_acquisition === val ? m.color : '#5a564e' }}>
                        {m.short}
                      </button>
                    ))}
                  </div>
                </div>

                {form.mode_acquisition !== 'propriete' && (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                      <LoueurSelect value={form.loueur_id} onChange={(id, nom) => setForm({ ...form, loueur_id: id, loueur: nom })} />
                      <div><label className="form-label">Loyer HT (€)</label>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <input type="number" className="input" min={0} step={0.01} value={form.loyer_ht || ''} onChange={e => setForm({...form, loyer_ht:parseFloat(e.target.value)||0})} placeholder="0,00" />
                          <select className="select" style={{ width:'120px', flexShrink:0 }} value={form.loyer_periode} onChange={e => setForm({...form, loyer_periode:e.target.value as LoyerPeriode})}>
                            <option value="jour">/ jour</option>
                            <option value="semaine">/ semaine</option>
                            <option value="mois">/ mois</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                      <div><label className="form-label">Dépôt / Caution (€)</label>
                        <input type="number" className="input" min={0} step={0.01} value={form.depot_garantie || ''} onChange={e => setForm({...form, depot_garantie:parseFloat(e.target.value)||0})} /></div>
                      <div><label className="form-label">Km inclus / an</label>
                        <input type="number" className="input" min={0} value={form.km_inclus || ''} onChange={e => setForm({...form, km_inclus:parseInt(e.target.value)||0})} placeholder="30000" /></div>
                      <div><label className="form-label">Coût km sup. (€)</label>
                        <input type="number" className="input" min={0} step={0.01} value={form.cout_km_sup || ''} onChange={e => setForm({...form, cout_km_sup:parseFloat(e.target.value)||0})} placeholder="0,15" /></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                      <div><label className="form-label">Début de contrat</label>
                        <input type="date" className="input" value={form.contrat_debut} onChange={e => setForm({...form, contrat_debut:e.target.value})} /></div>
                      <div><label className="form-label">Fin de contrat</label>
                        <input type="date" className="input" value={form.contrat_fin} onChange={e => setForm({...form, contrat_fin:e.target.value})} /></div>
                    </div>
                  </>
                )}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div><label className="form-label">Entrée dans le parc</label>
                    <input type="date" className="input" value={form.date_entree_parc} onChange={e => setForm({...form, date_entree_parc:e.target.value})} /></div>
                  <div><label className="form-label">Sortie du parc</label>
                    <input type="date" className="input" value={form.date_sortie_parc} onChange={e => setForm({...form, date_sortie_parc:e.target.value})} /></div>
                </div>
              </VFormSection>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Ajout…' : 'Ajouter le véhicule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertCell({ status, date }: { status: ReturnType<typeof docAlert>; date: string | null }) {
  if (status.level === 'none') return <span style={{ fontSize:'10px', color:'#c2bdb4' }}>—</span>
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'10px', fontWeight:600, color: status.color }}>
      {(status.level === 'danger' || status.level === 'warn') && <AlertTriangle size={10} />}
      {status.label}
    </span>
  )
}

function VFormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'12px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
        {label}
      </div>
      {children}
    </div>
  )
}
