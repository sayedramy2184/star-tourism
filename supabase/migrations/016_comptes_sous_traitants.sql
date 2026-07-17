-- ══════════════════════════════════════════════════════════════
--  ÉLITE DRIVE — Migration 016
--  Comptes de connexion pour les SOUS-TRAITANTS (app chauffeur)
--
--  - Lien fiche sous-traitant ↔ compte auth (profile_id)
--  - Nouveau rôle 'sous_traitant'
--  - RLS RESTRICTIVE : un compte sous-traitant ne peut accéder QU'À
--    ses propres missions (et rien d'autre : ni finances, ni autres
--    clients/dossiers). Les rôles admin/dispatcher/chauffeur ne sont
--    PAS affectés (le service-role bypass la RLS de toute façon).
--  Idempotente.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Lien compte de connexion ───────────────
alter table sous_traitants
  add column if not exists profile_id uuid references profiles(id) on delete set null;
create unique index if not exists idx_sous_traitants_profile
  on sous_traitants(profile_id) where profile_id is not null;

-- ── 2. Nouveau rôle 'sous_traitant' ───────────
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute 'alter table profiles drop constraint ' || quote_ident(c.conname);
  end loop;
end $$;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','dispatcher','chauffeur','sous_traitant'));

-- ── 3. Helpers (SECURITY DEFINER pour éviter la récursion RLS) ──
create or replace function my_sous_traitant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from sous_traitants where profile_id = auth.uid()
$$;

create or replace function st_can_see_dossier(d_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from prestations p
    where p.dossier_id = d_id and p.sous_traitant_id = my_sous_traitant_id()
  ) or exists (
    select 1 from jours_mad j
    join prestations p on p.id = j.prestation_id
    where p.dossier_id = d_id and j.sous_traitant_id = my_sous_traitant_id()
  )
$$;

-- ── 4. Politiques RESTRICTIVES par table ──────
-- Principe : la politique est neutre (passe) pour tout rôle ≠ sous_traitant ;
-- pour un sous_traitant elle n'autorise que les lignes de ses missions.

-- Ses propres missions & données liées ---------------------------
drop policy if exists "st_scope_sous_traitants" on sous_traitants;
create policy "st_scope_sous_traitants" on sous_traitants as restrictive for all
  using  (my_role() is distinct from 'sous_traitant' or id = my_sous_traitant_id())
  with check (my_role() is distinct from 'sous_traitant' or id = my_sous_traitant_id());

drop policy if exists "st_scope_prestations" on prestations;
create policy "st_scope_prestations" on prestations as restrictive for all
  using  (my_role() is distinct from 'sous_traitant' or sous_traitant_id = my_sous_traitant_id())
  with check (my_role() is distinct from 'sous_traitant' or sous_traitant_id = my_sous_traitant_id());

drop policy if exists "st_scope_jours_mad" on jours_mad;
create policy "st_scope_jours_mad" on jours_mad as restrictive for all
  using  (my_role() is distinct from 'sous_traitant' or sous_traitant_id = my_sous_traitant_id())
  with check (my_role() is distinct from 'sous_traitant' or sous_traitant_id = my_sous_traitant_id());

drop policy if exists "st_scope_dossiers" on dossiers;
create policy "st_scope_dossiers" on dossiers as restrictive for all
  using  (my_role() is distinct from 'sous_traitant' or st_can_see_dossier(id))
  with check (my_role() is distinct from 'sous_traitant' or st_can_see_dossier(id));

drop policy if exists "st_scope_clients" on clients;
create policy "st_scope_clients" on clients as restrictive for all
  using  (my_role() is distinct from 'sous_traitant'
          or exists (select 1 from dossiers d where d.client_id = clients.id and st_can_see_dossier(d.id)))
  with check (my_role() is distinct from 'sous_traitant'
          or exists (select 1 from dossiers d where d.client_id = clients.id and st_can_see_dossier(d.id)));

drop policy if exists "st_scope_passagers" on passagers;
create policy "st_scope_passagers" on passagers as restrictive for all
  using  (my_role() is distinct from 'sous_traitant' or st_can_see_dossier(dossier_id))
  with check (my_role() is distinct from 'sous_traitant' or st_can_see_dossier(dossier_id));

-- Tout le reste : INTERDIT pour un sous_traitant -----------------
do $$
declare t text;
begin
  foreach t in array array[
    'chauffeurs','vehicules','vehicules_ext','factures','lignes_facture',
    'compteurs','paiements','tarifs_clients','forfaits_mad','loueurs',
    'paiements_loueur','paiements_sous_traitant','societe_parametres'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on %I', 'st_block_' || t, t);
      execute format(
        'create policy %I on %I as restrictive for all using (my_role() is distinct from ''sous_traitant'')',
        'st_block_' || t, t
      );
    end if;
  end loop;
end $$;
