import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { renderFactureBuffer } from '@/components/factures/FacturePDF'

export const dynamic = 'force-dynamic'
// @react-pdf/renderer nécessite le runtime Node (pas Edge)
export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const { data: facture, error } = await supabase
    .from('factures')
    .select(`
      numero, type, date_emission, date_echeance, montant_ht, taux_tva, montant_tva, montant_ttc, notes, statut,
      client:clients(nom, contact_nom, adresse, code_postal, ville, pays, email, telephone, numero_tva),
      dossier:dossiers(numero),
      lignes:lignes_facture(ordre, designation, description, reference, quantite, prix_unitaire_ht, montant_ht)
    `)
    .eq('id', params.id)
    .single()

  if (error || !facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const { data: societe } = await supabase
    .from('societe_parametres')
    .select('nom, forme_juridique, siret, numero_tva, adresse, code_postal, ville, telephone, email, site_web, iban, bic, banque, mentions_legales, conditions_paiement')
    .eq('company_id', profile.company_id)
    .maybeSingle()

  const client  = Array.isArray(facture.client) ? facture.client[0] : facture.client
  const dossier = Array.isArray(facture.dossier) ? facture.dossier[0] : facture.dossier
  const lignes  = [...(facture.lignes ?? [])].sort((a: any, b: any) => a.ordre - b.ordre)

  const buffer = await renderFactureBuffer({
    facture: {
      numero: facture.numero,
      type: (facture as any).type,
      date_emission: facture.date_emission,
      date_echeance: facture.date_echeance,
      montant_ht: facture.montant_ht,
      taux_tva: facture.taux_tva,
      montant_tva: facture.montant_tva,
      montant_ttc: facture.montant_ttc,
      notes: facture.notes,
      statut: facture.statut,
    },
    lignes,
    client: client ?? {
      nom: '', contact_nom: null, adresse: null, code_postal: null, ville: null,
      pays: null, email: null, telephone: null, numero_tva: null,
    },
    societe: societe ?? {
      nom: null, forme_juridique: null, siret: null, numero_tva: null, adresse: null,
      code_postal: null, ville: null, telephone: null, email: null, site_web: null,
      iban: null, bic: null, banque: null, mentions_legales: null, conditions_paiement: null,
    },
    dossierNumero: dossier?.numero ?? null,
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Facture-${facture.numero}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
