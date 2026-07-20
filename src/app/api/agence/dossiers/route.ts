import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppAccount } from '@/lib/appAccount'
import { NextRequest, NextResponse } from 'next/server'
import { eachDayOfInterval, parseISO, format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOURS_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']

async function agencyAccount() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const account = await getAppAccount(supabase, user.id)
  if (!account || account.type !== 'agence') {
    return { error: NextResponse.json({ error: 'Accès réservé aux agences' }, { status: 403 }) }
  }
  return { account }
}

// GET — liste des dossiers de l'agence (avec prestations, chauffeur, véhicule, passagers)
export async function GET() {
  const a = await agencyAccount()
  if (a.error) return a.error
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('dossiers')
    .select(`
      id, numero, statut, origine, soumis_at, date_debut, date_fin, created_at, notes,
      montant_ht, montant_tva, montant_ttc,
      passagers(id, nom, nationalite, telephone, nb_bagages),
      prestations(
        id, type, statut, validation_statut, refus_motif, annulation_demandee,
        montant_ht, tarif_journalier_ht, tarif_fixe_ht, nb_jours, libelle, notes,
        date_debut, date_fin, heure_depart, heure_debut_journee, heure_fin_journee,
        adresse_depart, adresse_arrivee, modele_souhaite, nb_passagers, nb_bagages,
        vol_numero, vol_heure, vol_ville, vol_terminal,
        chauffeur:chauffeurs(nom, prenom, telephone),
        vehicule:vehicules(marque, modele, immatriculation),
        vehicule_ext:vehicules_ext(marque, modele),
        jours_mad(
          date,
          chauffeur:chauffeurs(nom, prenom, telephone),
          vehicule:vehicules(marque, modele, immatriculation),
          vehicule_ext:vehicules_ext(marque, modele)
        )
      )
    `)
    .eq('client_id', a.account.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — soumettre une nouvelle demande (dossier + prestations + passagers)
export async function POST(req: NextRequest) {
  const a = await agencyAccount()
  if (a.error) return a.error
  const admin = createAdminClient()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })

  const prestations: any[] = Array.isArray(body.prestations) ? body.prestations : []
  const passagers: any[] = Array.isArray(body.passagers) ? body.passagers : []
  if (prestations.length === 0) return NextResponse.json({ error: 'At least one service is required' }, { status: 400 })
  for (const p of prestations) {
    if (!p.type || !p.date_debut) return NextResponse.json({ error: 'Each service needs a type and a date' }, { status: 400 })
  }

  // company_id de l'agence
  const { data: client } = await admin.from('clients').select('company_id').eq('id', a.account.id).single()
  if (!client) return NextResponse.json({ error: 'Agence introuvable' }, { status: 404 })
  const company_id = client.company_id

  // Bornes du dossier
  const dates = prestations.flatMap(p => [p.date_debut, p.date_fin || p.date_debut])
  const date_debut = dates.reduce((a, b) => (a < b ? a : b))
  const date_fin = dates.reduce((a, b) => (a > b ? a : b))

  const { data: numData } = await admin.rpc('next_dossier_numero', { p_company_id: company_id })
  const numero = numData as string

  const { data: dossier, error: dErr } = await admin
    .from('dossiers')
    .insert({
      company_id, numero, client_id: a.account.id,
      date_debut, date_fin,
      statut: 'en_attente', origine: 'agence', soumis_at: new Date().toISOString(),
      notes: body.notes || null,
      montant_ht: 0, montant_tva: 0, montant_ttc: 0,
    })
    .select().single()
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  // Passagers
  if (passagers.length > 0) {
    const rows = passagers.filter(p => (p.nom || '').trim()).map(p => ({
      company_id, dossier_id: dossier.id, nom: String(p.nom).trim(),
      nationalite: p.nationalite || null, telephone: p.telephone || null, nb_bagages: Number(p.nb_bagages) || 0,
    }))
    if (rows.length) await admin.from('passagers').insert(rows)
  }

  // Prestations (sans prix — à valider par le dispatch)
  let ordre = 1
  for (const p of prestations) {
    const isMad = p.type === 'mad'
    const df = p.date_fin || p.date_debut
    const { data: presta, error: pErr } = await admin
      .from('prestations')
      .insert({
        company_id, dossier_id: dossier.id, ordre: ordre++, type: p.type,
        date_debut: p.date_debut, date_fin: isMad ? df : p.date_debut,
        heure_depart: !isMad ? (p.heure_depart || null) : null,
        heure_debut_journee: isMad ? (p.heure_debut_journee || null) : null,
        heure_fin_journee: isMad ? (p.heure_fin_journee || null) : null,
        adresse_depart: p.adresse_depart || null,
        adresse_arrivee: !isMad ? (p.adresse_arrivee || null) : null,
        vol_numero: p.vol_numero || null, vol_heure: p.vol_heure || null,
        vol_ville: p.vol_ville || null, vol_terminal: p.vol_terminal || null,
        modele_souhaite: p.modele_souhaite || null,
        nb_passagers: Number(p.nb_passagers) || 1, nb_bagages: Number(p.nb_bagages) || 0,
        statut: 'en_attente', validation_statut: 'a_valider',
        tarif_journalier_ht: isMad ? 0 : null, tarif_fixe_ht: !isMad ? 0 : null,
        montant_ht: 0,
      })
      .select('id').single()
    if (pErr) { console.error('presta agence:', pErr); continue }

    // Jours pour une MAD
    if (isMad) {
      try {
        const jours = eachDayOfInterval({ start: parseISO(p.date_debut), end: parseISO(df) }).map(d => ({
          company_id, prestation_id: presta.id,
          date: format(d, 'yyyy-MM-dd'), jour_semaine: JOURS_FR[d.getDay()],
          tarif_ht: 0, statut: 'en_attente',
        }))
        if (jours.length) await admin.from('jours_mad').insert(jours)
      } catch { /* dates invalides ignorées */ }
    }
  }

  return NextResponse.json({ data: { id: dossier.id, numero } }, { status: 201 })
}
