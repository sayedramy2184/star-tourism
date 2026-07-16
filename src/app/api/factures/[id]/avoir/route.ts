import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/factures/[id]/avoir — crée un avoir (note de crédit) pour une facture émise
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const { data: orig } = await supabase
    .from('factures')
    .select('id, numero, type, statut, client_id, montant_ht, taux_tva, montant_tva, montant_ttc')
    .eq('id', params.id).single()
  if (!orig) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  if (orig.type === 'avoir') return NextResponse.json({ error: 'Un avoir ne peut pas être avoiré' }, { status: 400 })
  if (orig.statut === 'brouillon') return NextResponse.json({ error: 'Supprimez le brouillon plutôt que de créer un avoir' }, { status: 400 })
  if (orig.statut === 'annulee') return NextResponse.json({ error: 'Facture déjà annulée' }, { status: 400 })

  // Numéro d'avoir dédié
  const { data: numero, error: nErr } = await supabase
    .rpc('next_numero', { p_company_id: profile.company_id, p_type: 'avoir', p_prefix: 'AV' })
  if (nErr || !numero) return NextResponse.json({ error: 'Numérotation impossible' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  const { data: avoir, error: aErr } = await supabase
    .from('factures')
    .insert({
      company_id: profile.company_id,
      numero,
      type: 'avoir',
      facture_origine_id: orig.id,
      dossier_id: null,
      client_id: orig.client_id,
      statut: 'emise',
      date_emission: today,
      date_echeance: today,
      montant_ht: orig.montant_ht,
      taux_tva: orig.taux_tva,
      montant_tva: orig.montant_tva,
      montant_ttc: orig.montant_ttc,
      notes: `Avoir sur facture ${orig.numero}`,
    })
    .select()
    .single()
  if (aErr || !avoir) return NextResponse.json({ error: aErr?.message ?? 'Erreur création avoir' }, { status: 500 })

  // Reprend les lignes de la facture d'origine
  const { data: lignes } = await supabase
    .from('lignes_facture')
    .select('ordre, designation, description, reference, quantite, prix_unitaire_ht')
    .eq('facture_id', orig.id)
    .order('ordre')
  if (lignes && lignes.length > 0) {
    await supabase.from('lignes_facture').insert(lignes.map(l => ({ ...l, facture_id: avoir.id })))
  }

  // La facture d'origine est annulée par l'avoir
  await supabase.from('factures').update({ statut: 'annulee', updated_at: new Date().toISOString() }).eq('id', orig.id)

  return NextResponse.json({ data: avoir })
}
