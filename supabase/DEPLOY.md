Deploying migrations + seed to Supabase

This document explains how to run the SQL migrations and demo seed against a Supabase/Postgres instance.

Required secret
- `SUPABASE_DB_URL` — a Postgres connection string that the workflow can use, e.g.: `postgres://postgres:password@db.example.supabase.co:5432/postgres`

Usage (GitHub Actions)
1. Go to the repository Settings → Secrets → Actions and add `SUPABASE_DB_URL` with your Supabase DB connection string (service role / admin connection).
2. Push to `main` or run the `Supabase Migrations & Seed` workflow manually from the Actions tab. The workflow runs all files in `supabase/migrations/*.sql` and then `supabase/seed_demo.sql`.

Local (manual) usage
You can run migrations locally with `psql`:

```bash
# replace with your connection string
export SUPABASE_DB_URL="postgres://postgres:password@localhost:5432/postgres"
for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_demo.sql
```

Notes and safety
- Use a service-role or admin DB connection that has privileges to create tables and functions.
- Running migrations on a production DB is destructive if migrations change schema — review SQL before running.
- Consider using CI environments (staging) first and automated backups before applying to production.

Rollbacks
- This workflow does not implement rollbacks. To roll back, write reverse migrations and apply them explicitly.
