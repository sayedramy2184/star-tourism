# Star Tourism Services Drive — contexte projet (pour Claude Code)

Logiciel de gestion **VTC / chauffeurs** (agences étrangères → clients → missions).
Ce fichier est chargé automatiquement par Claude Code : il donne le contexte pour
continuer le travail depuis n'importe quel poste.

## Stack
- **Next.js 14** (App Router, `src/`) + **TypeScript** + **Tailwind** (styles surtout inline + classes dans `globals.css`).
- **Supabase** : Postgres + Auth + RLS. Client SSR (`@supabase/ssr`), client admin service-role côté API.
- PDF factures : `@react-pdf/renderer` (polices standard uniquement, pas d'emoji/Unicode exotique).
- `middleware.ts` est dans **`src/middleware.ts`** (obligatoire car app dans `src/`).

## Démarrage local
```bash
npm install            # .npmrc gère le conflit peer ESLint (legacy-peer-deps)
cp .env.example .env.local   # puis remplir les clés Supabase (jamais commité)
npm run dev
```
Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (opt.), `NEXT_PUBLIC_APP_URL`.

## ⚠️ Déploiement Vercel
Le **webhook GitHub→Vercel est cassé** : un `git push` ne déclenche PAS de déploiement.
→ Déployer manuellement : **`npx vercel --prod`** (après `npx vercel login` + `npx vercel link` la 1ʳᵉ fois).
Repo GitHub : `sayedramy2184/star-tourism`. À réparer un jour via Vercel → Settings → Git.

## ⚠️ Migrations base de données
Le projet **n'est pas lié à la CLI Supabase**. Les migrations `supabase/migrations/*.sql`
s'appliquent **à la main** : copier-coller dans **Supabase → SQL Editor → Run**, dans l'ordre.
Elles sont idempotentes. Dernière = **021**. Toujours vérifier que la prod est à jour
(001→021) après avoir ajouté une migration.
020 = prestations libres (services hors transport). 021 = `vehicule_categories` (catégories
+ modèles configurables dans Paramètres → Véhicules, utilisés par les formulaires + portail agence).
018 = portail agences (rôle 'agence', origine dossier, validation_statut prestations, RLS).
019 = demande d'annulation agence (`prestations.annulation_demandee`).
⚠️ Historique : la **003** avait été oubliée en prod (table `societe_parametres`) — appliquée le 2026-07-17.
015 = logo société (`logo_path`). 016 = comptes sous-traitants + RLS restrictive.
017 = fix heures sup : sans forfait assigné = pas d'heures sup (`update_jour_mad_montant`).

## Conventions importantes
- **Responsive** : sur chaque liste, un tableau (desktop) + des cartes (mobile).
  Utiliser les classes **`.only-desktop`** / **`.only-mobile`** (définies dans `globals.css`,
  `display:none !important` selon le breakpoint 768px). NE PAS utiliser `md:hidden` +
  `style` inline `display:flex` → le style inline gagne et casse le masquage.
- **Couleurs types de prestation** : MAD = **terracotta** `#a6432a` / fond `#f8ece7` ;
  Transfert = bleu `#1e3f70` / `#e8eef8` ; Externe = violet `#4a2a6e`. L'ambre `#7a5c10`
  reste réservé aux **statuts** (congé, maintenance, en retard) — ne pas confondre avec la MAD.
- **CA / chiffre d'affaires** : toujours exclure les prestations `statut = 'annule'`.
  Le trigger `recalc_dossier` (migration 001 + déclenché par 014) garde `dossiers.montant_ht`
  à jour en excluant les annulées.
- **Zoom mobile bloqué** via `viewport` (layout) + `touch-action` CSS + composant `NoZoom`.
  Ne PAS remettre de `preventDefault` sur `touchend` (ça casse les boutons en `onMouseDown`).

## Modules clés
- **Dossiers / Prestations** : agence = client facturé ; passagers nommés au niveau dossier
  (`passagers`), affectés aux prestations. Migration 010.
- **Planning** (`/dashboard/planning`) : gantt desktop (missions/chauffeurs/véhicules),
  agenda jour-par-jour sur mobile. Véhicule effectif d'un jour MAD = jour sinon prestation.
- **Véhicules / Loueurs** : parc + location (migration 011), loyer par période (jour/sem/mois).
  Loueurs = compta fournisseur : décompte (coût couru) − versements = solde (migrations 012).
- **Sous-traitants** : même principe décompte + versements (migration 013), en plus du
  paiement par prestation existant. **Comptes de connexion** (migration 016) : un sous-traitant
  peut avoir un accès à l'app mobile `/chauffeur` (fiche → « Créer l'accès »). L'app détecte
  le type de compte (chauffeur interne OU sous-traitant) via `getAppAccount` et filtre par
  `chauffeur_id` ou `sous_traitant_id`. RLS **restrictive** : un sous-traitant ne voit QUE
  ses missions. Il peut changer le statut (`/api/chauffeur/statut`) et saisir ses heures.
- **App chauffeur (PWA)** `/chauffeur` : 4 onglets (Aujourd'hui, À venir, Historique, Profil),
  détail mission complet (passagers, vol, notes, maps), saisie des heures réelles
  **verrouillée quand le dossier est validé** (`dossiers.valide_at`).

## Workflow multi-postes
`git pull` en arrivant, `git commit` + `git push` en partant. La base Supabase est partagée (cloud).
