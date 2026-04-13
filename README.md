# CSV Dataset Viewer

A Vercel-hosted Next.js app for authenticated CSV uploads, private file storage, persisted parsed rows, and table exploration.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase email/password authentication
- shadcn/ui with Base UI primitives
- Vercel Blob for private CSV files
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
- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN` for Vercel Blob uploads

When `BLOB_READ_WRITE_TOKEN` is empty in local development, the app skips raw
Blob storage so you can still test CSV parsing and persisted rows. Production
uploads require a real Vercel Blob read/write token.

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

Use Supabase for Auth and Postgres, and Vercel Blob for private CSV files. After configuring project environment variables in Vercel, pull them locally:

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
