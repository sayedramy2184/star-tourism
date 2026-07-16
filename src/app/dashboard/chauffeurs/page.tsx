'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Phone, Mail, AlertTriangle } from 'lucide-react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useSearchPaginate } from '@/lib/useSearchPaginate'
import { SearchBar, Pager } from '@/components/ui/ListControls'
import { exportCsv } from '@/lib/exportCsv'

type Statut = 'disponible' | 'en_mission' | 'indisponible' | 'conge'

interface Chauffeur {
  id: string
  nom: string
  prenom: string
  telephone: string
  email: string | null
  statut: Statut
  vtc_card_numero: string | null
  vtc_card_expiry: string | null
  permis_expiry: string | null
  notes: string | null
}

const STATUTS: Record<Statut, { label: string; color: string; bg: string }> = {
  disponible:   { label: 'Disponible',   color: '#1e5e3a', bg: '#eaf4ee' },
  en_mission:   { label: 'En mission',   color: '#1e3f70', bg: '#e8eef8' },
  indisponible: { label: 'Indisponible', color: '#9e2a2a', bg: '#faeaea' },
  conge:        { label: 'Congé',        color: '#7a5c10', bg: '#fdf3dc' },
}

function docStatus(dateStr: string | null) {
  if (!dateStr) return { level: 'none', label: 'Non renseigné', color: '#c2bdb4' }
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days < 0)   return { level: 'danger', label: `Expiré (${format(parseISO(dateStr),'dd/MM/yyyy')})`, color: '#9e2a2a' }
  if (days < 30)  return { level: 'warn',   label: `Expire dans ${days}j`, color: '#7a5c10' }
  if (days < 90)  return { level: 'soon',   label: `Expire le ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#9a7a28' }
  return { level: 'ok', label: `Valide — ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#1e5e3a' }
}

const emptyForm = {
  nom: '', prenom: '', telephone: '', email: '',
  statut: 'disponible' as Statut,
  vtc_card_numero: '', vtc_card_expiry: '',
  permis_expiry: '', notes: '',
}

