# ASA — setup

Everything here is optional except the two core keys. The app degrades
gracefully: anything you don't configure simply turns its feature off rather
than breaking.

## Required — translation and speech

Set on the **armenian-speaker-api** service:

| Variable | Where to get it |
| --- | --- |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |
| `AZURE_SPEECH_KEY` | Azure Portal → your Speech resource → Keys and Endpoint |
| `AZURE_SPEECH_REGION` | Same page (e.g. `eastus`) |
| `PUBLIC_APP_URL` | Your frontend URL, used for Stripe redirects |
| `FRONTEND_ORIGIN` | Your frontend URL, used for CORS |

Set on the **armenian-speaker-client** service:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | Your backend URL, e.g. `https://armenian-speaker-api.onrender.com` |

## Optional — Pro subscriptions (Stripe)

Take **both** values from the *same* Stripe environment (a sandbox, or live).
Mixing a sandbox key with a live price ID is the most common failure.

| Variable | Notes |
| --- | --- |
| `STRIPE_SECRET_KEY` | Starts with `sk_test_` (sandbox) or `sk_live_` |
| `STRIPE_PRICE_ID` | Starts with `price_` — **not** `prod_` |

Without these, the upgrade button reports that checkout isn't configured and
everything else keeps working.

## Optional — accounts and cross-device sync (Supabase)

Free tier is sufficient: 500 MB database, 50,000 monthly active users.

**If you skip this**, the app stores progress in the browser only, and the
Supabase client is tree-shaken out of the bundle entirely — it costs nothing.

### 1. Create the project

supabase.com → New project. Note the region and database password.

### 2. Create the table and lock it down

SQL Editor → New query → run this:

```sql
create table public.user_data (
  user_id    uuid primary key references auth.users on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "read own data"   on public.user_data
  for select using (auth.uid() = user_id);

create policy "insert own data" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "update own data" on public.user_data
  for update using (auth.uid() = user_id)
          with check (auth.uid() = user_id);
```

Row-level security is what actually keeps accounts separate — Postgres enforces
it on every query, so one user cannot read another's cards even if the frontend
code were wrong.

### 3. Turn off email confirmation

Authentication → Sign In / Providers → Email → disable **Confirm email**.

Supabase's built-in mail service is rate-limited to a handful of messages per
hour, which is fine for testing but would block real signups. Disabling
confirmation lets people sign up and study immediately with no mail server. If
you later add your own SMTP provider, turn confirmation back on.

### 4. Add the keys to the client

Project Settings → API:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | The **anon / public** key — never the service role key |

The anon key is meant to be public; it is safe in frontend code precisely
because RLS does the enforcement. The **service role key bypasses RLS** and must
never appear in the client.

Vite inlines env vars at build time, so changing these requires a rebuild, not
just a restart.

### Keeping the database awake

Free Supabase projects pause after 7 days with no database activity. Any real
usage prevents this. To be safe you can add a Supabase ping to
`.github/workflows/keep-alive.yml`, alongside the existing backend ping.

## Data and privacy notes

- Signing in syncs cards, decks and review history. It does **not** sync your
  Pro subscription — use *Already subscribed?* → restore by email on a new
  device.
- **Backup / Restore** works with or without an account. Restore *merges* rather
  than replaces, so importing an old backup never discards newer progress.
- Deleting a user in Supabase cascades to their synced row.
