-- Migration 012 — Loueurs (bailleurs de véhicules) & comptabilité fournisseur
-- On loue des véhicules AUPRÈS de loueurs. On suit : ce qu'on leur doit (coût couru
-- des locations) et les paiements qu'on leur verse (saisie libre) qui déduisent la dette.

-- 1. Table loueurs
create table if not exists loueurs (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  nom         text not null,
  contact_nom text,
  telephone   text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_loueurs_company on loueurs(company_id);
alter table loueurs enable row level security;
drop policy if exists "loueurs_all" on loueurs;
create policy "loueurs_all" on loueurs
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 2. Lien véhicule -> loueur
alter table vehicules add column if not exists loueur_id uuid references loueurs(id) on delete set null;
create index if not exists idx_vehicules_loueur_id on vehicules(loueur_id);

-- 3. Paiements versés aux loueurs (déduits de la dette)
create table if not exists paiements_loueur (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  loueur_id     uuid not null references loueurs(id) on delete cascade,
  montant       numeric(10,2) not null,
  date_paiement date not null default current_date,
  moyen         text,   -- virement | especes | cheque | carte | autre
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_paiements_loueur on paiements_loueur(loueur_id);
alter table paiements_loueur enable row level security;
drop policy if exists "paiements_loueur_all" on paiements_loueur;
create policy "paiements_loueur_all" on paiements_loueur
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
