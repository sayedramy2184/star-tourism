-- ═══════════════════════════════════════════════════════════════
--  STAR TOURISM SERVICES — Migration 009 — Tarifs dédiés client
--  Grille tarifaire propre à chaque client, chargée automatiquement
--  lors de la création d'un dossier.
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════

create table if not exists tarifs_clients (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  libelle     text not null,
  type        text not null check (type in ('transfert','mad')),
  categorie   text,                      -- catégorie véhicule (optionnelle)
  prix_ht     numeric(10,2) not null default 0,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tarifs_clients_client on tarifs_clients(client_id);

alter table tarifs_clients enable row level security;
drop policy if exists "tarifs_clients_all" on tarifs_clients;
create policy "tarifs_clients_all" on tarifs_clients
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
