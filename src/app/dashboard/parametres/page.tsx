'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit, Save, Building2, CreditCard, FileText, Tag, Car } from 'lucide-react'
import DocumentsOfficiels from '@/components/parametres/DocumentsOfficiels'
import LogoUploader from '@/components/parametres/LogoUploader'
import CategoriesVehicules from '@/components/parametres/CategoriesVehicules'

interface Societe {
  nom?: string; forme_juridique?: string; siret?: string; numero_tva?: string
  gerant_nom?: string
  adresse?: string; code_postal?: string; ville?: string; pays?: string
  telephone?: string; email?: string; site_web?: string
  iban?: string; bic?: string; banque?: string
  taux_tva?: number; mentions_legales?: string; conditions_paiement?: string
}

interface Forfait {
  id: string; nom: string; heures_incluses: number
  tarif_ht: number; tarif_heure_sup: number; avec_heures_sup: boolean; notes?: string
}

type Tab = 'societe' | 'facturation' | 'forfaits' | 'vehicules'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function Section({ label }: { label: string }) {
  return (
    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'12px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4', marginTop:'8px' }}>
      {label}
    </div>
  )
}

export default function ParametresPage() {
  const [tab,      setTab]      = useState<Tab>('societe')
  const [societe,  setSociete]  = useState<Societe>({})
  const [forfaits, setForfaits] = useState<Forfait[]>([])
  const [saving,   setSaving]   = useState(false)
  const [editForfait, setEditForfait] = useState<Partial<Forfait> | null>(null)
  const [showForfaitForm, setShowForfaitForm] = useState(false)

  useEffect(() => {
    fetch('/api/societe').then(r => r.json()).then(d => setSociete(d.data ?? {}))
    loadForfaits()
  }, [])

  function loadForfaits() {
    fetch('/api/forfaits').then(r => r.json()).then(d => setForfaits(d.data ?? []))
  }

  async function saveSociete() {
    setSaving(true)
    try {
      const res = await fetch('/api/societe', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(societe),
      })
      if (!res.ok) throw new Error()
      toast.success('Paramètres sauvegardés !')
    } catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  async function saveForfait() {
    if (!editForfait?.nom) return toast.error('Nom requis')
    setSaving(true)
    try {
      const isNew = !editForfait.id
      const url   = isNew ? '/api/forfaits' : `/api/forfaits/${editForfait.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForfait),
      })
      if (!res.ok) throw new Error()
      toast.success(isNew ? 'Forfait créé !' : 'Forfait modifié !')
      setEditForfait(null)
      setShowForfaitForm(false)
      loadForfaits()
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  async function deleteForfait(id: string) {
    if (!confirm('Supprimer ce forfait ?')) return
    await fetch(`/api/forfaits/${id}`, { method: 'DELETE' })
    toast.success('Forfait supprimé')
    loadForfaits()
  }

  const TABS: { val: Tab; label: string; icon: React.ReactNode }[] = [
    { val:'societe',    label:'Société',      icon:<Building2 size={14}/> },
    { val:'facturation',label:'Facturation',  icon:<CreditCard size={14}/> },
    { val:'forfaits',   label:'Forfaits MAD', icon:<Tag size={14}/> },
    { val:'vehicules',  label:'Véhicules',    icon:<Car size={14}/> },
  ]

  return (
    <div style={{ maxWidth:'860px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <span className="section-title">Paramètres</span>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'0', marginBottom:'24px', borderBottom:'1.5px solid #b8b0a4' }}>
        {TABS.map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            style={{
              display:'flex', alignItems:'center', gap:'7px', padding:'10px 20px',
              fontSize:'12px', fontWeight:600, cursor:'pointer',
              background:'none', border:'none',
              borderBottom: tab===t.val ? '2px solid #9a7a28' : '2px solid transparent',
              color: tab===t.val ? '#9a7a28' : '#5a564e',
              marginBottom:'-1.5px', transition:'all 0.14s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── SOCIÉTÉ ── */}
      {tab === 'societe' && (
        <div className="card">
          <div className="card-header"><span className="card-header-title">Informations société</span></div>
          <div style={{ padding:'22px 24px' }}>
            <Section label="Logo" />
            <div style={{ marginBottom:'20px' }}>
              <LogoUploader />
            </div>

            <Section label="Identité" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div><label className="form-label">Nom / Raison sociale</label>
                <input type="text" className="input" value={societe.nom ?? ''} onChange={e => setSociete({...societe, nom:e.target.value})} placeholder="Star Tourism Services SAS" /></div>
              <div><label className="form-label">Forme juridique</label>
                <select className="select" value={societe.forme_juridique ?? ''} onChange={e => setSociete({...societe, forme_juridique:e.target.value})}>
                  <option value="">— Sélectionner —</option>
                  {['SAS','SARL','EURL','EI','SA','SNC','Auto-entrepreneur'].map(f => <option key={f}>{f}</option>)}
                </select></div>
              <div><label className="form-label">SIRET</label>
                <input type="text" className="input" value={societe.siret ?? ''} onChange={e => setSociete({...societe, siret:e.target.value})} placeholder="123 456 789 00012" /></div>
              <div><label className="form-label">N° TVA intracommunautaire</label>
                <input type="text" className="input" value={societe.numero_tva ?? ''} onChange={e => setSociete({...societe, numero_tva:e.target.value})} placeholder="FR 12 345678901" /></div>
              <div style={{ gridColumn:'span 2' }}><label className="form-label">Gérant (signataire des ordres de mission)</label>
                <input type="text" className="input" value={societe.gerant_nom ?? ''} onChange={e => setSociete({...societe, gerant_nom:e.target.value})} placeholder="Prénom Nom du gérant" /></div>
            </div>

            <Section label="Contact & adresse" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div style={{ gridColumn:'span 2' }}><label className="form-label">Adresse</label>
                <input type="text" className="input" value={societe.adresse ?? ''} onChange={e => setSociete({...societe, adresse:e.target.value})} placeholder="14 Rue de la Paix" /></div>
              <div><label className="form-label">Code postal</label>
                <input type="text" className="input" value={societe.code_postal ?? ''} onChange={e => setSociete({...societe, code_postal:e.target.value})} placeholder="75001" /></div>
              <div><label className="form-label">Ville</label>
                <input type="text" className="input" value={societe.ville ?? ''} onChange={e => setSociete({...societe, ville:e.target.value})} placeholder="Paris" /></div>
              <div><label className="form-label">Téléphone</label>
                <input type="tel" className="input" value={societe.telephone ?? ''} onChange={e => setSociete({...societe, telephone:e.target.value})} placeholder="+33 1 23 45 67 89" /></div>
              <div><label className="form-label">Email</label>
                <input type="email" className="input" value={societe.email ?? ''} onChange={e => setSociete({...societe, email:e.target.value})} placeholder="contact@elitedrive.fr" /></div>
              <div><label className="form-label">Site web</label>
                <input type="url" className="input" value={societe.site_web ?? ''} onChange={e => setSociete({...societe, site_web:e.target.value})} placeholder="https://elitedrive.fr" /></div>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
              <button className="btn-primary" onClick={saveSociete} disabled={saving}>
                <Save size={13}/> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>

          <div style={{ marginTop:'16px' }}>
            <DocumentsOfficiels />
          </div>
        </div>
      )}

      {/* ── FACTURATION ── */}
      {tab === 'facturation' && (
        <div className="card">
          <div className="card-header"><span className="card-header-title">Facturation & coordonnées bancaires</span></div>
          <div style={{ padding:'22px 24px' }}>
            <Section label="Coordonnées bancaires" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div style={{ gridColumn:'span 2' }}><label className="form-label">IBAN</label>
                <input type="text" className="input" value={societe.iban ?? ''} onChange={e => setSociete({...societe, iban:e.target.value})} placeholder="FR76 3000 6000 0112 3456 7890 189" style={{ fontFamily:'JetBrains Mono,monospace' }} /></div>
              <div><label className="form-label">BIC / SWIFT</label>
                <input type="text" className="input" value={societe.bic ?? ''} onChange={e => setSociete({...societe, bic:e.target.value})} placeholder="BNPAFRPPXXX" style={{ fontFamily:'JetBrains Mono,monospace' }} /></div>
              <div><label className="form-label">Banque</label>
                <input type="text" className="input" value={societe.banque ?? ''} onChange={e => setSociete({...societe, banque:e.target.value})} placeholder="BNP Paribas" /></div>
            </div>

            <Section label="Paramètres de facturation" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div><label className="form-label">Taux TVA par défaut (%)</label>
                <input type="number" className="input" value={societe.taux_tva ?? 10} onChange={e => setSociete({...societe, taux_tva:parseFloat(e.target.value)||10})} min={0} max={100} step={0.1} /></div>
              <div><label className="form-label">Conditions de paiement</label>
                <select className="select" value={societe.conditions_paiement ?? 'Paiement à 30 jours'} onChange={e => setSociete({...societe, conditions_paiement:e.target.value})}>
                  {['Paiement immédiat','Paiement à 15 jours','Paiement à 30 jours','Paiement à 45 jours','Paiement à 60 jours'].map(c => <option key={c}>{c}</option>)}
                </select></div>
            </div>
            <div><label className="form-label">Mentions légales (pied de facture)</label>
              <textarea className="textarea" value={societe.mentions_legales ?? ''} onChange={e => setSociete({...societe, mentions_legales:e.target.value})} placeholder="En cas de retard de paiement, une pénalité de 3 fois le taux légal sera appliquée..." style={{ minHeight:'80px' }} /></div>

            <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4', marginTop:'16px' }}>
              <button className="btn-primary" onClick={saveSociete} disabled={saving}>
                <Save size={13}/> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORFAITS MAD ── */}
      {tab === 'forfaits' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <div>
              <div style={{ fontSize:'13px', color:'#5a564e' }}>
                Gérez vos forfaits de mise à disposition. Ils seront proposés lors de la création et de la saisie des heures réelles.
              </div>
            </div>
            <button className="btn-primary" onClick={() => { setEditForfait({ avec_heures_sup: true, tarif_heure_sup: 0 }); setShowForfaitForm(true) }}>
              <Plus size={13}/> Nouveau forfait
            </button>
          </div>

          {/* Formulaire création/édition */}
          {showForfaitForm && editForfait && (
            <div className="card" style={{ marginBottom:'16px', borderColor:'#9a7a28' }}>
              <div className="card-header">
                <span className="card-header-title">{editForfait.id ? 'Modifier le forfait' : 'Nouveau forfait'}</span>
                <button onClick={() => { setShowForfaitForm(false); setEditForfait(null) }}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'16px' }}>✕</button>
              </div>
              <div style={{ padding:'18px 20px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div style={{ gridColumn:'span 3' }}>
                    <label className="form-label">Nom du forfait *</label>
                    <input type="text" className="input" value={editForfait.nom ?? ''} onChange={e => setEditForfait({...editForfait, nom:e.target.value})} placeholder="ex: Forfait Premium 10h" />
                  </div>
                  <div>
                    <label className="form-label">Heures incluses *</label>
                    <input type="number" className="input" value={editForfait.heures_incluses ?? ''} onChange={e => setEditForfait({...editForfait, heures_incluses:parseFloat(e.target.value)||0})} min={0} step={0.5} placeholder="10" />
                  </div>
                  <div>
                    <label className="form-label">Tarif forfait HT (€) *</label>
                    <input type="number" className="input" value={editForfait.tarif_ht ?? ''} onChange={e => setEditForfait({...editForfait, tarif_ht:parseFloat(e.target.value)||0})} min={0} step={0.01} placeholder="960,00" />
                  </div>
                  <div>
                    <label className="form-label">Type</label>
                    <select className="select" value={editForfait.avec_heures_sup ? 'sup' : 'fixe'} onChange={e => setEditForfait({...editForfait, avec_heures_sup: e.target.value === 'sup'})}>
                      <option value="sup">Avec heures sup</option>
                      <option value="fixe">Forfait fixe</option>
                    </select>
                  </div>
                  {editForfait.avec_heures_sup && (
                    <div>
                      <label className="form-label">Tarif heure sup HT (€)</label>
                      <input type="number" className="input" value={editForfait.tarif_heure_sup ?? ''} onChange={e => setEditForfait({...editForfait, tarif_heure_sup:parseFloat(e.target.value)||0})} min={0} step={0.01} placeholder="96,00" />
                    </div>
                  )}
                  <div style={{ gridColumn:'span 3' }}>
                    <label className="form-label">Notes</label>
                    <input type="text" className="input" value={editForfait.notes ?? ''} onChange={e => setEditForfait({...editForfait, notes:e.target.value})} placeholder="Description, conditions particulières…" />
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'12px', borderTop:'1.5px solid #b8b0a4' }}>
                  <button className="btn-ghost" onClick={() => { setShowForfaitForm(false); setEditForfait(null) }}>Annuler</button>
                  <button className="btn-primary" onClick={saveForfait} disabled={saving}>
                    {saving ? 'Sauvegarde…' : editForfait.id ? 'Modifier' : 'Créer le forfait'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Liste forfaits */}
          <div className="table-container">
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead className="table-head">
                <tr>
                  {['Nom','Heures incluses','Tarif HT','Type','Heure sup','Notes','Actions'].map((h,i) => (
                    <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forfaits.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
                    Aucun forfait — créez le premier !
                  </td></tr>
                ) : forfaits.map(f => (
                  <tr key={f.id} className="tr-body">
                    <td className="td" style={{ background:'rgba(154,122,40,0.04)', fontWeight:600 }}>{f.nom}</td>
                    <td className="td">
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px' }}>{f.heures_incluses}h</span>
                    </td>
                    <td className="td">
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#9a7a28' }}>{fmt(f.tarif_ht)}</span>
                    </td>
                    <td className="td">
                      <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', background: f.avec_heures_sup ? '#e8eef8' : '#eaf4ee', color: f.avec_heures_sup ? '#1e3f70' : '#1e5e3a', border:`1px solid ${f.avec_heures_sup ? 'rgba(30,63,112,0.2)' : 'rgba(30,94,58,0.2)'}` }}>
                        {f.avec_heures_sup ? 'Avec heures sup' : 'Forfait fixe'}
                      </span>
                    </td>
                    <td className="td">
                      {f.avec_heures_sup
                        ? <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px' }}>{fmt(f.tarif_heure_sup)}/h</span>
                        : <span style={{ color:'#c2bdb4', fontSize:'11px' }}>—</span>}
                    </td>
                    <td className="td" style={{ color:'#8a8478', fontStyle:'italic', fontSize:'11px' }}>{f.notes ?? '—'}</td>
                    <td className="td" onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:'10px' }}
                          onClick={() => { setEditForfait(f); setShowForfaitForm(true) }}>
                          <Edit size={11}/> Modifier
                        </button>
                        <button style={{ background:'none', border:'1.5px solid rgba(158,42,42,0.3)', padding:'4px 8px', cursor:'pointer', color:'#9e2a2a', fontSize:'10px', transition:'all 0.14s' }}
                          onClick={() => deleteForfait(f.id)}>
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VÉHICULES ── */}
      {tab === 'vehicules' && <CategoriesVehicules />}
    </div>
  )
}
