'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { Client } from '@/types'
import { Plus, X } from 'lucide-react'
import { useSearchPaginate } from '@/lib/useSearchPaginate'
import { SearchBar, Pager } from '@/components/ui/ListControls'
import { exportCsv } from '@/lib/exportCsv'

export default function ClientsPage() {
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [form, setForm] = useState({
    type: 'agence', nom: '', contact_nom: '',
    email: '', telephone: '', adresse: '', ville: '', pays: 'France', numero_tva: '', notes: '',
  })

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    const res = await fetch('/api/clients')
    const { data } = await res.json()
    setClients(data ?? [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const { data, error } = await res.json()
    if (error) { toast.error(error); return }
    toast.success('Client créé !')
    setClients(prev => [data, ...prev])
    setShowForm(false)
    setForm({ type:'entreprise', nom:'', contact_nom:'', email:'', telephone:'', adresse:'', ville:'', pays:'France', numero_tva:'', notes:'' })
  }

  const sp = useSearchPaginate(clients, c =>
    `${c.nom} ${c.contact_nom ?? ''} ${c.email ?? ''} ${c.telephone ?? ''} ${c.numero_tva ?? ''} ${c.ville ?? ''}`)

  function handleExport() {
    exportCsv('clients.csv', sp.filtered.map(c => ({
      Type: c.type === 'agence' ? 'Agence' : c.type === 'entreprise' ? 'Entreprise' : 'Particulier',
      Nom: c.nom, Contact: c.contact_nom ?? '', Email: c.email ?? '',
      Téléphone: c.telephone ?? '', Ville: c.ville ?? '', 'N° TVA': c.numero_tva ?? '',
    })))
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <span className="section-title">Clients</span>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Nouveau client
        </button>
      </div>

      <div style={{ marginBottom:'14px' }}>
        <SearchBar value={sp.query} onChange={sp.setQuery} placeholder="Rechercher un client, email, ville…" onExport={handleExport} />
      </div>

      {/* Modal création */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{ background:'#fff', width:'520px', maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background:'#16130e', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>Nouveau client</span>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px' }}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ padding:'22px 24px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'14px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>
                Type & Identité
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="select" value={form.type} onChange={e => setForm({...form, type:e.target.value})}>
                    <option value="agence">Agence (partenaire)</option>
                    <option value="entreprise">Entreprise</option>
                    <option value="particulier">Particulier</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{form.type === 'particulier' ? 'Nom complet *' : 'Raison sociale *'}</label>
                  <input type="text" className="input" required value={form.nom} onChange={e => setForm({...form, nom:e.target.value})} placeholder={form.type === 'agence' ? 'KTS Voyages' : form.type === 'entreprise' ? 'Luxinvest Partners' : 'Jean Dupont'} />
                </div>
              </div>
              {form.type === 'entreprise' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div>
                    <label className="form-label">Contact sur place</label>
                    <input type="text" className="input" value={form.contact_nom} onChange={e => setForm({...form, contact_nom:e.target.value})} placeholder="Alain Bertrand" />
                  </div>
                  <div>
                    <label className="form-label">N° TVA</label>
                    <input type="text" className="input" value={form.numero_tva} onChange={e => setForm({...form, numero_tva:e.target.value})} placeholder="FR12 345 678 901" />
                  </div>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="contact@exemple.fr" />
                </div>
                <div>
                  <label className="form-label">Téléphone</label>
                  <input type="tel" className="input" value={form.telephone} onChange={e => setForm({...form, telephone:e.target.value})} placeholder="+33 6 12 34 56 78" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <label className="form-label">Adresse</label>
                  <input type="text" className="input" value={form.adresse} onChange={e => setForm({...form, adresse:e.target.value})} placeholder="14 Place Vendôme" />
                </div>
                <div>
                  <label className="form-label">Ville</label>
                  <input type="text" className="input" value={form.ville} onChange={e => setForm({...form, ville:e.target.value})} placeholder="Paris" />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Informations particulières, conditions tarifaires…" />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'16px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Créer le client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste mobile (cartes) */}
      <div className="only-mobile" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {loading ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>Chargement…</div>
        ) : sp.total === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>{clients.length === 0 ? 'Aucun client — créez le premier !' : 'Aucun résultat.'}</div>
        ) : sp.pageItems.map((c: any) => {
          const typeStyle = c.type === 'agence' ? { background:'#fdf6e3', color:'#9a7a28' } : c.type === 'entreprise' ? { background:'#e8eef8', color:'#1e3f70' } : { background:'#eaf4ee', color:'#1e5e3a' }
          return (
            <Link key={c.id} href={`/dashboard/clients/${c.id}`} style={{ display:'block', background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', padding:'12px', textDecoration:'none', color:'inherit' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, color:'#16130e', fontSize:'14px' }}>{c.nom}</div>
                  {c.contact_nom && <div style={{ fontSize:'11px', color:'#5a564e' }}>{c.contact_nom}</div>}
                </div>
                <span style={{ flexShrink:0, padding:'2px 8px', fontSize:'8px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', border:'1px solid rgba(0,0,0,0.08)', ...typeStyle }}>
                  {c.type === 'agence' ? 'Agence' : c.type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                </span>
              </div>
              <div className="mono" style={{ fontSize:'11px', color:'#5a564e', marginTop:'8px', display:'flex', flexDirection:'column', gap:'2px' }}>
                {c.telephone && <span>{c.telephone}</span>}
                {c.email && <span>{c.email}</span>}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Table (desktop) */}
      <div className="table-container only-desktop">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Type','Nom / Société','Contact','Email','Téléphone','Dossiers',''].map((h,i) => (
                <th key={i} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="td" style={{ textAlign:'center', padding:'40px', color:'#8a8478' }}>Chargement…</td></tr>
            ) : sp.total === 0 ? (
              <tr><td colSpan={7} className="td" style={{ textAlign:'center', padding:'60px', color:'#8a8478' }}>{clients.length === 0 ? 'Aucun client — créez le premier !' : 'Aucun résultat.'}</td></tr>
            ) : sp.pageItems.map((c, i) => (
              <tr key={c.id} className="tr-body">
                <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                  <span style={{ display:'inline-block', padding:'2px 8px', fontSize:'8px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', ...(c.type === 'agence' ? { background:'#fdf6e3', color:'#9a7a28' } : c.type === 'entreprise' ? { background:'#e8eef8', color:'#1e3f70' } : { background:'#eaf4ee', color:'#1e5e3a' }), border:'1px solid rgba(0,0,0,0.08)' }}>
                    {c.type === 'agence' ? 'Agence' : c.type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                  </span>
                </td>
                <td className="td">
                  <div style={{ fontWeight:600, color:'#16130e' }}>{c.nom}</div>
                  {c.numero_tva && <div style={{ fontSize:'10px', color:'#8a8478', fontFamily:'JetBrains Mono,monospace' }}>{c.numero_tva}</div>}
                </td>
                <td className="td" style={{ color:'#5a564e' }}>{c.contact_nom ?? '—'}</td>
                <td className="td" style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>{c.email ?? '—'}</td>
                <td className="td" style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>{c.telephone ?? '—'}</td>
                <td className="td">—</td>
                <td className="td">
                  <Link href={`/dashboard/clients/${c.id}`} className="btn-ghost" style={{ padding:'4px 12px', fontSize:'10px', textDecoration:'none' }}>Voir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={sp.page} pageCount={sp.pageCount} total={sp.total} onPage={sp.setPage} />
    </div>
  )
}
