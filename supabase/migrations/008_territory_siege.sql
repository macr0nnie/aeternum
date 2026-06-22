-- =============================================================================
-- 008 — Territory siege: allow raids & captures by non-owners
-- =============================================================================
-- The base RLS only let an owner UPDATE their territory, so attack/raid/capture
-- (which change another player's territory health or ownership) silently failed.
-- This adds an UPDATE policy permitting any authenticated user to update a
-- territory (raid lowers health; winning capture sets owner_id). Authorization
-- of *what* a non-owner may change is enforced in app logic + the attack log.
--
-- NOTE: For production hardening, move siege resolution into a SECURITY DEFINER
-- edge function so clients can't set arbitrary health/owner. This open policy is
-- acceptable for the current local/dev build and keeps the loop playable.
-- =============================================================================

DROP POLICY IF EXISTS "territories_update" ON public.territories;

-- Owners can fully manage their own territory (upgrade, repair, rename, etc.).
CREATE POLICY "territories_update_owner" ON public.territories
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Any authenticated player may update a territory they do NOT own (raid/capture).
-- Pairs with an inserted row in territory_attacks recording the action.
CREATE POLICY "territories_update_attacker" ON public.territories
  FOR UPDATE TO authenticated
  USING (owner_id <> auth.uid());
