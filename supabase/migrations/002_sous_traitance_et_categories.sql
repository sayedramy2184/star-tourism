-- ──────────────────────────────────────────────
--  ÉLITE DRIVE — Migration 002
--  Sous-traitance sur prestations + catégorie « Van Bagages »
--
--  Réconcilie le schéma avec le code applicatif :
--  - affectation d'un sous-traitant sur une prestation (coût / marge / paiement)
--  - affectation d'un sous-traitant sur un jour de MAD
--  - nouvelle catégorie de véhicule « van_bagages »
-- ──────────────────────────────────────────────

-- ── 1. Catégorie véhicule « van_bagages » ──────
alter table vehicules drop constraint if exists vehicules_categorie_check;
alter table vehicules add constraint vehicules_categorie_check
  check (categorie in (
    'berline_standard','berline_premium','berline_prestige',
    'van_minibus','van_bagages','suv_premium','electrique'
  ));

-- ── 2. Sous-traitance sur les prestations ──────
alter table prestations
  add column if not exists sous_traitant_id       uuid references sous_traitants(id) on delete set null,
  add column if not exists st_chauffeur_nom        text,
  add column if not exists st_chauffeur_telephone  text,
  add column if not exists st_vehicule_marque      text,
  add column if not exists st_vehicule_modele      text,
  add column if not exists st_vehicule_immat       text,
  add column if not exists st_cout_ht              numeric(12,2),
  add column if not exists st_marge_ht             numeric(12,2),
  add column if not exists st_paiement_statut      text default 'non_paye'
                                                   check (st_paiement_statut in ('non_paye','paye')),
  add column if not exists st_paiement_date        date,
  add column if not exists st_paiement_ref         text;

create index if not exists idx_prestations_sous_traitant on prestations(sous_traitant_id);

-- ── 3. Sous-traitance sur les jours de MAD ─────
alter table jours_mad
  add column if not exists sous_traitant_id uuid references sous_traitants(id) on delete set null;

create index if not exists idx_jours_mad_sous_traitant on jours_mad(sous_traitant_id);
