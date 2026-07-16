-- Migration 014 — Recalcul auto des montants du dossier quand une prestation change
-- La fonction recalc_dossier() (migration 001) somme déjà les prestations où statut != 'annule'.
-- Il manquait juste de l'appeler à chaque insert/update/delete de prestation
-- (en particulier quand on passe une prestation en 'annule').

create or replace function recalc_dossier_on_prestation()
returns trigger language plpgsql as $$
begin
  perform recalc_dossier(coalesce(new.dossier_id, old.dossier_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists prestations_recalc_dossier on prestations;
create trigger prestations_recalc_dossier
  after insert or delete or update of statut, montant_ht, dossier_id on prestations
  for each row execute function recalc_dossier_on_prestation();

-- Recalcul immédiat de tous les dossiers existants (corrige les totaux hérités)
do $$
declare d record;
begin
  for d in select id from dossiers loop
    perform recalc_dossier(d.id);
  end loop;
end $$;
