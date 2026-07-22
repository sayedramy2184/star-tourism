-- ══════════════════════════════════════════════════════════════
--  Migration 022 — Catégorie de la flotte = catégories configurables
--
--  vehicules.categorie n'est plus un enum figé : il stocke désormais
--  le NOM d'une catégorie (table vehicule_categories, migration 021).
--  On migre les anciennes valeurs snake_case vers les noms par défaut.
--  Idempotente. Prérequis : migration 021 appliquée.
-- ══════════════════════════════════════════════════════════════

-- 1. Supprimer l'ancienne contrainte enum (peu importe son nom)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'vehicules'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%categorie%'
  loop
    execute 'alter table vehicules drop constraint ' || quote_ident(c.conname);
  end loop;
end $$;

-- 2. Migrer les valeurs snake_case → noms configurés
update vehicules set categorie = case categorie
  when 'berline_standard' then 'Berline standard'
  when 'berline_premium'  then 'Berline premium'
  when 'berline_prestige' then 'Berline prestige'
  when 'van_minibus'      then 'Van / Minibus'
  when 'van_bagages'      then 'Van / Minibus'
  when 'suv_premium'      then 'SUV premium'
  when 'electrique'       then 'Électrique'
  else categorie
end
where categorie in ('berline_standard','berline_premium','berline_prestige','van_minibus','van_bagages','suv_premium','electrique');

-- 3. Défaut neutre (le formulaire fournit la catégorie)
alter table vehicules alter column categorie drop default;
