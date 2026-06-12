# Unified Inbox

A unified customer-messaging inbox for **Facebook Messenger**, **Instagram DMs**,
and **email**, built for a support team replying to customers with full thread
history.

- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres + Auth + Realtime)
- Vercel serverless friendly — no long-running processes; live UI updates come
  from Supabase Realtime
- Tailwind, minimal UI

The app **builds and runs with empty Meta/email credentials** — fill them in
later without code changes.

## Architecture

```
inbound                                outbound
Meta webhook ──┐                        ┌── lib/channels/messenger.ts ─┐
  (page)       │   normalize to ONE     │                              ├─ Graph API /me/messages
  (instagram)  ├─► shape, then          ├── lib/channels/instagram.ts ─┘
email webhook ─┘   lib/ingest.ts        └── lib/channels/email.ts ──── Resend
                   (channel-agnostic:        (selected by lib/channels/index.ts)
                    contacts / conversations / messages)
```

- **Adapter pattern** — each channel normalizes inbound traffic into one shape
  (`InboundMessage` in `lib/types.ts`) and routes outbound through `send()`.
  The core (`lib/ingest.ts`, the data model) never knows about channels'
  payload formats.
- **One Meta app, one webhook** — `/api/webhook` serves both Messenger and
  Instagram. The payload `object` field distinguishes them (`"page"` =
  messenger, `"instagram"` = instagram); `sender.id` is a PSID or IGSID.
- **Outbound window** (`lib/window.ts`, computed from
  `conversations.last_inbound_at`):

  | Time since last inbound | Result |
  |---|---|
  | < 24h | `messaging_type: RESPONSE` |
  | 24h – 7d | `messaging_type: MESSAGE_TAG` + tag `HUMAN_AGENT` |
  | > 7d | send blocked (HTTP 422, `templateRequired: true`) |

- **Email threading** — outbound emails set
  `Reply-To: support+<conversationId>@EMAIL_REPLY_DOMAIN` plus
  `In-Reply-To`/`References` headers; the inbound webhook parses the UUID out
  of the plus address to route replies into the right conversation.
- **RLS in Postgres** — an agent can SELECT/UPDATE a conversation and its
  messages only if `conversation.channel = ANY(agent.allowed_channels)`;
  `role = 'admin'` sees everything. Enforced by the policies in the migration,
  not by application code. (API routes use the service-role key, which
  bypasses RLS; the browser uses the anon key + the agent's session, which
  doesn't.)

## Setup order

### 1. Install

```bash
npm install
```

### 2. Create the Supabase project and schema

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of
   `supabase/migrations/0001_init.sql`, and run it.
3. Then run `supabase/migrations/0002_agent_profiles.sql` the same way —
   it adds agent avatars (`avatars` storage bucket) and self-service profile
   editing (name/photo only; role and channel access stay admin-managed),
   and is required by the `/profile` and `/dashboard` pages.

### 3. Create agent logins

1. **Authentication → Users → Add user** — create an email/password user.
2. Copy the user's UUID, then in the SQL editor:

```sql
insert into public.agents (id, email, name, role, allowed_channels) values
  ('<auth-user-uuid>', 'admin@example.com', 'Admin', 'admin',
   array['messenger','instagram','email']);

-- a restricted agent, e.g. email-only:
-- ('<other-uuid>', 'agent@example.com', 'Agent', 'agent', array['email']);
```

### 4. Environment

```bash
cp .env.example .env.local
```

Fill in the three Supabase values (**Project Settings → API**). Leave the Meta
and email values empty for now — the app runs without them; sending will
return a clear "not configured" error until they're set.

### 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with the agent's email/password.

### 6. Later: wire up the channels

**Meta (you'll do this yourself):**
- One Meta app with Messenger + Instagram products attached to your Page.
- Webhook callback URL: `https://<your-domain>/api/webhook`, verify token =
  `FB_VERIFY_TOKEN`. Subscribe to `messages` on both the **page** and
  **instagram** objects.
- Set `FB_APP_SECRET` and `FB_PAGE_ACCESS_TOKEN`.

**Email:**
- Point your inbound-email provider's webhook at
  `https://<your-domain>/api/email/inbound` (expects JSON
  `{ from, to, subject, text, headers }`; adapt the normalization in that
  route if your provider's shape differs).
- Set `EMAIL_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`,
  `EMAIL_REPLY_DOMAIN`. Inbound mail for `support+*@EMAIL_REPLY_DOMAIN` must
  be routed to the webhook.

## Testing the webhooks locally

**Meta webhook** (set `FB_APP_SECRET=devsecret` and `FB_VERIFY_TOKEN=devtoken`
in `.env.local` first):

```bash
# verification handshake
curl "http://localhost:3000/api/webhook?hub.mode=subscribe&hub.verify_token=devtoken&hub.challenge=42"

# inbound messenger message (signature computed over the exact raw body)
BODY='{"object":"page","entry":[{"messaging":[{"sender":{"id":"psid-123"},"message":{"mid":"m-1","text":"Hi, do you have these in 42?"}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac devsecret -hex | sed 's/^.* //')
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=$SIG" \
  -d "$BODY"
```

Use `"object":"instagram"` in the same payload shape to simulate an Instagram DM.

**Email inbound** (no signature needed in development when
`EMAIL_WEBHOOK_SECRET` is empty):

```bash
curl -X POST http://localhost:3000/api/email/inbound \
  -H "Content-Type: application/json" \
  -d '{"from":"Jane Doe <jane@example.com>","to":"support@yourdomain.com","subject":"Sizing question","text":"Do the loafers run small?","headers":{"Message-Id":"<abc@mail.example.com>"}}'
```

**Send** (will return `meta_not_configured` / `email_not_configured` until
credentials are set — that's expected):

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"<uuid>","text":"They fit true to size!","agentId":"<agent-uuid>"}'
```

## Deploying to Vercel

Add every variable from `.env.example` in the Vercel project settings. All
API routes declare `runtime = 'nodejs'`; Supabase clients are cached at module
scope so warm invocations reuse connections. No websocket server is needed —
the browser talks to Supabase Realtime directly.

## Project layout

```
app/
  (inbox)/page.tsx          inbox UI (list / thread / reply, Realtime)
  api/webhook/route.ts      Meta webhook: GET verify + POST (HMAC over raw body)
  api/email/inbound/route.ts generic email-provider webhook
  api/send/route.ts         outbound: window check -> adapter -> store
components/inbox/           ConversationList, ThreadView, ReplyBox, SignIn, badge
lib/
  channels/                 messenger / instagram / email adapters + router
  ingest.ts                 channel-agnostic inbound pipeline
  supabase.ts               cached server (service-role) + browser clients
  window.ts                 24h / 7d Meta send-window logic
  types.ts                  normalized shapes + DB row types
supabase/migrations/0001_init.sql   schema, record_inbound(), RLS, realtime
```

## Out of scope (not built yet)

App Review tooling, Facebook OAuth login, history backfill, analytics,
billing, bots/automations.
# unified-chat
