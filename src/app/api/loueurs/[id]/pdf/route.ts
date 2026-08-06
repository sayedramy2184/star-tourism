import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { coutLocation } from '@/lib/coutLocation'
import { renderLoueurBuffer, type LoueurPDFVehicule } from '@/components/loueurs/LoueurPDF'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PERIODE_SUFFIX: Record<string, string> = { jour: '/jour', semaine: '/sem.', mois: '/mois' }
function loyerLabel(loyer: number | null, periode: string | null) {
  if (!loyer) return '-'
  const [ent, dec] = loyer.toFixed(2).split('.')
  return `${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec} EUR${PERIODE_SUFFIX[periode ?? 'mois'] ?? '/mois'}`
}
function fmtDate(d: string | null) {
  if (!d) return '-'
  const [y, m, j] = d.split('-')
  return j ? `${j}/${m}/${y}` : d
}
const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const { data: loueur, error } = await supabase
    .from('loueurs').select('nom, contact_nom, telephone, email, notes').eq('id', params.id).single()
  if (error || !loueur) return NextResponse.json({ error: 'Loueur introuvable' }, { status: 404 })

  const [{ data: vehicules }, { data: paiements }, { data: societe }] = await Promise.all([
    supabase.from('vehicules')
      .select('marque, modele, immatriculation, loyer_ht, loyer_periode, contrat_debut, contrat_fin, date_entree_parc, date_sortie_parc, mode_acquisition')
      .eq('loueur_id', params.id).order('marque'),
    supabase.from('paiements_loueur')
      .select('montant, date_paiement, moyen, note').eq('loueur_id', params.id).order('date_paiement', { ascending: false }),
    supabase.from('societe_parametres')
      .select('nom, adresse, code_postal, ville, telephone, email, siret, numero_tva, mentions_legales')
      .eq('company_id', profile.company_id).maybeSingle(),
  ])

  const today = new Date()
  const vehLignes: LoueurPDFVehicule[] = (vehicules ?? []).map((v: any) => {
    const c = coutLocation(v, today)
    return {
      vehicule: `${v.marque ?? ''} ${v.modele ?? ''}`.trim() || '-',
      immatriculation: v.immatriculation ?? null,
      loyer: loyerLabel(v.loyer_ht, v.loyer_periode),
      depuis: fmtDate(c.debut),
      jours: c.joursCourus || 0,
      coutCouru: c.coutCouru,
      actif: c.actif,
    }
  })

  const coutCouru = r2(vehLignes.reduce((s, v) => s + v.coutCouru, 0))
  const paye = r2((paiements ?? []).reduce((s: number, p: any) => s + Number(p.montant ?? 0), 0))
  const solde = r2(coutCouru - paye)

  const buffer = await renderLoueurBuffer({
    loueur: {
      nom: loueur.nom, contact_nom: loueur.contact_nom ?? null, telephone: loueur.telephone ?? null,
      email: loueur.email ?? null, adresse: null, notes: loueur.notes ?? null,
    },
    vehicules: vehLignes,
    paiements: (paiements ?? []).map((p: any) => ({ montant: Number(p.montant ?? 0), date_paiement: p.date_paiement, moyen: p.moyen, note: p.note })),
    totals: { coutCouru, paye, solde },
    societe: societe ?? {
      nom: null, adresse: null, code_postal: null, ville: null, telephone: null, email: null,
      siret: null, numero_tva: null, mentions_legales: null,
    },
    dateEdition: today.toISOString().slice(0, 10),
  })

  const nomFichier = (loueur.nom || 'loueur').replace(/[^a-zA-Z0-9]+/g, '-')
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Decompte-${nomFichier}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
