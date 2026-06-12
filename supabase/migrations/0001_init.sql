-- 0001_init.sql — unified inbox schema + RLS
-- Paste into the Supabase SQL editor (or run via supabase db push).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- agents.id mirrors auth.users.id: create the auth user first, then insert
-- the agent row with the same UUID. Channel access lives here and drives RLS.
create table public.agents (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  allowed_channels text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint agents_allowed_channels_valid
    check (allowed_channels <@ array['messenger', 'instagram', 'email'])
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('messenger', 'instagram', 'email')),
  -- PSID (messenger), IGSID (instagram), or email address
  external_id text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('messenger', 'instagram', 'email')),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  assignee_id uuid references public.agents (id) on delete set null,
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  unread_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index conversations_contact_idx on public.conversations (contact_id);
create index conversations_last_message_idx
  on public.conversations (last_message_at desc nulls last);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null default '',
  -- provider message id: Meta `mid` or email Message-ID
  external_id text,
  author text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
-- Hard dedupe for webhook retries.
create unique index messages_external_id_unique
  on public.messages (external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- Atomic inbound counter bump (called by lib/ingest.ts via rpc)
-- ---------------------------------------------------------------------------

create or replace function public.record_inbound(p_conversation_id uuid, p_at timestamptz)
returns void
language sql
as $$
  update public.conversations
  set last_inbound_at = p_at,
      last_message_at = p_at,
      unread_count = unread_count + 1,
      status = case when status = 'closed' then 'open' else status end
  where id = p_conversation_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS
--
-- An agent may see/update a conversation (and its messages) only if the
-- conversation's channel is in their allowed_channels; role='admin' sees
-- everything. Enforced here in Postgres, not in the application.
--
-- Helper functions are SECURITY DEFINER so the policy can consult the agents
-- table without recursing into the agents RLS policy itself.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agents a
    where a.id = auth.uid() and a.role = 'admin'
  );
$$;

create or replace function public.agent_can_access_channel(p_channel text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agents a
    where a.id = auth.uid()
      and (a.role = 'admin' or p_channel = any (a.allowed_channels))
  );
$$;

alter table public.agents enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- No insert/delete policies: writes go through API routes using the
-- service-role key, which bypasses RLS.

create policy agents_select on public.agents
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy contacts_select on public.contacts
  for select to authenticated
  using (public.agent_can_access_channel(channel));

create policy conversations_select on public.conversations
  for select to authenticated
  using (public.agent_can_access_channel(channel));

create policy conversations_update on public.conversations
  for update to authenticated
  using (public.agent_can_access_channel(channel))
  with check (public.agent_can_access_channel(channel));

create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.agent_can_access_channel(c.channel)
    )
  );

create policy messages_update on public.messages
  for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.agent_can_access_channel(c.channel)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.agent_can_access_channel(c.channel)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: broadcast inserts/updates to the UI. Subscriptions made with the
-- anon key + a user session respect the RLS policies above.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Example seed (run AFTER creating the auth user in Authentication > Users;
-- replace the UUID with that user's id):
--
-- insert into public.agents (id, email, name, role, allowed_channels) values
--   ('00000000-0000-0000-0000-000000000000', 'admin@example.com', 'Admin',
--    'admin', array['messenger','instagram','email']);
-- ---------------------------------------------------------------------------
