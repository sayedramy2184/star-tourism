import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, Phone, Mail, AlertTriangle, CheckCircle } from 'lucide-react'
import AccesChauffeur from '@/components/chauffeurs/AccesChauffeur'
import ChauffeurEditModal from '@/components/chauffeurs/ChauffeurEditModal'
import HistoriqueChauffeur, { type HistoItem } from '@/components/chauffeurs/HistoriqueChauffeur'

function docStatus(dateStr: string | null) {
  if (!dateStr) return { level: 'none', label: 'Non renseigné', color: '#c2bdb4' }
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days < 0)  return { level: 'danger', label: `Expiré le ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#9e2a2a' }
  if (days < 30) return { level: 'warn',   label: `Expire dans ${days} jours`, color: '#7a5c10' }
  if (days < 90) return { level: 'soon',   label: `Expire le ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#9a7a28' }
  return { level: 'ok', label: `Valide jusqu'au ${format(parseISO(dateStr),'dd/MM/yyyy')}`, color: '#1e5e3a' }
}

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  disponible:   { label: 'Disponible',   color: '#1e5e3a', bg: '#eaf4ee' },
  en_mission:   { label: 'En mission',   color: '#1e3f70', bg: '#e8eef8' },
  indisponible: { label: 'Indisponible', color: '#9e2a2a', bg: '#faeaea' },
  conge:        { label: 'Congé',        color: '#7a5c10', bg: '#fdf3dc' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function ChauffeurDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: c, error } = await supabase
    .from('chauffeurs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !c) notFound()

  // Historique MAD
  const { data: jours } = await supabase
    .from('jours_mad')
    .select(`
      id, date, jour_semaine, tarif_ht, statut, note,
      prestation:prestations(
        id, type, date_debut, date_fin,
        dossier:dossiers(id, numero, client:clients(nom))
      )
    `)
    .eq('chauffeur_id', params.id)
    .order('date', { ascending: false })
    .limit(100)

  // Historique transferts
  const { data: transferts } = await supabase
    .from('prestations')
    .select(`
      id, type, date_debut, heure_depart, adresse_depart, adresse_arrivee,
      tarif_fixe_ht, statut,
      dossier:dossiers(id, numero, client:clients(nom))
    `)
    .eq('chauffeur_id', params.id)
    .eq('type', 'transfert')
    .order('date_debut', { ascending: false })
    .limit(100)

  const st        = STATUTS[c.statut] ?? STATUTS.disponible
  const vtc       = docStatus(c.vtc_card_expiry)
  const permis    = docStatus(c.permis_expiry)
  const initials  = `${c.prenom[0]}${c.nom[0]}`.toUpperCase()

  const LANGUES_LBL: Record<string, string> = { francais:'Français', anglais:'Anglais', espagnol:'Espagnol', allemand:'Allemand', italien:'Italien', arabe:'Arabe', chinois:'Chinois', russe:'Russe' }
  const COMP_LBL: Record<string, string> = { bodyguard:'Bodyguard', guide:'Guide touristique', secouriste:'Secouriste', tpmr:'TPMR', permis_d:'Permis D' }
  const docs = [
    { label: 'Carte VTC', numero: c.vtc_card_numero, status: vtc, show: true },
    { label: 'Permis de conduire', numero: null, status: permis, show: true },
    { label: 'Visite médicale', numero: null, status: docStatus(c.visite_medicale_expiry), show: !!c.visite_medicale_expiry },
    { label: 'Carte qualification conducteur', numero: null, status: docStatus(c.carte_qualif_expiry), show: !!c.carte_qualif_expiry },
    { label: 'Carte de séjour', numero: c.carte_sejour_numero, status: docStatus(c.carte_sejour_expiry), show: !!c.carte_sejour_expiry || !!c.carte_sejour_numero },
  ].filter(x => x.show)

  // Stats
  const nbMissions   = (jours?.length ?? 0) + (transferts?.length ?? 0)
  const caTotal      = (jours?.reduce((s: number, j: any) => s + (j.tarif_ht ?? 0), 0) ?? 0) +
                       (transferts?.reduce((s: number, t: any) => s + (t.tarif_fixe_ht ?? 0), 0) ?? 0)

  // Historique normalisé pour le composant client (filtres)
  const histoItems: HistoItem[] = [
    ...(jours ?? []).map((j: any): HistoItem => ({
      id: `mad-${j.id}`, kind: 'mad',
      date: j.date, heure: null, jourSemaine: j.jour_semaine,
      clientNom: j.prestation?.dossier?.client?.nom ?? '—',
      dossierId: j.prestation?.dossier?.id ?? null,
      dossierNumero: j.prestation?.dossier?.numero ?? null,
      details: 'Journée complète' + (j.note ? `\n${j.note}` : ''),
      tarif: j.tarif_ht ?? 0, statut: j.statut,
    })),
    ...(transferts ?? []).map((t: any): HistoItem => ({
      id: `tr-${t.id}`, kind: 'transfert',
      date: t.date_debut, heure: t.heure_depart ?? null, jourSemaine: null,
      clientNom: t.dossier?.client?.nom ?? '—',
      dossierId: t.dossier?.id ?? null,
      dossierNumero: t.dossier?.numero ?? null,
      details: [t.adresse_depart, t.adresse_arrivee ? `→ ${t.adresse_arrivee}` : null].filter(Boolean).join('\n') || '—',
      tarif: t.tarif_fixe_ht ?? 0, statut: t.statut,
    })),
  ]

  return (
    <div>
      <div style={{ marginBottom:'20px' }}>
        <Link href="/dashboard/chauffeurs"
          style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#8a8478', textDecoration:'none' }}>
          <ArrowLeft size={13} /> Retour aux chauffeurs
        </Link>
      </div>

      <div className="detail-grid">

        {/* ── COLONNE PRINCIPALE ── */}
        <div>

          {/* Fiche chauffeur */}
          <div className="card" style={{ marginBottom:'16px' }}>
            <div style={{ background:'#16130e', padding:'12px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28' }}>FICHE CHAUFFEUR</span>
              <ChauffeurEditModal chauffeur={c} />
            </div>
            <div style={{ padding:'20px 22px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'16px', marginBottom:'18px' }}>
                {/* Avatar */}
                <div style={{
                  width:'56px', height:'56px', borderRadius:'50%', flexShrink:0,
                  background: st.bg, border:`2px solid ${st.color}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'18px', fontWeight:700, color: st.color,
                  fontFamily:'Cormorant Garamond,serif',
                }}>
                  {initials}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'26px', fontWeight:500, color:'#16130e', lineHeight:1 }}>
                    {c.prenom} {c.nom}
                  </div>
                  <div style={{ marginTop:'6px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:'5px',
                      padding:'3px 10px', fontSize:'10px', fontWeight:700,
                      background: st.bg, color: st.color, border:`1px solid ${st.color}33`,
                    }}>
                      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: st.color }} />
                      {st.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                <div>
                  <div className="form-label">Téléphone</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', fontWeight:500 }}>
                    <Phone size={12} style={{ color:'#8a8478' }} /> {c.telephone}
                  </div>
                </div>
                {c.email && (
                  <div>
                    <div className="form-label">Email</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
                      <Mail size={12} style={{ color:'#8a8478' }} /> {c.email}
                    </div>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div style={{ borderTop:'1.5px solid #d8d2c8', paddingTop:'14px' }}>
                <div className="form-label" style={{ marginBottom:'10px' }}>Documents & validités</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {docs.map(doc => <DocCard key={doc.label} label={doc.label} numero={doc.numero} status={doc.status} />)}
                </div>
              </div>

              {((c.langues?.length ?? 0) > 0 || (c.competences?.length ?? 0) > 0) && (
                <div style={{ borderTop:'1.5px solid #d8d2c8', paddingTop:'14px', marginTop:'14px' }}>
                  <div className="form-label" style={{ marginBottom:'8px' }}>Compétences</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                    {(c.langues ?? []).map((l: string) => (
                      <span key={l} style={{ fontSize:'11px', fontWeight:600, padding:'3px 10px', background:'#fdf6e3', color:'#9a7a28', border:'1px solid rgba(154,122,40,0.25)' }}>{LANGUES_LBL[l] ?? l}</span>
                    ))}
                    {(c.competences ?? []).map((k: string) => (
                      <span key={k} style={{ fontSize:'11px', fontWeight:600, padding:'3px 10px', background:'#e8eef8', color:'#1e3f70', border:'1px solid rgba(30,63,112,0.25)' }}>{COMP_LBL[k] ?? k}</span>
                    ))}
                  </div>
                </div>
              )}

              {c.notes && (
                <div style={{ marginTop:'14px', padding:'10px 12px', background:'#f5f2ed', border:'1px solid #d8d2c8', borderLeft:'3px solid #9a7a28' }}>
                  <div className="form-label" style={{ marginBottom:'4px' }}>Notes</div>
                  <p style={{ fontSize:'12px', color:'#5a564e', lineHeight:1.6, fontStyle:'italic' }}>{c.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Historique des prestations (avec filtres) ── */}
          <HistoriqueChauffeur items={histoItems} />

        </div>

        {/* ── SIDEBAR ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* Stats */}
          <div className="card">
            <div className="card-header"><span className="card-header-title">Statistiques</span></div>
            <div style={{ padding:'14px 16px' }}>
              {[
                { label:'Total prestations', value: nbMissions },
                { label:'Jours MAD',         value: jours?.length ?? 0 },
                { label:'Transferts',        value: transferts?.length ?? 0 },
                { label:'CA généré HT',      value: fmt(caTotal) },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #d8d2c8' }}>
                  <span style={{ fontSize:'11px', color:'#5a564e' }}>{s.label}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#16130e', fontWeight:400 }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes docs */}
          {(vtc.level === 'danger' || vtc.level === 'warn' || permis.level === 'danger' || permis.level === 'warn') && (
            <div className="card" style={{ borderColor:'#7a5c10' }}>
              <div style={{ background:'#7a5c10', padding:'9px 16px', display:'flex', alignItems:'center', gap:'6px' }}>
                <AlertTriangle size={13} color="#fff" />
                <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#fff' }}>
                  Documents à renouveler
                </span>
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'6px' }}>
                {(vtc.level === 'danger' || vtc.level === 'warn') && (
                  <div style={{ padding:'7px 10px', background:'#fdf3dc', borderLeft:'3px solid #7a5c10', fontSize:'11px', color:'#5a564e' }}>
                    <strong>Carte VTC</strong> — {vtc.label}
                  </div>
                )}
                {(permis.level === 'danger' || permis.level === 'warn') && (
                  <div style={{ padding:'7px 10px', background:'#fdf3dc', borderLeft:'3px solid #7a5c10', fontSize:'11px', color:'#5a564e' }}>
                    <strong>Permis</strong> — {permis.label}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Accès application chauffeur */}
          <AccesChauffeur chauffeurId={c.id} hasAccess={!!c.profile_id} email={c.email} />

          {/* Actions rapides */}
          <div className="card">
            <div className="card-header"><span className="card-header-title">Actions rapides</span></div>
            <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <a href={`tel:${c.telephone}`} className="btn-ghost"
                style={{ justifyContent:'center', gap:'8px', textDecoration:'none' }}>
                <Phone size={13} /> Appeler
              </a>
              {c.email && (
                <a href={`mailto:${c.email}`} className="btn-ghost"
                  style={{ justifyContent:'center', gap:'8px', textDecoration:'none' }}>
                  <Mail size={13} /> Envoyer un email
                </a>
              )}
              <Link href="/dashboard/planning" className="btn-primary" style={{ justifyContent:'center', textDecoration:'none' }}>
                + Affecter à une mission
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────

function DocCard({ label, numero, status }: { label: string; numero: string | null; status: ReturnType<typeof docStatus> }) {
  return (
    <div style={{
      padding:'12px 14px',
      background: status.level === 'danger' ? '#faeaea' : status.level === 'warn' ? '#fdf3dc' : '#f5f2ed',
      border: `1.5px solid ${status.level === 'danger' ? '#9e2a2a33' : status.level === 'warn' ? '#7a5c1033' : '#b8b0a4'}`,
    }}>
      <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'5px' }}>
        {label}
      </div>
      {numero && (
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#2e2b25', marginBottom:'4px' }}>{numero}</div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:600, color: status.color }}>
        {(status.level === 'danger' || status.level === 'warn') ? <AlertTriangle size={11} /> : status.level === 'ok' ? <CheckCircle size={11} /> : null}
        {status.label}
      </div>
    </div>
  )
}

