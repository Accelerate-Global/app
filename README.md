# CSV Dataset Viewer

A Vercel-hosted Next.js app for authenticated CSV uploads, Supabase-backed CSV storage, persisted parsed rows, and shared table exploration.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase email/password authentication
- shadcn/ui with Base UI primitives
- Supabase Storage for raw CSV files
- Supabase Postgres with Drizzle for dataset metadata and JSONB row storage
- Papa Parse and TanStack Table for client-side ingestion and table controls

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (defaults to `datasets`)
- `DATASET_ADMIN_EMAIL` (defaults to `admin@example.com`)
- `DATABASE_URL`

Raw CSV files are stored in Supabase Storage. Uploads require a server-side
`SUPABASE_SERVICE_ROLE_KEY`, and only the configured dataset admin account can
create, update, or delete datasets. All signed-in users can browse shared
datasets and rows.

Apply the database schema:

```bash
pnpm db:push
```

Start the app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Vercel Setup

Use Supabase for Auth, Postgres, and Storage. After configuring project
environment variables in Vercel, pull them locally:

```bash
vercel env pull .env.local
```

The app starts unauthenticated users at `/` and sends authenticated users to `/dashboard`.

## Signup Allowlist

Only emails present in `public.signup_email_allowlist` can create accounts.
Add rows in Supabase before a user signs up:

```sql
insert into public.signup_email_allowlist (email, note)
values ('person@example.com', 'Initial access');
```

Check the current allowlist:

```sql
select email, note, created_at
from public.signup_email_allowlist
order by email;
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
