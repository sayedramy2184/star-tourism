'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Edit, X } from 'lucide-react'
import LoueurSelect from '@/components/loueurs/LoueurSelect'

interface Vehicule {
  id: string; marque: string; modele: string; immatriculation: string
  annee: number | null; categorie: string; nb_places: number; statut: string
  ct_date: string | null; assurance_date: string | null
  kilometrage: number | null; couleur: string | null; notes: string | null
  mode_acquisition?: string | null; loueur?: string | null; loueur_id?: string | null
  loyer_ht?: number | null; loyer_periode?: string | null; depot_garantie?: number | null
  km_inclus?: number | null; cout_km_sup?: number | null
  contrat_debut?: string | null; contrat_fin?: string | null
  date_entree_parc?: string | null; date_sortie_parc?: string | null
}

// Libellés hérités (anciennes valeurs snake_case) — fallback d'affichage
const CATEGORIES: Record<string, string> = {
  berline_standard: 'Berline standard', berline_premium: 'Berline premium',
  berline_prestige: 'Berline prestige', van_minibus: 'Van / Minibus',
  van_bagages: 'Van / Minibus', suv_premium: 'SUV premium', electrique: 'Électrique',
}
const STATUTS: Record<string, string> = {
  disponible: 'Disponible', en_mission: 'En mission', maintenance: 'Maintenance', inactif: 'Inactif',
}
const MODES: Record<string, { short: string; color: string; bg: string }> = {
  propriete: { short: 'Propre',   color: '#1e5e3a', bg: '#eaf4ee' },
  lld:       { short: 'LLD',      color: '#1e3f70', bg: '#e8eef8' },
  leasing:   { short: 'Leasing',  color: '#4a2a6e', bg: '#f0ebfa' },
  location:  { short: 'Location', color: '#7a5c10', bg: '#fdf3dc' },
}
const d = (s: string | null | undefined) => s?.slice(0, 10) ?? ''

