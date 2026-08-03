import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Wallet, ChevronRight } from 'lucide-react'
import { loadPaieChauffeurs } from '@/lib/paieData'
import { fmtEur, round2 } from '@/lib/salaireChauffeur'

export const dynamic = 'force-dynamic'

export default async function PaiePage() {
  const supabase = createClient()
  const chauffeurs = await loadPaieChauffeurs(supabase)

  const totalAcquis = round2(chauffeurs.reduce((s, c) => s + c.acquis, 0))
  const totalVerse = round2(chauffeurs.reduce((s, c) => s + c.verse, 0))
  const totalRestant = round2(totalAcquis - totalVerse)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
        <span className="section-title"><Wallet size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />Paie des chauffeurs</span>
      </div>

      {/* Récap global */}
      <div className="stat-grid-3" style={{ marginBottom: '10px' }}>
        {[
          { label: 'Salaire acquis (terminé)', val: fmtEur(totalAcquis), color: '#16130e' },
          { label: 'Versé', val: fmtEur(totalVerse), color: '#1e5e3a' },
          { label: 'Restant dû', val: totalRestant <= 0 ? '✓ Soldé' : fmtEur(totalRestant), color: totalRestant > 0 ? '#9e2a2a' : '#1e5e3a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e0d9cd', padding: '16px 18px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#63605a', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#63605a', marginBottom: '20px' }}>
        Salaire calculé sur les <strong>missions terminées</strong> (dates passées) : 200 €/jour MAD, 50 €/transfert, ajustables par jour et par transfert. Ouvre un chauffeur pour le détail et les versements.
      </div>

      {/* Liste mobile */}
      <div className="only-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {chauffeurs.map(c => (
          <Link key={c.id} href={`/dashboard/paie/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', background: '#fff', border: '1.5px solid #e4e6ea', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#16130e' }}>{c.prenom} {c.nom}</span>
              <ChevronRight size={16} color="#e4e6ea" />
            </div>
            <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '11px' }}>
              <span style={{ color: '#5a564e' }}>Acquis <strong style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtEur(c.acquis)}</strong></span>
              <span style={{ color: '#1e5e3a' }}>Versé <strong style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtEur(c.verse)}</strong></span>
              <span style={{ color: c.restant > 0 ? '#9e2a2a' : '#1e5e3a', marginLeft: 'auto' }}>Dû <strong style={{ fontFamily: 'JetBrains Mono,monospace' }}>{c.restant <= 0 ? '✓' : fmtEur(c.restant)}</strong></span>
            </div>
          </Link>
        ))}
      </div>

      {/* Table desktop */}
      <div className="table-container only-desktop">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead className="table-head">
            <tr>
              {['Chauffeur', 'Salaire acquis', 'Versé', 'Restant dû', ''].map((h, i) => (
                <th key={i} className="th" style={i % 2 === 1 ? { background: 'rgba(0,0,0,0.1)' } : {}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chauffeurs.length === 0 ? (
              <tr><td colSpan={5} className="td" style={{ textAlign: 'center', padding: '50px', color: '#63605a' }}>Aucun chauffeur.</td></tr>
            ) : chauffeurs.map(c => (
              <tr key={c.id} className="tr-body">
                <td className="td" style={{ background: 'rgba(154,122,40,0.04)' }}>
                  <Link href={`/dashboard/paie/${c.id}`} style={{ fontWeight: 600, color: '#16130e', textDecoration: 'none' }}>{c.prenom} {c.nom}</Link>
                  {!c.interne && <span style={{ fontSize: '9px', color: '#4a2a6e', background: '#f0ebfa', border: '1px solid rgba(74,42,110,0.2)', padding: '1px 5px', marginLeft: '8px', textTransform: 'uppercase' }}>Externe</span>}
                </td>
                <td className="td"><span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: 600 }}>{fmtEur(c.acquis)}</span></td>
                <td className="td"><span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#1e5e3a' }}>{fmtEur(c.verse)}</span></td>
                <td className="td"><span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', fontWeight: 700, color: c.restant > 0 ? '#9e2a2a' : '#1e5e3a' }}>{c.restant <= 0 ? '✓ Soldé' : fmtEur(c.restant)}</span></td>
                <td className="td" style={{ textAlign: 'right' }}>
                  <Link href={`/dashboard/paie/${c.id}`} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '10px', textDecoration: 'none' }}>Détail →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
