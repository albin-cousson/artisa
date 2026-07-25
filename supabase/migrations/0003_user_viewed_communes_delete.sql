-- Permet de retirer une commune du menu "Mes artisans" (suppression du lien
-- user <-> commune uniquement : la commune et ses artisans restent en cache
-- partagé, consultables gratuitement par tous, cf. src/actions/communes.ts).
create policy "user_viewed_communes_delete_own"
  on public.user_viewed_communes for delete
  to authenticated
  using (auth.uid() = user_id);
