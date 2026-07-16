import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, Phone, Mail, MapPin, Building2, User } from 'lucide-react'
import TarifsClient from '@/components/clients/TarifsClient'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}
function fmtDate(d: string) { return format(new Date(d), 'dd/MM/yyyy', { locale: fr }) }

const DOSSIER_STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',  color: '#8a8478', bg: '#f5f2ed' },
  en_attente: { label: 'En attente', color: '#7a5c10', bg: '#fdf3dc' },
  en_cours:   { label: 'En cours',   color: '#1e3f70', bg: '#e8eef8' },
  termine:    { label: 'Terminé',    color: '#8a8478', bg: '#f5f2ed' },
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: c, error } = await supabase
    .from('clients').select('*').eq('id', params.id).single()
  if (error || !c) notFound()

  const { data: dossiers } = await supabase
    .from('dossiers')
    .select('id, numero, date_debut, date_fin, statut, montant_ht, nb_jours, prestations(id, statut, montant_ht)')
    .eq('client_id', params.id)
    .order('date_debut', { ascending: false })

  const D = dossiers ?? []
  // CA = prestations NON annulées
  const caTotal = D.reduce((s: number, d: any) =>
    s + (d.prestations ?? []).filter((p: any) => p.statut !== 'annule').reduce((a: number, p: any) => a + (p.montant_ht ?? 0), 0), 0)
  const ville = [c.code_postal, c.ville].filter(Boolean).join(' ')

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/dashboard/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8a8478', textDecoration: 'none' }}>
          <ArrowLeft size={13} /> Retour aux clients
        </Link>
      </div>

      <div className="detail-grid">
        {/* Colonne principale */}
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ background: '#16130e', padding: '12px 22px' }}>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9a7a28' }}>FICHE CLIENT</span>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                {(() => {
                  const ti = c.type === 'agence' ? { bg: '#fdf6e3', col: '#9a7a28', label: 'Agence partenaire' } : c.type === 'entreprise' ? { bg: '#e8eef8', col: '#1e3f70', label: 'Entreprise' } : { bg: '#eaf4ee', col: '#1e5e3a', label: 'Particulier' }
                  return (
                    <>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0, background: ti.bg, border: `2px solid ${ti.col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ti.col }}>
                        {c.type === 'particulier' ? <User size={22} /> : <Building2 size={22} />}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '26px', fontWeight: 500, color: '#16130e', lineHeight: 1 }}>{c.nom}</div>
                        <div style={{ fontSize: '11px', color: '#8a8478', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {ti.label}{c.contact_nom ? ` · ${c.contact_nom}` : ''}{c.pays && c.pays !== 'France' ? ` · ${c.pays}` : ''}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {c.telephone && <Info icon={<Phone size={13} />} label="Téléphone" value={c.telephone} />}
                {c.email && <Info icon={<Mail size={13} />} label="Email" value={c.email} />}
                {(c.adresse || ville) && <Info icon={<MapPin size={13} />} label="Adresse" value={[c.adresse, ville, c.pays && c.pays !== 'France' ? c.pays : null].filter(Boolean).join(', ')} />}
                {c.numero_tva && <Info icon={<Building2 size={13} />} label="N° TVA" value={c.numero_tva} mono />}
              </div>

              {c.notes && (
                <div style={{ marginTop: '14px', padding: '10px 12px', background: '#f5f2ed', borderLeft: '3px solid #9a7a28' }}>
                  <div className="form-label" style={{ marginBottom: '4px' }}>Notes</div>
                  <p style={{ fontSize: '12px', color: '#5a564e', lineHeight: 1.6, fontStyle: 'italic' }}>{c.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Dossiers du client */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="section-title">Dossiers ({D.length})</span>
            <Link href="/dashboard/dossiers/nouveau" className="btn-ghost" style={{ padding: '5px 12px', fontSize: '11px', textDecoration: 'none' }}>+ Nouveau dossier</Link>
          </div>
          {/* Liste mobile (cartes) */}
          <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {D.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Aucun dossier pour ce client</div>
            ) : D.map((d: any) => {
              const st = DOSSIER_STATUTS[d.statut] ?? DOSSIER_STATUTS.en_attente
              return (
                <Link key={d.id} href={`/dashboard/dossiers/${d.id}`} style={{ display: 'block', background: '#fff', border: '1.5px solid #b8b0a4', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '12px', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9a7a28' }}>{d.numero}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', color: st.color, background: st.bg }}>{st.label}</span>
                  </div>
                  <div className="mono" style={{ fontSize: '11px', color: '#5a564e', marginTop: '6px' }}>{fmtDate(d.date_debut)} → {fmtDate(d.date_fin)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
                    <span style={{ color: '#8a8478' }}>{d.prestations?.length ?? 0} prestation{(d.prestations?.length ?? 0) > 1 ? 's' : ''}</span>
                    <span className="mono" style={{ fontWeight: 700 }}>{fmt(d.montant_ht)}</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Table (desktop) */}
          <div className="table-container hidden md:block">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead className="table-head">
                <tr>{['N°', 'Période', 'Prestations', 'Montant HT', 'Statut', ''].map((h, i) => (
                  <th key={i} className="th" style={i % 2 === 1 ? { background: 'rgba(0,0,0,0.1)' } : {}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {D.length === 0 ? (
                  <tr><td colSpan={6} className="td" style={{ textAlign: 'center', padding: '40px', color: '#8a8478' }}>Aucun dossier pour ce client</td></tr>
                ) : D.map((d: any) => {
                  const st = DOSSIER_STATUTS[d.statut] ?? DOSSIER_STATUTS.en_attente
                  return (
                    <tr key={d.id} className="tr-body">
                      <td className="td"><span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#9a7a28' }}>{d.numero}</span></td>
                      <td className="td"><span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px' }}>{fmtDate(d.date_debut)} → {fmtDate(d.date_fin)}</span></td>
                      <td className="td">{d.prestations?.length ?? 0}</td>
                      <td className="td"><span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px' }}>{fmt(d.montant_ht)}</span></td>
                      <td className="td"><span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', color: st.color, background: st.bg }}>{st.label}</span></td>
                      <td className="td"><Link href={`/dashboard/dossiers/${d.id}`} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}>Ouvrir</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <TarifsClient clientId={c.id} />

          <div className="card">
            <div className="card-header"><span className="card-header-title">Statistiques</span></div>
            <div style={{ padding: '14px 16px' }}>
              {[
                { label: 'Dossiers', value: D.length },
                { label: 'En cours', value: D.filter((d: any) => d.statut === 'en_cours').length },
                { label: 'CA total HT', value: fmt(caTotal) },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #d8d2c8' }}>
                  <span style={{ fontSize: '11px', color: '#5a564e' }}>{s.label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#16130e' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-header-title">Actions rapides</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {c.telephone && <a href={`tel:${c.telephone}`} className="btn-ghost" style={{ justifyContent: 'center', gap: '8px', textDecoration: 'none' }}><Phone size={13} /> Appeler</a>}
              {c.email && <a href={`mailto:${c.email}`} className="btn-ghost" style={{ justifyContent: 'center', gap: '8px', textDecoration: 'none' }}><Mail size={13} /> Envoyer un email</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="form-label" style={{ marginBottom: '3px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#16130e', fontFamily: mono ? 'JetBrains Mono,monospace' : 'inherit' }}>
        <span style={{ color: '#8a8478', flexShrink: 0 }}>{icon}</span> {value}
      </div>
    </div>
  )
}
