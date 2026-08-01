-- ─────────────────────────────────────────────
--  025 — Rémunération chauffeur par unité de travail
--  Le salaire chauffeur se règle désormais individuellement :
--    • par jour MAD          → jours_mad.remuneration_ht
--    • par transfert          → prestations.remuneration_ht
--  NULL = tarif par défaut (200 €/jour MAD, 50 €/transfert, défini côté app).
--  Remplace le modèle « tarif par dossier » (024) ; la table
--  salaire_chauffeur_dossier reste en place mais n'est plus utilisée.
-- ─────────────────────────────────────────────
alter table jours_mad   add column if not exists remuneration_ht numeric(10,2);
alter table prestations add column if not exists remuneration_ht numeric(10,2);
