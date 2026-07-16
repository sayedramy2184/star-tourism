-- ═══════════════════════════════════════════════════════════════
--  STAR TOURISM SERVICES — Migration 010 — Agences & Passagers
--  - Agence = type de client (partenaire étranger facturé)
--  - Passagers nommés au niveau de la mission (dossier)
--  - Compteurs passagers / bagages + affectation par prestation
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Type de client « agence » ───────────────
alter table clients drop constraint if exists clients_type_check;
alter table clients add constraint clients_type_check
  check (type in ('particulier','entreprise','agence'));

-- ── 2. Passagers (au niveau dossier) ───────────
create table if not exists passagers (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  dossier_id  uuid not null references dossiers(id) on delete cascade,
  nom         text not null,
  nationalite text,          -- code ISO 2 lettres (drapeau) ou texte libre
  telephone   text,
  nb_bagages  integer not null default 0,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_passagers_dossier on passagers(dossier_id);

alter table passagers enable row level security;
drop policy if exists "passagers_all" on passagers;
create policy "passagers_all" on passagers
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- ── 3. Compteurs & affectation passagers sur prestation ──
alter table prestations
  add column if not exists nb_passagers integer not null default 1,
  add column if not exists nb_bagages   integer not null default 0,
  add column if not exists passager_ids uuid[];    -- passagers affectés (sous-bloc B)
