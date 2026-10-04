Seed and migrations

This folder contains SQL to seed a demo organization for local Supabase/Postgres testing.

To apply the demo seed to your local Supabase (pgcli/psql or supabase CLI):

Using `psql` (replace connection string):

```bash
psql "postgresql://postgres:postgres@localhost:5432/postgres" -f supabase/seed_demo.sql
```

Using `supabase` (if running in project directory):

```bash
supabase db reset --project-ref <your-ref> # BE CAREFUL: resets DB
supabase db remote set <connection-string>
psql <connection-string> -f supabase/seed_demo.sql
```

Notes:
- The seed creates an organization with a deterministic UUID and a few sources/grants.
- It doesn't create `auth.users`; create users via Supabase Auth UI or CLI and then insert into `public.memberships` linking to the organization.
- Adjust dates and amounts to suit your demo.
