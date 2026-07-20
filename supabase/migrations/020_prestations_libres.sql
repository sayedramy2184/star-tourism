-- ══════════════════════════════════════════════════════════════
--  Migration 020 — Prestations LIBRES (services hors transport)
--
--  Permet d'ajouter à un dossier des prestations facturables non liées
--  au transport (guide, billetterie, meet & greet, extras…) :
--  type = 'libre', avec un libellé et un tarif fixe.
--  Idempotente.
-- ══════════════════════════════════════════════════════════════

-- Étend la contrainte de type des prestations pour inclure 'libre'
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'prestations'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%''mad''%'
  loop
    execute 'alter table prestations drop constraint ' || quote_ident(c.conname);
  end loop;
end $$;
alter table prestations add constraint prestations_type_check
  check (type in ('mad','transfert','libre'));

-- Libellé de la prestation libre
alter table prestations add column if not exists libelle text;