export default function VehiculeEditModal({ vehicule }: { vehicule: Vehicule }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<{ id: string; nom: string; modeles?: string[] }[]>([])
  useEffect(() => {
    if (!open) return
    fetch('/api/vehicule-categories').then(r => r.json()).then(d => setCategories(d.data ?? [])).catch(() => {})
  }, [open])
  const [form, setForm] = useState({
    marque: vehicule.marque, modele: vehicule.modele, immatriculation: vehicule.immatriculation,
    annee: vehicule.annee ?? new Date().getFullYear(), categorie: vehicule.categorie,
    nb_places: vehicule.nb_places, statut: vehicule.statut,
    ct_date: d(vehicule.ct_date), assurance_date: d(vehicule.assurance_date),
    kilometrage: vehicule.kilometrage ?? 0, couleur: vehicule.couleur ?? '', notes: vehicule.notes ?? '',
    mode_acquisition: vehicule.mode_acquisition ?? 'propriete',
    loueur_id: vehicule.loueur_id ?? '', loueur: vehicule.loueur ?? '', loyer_ht: vehicule.loyer_ht ?? 0, loyer_periode: vehicule.loyer_periode ?? 'mois',
    depot_garantie: vehicule.depot_garantie ?? 0, km_inclus: vehicule.km_inclus ?? 0,
    cout_km_sup: vehicule.cout_km_sup ?? 0,
    contrat_debut: d(vehicule.contrat_debut), contrat_fin: d(vehicule.contrat_fin),
    date_entree_parc: d(vehicule.date_entree_parc), date_sortie_parc: d(vehicule.date_sortie_parc),
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/vehicules/${vehicule.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marque: form.marque, modele: form.modele, immatriculation: form.immatriculation,
          annee: Number(form.annee) || null, categorie: form.categorie,
          nb_places: Number(form.nb_places) || 4, statut: form.statut,
          ct_date: form.ct_date || null, assurance_date: form.assurance_date || null,
          kilometrage: Number(form.kilometrage) || null, couleur: form.couleur || null,
          notes: form.notes || null,
          mode_acquisition: form.mode_acquisition,
          loueur_id:     form.mode_acquisition === 'propriete' ? null : (form.loueur_id || null),
          loueur:        form.mode_acquisition === 'propriete' ? null : (form.loueur || null),
          loyer_ht:      form.mode_acquisition === 'propriete' ? null : (Number(form.loyer_ht) || null),
          loyer_periode: form.loyer_periode,
          depot_garantie:   Number(form.depot_garantie) || null,
          km_inclus:        Number(form.km_inclus) || null,
          cout_km_sup:      Number(form.cout_km_sup) || null,
          contrat_debut:    form.contrat_debut    || null,
          contrat_fin:      form.contrat_fin      || null,
          date_entree_parc: form.date_entree_parc || null,
          date_sortie_parc: form.date_sortie_parc || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      toast.success('Véhicule mis à jour')
      setOpen(false)
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}
        style={{ padding: '5px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }}>
        <Edit size={11} /> Modifier
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,19,14,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: '#fff', border: '1.5px solid #b8b0a4', width: '560px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#16130e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
              <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '19px', fontWeight: 500, color: '#fff', letterSpacing: '1px' }}>Modifier le véhicule</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save} style={{ padding: '22px 24px' }}>
              <div className="form-grid-2" style={{ marginBottom: '12px' }}>
                <div><label className="form-label">Marque *</label><input className="input" required value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} /></div>
                <div><label className="form-label">Modèle *</label>
                  <input className="input" required list="veh-edit-modeles" value={form.modele} onChange={e => setForm({ ...form, modele: e.target.value })} />
                  <datalist id="veh-edit-modeles">
                    {(categories.find(c => c.nom === form.categorie)?.modeles ?? []).map((m: string) => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div><label className="form-label">Immatriculation *</label><input className="input" required value={form.immatriculation} onChange={e => setForm({ ...form, immatriculation: e.target.value.toUpperCase() })} /></div>
                <div><label className="form-label">Couleur</label><input className="input" value={form.couleur} onChange={e => setForm({ ...form, couleur: e.target.value })} /></div>
              </div>
              <div className="form-grid-3" style={{ marginBottom: '12px' }}>
                <div><label className="form-label">Catégorie</label>
                  <select className="select" value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}>
                    <option value="">— Sélectionner —</option>
                    {categories.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                    {form.categorie && !categories.some(c => c.nom === form.categorie) && (
                      <option value={form.categorie}>{CATEGORIES[form.categorie] ?? form.categorie}</option>
                    )}
                  </select>
                </div>
                <div><label className="form-label">Places</label><input type="number" className="input" min={1} value={form.nb_places} onChange={e => setForm({ ...form, nb_places: Number(e.target.value) })} /></div>
                <div><label className="form-label">Année</label><input type="number" className="input" value={form.annee} onChange={e => setForm({ ...form, annee: Number(e.target.value) })} /></div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Statut</label>
                <select className="select" value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}>
                  {Object.entries(STATUTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-grid-3" style={{ marginBottom: '16px' }}>
                <div><label className="form-label">Contrôle technique</label><input type="date" className="input" value={form.ct_date} onChange={e => setForm({ ...form, ct_date: e.target.value })} /></div>
                <div><label className="form-label">Assurance</label><input type="date" className="input" value={form.assurance_date} onChange={e => setForm({ ...form, assurance_date: e.target.value })} /></div>
                <div><label className="form-label">Kilométrage</label><input type="number" className="input" min={0} value={form.kilometrage} onChange={e => setForm({ ...form, kilometrage: Number(e.target.value) })} /></div>
              </div>
              {/* ── Parc & location ── */}
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'#9a7a28', marginBottom:'12px', paddingBottom:'6px', borderBottom:'1px solid #b8b0a4' }}>Parc & location</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'12px' }}>
                {Object.entries(MODES).map(([val, m]) => (
                  <button key={val} type="button" onClick={() => setForm({ ...form, mode_acquisition: val })}
                    style={{ padding:'8px 6px', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', cursor:'pointer',
                      background: form.mode_acquisition === val ? m.bg : '#fff',
                      border: `1.5px solid ${form.mode_acquisition === val ? m.color : '#b8b0a4'}`,
                      color: form.mode_acquisition === val ? m.color : '#5a564e' }}>
                    {m.short}
                  </button>
                ))}
              </div>
              {form.mode_acquisition !== 'propriete' && (
                <>
                  <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                    <LoueurSelect value={form.loueur_id} onChange={(id, nom) => setForm({ ...form, loueur_id: id, loueur: nom })} />
                    <div><label className="form-label">Loyer HT (€)</label>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <input type="number" min={0} step={0.01} className="input" value={form.loyer_ht || ''} onChange={e => setForm({ ...form, loyer_ht: Number(e.target.value) })} />
                        <select className="select" style={{ width:'110px', flexShrink:0 }} value={form.loyer_periode} onChange={e => setForm({ ...form, loyer_periode: e.target.value })}>
                          <option value="jour">/ jour</option>
                          <option value="semaine">/ semaine</option>
                          <option value="mois">/ mois</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="form-grid-3" style={{ marginBottom:'12px' }}>
                    <div><label className="form-label">Dépôt / Caution (€)</label><input type="number" min={0} step={0.01} className="input" value={form.depot_garantie || ''} onChange={e => setForm({ ...form, depot_garantie: Number(e.target.value) })} /></div>
                    <div><label className="form-label">Km inclus / an</label><input type="number" min={0} className="input" value={form.km_inclus || ''} onChange={e => setForm({ ...form, km_inclus: Number(e.target.value) })} /></div>
                    <div><label className="form-label">Coût km sup. (€)</label><input type="number" min={0} step={0.01} className="input" value={form.cout_km_sup || ''} onChange={e => setForm({ ...form, cout_km_sup: Number(e.target.value) })} /></div>
                  </div>
                  <div className="form-grid-2" style={{ marginBottom:'12px' }}>
                    <div><label className="form-label">Début de contrat</label><input type="date" className="input" value={form.contrat_debut} onChange={e => setForm({ ...form, contrat_debut: e.target.value })} /></div>
                    <div><label className="form-label">Fin de contrat</label><input type="date" className="input" value={form.contrat_fin} onChange={e => setForm({ ...form, contrat_fin: e.target.value })} /></div>
                  </div>
                </>
              )}
              <div className="form-grid-2" style={{ marginBottom:'16px' }}>
                <div><label className="form-label">Entrée dans le parc</label><input type="date" className="input" value={form.date_entree_parc} onChange={e => setForm({ ...form, date_entree_parc: e.target.value })} /></div>
                <div><label className="form-label">Sortie du parc</label><input type="date" className="input" value={form.date_sortie_parc} onChange={e => setForm({ ...form, date_sortie_parc: e.target.value })} /></div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', borderTop: '1.5px solid #b8b0a4' }}>
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
