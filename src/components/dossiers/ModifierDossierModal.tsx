'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Edit, X } from 'lucide-react'

interface Client { id: string; nom: string; contact_nom: string | null }

interface Props {
  dossier: {
    id: string
    client_id: string
    date_debut: string
    date_fin: string
    statut: string
    notes: string | null
  }
}

const STATUTS = [
  { val:'brouillon',  label:'Brouillon',  color:'#8a8478' },
  { val:'en_attente', label:'En attente', color:'#7a5c10' },
  { val:'confirme',   label:'Confirmé',   color:'#1e5e3a' },
  { val:'en_cours',   label:'En cours',   color:'#1e3f70' },
  { val:'termine',    label:'Terminé',    color:'#8a8478' },
  { val:'annule',     label:'Annulé',     color:'#9e2a2a' },
]

export default function ModifierDossierModal({ dossier }: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [clients, setClients] = useState<Client[]>([])

  const [clientId,   setClientId]   = useState(dossier.client_id)
  const [dateDebut,  setDateDebut]  = useState(dossier.date_debut)
  const [dateFin,    setDateFin]    = useState(dossier.date_fin)
  const [statut,     setStatut]     = useState(dossier.statut)
  const [notes,      setNotes]      = useState(dossier.notes ?? '')

  useEffect(() => {
    if (!open) return
    fetch('/api/clients').then(r => r.json()).then(d => setClients(d.data ?? []))
  }, [open])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:  clientId,
          date_debut: dateDebut,
          date_fin:   dateFin,
          statut,
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Dossier mis à jour !')
      setOpen(false)
      router.refresh()
    } catch { toast.error('Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost"
        style={{ padding:'5px 12px', fontSize:'11px', color:'rgba(255,255,255,0.5)', borderColor:'rgba(255,255,255,0.15)' }}
        onClick={() => setOpen(true)}>
        <Edit size={11} /> Modifier
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(22,19,14,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
          <div style={{ background:'#fff', border:'1.5px solid #b8b0a4', width:'500px', maxWidth:'96vw', boxShadow:'0 24px 60px rgba(0,0,0,0.2)' }}>

            <div style={{ background:'#16130e', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'19px', fontWeight:500, color:'#fff', letterSpacing:'1px' }}>
                Modifier le dossier
              </span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}><X size={18}/></button>
            </div>

            <form onSubmit={handleSave} style={{ padding:'22px 24px' }}>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label className="form-label">Client</label>
                  <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom}{c.contact_nom ? ` — ${c.contact_nom}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date de début</label>
                  <input type="date" className="input" value={dateDebut} onChange={e => { setDateDebut(e.target.value); if (dateFin < e.target.value) setDateFin(e.target.value) }} required />
                </div>
                <div>
                  <label className="form-label">Date de fin</label>
                  <input type="date" className="input" value={dateFin} min={dateDebut} onChange={e => setDateFin(e.target.value)} required />
                </div>
              </div>

              <div style={{ marginBottom:'12px' }}>
                <label className="form-label" style={{ marginBottom:'8px' }}>Statut</label>
                <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                  {STATUTS.map(s => (
                    <button key={s.val} type="button" onClick={() => setStatut(s.val)}
                      style={{
                        padding:'6px 12px', fontSize:'10px', fontWeight:700, cursor:'pointer',
                        background: statut===s.val ? s.color+'15' : 'transparent',
                        border:`1.5px solid ${statut===s.val ? s.color : '#b8b0a4'}`,
                        color: statut===s.val ? s.color : '#5a564e',
                        transition:'all 0.14s',
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Notes internes</label>
                <textarea className="textarea" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Instructions, préférences client…" style={{ minHeight:'80px' }} />
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'20px', paddingTop:'16px', borderTop:'1.5px solid #b8b0a4' }}>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
