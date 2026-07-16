import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import VehiculeEditModal from '@/components/vehicules/VehiculeEditModal'

const CATEGORIES: Record<string, string> = {
  berline_standard: 'Berline Standard', berline_premium: 'Berline Premium',
  berline_prestige: 'Berline Prestige',  van_minibus: 'Van / Minibus',
  van_bagages: 'Van Bagages',           suv_premium: 'SUV Premium',
  electrique: 'Électrique',
}

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  disponible:  { label: 'Disponible',  color: '#1e5e3a', bg: '#eaf4ee' },
  en_mission:  { label: 'En mission',  color: '#1e3f70', bg: '#e8eef8' },
  maintenance: { label: 'Maintenance', color: '#7a5c10', bg: '#fdf3dc' },
  inactif:     { label: 'Inactif',     color: '#8a8478', bg: '#f5f2ed' },
}

const MODES: Record<string, { label: string; color: string; bg: string }> = {
  propriete: { label: 'Propriété',          color: '#1e5e3a', bg: '#eaf4ee' },
  lld:       { label: 'LLD (longue durée)', color: '#1e3f70', bg: '#e8eef8' },
  leasing:   { label: 'Leasing / LOA',      color: '#4a2a6e', bg: '#f0ebfa' },
  location:  { label: 'Location courte',    color: '#7a5c10', bg: '#fdf3dc' },
}

const PERIODE_SUFFIX: Record<string, string> = { jour: '/jour', semaine: '/sem.', mois: '/mois' }

