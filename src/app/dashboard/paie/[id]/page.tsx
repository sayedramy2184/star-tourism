import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, Wallet } from 'lucide-react'
import { loadPaieChauffeurDetail } from '@/lib/paieData'
import { fmtEur } from '@/lib/salaireChauffeur'
import DossierPaieCard from '@/components/paie/DossierPaieCard'

export const dynamic = 'force-dynamic'

export default async function PaieChauffeurPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: c, error } = await supabase
    .from('chauffeurs').select('id, nom, prenom, statut, telephone').eq('id', params.id).single()
  if (error || !c) notFound()

  const paie = await loadPaieChauffeurDetail(supabase, params.id)

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/dashboard/paie" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8a8478', textDecoration: 'none' }}>
          <ArrowLeft size={13} /> Retour à la paie
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <span className="section-title"><Wallet size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />Paie · {c.prenom} {c.nom}</span>
        <Link href={`/dashboard/chauffeurs/${c.id}`} style={{ fontSize: '12px', color: '#1e3f70', textDecoration: 'none' }}>Voir la fiche →</Link>
      </div>

      {/* Récap global — missions terminées uniquement */}
      <div className="stat-grid-3" style={{ marginBottom: '10px' }}>
        {[
          { label: 'Salaire acquis (terminé)', val: fmtEur(paie.acquis), color: '#16130e' },
          { label: 'Versé', val: fmtEur(paie.verse), color: '#1e5e3a' },
          { label: 'Restant dû', val: paie.restant <= 0 ? '✓ Soldé' : fmtEur(paie.restant), color: paie.restant > 0 ? '#9e2a2a' : '#1e5e3a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e0d9cd', padding: '16px 18px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#8a8478', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#8a8478', marginBottom: '20px' }}>
        Le récap global ne compte que les <strong>prestations terminées</strong> (dates passées). Le détail par dossier ci-dessous montre l'ensemble des missions affectées ; clique sur « Modifier les tarifs » pour ajuster la rémunération jour par jour.
      </div>

      {/* Détail par dossier */}
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#9a7a28', marginBottom: '10px' }}>
        Détail par dossier
      </div>
      {paie.dossiers.length === 0 ? (
        <div className="card" style={{ padding: '30px', textAlign: 'center', color: '#8a8478', fontSize: '13px' }}>
          Aucune mission affectée à ce chauffeur.
        </div>
      ) : (
        paie.dossiers.map(d => (
          <DossierPaieCard key={d.dossierId} chauffeurId={c.id} dossier={d} dossierHref={`/dashboard/dossiers/${d.dossierId}`} />
        ))
      )}

      {/* Versements non rattachés à un dossier (héritage) */}
      {paie.versementsHorsDossier.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card-header"><span className="card-header-title">Versements non rattachés à un dossier</span></div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {paie.versementsHorsDossier.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: '#faf9f7', border: '1px solid #f4f5f7' }}>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: 600, color: '#1e5e3a' }}>{fmtEur(Number(p.montant))}</span>
                <span style={{ fontSize: '10px', color: '#8a8478' }}>{format(parseISO(p.date_paiement), 'dd/MM/yyyy', { locale: fr })}</span>
                {p.moyen && <span style={{ fontSize: '9px', color: '#5a564e', textTransform: 'uppercase' }}>{p.moyen}</span>}
                {p.note && <span style={{ fontSize: '10px', color: '#8a8478' }}>· {p.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
