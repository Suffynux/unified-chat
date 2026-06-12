-- 0002_agent_profiles.sql — agent avatars + self-service profile editing
-- Paste into the Supabase SQL editor (run AFTER 0001_init.sql).

-- ---------------------------------------------------------------------------
-- Avatar column
-- ---------------------------------------------------------------------------

alter table public.agents add column if not exists avatar_url text;

-- ---------------------------------------------------------------------------
-- Agents may update their OWN row, but only the profile columns.
-- role / allowed_channels / email stay admin-managed: the column-level grant
-- below means even a crafted request can't touch them.
-- ---------------------------------------------------------------------------

create policy agents_update_self on public.agents
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on table public.agents from authenticated;
grant update (name, avatar_url) on table public.agents to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for profile photos.
-- Public read; each agent can write only inside a folder named after their
-- own auth uid (avatars/<uid>/...).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

create policy "avatars insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
