-- ─────────────────────────────────────────────
--  024 — Paie chauffeur par dossier
--  • salaire_chauffeur_dossier : tarifs (jour MAD / transfert) modifiables
--    par couple (chauffeur, dossier). NULL = tarif par défaut (200 / 50, défini côté app).
--  • paiements_chauffeur.dossier_id : rattache un versement à un dossier (nullable).
-- ─────────────────────────────────────────────

create table if not exists salaire_chauffeur_dossier (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  chauffeur_id    uuid not null references chauffeurs(id) on delete cascade,
  dossier_id      uuid not null references dossiers(id) on delete cascade,
  tarif_jour      numeric(10,2),   -- null => défaut (200)
  tarif_transfert numeric(10,2),   -- null => défaut (50)
  note            text,
  updated_at      timestamptz not null default now(),
  unique(chauffeur_id, dossier_id)
);

create index if not exists idx_salaire_ch_dossier_chauffeur on salaire_chauffeur_dossier(chauffeur_id);

alter table salaire_chauffeur_dossier enable row level security;
drop policy if exists "salaire_chauffeur_dossier_all" on salaire_chauffeur_dossier;
create policy "salaire_chauffeur_dossier_all" on salaire_chauffeur_dossier
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- Rattachement d'un versement à un dossier
alter table paiements_chauffeur
  add column if not exists dossier_id uuid references dossiers(id) on delete set null;
create index if not exists idx_paiements_chauffeur_dossier on paiements_chauffeur(dossier_id);