export default function ChauffeursPage() {
  const router = useRouter()
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [filter,     setFilter]     = useState<string>('tous')
  const [form,       setForm]       = useState(emptyForm)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/chauffeurs')
    const { data } = await res.json()
    setChauffeurs(data ?? [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/chauffeurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        vtc_card_expiry: form.vtc_card_expiry || null,
        permis_expiry:   form.permis_expiry   || null,
        email:           form.email           || null,
        notes:           form.notes           || null,
      }),
    })
    const { data, error } = await res.json()
    if (error) { toast.error(error); setSaving(false); return }
    toast.success(`${data.prenom} ${data.nom} ajouté !`)
    setChauffeurs(prev => [data, ...prev])
    setShowForm(false)
    setForm(emptyForm)
    setSaving(false)
  }

  const filtered = chauffeurs.filter(c =>
    filter === 'tous' ? true :
    filter === 'alertes' ? (docStatus(c.vtc_card_expiry).level !== 'ok' || docStatus(c.permis_expiry).level !== 'ok') :
    c.statut === filter
  )
  const sp = useSearchPaginate(filtered, (c: any) =>
    `${c.prenom} ${c.nom} ${c.telephone ?? ''} ${c.email ?? ''} ${c.vtc_card_numero ?? ''}`)

  function handleExport() {
    exportCsv('chauffeurs.csv', sp.filtered.map((c: any) => ({
      Prénom: c.prenom, Nom: c.nom, Téléphone: c.telephone ?? '', Email: c.email ?? '',
      Statut: c.statut, 'Carte VTC': c.vtc_card_numero ?? '', 'Expiration VTC': c.vtc_card_expiry ?? '',
      'Expiration permis': c.permis_expiry ?? '',
    })))
  }

  // KPIs
  const dispo    = chauffeurs.filter(c => c.statut === 'disponible').length
  const mission  = chauffeurs.filter(c => c.statut === 'en_mission').length
  const alertes  = chauffeurs.filter(c =>
    docStatus(c.vtc_card_expiry).level === 'danger' ||
    docStatus(c.vtc_card_expiry).level === 'warn'   ||
    docStatus(c.permis_expiry).level   === 'danger' ||
    docStatus(c.permis_expiry).level   === 'warn'
  ).length

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <span className="section-title">Chauffeurs</span>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Nouveau chauffeur
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom:'22px' }}>
        {[
          { label:'Total',       value: chauffeurs.length, color:'#16130e' },
          { label:'Disponibles', value: dispo,   color:'#1e5e3a' },
          { label:'En mission',  value: mission, color:'#1e3f70' },
          { label:'Alertes docs',value: alertes, color: alertes > 0 ? '#9e2a2a' : '#16130e' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color, fontSize:'34px' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
        {[
          { val:'tous',         label:'Tous' },
          { val:'disponible',   label:'Disponibles' },
          { val:'en_mission',   label:'En mission' },
          { val:'indisponible', label:'Indisponibles' },
          { val:'conge',        label:'Congé' },
          { val:'alertes',      label:'⚠ Alertes docs' },
        ].map(f => (
          <button key={f.val}
            onClick={() => setFilter(f.val)}
            className={`filter-chip${filter === f.val ? ' active' : ''}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom:'14px' }}>
        <SearchBar value={sp.query} onChange={sp.setQuery} placeholder="Rechercher un chauffeur, téléphone, carte VTC…" onExport={handleExport} />
      </div>

      {/* Table */}
      <div className="table-container">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Chauffeur','Contact','Statut','Carte VTC','Permis','Actions'].map((h, i) => (
                <th key={h} className="th" style={i % 2 === 1 ? { background:'rgba(0,0,0,0.1)' } : {}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'#8a8478' }}>Chargement…</td></tr>
            ) : sp.total === 0 ? (
              <tr><td colSpan={6} style={{ padding:'60px', textAlign:'center', color:'#8a8478' }}>
                {chauffeurs.length === 0 ? 'Aucun chauffeur — créez le premier !' : 'Aucun résultat'}
              </td></tr>
            ) : sp.pageItems.map(c => {
              const vtc    = docStatus(c.vtc_card_expiry)
              const permis = docStatus(c.permis_expiry)
              const st     = STATUTS[c.statut]
              const initials = `${c.prenom[0]}${c.nom[0]}`.toUpperCase()
              return (
                <tr key={c.id} className="tr-body" onClick={() => router.push(`/dashboard/chauffeurs/${c.id}`)}>
                  {/* Nom */}
                  <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{
                        width:'34px', height:'34px', borderRadius:'50%', flexShrink:0,
                        background: c.statut === 'disponible' ? '#eaf4ee' : c.statut === 'en_mission' ? '#e8eef8' : '#f5f2ed',
                        border: `1.5px solid ${st.color}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'11px', fontWeight:700, color: st.color,
                      }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, color:'#16130e' }}>{c.prenom} {c.nom}</div>
                        {c.vtc_card_numero && (
                          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#8a8478' }}>
                            VTC {c.vtc_card_numero}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="td">
                    <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'#2e2b25' }}>
                        <Phone size={10} style={{ color:'#8a8478' }} /> {c.telephone}
                      </div>
                      {c.email && (
                        <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'#5a564e' }}>
                          <Mail size={10} style={{ color:'#8a8478' }} /> {c.email}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Statut */}
                  <td className="td">
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:'5px',
                      padding:'3px 10px', fontSize:'10px', fontWeight:700, letterSpacing:'0.5px',
                      background: st.bg, color: st.color,
                      border: `1px solid ${st.color}33`,
                    }}>
                      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: st.color,
                        animation: c.statut === 'en_mission' ? 'blink 1.6s infinite' : 'none' }} />
                      {st.label}
                    </span>
                  </td>

                  {/* Carte VTC */}
                  <td className="td">
                    <DocBadge status={vtc} />
                  </td>

                  {/* Permis */}
                  <td className="td">
                    <DocBadge status={permis} />
                  </td>

                  {/* Actions */}
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:'10px' }}
                        onClick={() => router.push(`/dashboard/chauffeurs/${c.id}`)}>
                        Fiche
                      </button>
                      <StatutToggle chauffeur={c} onChange={updated => {
                        setChauffeurs(prev => prev.map(x => x.id === c.id ? { ...x, statut: updated } : x))
                      }} />
                    </div>
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
          <div style={{ background:'#fff', width:'540px', maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background:'#16130e', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
                Nouveau chauffeur
              </span>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px' }}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ padding:'22px 24px' }}>

              <FormSection label="Identité">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div>
                    <label className="form-label">Prénom *</label>
                    <input type="text" className="input" required value={form.prenom}
                      onChange={e => setForm({...form, prenom:e.target.value})} placeholder="Mohamed" />
                  </div>
                  <div>
                    <label className="form-label">Nom *</label>
                    <input type="text" className="input" required value={form.nom}
                      onChange={e => setForm({...form, nom:e.target.value})} placeholder="Khalil" />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div>
                    <label className="form-label">Téléphone *</label>
                    <input type="tel" className="input" required value={form.telephone}
                      onChange={e => setForm({...form, telephone:e.target.value})} placeholder="+33 6 12 34 56 78" />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input type="email" className="input" value={form.email}
                      onChange={e => setForm({...form, email:e.target.value})} placeholder="chauffeur@exemple.fr" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Statut initial</label>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {(Object.keys(STATUTS) as Statut[]).map(s => (
                      <button key={s} type="button"
                        onClick={() => setForm({...form, statut:s})}
                        style={{
                          padding:'6px 14px', fontSize:'10px', fontWeight:700, letterSpacing:'0.5px',
                          background: form.statut === s ? STATUTS[s].bg : '#ffffff',
                          border: `1.5px solid ${form.statut === s ? STATUTS[s].color : '#b8b0a4'}`,
                          color: form.statut === s ? STATUTS[s].color : '#5a564e',
                          cursor:'pointer', transition:'all 0.14s',
                        }}>
                        {STATUTS[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </FormSection>

              <FormSection label="Documents">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div>
                    <label className="form-label">N° Carte VTC</label>
                    <input type="text" className="input" value={form.vtc_card_numero}
                      onChange={e => setForm({...form, vtc_card_numero:e.target.value})} placeholder="VTC-XXXXXXXX" />
                  </div>
                  <div>
                    <label className="form-label">Expiration carte VTC</label>
                    <input type="date" className="input" value={form.vtc_card_expiry}
                      onChange={e => setForm({...form, vtc_card_expiry:e.target.value})} />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label className="form-label">Expiration permis</label>
                    <input type="date" className="input" value={form.permis_expiry}
                      onChange={e => setForm({...form, permis_expiry:e.target.value})} />
                  </div>
                </div>
              </FormSection>

              <div>
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={form.notes}
                  onChange={e => setForm({...form, notes:e.target.value})}
                  placeholder="Langues parlées, spécialités, informations particulières…" />
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'16px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Création…' : 'Créer le chauffeur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Composants helper ─────────────────────────

function DocBadge({ status }: { status: ReturnType<typeof docStatus> }) {
  if (status.level === 'none') {
    return <span style={{ fontSize:'10px', color:'#c2bdb4', fontStyle:'italic' }}>Non renseigné</span>
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'10px', fontWeight:600, color: status.color }}>
      {(status.level === 'danger' || status.level === 'warn') && <AlertTriangle size={11} />}
      {status.label}
    </span>
  )
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'12px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function StatutToggle({ chauffeur, onChange }: { chauffeur: Chauffeur; onChange: (s: Statut) => void }) {
  const [open, setOpen] = useState(false)

  // Disponible et en_mission sont automatiques (gérés par les affectations)
  // Indisponible et congé sont manuels
  const MANUELS: Statut[] = ['indisponible', 'conge']
  const isManuel = MANUELS.includes(chauffeur.statut)

  async function changeStatut(s: Statut) {
    setOpen(false)
    const res = await fetch(`/api/chauffeurs/${chauffeur.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: s }),
    })
    if (res.ok) { onChange(s); toast.success('Statut mis à jour') }
  }

  return (
    <div style={{ position:'relative' }}>
      <button
        className="btn-ghost"
        style={{
          padding:'4px 10px', fontSize:'10px',
          borderColor: isManuel ? STATUTS[chauffeur.statut].color : '#b8b0a4',
          color: isManuel ? STATUTS[chauffeur.statut].color : '#5a564e',
        }}
        onMouseDown={() => setOpen(o => !o)}
      >
        {isManuel ? STATUTS[chauffeur.statut].label : 'Marquer'} ▾
      </button>

      {open && (
        <>
          {/* Overlay pour fermer en cliquant ailleurs */}
          <div style={{ position:'fixed', inset:0, zIndex:49 }} onMouseDown={() => setOpen(false)} />

          <div style={{
            position:'absolute', right:0, top:'100%', zIndex:50, marginTop:'4px',
            background:'#fff', border:'1.5px solid #b8b0a4',
            boxShadow:'0 6px 20px rgba(0,0,0,0.15)', minWidth:'200px',
          }}>
            {/* Statuts automatiques — info seulement */}
            <div style={{ padding:'8px 14px 6px', borderBottom:'1px solid #ede9e2' }}>
              <div style={{ fontSize:'8px', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'6px' }}>
                Automatiques
              </div>
              {(['disponible','en_mission'] as Statut[]).map(s => (
                <div key={s} style={{ padding:'4px 8px', fontSize:'11px', fontWeight:600, color:STATUTS[s].color, opacity:0.5, display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:STATUTS[s].color, flexShrink:0 }} />
                  {STATUTS[s].label}
                  <span style={{ fontSize:'9px', color:'#b8b0a4', fontWeight:400, marginLeft:'auto' }}>auto</span>
                </div>
              ))}
            </div>

            {/* Statuts manuels */}
            <div style={{ padding:'6px 14px 8px' }}>
              <div style={{ fontSize:'8px', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'6px' }}>
                Manuel
              </div>
              {MANUELS.map(s => (
                <div key={s}
                  onMouseDown={() => changeStatut(s)}
                  style={{
                    padding:'8px 8px', fontSize:'11px', fontWeight:600, cursor:'pointer',
                    color:STATUTS[s].color, borderRadius:'2px',
                    background: chauffeur.statut === s ? STATUTS[s].bg : 'transparent',
                    display:'flex', alignItems:'center', gap:'6px', transition:'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = STATUTS[s].bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = chauffeur.statut === s ? STATUTS[s].bg : 'transparent')}
                >
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:STATUTS[s].color, flexShrink:0 }} />
                  {STATUTS[s].label}
                  {chauffeur.statut === s && <span style={{ fontSize:'9px', marginLeft:'auto' }}>✓</span>}
                </div>
              ))}

              {/* Remettre disponible si statut manuel actif */}
              {isManuel && (
                <div
                  onMouseDown={() => changeStatut('disponible')}
                  style={{
                    padding:'7px 8px', marginTop:'4px', fontSize:'11px', fontWeight:600,
                    color:'#1e5e3a', cursor:'pointer', borderTop:'1px solid #ede9e2',
                    display:'flex', alignItems:'center', gap:'6px', transition:'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eaf4ee')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  ↩ Remettre disponible
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
