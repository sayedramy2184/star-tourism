-- ══════════════════════════════════════════════════════════════
--  Migration 021 — Catégories de véhicules configurables (+ modèles)
--
--  Gérées dans Paramètres → Véhicules. Utilisées par les formulaires
--  de prestation (dispatch) et le portail agence pour la sélection du
--  véhicule souhaité (catégorie + modèle précis).
--  Idempotente.
-- ══════════════════════════════════════════════════════════════

create table if not exists vehicule_categories (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  nom         text not null,
  modeles     text[] not null default '{}',
  ordre       integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_vehicule_categories_company on vehicule_categories(company_id);

alter table vehicule_categories enable row level security;
drop policy if exists "vehicule_categories_all" on vehicule_categories;
create policy "vehicule_categories_all" on vehicule_categories
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- Lecture seule pour les agences (elles voient les catégories de leur société)
drop policy if exists "vehicule_categories_agence_read" on vehicule_categories;
create policy "vehicule_categories_agence_read" on vehicule_categories
  for select using (company_id = my_company_id());

-- ── Seed par défaut (si la société n'a encore aucune catégorie) ──
insert into vehicule_categories (company_id, nom, modeles, ordre)
select c.id, x.nom, x.modeles, x.ordre
from companies c
cross join (values
  ('Berline standard', array[]::text[], 1),
  ('Berline premium',  array['Mercedes Classe E','BMW Série 5','Audi A6'], 2),
  ('Berline prestige', array['Mercedes Classe S','BMW Série 7','Audi A8'], 3),
  ('Van / Minibus',    array['Mercedes Classe V','Mercedes Sprinter'], 4),
  ('SUV premium',      array['Mercedes GLE','BMW X5','Range Rover'], 5),
  ('Électrique',       array['Tesla Model S','Mercedes EQS'], 6)
) as x(nom, modeles, ordre)
where not exists (select 1 from vehicule_categories vc where vc.company_id = c.id);
