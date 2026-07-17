-- ──────────────────────────────────────────────
--  ÉLITE DRIVE — Migration 015
--  Logo de la société (paramètres)
--
--  Prérequis : la migration 003 doit être appliquée
--  (table societe_parametres + bucket 'societe-docs').
--  Idempotente.
-- ──────────────────────────────────────────────

-- ── Colonne logo (chemin Storage dans le bucket societe-docs) ──
alter table societe_parametres
  add column if not exists logo_path text;

-- Le logo est stocké dans le même bucket privé 'societe-docs' (déjà créé par la 003).
-- Aperçu via URL signée côté application.
