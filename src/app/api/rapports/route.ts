import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100 }

// GET /api/rapports?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })
  if (profile.role !== 'admin' && profile.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const now = new Date()
  const defFrom = `${now.getFullYear()}-01-01`
  const defTo = now.toISOString().slice(0, 10)
  const from = req.nextUrl.searchParams.get('from') || defFrom
  const to = req.nextUrl.searchParams.get('to') || defTo

  // ── Dossiers de la période (par date_debut) ──
  const { data: dossiers } = await supabase
    .from('dossiers')
    .select(`
      id, date_debut, montant_ht, statut,
      client:clients(id, nom),
      prestations(
        type, statut, chauffeur_id, sous_traitant_id, st_cout_ht, st_marge_ht, montant_ht,
        chauffeur:chauffeurs(id, nom, prenom),
        jours:jours_mad(chauffeur_id, chauffeur:chauffeurs(id, nom, prenom))
      )
    `)
    .gte('date_debut', from)
    .lte('date_debut', to)

  // ── Factures de la période (par date_emission) ──
  const { data: factures } = await supabase
    .from('factures')
    .select('statut, montant_ht, montant_ttc, date_emission')
    .gte('date_emission', from)
    .lte('date_emission', to)

  const D = dossiers ?? []
  const F = factures ?? []

  // Revenus (factures)
  const factNonAnnulees = F.filter(f => f.statut !== 'annulee')
  const factureTtc = r2(factNonAnnulees.reduce((s, f) => s + (f.montant_ttc ?? 0), 0))
  const encaisse   = r2(F.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.montant_ttc ?? 0), 0))
  const enAttente  = r2(factureTtc - encaisse)

  // CA dossiers + répartition prestations + sous-traitance
  let caDossiersHt = 0, nbTransfert = 0, nbMad = 0, stCout = 0, stMarge = 0, nbSousTraitees = 0
  const parClient = new Map<string, { nom: string; ca: number; dossiers: number }>()
  const parChauffeur = new Map<string, { nom: string; missions: number }>()
  const parMois = new Map<string, number>() // 'YYYY-MM' -> ca ht

  for (const d of D) {
    // CA = prestations NON annulées (exclut statut 'annule')
    const ht = ((d as any).prestations ?? [])
      .filter((p: any) => p.statut !== 'annule')
      .reduce((a: number, p: any) => a + (p.montant_ht ?? 0), 0)
    caDossiersHt += ht
    const client = Array.isArray((d as any).client) ? (d as any).client[0] : (d as any).client
    if (client) {
      const e = parClient.get(client.id) ?? { nom: client.nom, ca: 0, dossiers: 0 }
      e.ca += ht; e.dossiers += 1
      parClient.set(client.id, e)
    }
    const mois = (d as any).date_debut?.slice(0, 7)
    if (mois) parMois.set(mois, (parMois.get(mois) ?? 0) + ht)

    for (const p of ((d as any).prestations ?? [])) {
      if (p.statut === 'annule') continue   // ignorer les prestations annulées
      if (p.type === 'mad') nbMad++; else nbTransfert++
      if (p.sous_traitant_id) {
        nbSousTraitees++
        stCout += p.st_cout_ht ?? 0
        stMarge += p.st_marge_ht ?? 0
      }
      // Activité chauffeurs : transfert = 1 mission ; MAD = 1 mission par jour affecté
      const addCh = (ch: any) => {
        if (!ch) return
        const e = parChauffeur.get(ch.id) ?? { nom: `${ch.prenom} ${ch.nom}`, missions: 0 }
        e.missions += 1
        parChauffeur.set(ch.id, e)
      }
      if (p.type === 'transfert') {
        const ch = Array.isArray(p.chauffeur) ? p.chauffeur[0] : p.chauffeur
        addCh(ch)
      } else {
        for (const j of (p.jours ?? [])) {
          const ch = Array.isArray(j.chauffeur) ? j.chauffeur[0] : j.chauffeur
          addCh(ch)
        }
      }
    }
  }

  const topClients = Array.from(parClient.values()).sort((a, b) => b.ca - a.ca).slice(0, 10)
    .map(c => ({ ...c, ca: r2(c.ca) }))
  const activiteChauffeurs = Array.from(parChauffeur.values()).sort((a, b) => b.missions - a.missions)
  // Série mensuelle complète (mois vides à 0) entre from et to
  const serieMois: { mois: string; ca: number }[] = []
  {
    const start = new Date(from + 'T00:00:00'); start.setDate(1)
    const end = new Date(to + 'T00:00:00')
    const cur = new Date(start)
    while (cur <= end && serieMois.length < 36) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      serieMois.push({ mois: key, ca: r2(parMois.get(key) ?? 0) })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  return NextResponse.json({
    data: {
      periode: { from, to },
      revenus: { factureTtc, encaisse, enAttente },
      dossiers: {
        nb: D.length,
        caHt: r2(caDossiersHt),
        enCours: D.filter(d => (d as any).statut === 'en_cours').length,
        termines: D.filter(d => (d as any).statut === 'termine').length,
      },
      prestations: { nbTransfert, nbMad, total: nbTransfert + nbMad },
      sousTraitance: { nb: nbSousTraitees, cout: r2(stCout), marge: r2(stMarge) },
      topClients,
      activiteChauffeurs,
      serieMois,
    },
  })
}
