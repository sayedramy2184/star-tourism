import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { BoutonModifierDossier, BoutonAjoutPrestation, BoutonAffecterVehicule, BoutonValiderDossier, BoutonSupprimerDossier } from '@/components/dossiers/DossierActions'
import PrestationCard from '@/components/dossiers/PrestationCard'
import GenererFactureButton from '@/components/factures/GenererFactureButton'
import PassagersDossier from '@/components/dossiers/PassagersDossier'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(n)
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

function StatusBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; color: string; dot: string }> = {
    brouillon:  { label:'Brouillon',  color:'#8a8478', dot:'#c2bdb4' },
    en_attente: { label:'En attente', color:'#7a5c10', dot:'#7a5c10' },
    confirme:   { label:'Confirmé',   color:'#1e5e3a', dot:'#1e5e3a' },
    en_cours:   { label:'En cours',   color:'#1e3f70', dot:'#1e3f70' },
    termine:    { label:'Terminé',    color:'#8a8478', dot:'#c2bdb4' },
    annule:     { label:'Annulé',     color:'#9e2a2a', dot:'#9e2a2a' },
  }
  const s = map[statut] ?? map.brouillon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:700, color:s.color }}>
      <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:s.dot, flexShrink:0 }} />
      {s.label}
    </span>
  )
}

