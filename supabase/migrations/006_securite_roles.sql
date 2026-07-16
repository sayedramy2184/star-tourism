-- ═══════════════════════════════════════════════════════════════
--  ÉLITE DRIVE — Migration 006 — Sécurité des rôles
--  Empêche un utilisateur de se promouvoir admin (élévation verticale).
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Un utilisateur ne peut modifier QUE sa propre ligne (ou tout, s'il est admin).
drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update
  using (id = auth.uid() or my_role() = 'admin')
  with check (company_id = my_company_id());

-- Garde-fou : seul un admin peut changer le rôle ou la société d'un profil.
create or replace function guard_profiles_role()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role
      or new.company_id is distinct from old.company_id)
     and coalesce(my_role(), '') <> 'admin' then
    raise exception 'Modification du rôle ou de la société non autorisée';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard
  before update on profiles
  for each row execute function guard_profiles_role();
