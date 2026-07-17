-- ══════════════════════════════════════════════════════════════
--  ÉLITE DRIVE — Migration 017
--  Correctif calcul des heures sup côté MAD
--
--  Bug : sans forfait assigné, heures_incluses valait 0 → toutes les
--  heures travaillées étaient comptées en heures sup (ex. 10:00→17:00
--  = 7h affichait « 7h + 7h sup »).
--  Règle : pas de forfait (ni heures_incluses explicites) = PAS d'heures sup.
--  Idempotente.
-- ══════════════════════════════════════════════════════════════

create or replace function update_jour_mad_montant(p_jour_id uuid)
returns void language plpgsql as $$
declare
  v_debut time; v_fin time;
  v_has_ref boolean;
  v_incluses numeric(6,2); v_tarifsup numeric(10,2); v_base numeric(12,2);
  v_reelles numeric(6,2); v_sup numeric(6,2); v_msup numeric(10,2);
begin
  select j.heure_debut_reelle, j.heure_fin_reelle,
         (j.forfait_id is not null or j.heures_incluses is not null),
         coalesce(j.heures_incluses, f.heures_incluses, 0),
         coalesce(j.tarif_heure_sup, f.tarif_heure_sup, 0),
         coalesce(f.tarif_ht, j.tarif_ht, 0)
    into v_debut, v_fin, v_has_ref, v_incluses, v_tarifsup, v_base
  from jours_mad j
  left join forfaits_mad f on f.id = j.forfait_id
  where j.id = p_jour_id;

  if v_debut is null or v_fin is null then
    update jours_mad set heures_reelles = null, heures_sup = 0,
           montant_sup = 0, montant_total = coalesce(v_base, tarif_ht)
     where id = p_jour_id;
    return;
  end if;

  -- Heures réelles (gère le passage minuit)
  v_reelles := round(extract(epoch from (v_fin - v_debut)) / 3600.0
                     + case when v_fin < v_debut then 24 else 0 end, 2);

  -- Heures sup UNIQUEMENT si un forfait / des heures incluses sont définis
  if v_has_ref then
    v_sup := greatest(0, v_reelles - v_incluses);
  else
    v_sup := 0;
  end if;
  v_msup := round(v_sup * v_tarifsup, 2);

  update jours_mad set
    heures_reelles = v_reelles, heures_sup = v_sup,
    montant_sup = v_msup, montant_total = round(v_base + v_msup, 2)
  where id = p_jour_id;
end;
$$;

-- ── Recalcule les jours déjà saisis + les prestations concernées ──
do $$
declare r record;
begin
  for r in
    select id from jours_mad
    where heure_debut_reelle is not null and heure_fin_reelle is not null
  loop
    perform update_jour_mad_montant(r.id);
  end loop;

  for r in
    select distinct prestation_id from jours_mad
    where heure_debut_reelle is not null and heure_fin_reelle is not null
  loop
    perform recalc_prestation_mad(r.prestation_id);
  end loop;
end $$;
