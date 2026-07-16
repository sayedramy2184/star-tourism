'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Plus, Phone, Mail, Edit, Trash2, X } from 'lucide-react'
import { useSearchPaginate } from '@/lib/useSearchPaginate'
import { SearchBar, Pager } from '@/components/ui/ListControls'
import { exportCsv } from '@/lib/exportCsv'

interface SousTraitant {
  id: string
  societe: string
  contact_nom: string | null
  telephone: string | null
  email: string | null
  siret: string | null
  notes: string | null
}

const emptyForm = {
  societe: '', contact_nom: '', telephone: '',
  email: '', siret: '', notes: '',
}

export default function SousTraitantsPage() {
  const [list,     setList]     = useState<SousTraitant[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<SousTraitant | null>(null)
  const [form,     setForm]     = useState(emptyForm)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/sous-traitants')
    const { data } = await res.json()
    setList(data ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(st: SousTraitant) {
    setEditing(st)
    setForm({
      societe:     st.societe,
      contact_nom: st.contact_nom ?? '',
      telephone:   st.telephone  ?? '',
      email:       st.email      ?? '',
      siret:       st.siret      ?? '',
      notes:       st.notes      ?? '',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.societe) return toast.error('Nom de société requis')
    setSaving(true)
    try {
      const body = {
        societe:     form.societe,
        contact_nom: form.contact_nom || null,
        telephone:   form.telephone   || null,
        email:       form.email       || null,
        siret:       form.siret       || null,
        notes:       form.notes       || null,
      }
      const res = await fetch(
        editing ? `/api/sous-traitants/${editing.id}` : '/api/sous-traitants',
        { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      const { data, error } = await res.json()
      if (error) throw new Error(error)
      toast.success(editing ? 'Sous-traitant mis à jour !' : 'Sous-traitant ajouté !')
      setShowForm(false)
      load()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string, societe: string) {
    if (!confirm(`Supprimer ${societe} ?`)) return
    await fetch(`/api/sous-traitants/${id}`, { method: 'DELETE' })
    toast.success('Supprimé')
    setList(prev => prev.filter(s => s.id !== id))
  }

  const sp = useSearchPaginate(list, (s: any) =>
    `${s.societe} ${s.contact_nom ?? ''} ${s.telephone ?? ''} ${s.email ?? ''} ${s.siret ?? ''}`)

  function handleExport() {
    exportCsv('sous-traitants.csv', sp.filtered.map((s: any) => ({
      Société: s.societe, Contact: s.contact_nom ?? '', Téléphone: s.telephone ?? '',
      Email: s.email ?? '', SIRET: s.siret ?? '',
    })))
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <span className="section-title">Sous-traitants</span>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={14}/> Nouveau sous-traitant
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom:'22px' }}>
        <div className="kpi-card">
          <div className="kpi-label">Sous-traitants</div>
          <div className="kpi-value">{list.length}</div>
          <div className="kpi-sub">Partenaires actifs</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Prestations sous-traitées</div>
          <div className="kpi-value" style={{ color:'#1e3f70' }}>—</div>
          <div className="kpi-sub">Ce mois</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Marge moyenne</div>
          <div className="kpi-value" style={{ color:'#1e5e3a' }}>—</div>
          <div className="kpi-sub">Sur prestations ST</div>
        </div>
      </div>

      <div style={{ marginBottom:'14px' }}>
        <SearchBar value={sp.query} onChange={sp.setQuery} placeholder="Rechercher un sous-traitant, SIRET…" onExport={handleExport} />
      </div>

      {/* Table */}
      <div className="table-container">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Société','Contact','Téléphone','Email','SIRET','Notes','Actions'].map((h,i) => (
                <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'#8a8478' }}>Chargement…</td></tr>
            ) : sp.total === 0 ? (
              <tr><td colSpan={7} style={{ padding:'60px', textAlign:'center', color:'#8a8478' }}>
                {list.length === 0 ? 'Aucun sous-traitant — ajoutez le premier !' : 'Aucun résultat'}
              </td></tr>
            ) : sp.pageItems.map(st => (
              <tr key={st.id} className="tr-body" style={{ cursor:'pointer' }} onClick={() => window.location.href=`/dashboard/sous-traitants/${st.id}`}>
                <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                  <div style={{ fontWeight:600, color:'#16130e', fontFamily:'Cormorant Garamond,serif', fontSize:'14px' }}>{st.societe}</div>
                </td>
                <td className="td" style={{ color:'#2e2b25' }}>{st.contact_nom ?? '—'}</td>
                <td className="td">
                  {st.telephone ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', fontFamily:'JetBrains Mono,monospace' }}>
                      <Phone size={10} style={{ color:'#8a8478' }}/> {st.telephone}
                    </div>
                  ) : '—'}
                </td>
                <td className="td">
                  {st.email ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px' }}>
                      <Mail size={10} style={{ color:'#8a8478' }}/> {st.email}
                    </div>
                  ) : '—'}
                </td>
                <td className="td">
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'#8a8478' }}>
                    {st.siret ?? '—'}
                  </span>
                </td>
                <td className="td" style={{ fontSize:'11px', color:'#8a8478', fontStyle:'italic', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {st.notes ?? '—'}
                </td>
                <td className="td" onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:'10px' }}
                      onClick={() => openEdit(st)}>
                      <Edit size={11}/> Modifier
                    </button>
                    <button style={{ background:'none', border:'1.5px solid rgba(158,42,42,0.3)', padding:'4px 8px', cursor:'pointer', color:'#9e2a2a', fontSize:'10px', transition:'all 0.14s' }}
                      onClick={() => handleDelete(st.id, st.societe)}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={sp.page} pageCount={sp.pageCount} total={sp.total} onPage={sp.setPage} />

      {/* Modal création/édition */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'520px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.3)', border:'1.5px solid #b8b0a4' }}>
            <div style={{ background:'#16130e', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
                {editing ? 'Modifier le sous-traitant' : 'Nouveau sous-traitant'}
              </span>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
                <X size={18}/>
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding:'22px 24px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'12px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
                Informations société
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label className="form-label">Nom de la société *</label>
                  <input type="text" className="input" required value={form.societe}
                    onChange={e => setForm({...form, societe:e.target.value})}
                    placeholder="Elite VTC Paris" />
                </div>
                <div>
                  <label className="form-label">Contact principal</label>
                  <input type="text" className="input" value={form.contact_nom}
                    onChange={e => setForm({...form, contact_nom:e.target.value})}
                    placeholder="Prénom Nom" />
                </div>
                <div>
                  <label className="form-label">SIRET</label>
                  <input type="text" className="input" value={form.siret}
                    onChange={e => setForm({...form, siret:e.target.value})}
                    placeholder="123 456 789 00012" />
                </div>
                <div>
                  <label className="form-label">Téléphone</label>
                  <input type="tel" className="input" value={form.telephone}
                    onChange={e => setForm({...form, telephone:e.target.value})}
                    placeholder="+33 6 12 34 56 78" />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" className="input" value={form.email}
                    onChange={e => setForm({...form, email:e.target.value})}
                    placeholder="contact@societe.fr" />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={form.notes}
                  onChange={e => setForm({...form, notes:e.target.value})}
                  placeholder="Spécialités, zone géographique, conditions tarifaires habituelles…" />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'16px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Sauvegarde…' : editing ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