export default async function DossierDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('dossiers')
    .select(`
      *,
      client:clients(*),
      passagers(id, nom, nationalite, telephone, nb_bagages),
      prestations(
        *,
        vehicule:vehicules(id, marque, modele, immatriculation),
        vehicule_ext:vehicules_ext(id, marque, modele, immatriculation, loueur, cout_ht),
        chauffeur:chauffeurs(id, nom, prenom),
        sous_traitant:sous_traitants(id, societe, contact_nom, telephone),
        jours:jours_mad(
          *, chauffeur:chauffeurs(id, nom, prenom),
          vehicule:vehicules(id, marque, modele, immatriculation)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) notFound()

  // Trier
  const prestations = (data.prestations ?? []).sort((a: any, b: any) => a.ordre - b.ordre)
  prestations.forEach((p: any) => {
    if (p.jours) p.jours.sort((a: any, b: any) => a.date.localeCompare(b.date))
  })

  // Alertes
  const alertes: string[] = []
  prestations.forEach((p: any) => {
    if (p.type === 'mad' && p.jours) {
      const manquants = p.jours.filter((j: any) => !j.chauffeur_id)
      if (manquants.length > 0)
        alertes.push(`P-0${p.ordre} · ${manquants.length} jour(s) sans chauffeur`)
    }
    if (p.affectation_differee)
      alertes.push(`P-0${p.ordre} · Véhicule non affecté`)
    if (p.vehicule_ext)
      alertes.push(`P-0${p.ordre} · Véhicule externe à confirmer (${p.vehicule_ext.loueur ?? 'loueur'})`)
  })

  // Coûts externes
  const couts_ext = prestations.reduce((s: number, p: any) =>
    s + (p.vehicule_ext?.cout_ht ?? 0), 0)

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom:'20px' }}>
        <Link href="/dashboard/dossiers"
          style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#8a8478', textDecoration:'none' }}
          className="hover:text-noir">
          <ArrowLeft size={13} /> Retour aux dossiers
        </Link>
      </div>

      <div className="detail-grid">

        {/* ── COLONNE PRINCIPALE ── */}
        <div>

          {/* Header card */}
          <div className="card" style={{ marginBottom:'16px' }}>
            <div style={{ background:'#16130e', padding:'12px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'13px', color:'#9a7a28' }}>{data.numero}</span>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                <BoutonValiderDossier
                  dossierId={data.id}
                  statut={data.statut}
                  numero={data.numero}
                />
                <BoutonModifierDossier dossier={{
                  id: data.id,
                  client_id: data.client_id,
                  date_debut: data.date_debut,
                  date_fin: data.date_fin,
                  statut: data.statut,
                  notes: data.notes,
                }} />
                <BoutonSupprimerDossier
                  dossierId={data.id}
                  statut={data.statut}
                  numero={data.numero}
                />
                <GenererFactureButton dossierId={data.id} variant="header" />
              </div>
            </div>
            <div style={{ padding:'18px 22px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px' }}>
                <div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'24px', fontWeight:500, color:'#16130e' }}>
                    {data.client?.nom}
                  </div>
                  <div style={{ fontSize:'11px', color:'#5a564e', marginTop:'3px' }}>
                    {data.client?.contact_nom && `${data.client.contact_nom} · `}
                    {data.client?.email && `${data.client.email} · `}
                    {data.client?.telephone}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'5px' }}>
                    Période du dossier
                  </div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'18px', color:'#16130e' }}>
                    {fmtDate(data.date_debut)} → {fmtDate(data.date_fin)}
                  </div>
                  <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28', marginTop:'3px' }}>
                    {data.nb_jours} jours · {prestations.length} prestation{prestations.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Meta strip */}
              <div style={{ display:'flex', flexWrap:'wrap', borderTop:'1.5px solid #d8d2c8' }}>
                {[
                  { label:'Statut',      val: <StatusBadge statut={data.statut} /> },
                  { label:'Montant HT',  val: <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9a7a28' }}>{fmt(data.montant_ht)}</span> },
                  { label:'TVA 10%',     val: <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>{fmt(data.montant_tva)}</span> },
                  { label:'Total TTC',   val: <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', fontWeight:700 }}>{fmt(data.montant_ttc)}</span> },
                  { label:'Facturation', val: <span style={{ fontSize:'11px', fontWeight:600, color:'#7a5c10' }}>Non facturé</span> },
                ].map((m, i) => (
                  <div key={m.label} style={{ flex:1, minWidth:'120px', padding:'10px 16px', borderRight: i < 4 ? '1px solid #d8d2c8' : 'none' }}>
                    <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#8a8478', marginBottom:'4px' }}>{m.label}</div>
                    <div>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Passagers */}
          <div style={{ marginBottom:'16px' }}>
            <PassagersDossier dossierId={data.id} />
          </div>

          {/* Prestations */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <span className="section-title">Prestations</span>
            <BoutonAjoutPrestation
              dossierId={data.id}
              dateDebutDossier={data.date_debut}
              dateFinDossier={data.date_fin}
            />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {prestations.map((p: any) => (
              <PrestationCard key={p.id} p={p} dossierId={data.id} passagers={data.passagers ?? []} />
            ))}
          </div>

          {data.notes && (
            <div className="card" style={{ marginTop:'16px', padding:'16px' }}>
              <div style={{ fontSize:'8px', fontWeight:600, letterSpacing:'2.5px', textTransform:'uppercase', color:'#8a8478', marginBottom:'8px' }}>Notes internes</div>
              <p style={{ fontSize:'11px', color:'#5a564e', lineHeight:1.7, fontStyle:'italic' }}>{data.notes}</p>
            </div>
          )}

        </div>

        {/* ── SIDEBAR DROITE ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* Alertes */}
          {alertes.length > 0 && (
            <div className="card" style={{ borderColor:'#7a5c10' }}>
              <div style={{ background:'#7a5c10', padding:'9px 16px', display:'flex', alignItems:'center', gap:'6px' }}>
                <AlertTriangle size={13} color="#fff" />
                <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:'#fff' }}>
                  Alertes ({alertes.length})
                </span>
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'6px' }}>
                {alertes.map((a, i) => (
                  <div key={i} style={{ padding:'7px 10px', background:'#fdf3dc', borderLeft:'3px solid #7a5c10', fontSize:'11px', color:'#5a564e' }}>
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Récap financier */}
          <div className="card">
            <div className="card-header"><span className="card-header-title">Récapitulatif financier</span></div>
            <div style={{ padding:'14px 16px' }}>
              {prestations.map((p: any) => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #d8d2c8' }}>
                  <span style={{ fontSize:'10px', color:'#5a564e' }}>
                    P-0{p.ordre} · {p.type === 'mad' ? `MAD ${p.jours?.length ?? p.nb_jours}j` : 'Transfert'}
                  </span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>{fmt(p.montant_ht)}</span>
                </div>
              ))}

              {couts_ext > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #d8d2c8' }}>
                  <span style={{ fontSize:'10px', color:'#9e2a2a' }}>— Coûts ext.</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#9e2a2a' }}>− {fmt(couts_ext)}</span>
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #d8d2c8', marginTop:'4px', borderTop:'1.5px solid #b8b0a4' }}>
                <span style={{ fontSize:'10px', color:'#5a564e' }}>Sous-total HT</span>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>{fmt(data.montant_ht)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #d8d2c8' }}>
                <span style={{ fontSize:'10px', color:'#5a564e' }}>TVA 10%</span>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px' }}>{fmt(data.montant_tva)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 4px' }}>
                <span style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>Total TTC</span>
                <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'20px', color:'#9a7a28' }}>{fmt(data.montant_ttc)}</span>
              </div>

              {couts_ext > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:'1px solid #d8d2c8', marginTop:'6px' }}>
                  <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:'#8a8478' }}>Marge nette</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px', color:'#1e5e3a' }}>
                    + {fmt(data.montant_ht - couts_ext)}
                  </span>
                </div>
              )}

              <GenererFactureButton dossierId={data.id} variant="sidebar" />
            </div>
          </div>

          {/* Chronologie */}
          <div className="card">
            <div className="card-header"><span className="card-header-title">Chronologie</span></div>
            <div style={{ padding:'14px 16px' }}>
              {prestations.map((p: any, i: number) => (
                <div key={p.id} style={{ display:'flex', gap:'10px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'10px', flexShrink:0 }}>
                    <div style={{
                      width:'8px', height:'8px', borderRadius:'50', marginTop:'3px', flexShrink:0,
                      background: p.type === 'mad' ? '#a6432a' : '#1e3f70',
                      border: '1.5px solid',
                      borderColor: p.type === 'mad' ? '#a6432a' : '#1e3f70',
                    }} />
                    {i < prestations.length - 1 && (
                      <div style={{ width:'1px', flex:1, background:'#d8d2c8', marginTop:'3px', minHeight:'16px' }} />
                    )}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'11px', fontWeight:600, color:'#16130e' }}>
                      {p.type === 'mad' ? 'Mise à disposition' : 'Transfert'}
                    </div>
                    <div style={{ fontSize:'10px', color:'#5a564e' }}>
                      {p.type === 'mad'
                        ? `${fmtDate(p.date_debut)} → ${fmtDate(p.date_fin)} · ${p.jours?.length ?? p.nb_jours}j`
                        : `${fmtDate(p.date_debut)}${p.heure_depart ? ` · ${p.heure_depart}` : ''}`}
                    </div>
                    {p.adresse_depart && (
                      <div style={{ fontSize:'10px', color:'#8a8478', marginTop:'1px' }}>
                        {p.adresse_depart}{p.adresse_arrivee ? ` → ${p.adresse_arrivee}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
