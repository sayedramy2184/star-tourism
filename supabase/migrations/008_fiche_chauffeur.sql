-- ═══════════════════════════════════════════════════════════════
--  STAR TOURISM SERVICES — Migration 008 — Fiche chauffeur enrichie
--  Documents & validités, compétences/critères, infos contrat.
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════

alter table chauffeurs
  -- Coordonnées / identité
  add column if not exists matricule              text,
  add column if not exists adresse                text,
  add column if not exists code_postal            text,
  add column if not exists ville                  text,
  add column if not exists date_naissance         date,
  add column if not exists nationalite            text,
  -- Contrat
  add column if not exists interne                boolean default true,
  add column if not exists coefficient            numeric(6,2),
  add column if not exists date_embauche          date,
  -- Volet social — documents & validités
  add column if not exists visite_medicale_date   date,   -- dernière visite
  add column if not exists visite_medicale_expiry date,
  add column if not exists carte_sejour_numero    text,
  add column if not exists carte_sejour_expiry    date,
  add column if not exists carte_qualif_expiry    date,   -- carte qualification conducteur
  -- Compétences / critères
  add column if not exists langues                text[],  -- {francais,anglais,...}
  add column if not exists competences            text[];  -- {bodyguard,guide,secouriste,tpmr,permis_d}