function docStatus(dateStr: string | null) {
  if (!dateStr) return { level: 'none', label: 'Non renseigné', color: '#c2bdb4' }
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days < 0)  return { level: 'danger', label: `Expiré le ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#9e2a2a' }
  if (days < 30) return { level: 'warn',   label: `Expire dans ${days} jours`, color: '#7a5c10' }
  if (days < 90) return { level: 'soon',   label: `Expire le ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#9a7a28' }
  return { level: 'ok', label: `Valide jusqu'au ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#1e5e3a' }
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function VehiculeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: v, error } = await supabase
    .from('vehicules')
    .select('*, chauffeur:chauffeurs(id, nom, prenom, telephone)')
    .eq('id', params.id)
    .single()

  if (error || !v) notFound()

  // Historique prestations (transferts)
  const { data: prestations } = await supabase
    .from('prestations')
    .select(`
      id, type, date_debut, date_fin, statut,
      heure_depart, adresse_depart, adresse_arrivee,
      tarif_fixe_ht, tarif_journalier_ht, montant_ht,
      chauffeur:chauffeurs(id, nom, prenom),
      dossier:dossiers(id, numero, client:clients(nom))
    `)
    .eq('vehicule_id', params.id)
    .order('date_debut', { ascending: false })
    .limit(50)

  // Historique jours MAD
  const { data: jours } = await supabase
    .from('jours_mad')
    .select(`
      id, date, jour_semaine, tarif_ht, statut,
      chauffeur:chauffeurs(id, nom, prenom),
      prestation:prestations(id, statut, dossier:dossiers(id, numero, client:clients(nom)))
    `)
    .eq('vehicule_id', params.id)
    .order('date', { ascending: false })
    .limit(50)

  const st     = STATUTS[v.statut] ?? STATUTS.disponible
  const mode   = MODES[v.mode_acquisition] ?? MODES.propriete
  const estLoue = v.mode_acquisition && v.mode_acquisition !== 'propriete'
  const ct     = docStatus(v.ct_date)
  const ass    = docStatus(v.assurance_date)
  const contrat = docStatus(v.contrat_fin)
  const nbMissions = (prestations?.length ?? 0) + (jours?.length ?? 0)
  // CA généré = exclut les prestations annulées (et les jours d'une MAD annulée)
  const caTotal = (prestations?.filter((p: any) => p.statut !== 'annule').reduce((s: number, p: any) => s + (p.montant_ht ?? 0), 0) ?? 0) +
                  (jours?.filter((j: any) => j.statut !== 'annule' && j.prestation?.statut !== 'annule').reduce((s: number, j: any) => s + (j.tarif_ht ?? 0), 0) ?? 0)

  return (
    <div>
      <div style={{ marginBottom:'20px' }}>
        <Link href="/dashboard/vehicules"
          style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#8a8478', textDecoration:'none' }}>
          <ArrowLeft size={13} /> Retour aux véhicules
        </Link>
      </div>

      <div className="detail-grid">

        {/* ── PRINCIPAL ── */}
        <div>

          {/* Fiche véhicule */}
          <div className="card" style={{ marginBottom:'16px' }}>
            <div style={{ background:'#16130e', padding:'12px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', letterSpacing:'2px', color:'#9a7a28' }}>
                {v.immatriculation}
              </span>
              <VehiculeEditModal vehicule={{
                id: v.id, marque: v.marque, modele: v.modele, immatriculation: v.immatriculation,
                annee: v.annee, categorie: v.categorie, nb_places: v.nb_places, statut: v.statut,
                ct_date: v.ct_date, assurance_date: v.assurance_date, kilometrage: v.kilometrage,
                couleur: v.couleur, notes: v.notes,
                mode_acquisition: v.mode_acquisition, loueur: v.loueur, loueur_id: v.loueur_id,
                loyer_ht: v.loyer_ht, loyer_periode: v.loyer_periode, depot_garantie: v.depot_garantie,
                km_inclus: v.km_inclus, cout_km_sup: v.cout_km_sup,
                contrat_debut: v.contrat_debut, contrat_fin: v.contrat_fin,
                date_entree_parc: v.date_entree_parc, date_sortie_parc: v.date_sortie_parc,
              }} />
            </div>
            <div style={{ padding:'20px 22px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'18px' }}>
                <div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'28px', fontWeight:500, color:'#16130e', lineHeight:1 }}>
                    {v.marque} {v.modele}
                  </div>
                  <div style={{ fontSize:'12px', color:'#5a564e', marginTop:'5px' }}>
                    {CATEGORIES[v.categorie]} · {v.nb_places} places
                    {v.annee && ` · ${v.annee}`}
                    {v.couleur && ` · ${v.couleur}`}
                  </div>
                </div>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:'5px',
                  padding:'4px 12px', fontSize:'10px', fontWeight:700,
                  background: st.bg, color: st.color, border:`1px solid ${st.color}33`,
                }}>
                  <span style={{ width:'7px', height:'7px', borderRadius:'50%', background: st.color,
                    animation: v.statut === 'en_mission' ? 'blink 1.6s infinite' : 'none' }} />
                  {st.label}
                </span>
              </div>

              {/* Meta grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:'0', borderTop:'1.5px solid #d8d2c8' }}>
                {[
                  { label:'Contrôle tech.', val: v.ct_date ? format(parseISO(v.ct_date),'MM/yyyy') : '—', alert: ct },
                  { label:'Assurance',      val: v.assurance_date ? format(parseISO(v.assurance_date),'MM/yyyy') : '—', alert: ass },
                  { label:'Kilométrage',    val: v.kilometrage ? `${v.kilometrage.toLocaleString('fr-FR')} km` : '—', alert: null },
                  { label:'Chauffeur',      val: v.chauffeur ? `${v.chauffeur.prenom} ${v.chauffeur.nom}` : 'Non affecté', alert: null },
                ].map((m, i) => (
                  <div key={m.label} style={{ padding:'12px 16px', borderRight: i < 3 ? '1px solid #d8d2c8' : 'none' }}>
                    <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>{m.label}</div>
                    <div style={{ fontFamily: i === 2 ? 'JetBrains Mono,monospace' : 'inherit', fontSize:'12px', fontWeight:500,
                      color: m.alert ? (m.alert.level === 'danger' ? '#9e2a2a' : m.alert.level === 'warn' ? '#7a5c10' : '#16130e') : '#16130e' }}>
                      {m.alert && (m.alert.level === 'danger' || m.alert.level === 'warn') && <AlertTriangle size={11} style={{ marginRight:'4px', display:'inline' }} />}
                      {m.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Parc & location */}
          <div className="card" style={{ marginBottom:'16px' }}>
            <div className="card-header">
              <span className="card-header-title">Parc & location</span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 12px', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', background:mode.bg, color:mode.color, border:`1px solid ${mode.color}55` }}>
                {mode.label}
              </span>
            </div>
            <div style={{ padding:'16px 20px' }}>
              <div className="kpi-grid">
                {[
                  ...(estLoue ? [
                    { label:'Loueur / Bailleur', val: v.loueur_id
                        ? <Link href={`/dashboard/loueurs/${v.loueur_id}`} style={{ color:'#9a7a28', textDecoration:'underline' }}>{v.loueur ?? 'Voir le loueur'}</Link>
                        : (v.loueur ?? '—') },
                    { label:'Loyer HT',          val: v.loyer_ht ? `${fmt(v.loyer_ht)}${PERIODE_SUFFIX[v.loyer_periode] ?? '/mois'}` : '—', mono:true },
                    { label:'Dépôt / Caution',   val: v.depot_garantie ? fmt(v.depot_garantie) : '—', mono:true },
                    { label:'Km inclus / an',    val: v.km_inclus ? `${v.km_inclus.toLocaleString('fr-FR')} km` : '—', mono:true },
                    { label:'Coût km sup.',      val: v.cout_km_sup ? fmt(v.cout_km_sup) : '—', mono:true },
                    { label:'Contrat', val: (v.contrat_debut || v.contrat_fin)
                        ? `${v.contrat_debut ? format(parseISO(v.contrat_debut),'dd/MM/yy') : '?'} → ${v.contrat_fin ? format(parseISO(v.contrat_fin),'dd/MM/yy') : '?'}`
                        : '—',
                      alert: (contrat.level === 'danger' || contrat.level === 'warn') ? contrat : null },
                  ] : []),
                  { label:'Entrée parc', val: v.date_entree_parc ? format(parseISO(v.date_entree_parc),'dd/MM/yyyy') : '—' },
                  { label:'Sortie parc', val: v.date_sortie_parc ? format(parseISO(v.date_sortie_parc),'dd/MM/yyyy') : '—',
                    alert: v.date_sortie_parc && differenceInDays(parseISO(v.date_sortie_parc), new Date()) < 0 ? { level:'danger', label:'Sorti du parc', color:'#9e2a2a' } : null },
                ].map((m: any) => (
                  <div key={m.label}>
                    <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>{m.label}</div>
                    <div style={{ fontFamily: m.mono ? 'JetBrains Mono,monospace' : 'inherit', fontSize:'12px', fontWeight:500, color: m.alert ? m.alert.color : '#16130e' }}>
                      {m.alert && <AlertTriangle size={11} style={{ marginRight:'4px', display:'inline', verticalAlign:'-1px' }} />}
                      {m.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Historique */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <span className="section-title">Historique des missions</span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#8a8478' }}>
              {nbMissions} mission{nbMissions > 1 ? 's' : ''}
            </span>
          </div>

          {/* Liste mobile (cartes) */}
          <div className="only-mobile" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {nbMissions === 0 ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>Aucune mission pour ce véhicule</div>
            ) : (
              <>
                {prestations?.map((p: any) => (
                  <div key={`mp-${p.id}`} style={{ background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', padding:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                        <span className={p.type === 'mad' ? 'pill-mad' : 'pill-transfer'}>{p.type === 'mad' ? 'MAD' : 'Transfert'}</span>
                        <span className="mono" style={{ fontSize:'11px' }}>{format(new Date(p.date_debut),'dd/MM/yy',{locale:fr})}</span>
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:700, color: p.statut === 'termine' ? '#8a8478' : p.statut === 'confirme' ? '#1e5e3a' : '#1e3f70' }}>{p.statut}</span>
                    </div>
                    <div style={{ fontWeight:600, fontSize:'13px', marginTop:'6px' }}>{p.dossier?.client?.nom ?? '—'}</div>
                    <div className="mono" style={{ fontSize:'9px', color:'#9a7a28' }}>{p.dossier?.numero}</div>
                    {(p.adresse_depart || p.adresse_arrivee) && (
                      <div style={{ fontSize:'11px', color:'#5a564e', marginTop:'4px' }}>{p.adresse_depart}{p.adresse_arrivee ? ` → ${p.adresse_arrivee}` : ''}</div>
                    )}
                    <div style={{ display:'flex', justifyContent:'space-between', gap:'8px', marginTop:'6px', fontSize:'11px' }}>
                      <span style={{ color:'#5a564e' }}>{p.chauffeur ? `${p.chauffeur.prenom} ${p.chauffeur.nom}` : '—'}</span>
                      <span className="mono" style={{ color:'#9a7a28' }}>{p.montant_ht ? fmt(p.montant_ht) : '—'}</span>
                    </div>
                  </div>
                ))}
                {jours?.map((j: any) => (
                  <div key={`mj-${j.id}`} style={{ background:'#fff', border:'1.5px solid #b8b0a4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', padding:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                        <span className="pill-mad">MAD</span>
                        <span className="mono" style={{ fontSize:'11px' }}>{j.jour_semaine} {format(new Date(j.date),'dd/MM/yy',{locale:fr})}</span>
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:700, color: j.statut === 'termine' ? '#8a8478' : '#1e3f70' }}>{j.statut}</span>
                    </div>
                    <div style={{ fontWeight:600, fontSize:'13px', marginTop:'6px' }}>{j.prestation?.dossier?.client?.nom ?? '—'}</div>
                    <div className="mono" style={{ fontSize:'9px', color:'#9a7a28' }}>{j.prestation?.dossier?.numero}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:'8px', marginTop:'6px', fontSize:'11px' }}>
                      <span style={{ color:'#5a564e' }}>{j.chauffeur ? `${j.chauffeur.prenom} ${j.chauffeur.nom}` : '—'}</span>
                      <span className="mono" style={{ color:'#9a7a28' }}>{fmt(j.tarif_ht)}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Table (desktop) */}
          <div className="table-container only-desktop">
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead className="table-head">
                <tr>
                  {['Date','Type','Client / Dossier','Itinéraire','Chauffeur','Montant HT','Statut'].map((h,i) => (
                    <th key={h} className="th" style={i%2===1?{background:'rgba(0,0,0,0.1)'}:{}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prestations?.map((p: any) => (
                  <tr key={`p-${p.id}`} className="tr-body">
                    <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>
                        {format(new Date(p.date_debut),'dd/MM/yyyy',{locale:fr})}
                      </div>
                    </td>
                    <td className="td"><span className={p.type === 'mad' ? 'pill-mad' : 'pill-transfer'}>{p.type === 'mad' ? 'MAD' : 'Transfert'}</span></td>
                    <td className="td">
                      <div style={{ fontWeight:600, fontSize:'12px' }}>{p.dossier?.client?.nom ?? '—'}</div>
                      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#9a7a28' }}>{p.dossier?.numero}</div>
                    </td>
                    <td className="td">
                      <div style={{ fontSize:'11px', color:'#5a564e' }}>
                        {p.adresse_depart && <div>{p.adresse_depart}</div>}
                        {p.adresse_arrivee && <div style={{ color:'#8a8478' }}>→ {p.adresse_arrivee}</div>}
                        {!p.adresse_depart && !p.adresse_arrivee && '—'}
                      </div>
                    </td>
                    <td className="td" style={{ fontSize:'12px' }}>
                      {p.chauffeur ? `${p.chauffeur.prenom} ${p.chauffeur.nom}` : '—'}
                    </td>
                    <td className="td">
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28' }}>
                        {p.montant_ht ? fmt(p.montant_ht) : '—'}
                      </span>
                    </td>
                    <td className="td">
                      <span style={{ fontSize:'10px', fontWeight:700, color: p.statut === 'termine' ? '#8a8478' : p.statut === 'confirme' ? '#1e5e3a' : '#1e3f70' }}>
                        {p.statut}
                      </span>
                    </td>
                  </tr>
                ))}

                {jours?.map((j: any) => (
                  <tr key={`j-${j.id}`} className="tr-body">
                    <td className="td" style={{ background:'rgba(154,122,40,0.04)' }}>
                      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>
                        {j.jour_semaine} {format(new Date(j.date),'dd/MM/yyyy',{locale:fr})}
                      </div>
                    </td>
                    <td className="td"><span className="pill-mad">MAD</span></td>
                    <td className="td">
                      <div style={{ fontWeight:600, fontSize:'12px' }}>{j.prestation?.dossier?.client?.nom ?? '—'}</div>
                      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', color:'#9a7a28' }}>{j.prestation?.dossier?.numero}</div>
                    </td>
                    <td className="td"><span style={{ fontSize:'11px', color:'#8a8478' }}>Journée complète</span></td>
                    <td className="td" style={{ fontSize:'12px' }}>
                      {j.chauffeur ? `${j.chauffeur.prenom} ${j.chauffeur.nom}` : '—'}
                    </td>
                    <td className="td">
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28' }}>
                        {fmt(j.tarif_ht)}
                      </span>
                    </td>
                    <td className="td">
                      <span style={{ fontSize:'10px', fontWeight:700, color: j.statut === 'termine' ? '#8a8478' : '#1e3f70' }}>
                        {j.statut}
                      </span>
                    </td>
                  </tr>
                ))}

                {nbMissions === 0 && (
                  <tr><td colSpan={7} style={{ padding:'50px', textAlign:'center', color:'#8a8478', fontSize:'12px' }}>
                    Aucune mission pour ce véhicule
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* Stats */}
          <div className="card">
            <div className="card-header"><span className="card-header-title">Statistiques</span></div>
            <div style={{ padding:'14px 16px' }}>
              {[
                { label:'Total missions', value: nbMissions },
                { label:'CA généré HT',  value: fmt(caTotal) },
                ...(estLoue ? [{ label:'Loyer', value: v.loyer_ht ? `${fmt(v.loyer_ht)}${PERIODE_SUFFIX[v.loyer_periode] ?? '/mois'}` : '—' }] : []),
                { label:'Kilométrage',   value: v.kilometrage ? `${v.kilometrage.toLocaleString('fr-FR')} km` : '—' },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #d8d2c8' }}>
                  <span style={{ fontSize:'11px', color:'#5a564e' }}>{s.label}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#16130e' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes */}
          {(ct.level === 'danger' || ct.level === 'warn' || ass.level === 'danger' || ass.level === 'warn' || (estLoue && (contrat.level === 'danger' || contrat.level === 'warn'))) && (
            <div className="card" style={{ borderColor:'#9e2a2a' }}>
              <div style={{ background:'#9e2a2a', padding:'9px 16px', display:'flex', alignItems:'center', gap:'6px' }}>
                <AlertTriangle size={13} color="#fff" />
                <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#fff' }}>Alertes</span>
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'6px' }}>
                {(ct.level === 'danger' || ct.level === 'warn') && (
                  <div style={{ padding:'8px 10px', background:'#faeaea', borderLeft:'3px solid #9e2a2a', fontSize:'11px', color:'#5a564e' }}>
                    <strong>Contrôle technique</strong><br />{ct.label}
                  </div>
                )}
                {(ass.level === 'danger' || ass.level === 'warn') && (
                  <div style={{ padding:'8px 10px', background:'#faeaea', borderLeft:'3px solid #9e2a2a', fontSize:'11px', color:'#5a564e' }}>
                    <strong>Assurance</strong><br />{ass.label}
                  </div>
                )}
                {estLoue && (contrat.level === 'danger' || contrat.level === 'warn') && (
                  <div style={{ padding:'8px 10px', background:'#faeaea', borderLeft:'3px solid #9e2a2a', fontSize:'11px', color:'#5a564e' }}>
                    <strong>Fin de contrat de location</strong><br />{contrat.label}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents OK */}
          {ct.level === 'ok' && ass.level === 'ok' && (
            <div className="card">
              <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'8px' }}>
                <CheckCircle size={16} color="#1e5e3a" />
                <span style={{ fontSize:'12px', color:'#1e5e3a', fontWeight:500 }}>Tous les documents sont valides</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
